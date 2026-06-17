import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  FileText,
  KeyRound,
  Library,
  Plus,
  ScrollText,
  Search,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { collectionsApi, credentialsApi, itemsApi, usersApi } from "../api/resources.ts";
import { useAuth, useCapabilities } from "../auth/AuthContext.tsx";
import { useAsync } from "../hooks/useAsync.ts";
import { ErrorNotice } from "../components/AsyncBoundary.tsx";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent } from "../components/ui/card.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";

type Translate = ReturnType<typeof useTranslation>["t"];

function greetingPhrase(t: Translate): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return t("dashboard.greeting.morning");
  }
  if (hour < 18) {
    return t("dashboard.greeting.afternoon");
  }
  return t("dashboard.greeting.evening");
}

interface Metric {
  readonly label: string;
  readonly value: number;
  readonly icon: LucideIcon;
  readonly to: string;
  readonly tone?: "default" | "warning";
}

interface QuickAction {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly to: string;
  readonly primary?: boolean;
}

export function DashboardPage(): JSX.Element {
  const { t } = useTranslation();
  const { session } = useAuth();
  const capabilities = useCapabilities();
  const orgId = session?.user.companyId ?? "";
  const firstName = (session?.user.displayName ?? "").split(/\s+/)[0] ?? "";

  const items = useAsync(() => itemsApi.list(), []);
  const adminCounts = useAsync(
    () =>
      capabilities.canAdminister
        ? Promise.all([usersApi.list(orgId), collectionsApi.list(), credentialsApi.list()]).then(
            ([users, collections, credentials]) => ({
              users: users.users.length,
              collections: collections.collections.length,
              credentials: credentials.credentials.length,
            }),
          )
        : Promise.resolve(null),
    [capabilities.canAdminister, orgId],
  );

  const all = items.data?.items ?? [];
  const countByStatus = (status: string): number => all.filter((item) => item.status === status).length;
  const rejectedDrafts = all.filter((item) => item.status === "draft" && item.lastRejectionReason !== null);

  const metrics: Array<Metric> = [
    { label: t("dashboard.metrics.published"), value: countByStatus("published"), icon: BookOpen, to: "/catalog" },
  ];
  if (capabilities.canReview) {
    metrics.push({ label: t("dashboard.metrics.awaitingReview"), value: countByStatus("in_review"), icon: ClipboardCheck, to: "/review" });
  }
  if (capabilities.canCurate) {
    metrics.push({ label: t("dashboard.metrics.drafts"), value: countByStatus("draft"), icon: FileText, to: "/items" });
    if (rejectedDrafts.length > 0) {
      metrics.push({
        label: t("dashboard.metrics.actionNeeded"),
        value: rejectedDrafts.length,
        icon: AlertTriangle,
        to: "/items",
        tone: "warning",
      });
    }
  }
  if (capabilities.canAdminister && adminCounts.data !== null) {
    metrics.push({ label: t("dashboard.metrics.members"), value: adminCounts.data.users, icon: Users, to: "/settings/members" });
    metrics.push({ label: t("dashboard.metrics.collections"), value: adminCounts.data.collections, icon: Library, to: "/settings/collections" });
    metrics.push({ label: t("dashboard.metrics.credentials"), value: adminCounts.data.credentials, icon: KeyRound, to: "/settings/credentials" });
  }

  const actions: Array<QuickAction> = [];
  if (capabilities.canCurate) {
    actions.push({ label: t("dashboard.actions.newItem"), icon: Plus, to: "/items/new", primary: true });
    actions.push({ label: t("dashboard.actions.uploadDocument"), icon: Upload, to: "/upload" });
  }
  if (capabilities.canReview) {
    actions.push({ label: t("dashboard.actions.reviewQueue"), icon: ClipboardCheck, to: "/review" });
  }
  actions.push({ label: t("dashboard.actions.search"), icon: Search, to: "/search" });
  if (capabilities.canAudit) {
    actions.push({ label: t("dashboard.actions.audit"), icon: ScrollText, to: "/audit" });
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName !== ""
            ? t("dashboard.greeting.withName", { greeting: greetingPhrase(t), name: firstName })
            : t("dashboard.greeting.withoutName", { greeting: greetingPhrase(t) })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
      </header>

      {items.error !== null ? <ErrorNotice error={items.error} /> : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.loading
          ? Array.from({ length: 4 }, (_unused, index) => (
              <Card key={index}>
                <CardContent className="space-y-2 py-5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-12" />
                </CardContent>
              </Card>
            ))
          : metrics.map((metric) => {
              const Icon = metric.icon;
              const isWarning = metric.tone === "warning";
              let iconClass = "h-4 w-4 text-muted-foreground";
              let valueClass = "mt-2 text-3xl font-semibold tabular-nums";
              if (isWarning) {
                iconClass = "h-4 w-4 text-warning";
                valueClass = "mt-2 text-3xl font-semibold tabular-nums text-warning";
              }
              return (
                <Link key={metric.label} to={metric.to} className="group">
                  <Card className="transition-colors hover:border-primary/50">
                    <CardContent className="py-5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{metric.label}</span>
                        <Icon className={iconClass} />
                      </div>
                      <p className={valueClass}>{metric.value}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{t("dashboard.actions.heading")}</h2>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button key={action.label} asChild variant={action.primary === true ? "default" : "outline"}>
                <Link to={action.to}>
                  <Icon className="mr-2 h-4 w-4" />
                  {action.label}
                </Link>
              </Button>
            );
          })}
        </div>
      </section>

      {capabilities.canCurate && rejectedDrafts.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{t("dashboard.attention.heading")}</h2>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {rejectedDrafts.map((item) => (
                <Link
                  key={item.id}
                  to={`/items/${item.id}`}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {t("dashboard.attention.rejected", { reason: item.lastRejectionReason })}
                    </p>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
