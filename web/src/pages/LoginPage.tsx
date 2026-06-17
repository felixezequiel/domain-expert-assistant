import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, FileCheck2, Loader2, Lock, ScrollText } from "lucide-react";
import { useAuth } from "../auth/AuthContext.tsx";
import { ApiError } from "../api/ApiError.ts";
import { Button } from "../components/ui/button.tsx";
import { Input } from "../components/ui/input.tsx";
import { Label } from "../components/ui/label.tsx";

type Translate = ReturnType<typeof useTranslation>["t"];

// A 401 here means bad credentials (the visitor never had a session), so show a credentials
// message rather than the generic "session expired" copy used elsewhere (finding B2).
function loginErrorMessage(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    if (error.isUnauthorized) {
      return t("auth.errors.invalidCredentials");
    }
    return error.message;
  }
  return error instanceof Error ? error.message : t("auth.errors.generic");
}

export function LoginPage(): JSX.Element {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const highlights = [
    {
      icon: FileCheck2,
      label: t("auth.login.hero.highlights.lifecycle.label"),
      hint: t("auth.login.hero.highlights.lifecycle.hint"),
    },
    {
      icon: Lock,
      label: t("auth.login.hero.highlights.tenant.label"),
      hint: t("auth.login.hero.highlights.tenant.hint"),
    },
    {
      icon: ScrollText,
      label: t("auth.login.hero.highlights.audited.label"),
      hint: t("auth.login.hero.highlights.audited.hint"),
    },
  ];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/search");
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Editorial value panel — the product's purpose, stated with authority. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-sidebar p-12 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground ring-1 ring-inset ring-white/10">
            DE
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">{t("auth.brand")}</span>
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-[2.6rem] font-semibold leading-[1.08] tracking-tight text-foreground">
            {t("auth.login.hero.title")}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            {t("auth.login.hero.description")}
          </p>
        </div>

        <ul className="space-y-4">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.hint}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Sign-in */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              DE
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">{t("auth.brand")}</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{t("auth.login.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.login.subtitle")}</p>

          <form className="mt-7 space-y-4" onSubmit={(event) => void submit(event)}>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.login.emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder={t("auth.login.emailPlaceholder")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth.login.passwordLabel")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder={t("auth.login.passwordPlaceholder")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error !== null ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground/90"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>{loginErrorMessage(error, t)}</span>
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitting ? t("auth.login.submitting") : t("auth.login.submit")}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
