import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { authApi } from "../api/resources.ts";
import { ApiError } from "../api/ApiError.ts";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Input } from "../components/ui/input.tsx";
import { Label } from "../components/ui/label.tsx";

const MIN_PASSWORD_LENGTH = 8;

function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

// Reached via /#/invitations/:token — an invited user sets a password to activate the
// account, then is sent to the login screen. Password match + length are validated
// client-side before the API is called.
export function AcceptInvitationPage(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitError(null);

    if (token === undefined) {
      setSubmitError(new Error("Missing invitation token."));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setValidationError("Passwords do not match.");
      return;
    }
    setValidationError(null);

    setSubmitting(true);
    try {
      await authApi.acceptInvitation(token, password);
      setDone(true);
    } catch (caught) {
      setSubmitError(caught);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-success text-success-foreground">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <CardTitle className="text-xl">Your account is active.</CardTitle>
              <CardDescription>You can now sign in with your new password.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button type="button" className="w-full" onClick={() => navigate("/login")}>
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Accept your invitation</CardTitle>
          <CardDescription>Set a password to activate your account, then sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <div className="space-y-1.5">
              <Label htmlFor="invite-password">Password</Label>
              <Input
                id="invite-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-confirm">Confirm password</Label>
              <Input
                id="invite-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </div>
            {validationError !== null ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground/90"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>{validationError}</span>
              </div>
            ) : null}
            {submitError !== null ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground/90"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>{submitErrorMessage(submitError)}</span>
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitting ? "Activating…" : "Activate account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
