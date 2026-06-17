import { useState } from "react";
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

function actionErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

// The loaded item plus the decision/lifecycle controls. Split out so the page body only
// guards "still loading / not found" and this component always works with a real item.
function ReviewItem({ item, onChanged }: {
  readonly item: KnowledgeItemView;
  readonly onChanged: () => void;
}): JSX.Element {
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
            <Badge variant={badge.variant}>{badge.label}</Badge>
            <span>{item.sensitivity}</span>
            <span>·</span>
            <span>v{item.currentVersionNumber}</span>
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
          <CardTitle className="text-base">Decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            onClick={() => void act(() => itemsApi.approve(item.id), "Approved — now published")}
          >
            <Check className="h-4 w-4" />
            Approve
          </Button>

          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Rejection reason</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain what needs to change before this can be published…"
            />
            <Button
              type="button"
              variant="destructive"
              disabled={rejectDisabled}
              onClick={() => void act(() => itemsApi.reject(item.id, reason), "Rejected — back to draft")}
            >
              <X className="h-4 w-4" />
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>

      {showLifecycle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lifecycle</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canDeprecate && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void act(() => itemsApi.deprecate(item.id), "Deprecated")}
              >
                Deprecate
              </Button>
            )}
            {canArchive && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void act(() => itemsApi.archive(item.id), "Archived")}
              >
                Archive
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
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const state = useAsync(
    () => (itemId === undefined ? Promise.reject(new Error("Missing item id")) : itemsApi.get(itemId)),
    [itemId],
  );

  const item = state.data;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Review queue", to: "/review" }, { label: "Review item" }]} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Review item</h1>
        <Button type="button" variant="outline" size="sm" onClick={() => navigate("/review")}>
          <ArrowLeft className="h-4 w-4" />
          Back to queue
        </Button>
      </div>

      <AsyncBoundary loading={state.loading} error={state.error}>
        {item !== null && <ReviewItem item={item} onChanged={state.reload} />}
      </AsyncBoundary>
    </div>
  );
}
