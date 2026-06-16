import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authApi } from "../api/resources.ts";
import { ErrorNotice } from "../components/AsyncBoundary.tsx";

// Reached via /#/invitations/:token — an invited user sets their password to activate
// the account, then is sent to the login screen.
export function AcceptInvitationPage(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (token === undefined) {
      setError(new Error("Missing invitation token."));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await authApi.acceptInvitation(token, password);
      setDone(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="auth-page">
        <div className="card">
          <h2>Invitation accepted</h2>
          <p className="notice">Your account is active. You can now sign in.</p>
          <button type="button" onClick={() => navigate("/login")}>
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="card" onSubmit={(event) => void submit(event)}>
        <h2>Accept invitation</h2>
        <label htmlFor="invite-password">Choose a password</label>
        <input
          id="invite-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error !== null ? <ErrorNotice error={error} /> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Activating…" : "Set password"}
        </button>
      </form>
    </div>
  );
}
