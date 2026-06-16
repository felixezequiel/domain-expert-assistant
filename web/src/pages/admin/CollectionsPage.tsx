import { useState } from "react";
import { collectionsApi } from "../../api/resources.ts";
import type { CollectionView } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary, ErrorNotice } from "../../components/AsyncBoundary.tsx";

export function CollectionsPage(): JSX.Element {
  const state = useAsync(() => collectionsApi.list(), []);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [renameId, setRenameId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<unknown>(null);

  const create = async (): Promise<void> => {
    setError(null);
    try {
      await collectionsApi.create(name, description === "" ? undefined : description);
      setName("");
      setDescription("");
      state.reload();
    } catch (caught) {
      setError(caught);
    }
  };

  const rename = async (): Promise<void> => {
    setError(null);
    try {
      await collectionsApi.rename(renameId, renameValue);
      setRenameId("");
      setRenameValue("");
      state.reload();
    } catch (caught) {
      setError(caught);
    }
  };

  return (
    <section>
      <h2>Collections</h2>
      {error !== null ? <ErrorNotice error={error} /> : null}

      <div className="card">
        <h3>Create collection</h3>
        <label htmlFor="coll-name">Name</label>
        <input id="coll-name" value={name} onChange={(event) => setName(event.target.value)} />
        <label htmlFor="coll-desc">Description (optional)</label>
        <input id="coll-desc" value={description} onChange={(event) => setDescription(event.target.value)} />
        <button type="button" onClick={() => void create()}>
          Create
        </button>
      </div>

      <AsyncBoundary loading={state.loading} error={state.error}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Id</th>
            </tr>
          </thead>
          <tbody>
            {(state.data?.collections ?? []).map((collection: CollectionView) => (
              <tr key={collection.id}>
                <td>{collection.name}</td>
                <td>{collection.description ?? "—"}</td>
                <td>
                  <code>{collection.id}</code>
                  <button
                    type="button"
                    onClick={() => {
                      setRenameId(collection.id);
                      setRenameValue(collection.name);
                    }}
                  >
                    Rename
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncBoundary>

      {renameId !== "" ? (
        <div className="card">
          <h3>Rename collection</h3>
          <p>
            <code>{renameId}</code>
          </p>
          <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
          <button type="button" onClick={() => void rename()}>
            Save
          </button>
        </div>
      ) : null}
    </section>
  );
}
