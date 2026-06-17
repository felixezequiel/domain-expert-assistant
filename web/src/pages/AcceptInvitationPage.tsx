import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { authApi } from "../api/resources.ts";
import { ApiError } from "../api/ApiError.ts";
import { useAsync } from "../hooks/useAsync.ts";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Input } from "../components/ui/input.tsx";
import { Label } from "../components/ui/label.tsx";

type Translate = ReturnType<typeof useTranslation>["t"];

const MIN_PASSWORD_LENGTH = 8;

function submitErrorMessage(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return error instanceof Error ? error.message : t("auth.errors.generic");
}

// Reached via /#/invitations/:token. Before asking for a password we fetch the invitation's
// public context (org, invited email, roles) so the invitee knows what they're joining; then
// they set a password to activate the account. Password match + length are validated
// client-side before the API is called.
export function AcceptInvitationPage(): JSX.Element {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const invitation = useAsync(
    () =>
      token === undefined
        ? Promise.reject(new Error(t("auth.errors.missingToken")))
        : authApi.invitation(token),
    [token],
  );
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
      setSubmitError(new Error(t("auth.errors.missingToken")));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setValidationError(t("auth.invitation.validation.tooShort", { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setValidationError(t("auth.invitation.validation.mismatch"));
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
              <CardTitle className="text-xl">{t("auth.invitation.done.title")}</CardTitle>
              <CardDescription>{t("auth.invitation.done.description")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button type="button" className="w-full" onClick={() => navigate("/login")}>
              {t("auth.invitation.done.goToSignIn")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitation.error !== null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">{t("auth.invitation.notFound.title")}</CardTitle>
            <CardDescription>{t("auth.invitation.notFound.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/login")}>
              {t("auth.invitation.notFound.backToSignIn")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const context = invitation.data;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">
            {context === null
              ? t("auth.invitation.title")
              : t("auth.invitation.titleJoin", { organizationName: context.organizationName })}
          </CardTitle>
          <CardDescription>{t("auth.invitation.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {context !== null ? (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-3 text-sm">
              <p className="text-muted-foreground">
                {t("auth.invitation.invitedAs")}{" "}
                <span className="font-medium text-foreground">{context.email}</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground">{t("auth.invitation.rolesLabel")}</span>
                {context.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {t("common.roles." + role)}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <div className="space-y-1.5">
              <Label htmlFor="invite-password">{t("auth.invitation.passwordLabel")}</Label>
              <Input
                id="invite-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("auth.invitation.passwordHint", { min: MIN_PASSWORD_LENGTH })}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-confirm">{t("auth.invitation.confirmLabel")}</Label>
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
                <span>{submitErrorMessage(submitError, t)}</span>
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitting ? t("auth.invitation.submitting") : t("auth.invitation.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
