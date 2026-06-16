import { useState } from "react";
import { tagsApi } from "../../api/resources.ts";
import type { TagView } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary, ErrorNotice } from "../../components/AsyncBoundary.tsx";

export function TagsPage(): JSX.Element {
  const state = useAsync(() => tagsApi.list(), []);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<unknown>(null);

  const create = async (): Promise<void> => {
    setError(null);
    try {
      await tagsApi.create(label);
      setLabel("");
      state.reload();
    } catch (caught) {
      setError(caught);
    }
  };

  const remove = async (id: string): Promise<void> => {
    setError(null);
    try {
      await tagsApi.remove(id);
      state.reload();
    } catch (caught) {
      setError(caught);
    }
  };

  return (
    <section>
      <h2>Tenant tags</h2>
      {error !== null ? <ErrorNotice error={error} /> : null}

      <div className="card">
        <h3>Create tag</h3>
        <label htmlFor="tag-label">Label</label>
        <input id="tag-label" value={label} onChange={(event) => setLabel(event.target.value)} />
        <button type="button" onClick={() => void create()}>
          Create
        </button>
      </div>

      <AsyncBoundary loading={state.loading} error={state.error}>
        <table className="table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Slug</th>
              <th>Scope</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(state.data?.tags ?? []).map((tag: TagView) => (
              <tr key={tag.id}>
                <td>{tag.label}</td>
                <td>{tag.slug}</td>
                <td>{tag.scope}</td>
                <td>
                  {tag.scope === "system" ? (
                    <span className="muted">system</span>
                  ) : (
                    <button type="button" onClick={() => void remove(tag.id)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncBoundary>
    </section>
  );
}
