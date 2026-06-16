import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { itemsApi } from "../../api/resources.ts";
import type { KnowledgeVersionView } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary, ErrorNotice } from "../../components/AsyncBoundary.tsx";
import { VersionDiff } from "../../components/VersionDiff.tsx";

// Version history: list every version, pick two to diff, and roll back to an older one.
// Rollback creates a new version from the chosen one (the backend appends, never rewrites).
export function VersionHistoryPage(): JSX.Element {
  const { itemId } = useParams<{ itemId: string }>();
  const state = useAsync(
    () => (itemId === undefined ? Promise.resolve({ versions: [] }) : itemsApi.versions(itemId)),
    [itemId],
  );

  const [leftNumber, setLeftNumber] = useState<number | null>(null);
  const [rightNumber, setRightNumber] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const versions = state.data?.versions ?? [];

  useEffect(() => {
    if (versions.length >= 2) {
      setLeftNumber(versions[versions.length - 2]!.versionNumber);
      setRightNumber(versions[versions.length - 1]!.versionNumber);
    } else if (versions.length === 1) {
      setLeftNumber(versions[0]!.versionNumber);
      setRightNumber(versions[0]!.versionNumber);
    }
  }, [state.data]);

  const find = (versionNumber: number | null): KnowledgeVersionView | undefined =>
    versions.find((version) => version.versionNumber === versionNumber);

  const rollback = async (versionNumber: number): Promise<void> => {
    if (itemId === undefined) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await itemsApi.rollback(itemId, versionNumber);
      setNotice(`Rolled back to version ${versionNumber}.`);
      state.reload();
    } catch (caught) {
      setError(caught);
    }
  };

  const left = find(leftNumber);
  const right = find(rightNumber);

  return (
    <section>
      <h2>Version history</h2>
      {error !== null ? <ErrorNotice error={error} /> : null}
      {notice !== null ? <p className="notice notice--ok">{notice}</p> : null}

      <AsyncBoundary loading={state.loading} error={state.error}>
        <table className="table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Title</th>
              <th>Author</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {versions.map((version) => (
              <tr key={version.versionNumber}>
                <td>{version.versionNumber}</td>
                <td>{version.title}</td>
                <td>{version.createdBy}</td>
                <td>{version.createdAt}</td>
                <td>
                  <button type="button" onClick={() => void rollback(version.versionNumber)}>
                    Roll back to this
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {versions.length > 0 ? (
          <div className="card">
            <h3>Compare versions</h3>
            <div className="filters">
              <select
                aria-label="Left version"
                value={leftNumber ?? ""}
                onChange={(event) => setLeftNumber(Number(event.target.value))}
              >
                {versions.map((version) => (
                  <option key={version.versionNumber} value={version.versionNumber}>
                    v{version.versionNumber}
                  </option>
                ))}
              </select>
              <select
                aria-label="Right version"
                value={rightNumber ?? ""}
                onChange={(event) => setRightNumber(Number(event.target.value))}
              >
                {versions.map((version) => (
                  <option key={version.versionNumber} value={version.versionNumber}>
                    v{version.versionNumber}
                  </option>
                ))}
              </select>
            </div>
            {left !== undefined && right !== undefined ? (
              <VersionDiff
                oldText={left.body}
                newText={right.body}
                oldLabel={`v${left.versionNumber}`}
                newLabel={`v${right.versionNumber}`}
              />
            ) : null}
          </div>
        ) : null}
      </AsyncBoundary>
    </section>
  );
}
