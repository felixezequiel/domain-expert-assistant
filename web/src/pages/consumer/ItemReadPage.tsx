import { useNavigate, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import { itemsApi } from "../../api/resources.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary } from "../../components/AsyncBoundary.tsx";

// Read-only item view (consumer + auditor). Renders the markdown body with attribution
// (status, sensitivity, version) and a stale badge when the served version is outdated.
export function ItemReadPage(): JSX.Element {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const state = useAsync(
    () => (itemId === undefined ? Promise.reject(new Error("Missing item id")) : itemsApi.get(itemId)),
    [itemId],
  );
  const item = state.data;

  return (
    <section>
      <div className="page-header">
        <h2>{item?.title ?? "Item"}</h2>
        <button type="button" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>
      <AsyncBoundary loading={state.loading} error={state.error}>
        {item !== null ? (
          <article className="card">
            <p className="muted">
              {item.status} · {item.sensitivity} · v
              {item.publishedVersionNumber ?? item.currentVersionNumber}
              {item.isStale ? <span className="badge badge--stale">stale</span> : null}
            </p>
            <div className="md-editor__preview">
              <Markdown>{item.body}</Markdown>
            </div>
          </article>
        ) : null}
      </AsyncBoundary>
    </section>
  );
}
