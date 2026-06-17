import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import { ArrowLeft, Check, X } from "lucide-react";
import { itemsApi } from "../../api/resources.ts";
import { ApiError } from "../../api/ApiError.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary } from "../../components/AsyncBoundary.tsx";
import { Breadcrumbs } from "../../components/Breadcrumbs.tsx";
import { statusBadge } from "../../lib/format.ts";
import type { KnowledgeItemView } from "../../api/types.ts";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import { Label } from "../../components/ui/label.tsx";
import { Textarea } from "../../components/ui/textarea.tsx";
import { toast } from "../../components/ui/sonner.tsx";
import i18n from "../../i18n/index.ts";

function actionErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return error instanceof Error ? error.message : i18n.t("common.errors.generic");
}

// The loaded item plus the decision/lifecycle controls. Split out so the page body only
// guards "still loading / not found" and this component always works with a real item.
function ReviewItem({ item, onChanged }: {
  readonly item: KnowledgeItemView;
  readonly onChanged: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const badge = statusBadge(item.status);
  const rejectDisabled = reason.trim() === "";
  const canDeprecate = item.status === "published";
  const canArchive = item.status === "published" || item.status === "deprecated";
  const showLifecycle = canDeprecate || canArchive;

  // Run a lifecycle action, surface a success toast, then re-load the item so the status
  // badge reflects the new state (B3). Errors surface as a toast too.
  const act = async (action: () => Promise<{ status: string }>, message: string): Promise<void> => {
    try {
      await action();
      toast.success(message);
      onChanged();
    } catch (caught) {
      toast.error(actionErrorMessage(caught));
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{item.title}</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={badge.variant}>{t("common.status." + item.status)}</Badge>
            <span>{t("common.sensitivity." + item.sensitivity)}</span>
            <span>·</span>
            <span>{t("review.version", { number: item.currentVersionNumber })}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="markdown">
            <Markdown>{item.body}</Markdown>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("review.decision.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            onClick={() => void act(() => itemsApi.approve(item.id), t("review.toasts.approved"))}
          >
            <Check className="h-4 w-4" />
            {t("review.decision.approve")}
          </Button>

          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">{t("review.decision.rejectionReason")}</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("review.decision.rejectionPlaceholder")}
            />
            <Button
              type="button"
              variant="destructive"
              disabled={rejectDisabled}
              onClick={() => void act(() => itemsApi.reject(item.id, reason), t("review.toasts.rejected"))}
            >
              <X className="h-4 w-4" />
              {t("review.decision.reject")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showLifecycle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("review.lifecycle.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canDeprecate && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void act(() => itemsApi.deprecate(item.id), t("review.toasts.deprecated"))}
              >
                {t("review.lifecycle.deprecate")}
              </Button>
            )}
            {canArchive && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void act(() => itemsApi.archive(item.id), t("review.toasts.archived"))}
              >
                {t("review.lifecycle.archive")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

// Review detail: read the item body, then approve / reject (with reason).
// Deprecate / archive are contextual lifecycle actions, only shown for the statuses
// they apply to (U15). Action feedback is a transient toast — no inline notice is kept
// in state, so nothing stale can survive navigation (B3).
export function ReviewDetailPage(): JSX.Element {
  const { t } = useTranslation();
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const state = useAsync(
    () => (itemId === undefined ? Promise.reject(new Error("Missing item id")) : itemsApi.get(itemId)),
    [itemId],
  );

  const item = state.data;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: t("review.detail.breadcrumbQueue"), to: "/review" }, { label: t("review.detail.breadcrumbItem") }]}
      />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("review.detail.title")}</h1>
        <Button type="button" variant="outline" size="sm" onClick={() => navigate("/review")}>
          <ArrowLeft className="h-4 w-4" />
          {t("review.detail.backToQueue")}
        </Button>
      </div>

      <AsyncBoundary loading={state.loading} error={state.error}>
        {item !== null && <ReviewItem item={item} onChanged={state.reload} />}
      </AsyncBoundary>
    </div>
  );
}
