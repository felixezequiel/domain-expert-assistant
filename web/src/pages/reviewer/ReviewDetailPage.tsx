import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import { itemsApi } from "../../api/resources.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary, ErrorNotice } from "../../components/AsyncBoundary.tsx";

// Review detail: read the item body, then approve / reject (with reason).
// Deprecate / archive are also available here for published/deprecated items.
export function ReviewDetailPage(): JSX.Element {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const state = useAsync(
    () => (itemId === undefined ? Promise.reject(new Error("Missing item id")) : itemsApi.get(itemId)),
    [itemId],
  );

  const [reason, setReason] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const act = async (action: () => Promise<{ status: string }>, label: string): Promise<void> => {
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      setNotice(`${label} — status now ${result.status}.`);
      state.reload();
    } catch (caught) {
      setError(caught);
    }
  };

  const item = state.data;

  return (
    <section>
      <div className="page-header">
        <h2>Review item</h2>
        <button type="button" onClick={() => navigate("/review")}>
          Back to queue
        </button>
      </div>
      {error !== null ? <ErrorNotice error={error} /> : null}
      {notice !== null ? <p className="notice notice--ok">{notice}</p> : null}

      <AsyncBoundary loading={state.loading} error={state.error}>
        {item !== null ? (
          <>
            <div className="card">
              <h3>{item.title}</h3>
              <p className="muted">
                {item.status} · {item.sensitivity} · v{item.currentVersionNumber}
              </p>
              <div className="md-editor__preview">
                <Markdown>{item.body}</Markdown>
              </div>
            </div>

            <div className="card">
              <h3>Decision</h3>
              <div className="modal__actions">
                <button type="button" onClick={() => void act(() => itemsApi.approve(item.id), "Approved")}>
                  Approve
                </button>
              </div>
              <label htmlFor="reject-reason">Rejection reason</label>
              <input id="reject-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
              <button type="button" onClick={() => void act(() => itemsApi.reject(item.id, reason), "Rejected")}>
                Reject
              </button>
            </div>

            <div className="card">
              <h3>Lifecycle</h3>
              <div className="modal__actions">
                <button type="button" onClick={() => void act(() => itemsApi.deprecate(item.id), "Deprecated")}>
                  Deprecate
                </button>
                <button type="button" onClick={() => void act(() => itemsApi.archive(item.id), "Archived")}>
                  Archive
                </button>
              </div>
            </div>
          </>
        ) : null}
      </AsyncBoundary>
    </section>
  );
}
