import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Save } from "lucide-react";
import { usersApi } from "../../api/resources.ts";
import { useAuth } from "../../auth/AuthContext.tsx";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary } from "../../components/AsyncBoundary.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { toast } from "../../components/ui/sonner.tsx";

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Something went wrong.";
}

// Org governance policy. The current policy is fetched on load and prefilled into the
// toggle, so the admin always sees the live value rather than a write-only default.
export function PolicyPage(): JSX.Element {
  const { t } = useTranslation();
  const { session } = useAuth();
  const orgId = session?.user.companyId ?? "";

  const policy = useAsync(() => usersApi.getPolicy(orgId), [orgId]);

  const [requireSeparateReviewer, setRequireSeparateReviewer] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (policy.data !== null) {
      setRequireSeparateReviewer(policy.data.requireSeparateReviewer);
    }
  }, [policy.data]);

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      await usersApi.setPolicy(orgId, requireSeparateReviewer);
      toast.success(t("admin.policy.toasts.saved"));
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.policy.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.policy.governanceCard")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <AsyncBoundary loading={policy.loading} error={policy.error}>
            <label
              htmlFor="policy-reviewer"
              className="flex cursor-pointer items-start gap-3 text-sm"
            >
              <Checkbox
                id="policy-reviewer"
                checked={requireSeparateReviewer}
                onCheckedChange={(checked) => setRequireSeparateReviewer(checked === true)}
              />
              <span>
                <span className="font-medium">{t("admin.policy.requireReviewer")}</span>
                <span className="block text-muted-foreground">
                  {t("admin.policy.requireReviewerHint")}
                </span>
              </span>
            </label>

            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t("admin.policy.savePolicy")}
            </Button>
          </AsyncBoundary>
        </CardContent>
      </Card>
    </div>
  );
}
