import { useState } from "react";
import { usersApi } from "../../api/resources.ts";
import { useAuth } from "../../auth/AuthContext.tsx";
import { ErrorNotice } from "../../components/AsyncBoundary.tsx";

// Org policy toggle. The backend has no "read policy" endpoint, so the toggle is a
// write-only control: the admin sets requireSeparateReviewer and we confirm the saved
// value from the PUT response.
export function PolicyPage(): JSX.Element {
  const { session } = useAuth();
  const orgId = session?.companyId ?? "";
  const [requireSeparateReviewer, setRequireSeparateReviewer] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const save = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    try {
      await usersApi.setPolicy(orgId, requireSeparateReviewer);
      setNotice(`Saved: require separate reviewer = ${String(requireSeparateReviewer)}.`);
    } catch (caught) {
      setError(caught);
    }
  };

  return (
    <section>
      <h2>Org policy</h2>
      {error !== null ? <ErrorNotice error={error} /> : null}
      {notice !== null ? <p className="notice notice--ok">{notice}</p> : null}
      <div className="card">
        <label htmlFor="policy-reviewer">
          <input
            id="policy-reviewer"
            type="checkbox"
            checked={requireSeparateReviewer}
            onChange={(event) => setRequireSeparateReviewer(event.target.checked)}
          />
          Require a separate reviewer (the approver must differ from the author)
        </label>
        <button type="button" onClick={() => void save()}>
          Save policy
        </button>
      </div>
    </section>
  );
}
