import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { KeyRound, Library, ShieldCheck, Tags, Users } from "lucide-react";
import { collectionsApi, credentialsApi, tagsApi, usersApi } from "../../api/resources.ts";
import { ROLES, SENSITIVITY_LEVELS } from "../../api/types.ts";
import { useAuth } from "../../auth/AuthContext.tsx";
import { useAsync } from "../../hooks/useAsync.ts";
import { MetricCard } from "../../components/MetricCard.tsx";
import { Badge } from "../../components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.tsx";

// Governance "you are here": a plain-language snapshot of how the org is governed — the
// separation-of-duties posture, taxonomy/credential counts, what each role can do, and the
// sensitivity ladder. Answers "what can actually be done here?" before the admin dives into
// the individual settings tabs.
export function SettingsOverviewPage(): JSX.Element {
  const { t } = useTranslation();
  const { session } = useAuth();
  const orgId = session?.user.companyId ?? "";

  const users = useAsync(() => usersApi.list(orgId), [orgId]);
  const collections = useAsync(() => collectionsApi.list(), []);
  const tags = useAsync(() => tagsApi.list(), []);
  const credentials = useAsync(() => credentialsApi.list(), []);
  const policy = useAsync(() => usersApi.getPolicy(orgId), [orgId]);

  const members = users.data?.users ?? [];
  const activeCredentials = (credentials.data?.credentials ?? []).filter((credential) => credential.status === "active");
  const separationOn = policy.data?.requireSeparateReviewer ?? false;
  const roleMemberCount = (role: string): number => members.filter((member) => member.roles.includes(role)).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label={t("admin.overview.metrics.members")} value={members.length} icon={Users} to="/settings/members" />
        <MetricCard
          label={t("admin.overview.metrics.collections")}
          value={collections.data?.collections.length ?? 0}
          icon={Library}
          to="/settings/collections"
        />
        <MetricCard label={t("admin.overview.metrics.tags")} value={tags.data?.tags.length ?? 0} icon={Tags} to="/settings/tags" />
        <MetricCard
          label={t("admin.overview.metrics.credentials")}
          value={activeCredentials.length}
          icon={KeyRound}
          to="/settings/credentials"
        />
      </section>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{t("admin.overview.separation.label")}</p>
                <Badge variant={separationOn ? "success" : "secondary"}>
                  {separationOn ? t("admin.overview.separation.statusOn") : t("admin.overview.separation.statusOff")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {separationOn ? t("admin.overview.separation.on") : t("admin.overview.separation.off")}
              </p>
            </div>
          </div>
          <Link to="/settings/policy" className="text-sm font-medium text-primary hover:underline">
            {t("admin.overview.manage")}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">{t("admin.overview.roles.heading")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {ROLES.map((role) => (
            <div key={role} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-3 last:border-0 last:pb-0">
              <span className="w-24 shrink-0 text-sm font-medium capitalize">{t("common.roles." + role)}</span>
              <span className="min-w-0 flex-1 text-sm text-muted-foreground">{t("admin.overview.roles.descriptions." + role)}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {t("admin.overview.roles.memberCount", { count: roleMemberCount(role) })}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">{t("admin.overview.sensitivity.heading")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-sm text-muted-foreground">{t("admin.overview.sensitivity.intro")}</p>
          <div className="space-y-2">
            {SENSITIVITY_LEVELS.map((level, index) => (
              <div key={level} className="flex items-baseline gap-3">
                <Badge variant="outline" className="tabular-nums">
                  {index + 1}
                </Badge>
                <span className="w-28 shrink-0 text-sm font-medium capitalize">{t("common.sensitivity." + level)}</span>
                <span className="min-w-0 flex-1 text-sm text-muted-foreground">{t("admin.overview.sensitivity." + level)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
