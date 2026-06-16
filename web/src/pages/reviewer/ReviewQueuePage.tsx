import { Link } from "react-router-dom";
import { itemsApi } from "../../api/resources.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary } from "../../components/AsyncBoundary.tsx";

// Reviewer queue: items currently in_review, filtered server-side by status.
export function ReviewQueuePage(): JSX.Element {
  const state = useAsync(() => itemsApi.list(undefined, "in_review"), []);

  return (
    <section>
      <h2>Review queue</h2>
      <AsyncBoundary loading={state.loading} error={state.error}>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Sensitivity</th>
              <th>Version</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(state.data?.items ?? []).map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.sensitivity}</td>
                <td>{item.currentVersionNumber}</td>
                <td>
                  <Link to={`/review/${item.id}`}>Review</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(state.data?.items ?? []).length === 0 ? <p className="notice">Nothing awaiting review.</p> : null}
      </AsyncBoundary>
    </section>
  );
}
