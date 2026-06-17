import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Markdown from "react-markdown";
import { itemsApi } from "../../api/resources.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary } from "../../components/AsyncBoundary.tsx";
import { Breadcrumbs } from "../../components/Breadcrumbs.tsx";
import { statusBadge } from "../../lib/format.ts";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.tsx";

// Read-only item view (consumer + auditor). Renders the markdown body with attribution
// (status, sensitivity, version) and a Deprecated badge when the served version is stale.
export function ItemReadPage(): JSX.Element {
  const { t } = useTranslation();
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const state = useAsync(
    () => (itemId === undefined ? Promise.reject(new Error("Missing item id")) : itemsApi.get(itemId)),
    [itemId],
  );
  const item = state.data;
  const badge = item !== null ? statusBadge(item.status) : null;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t("consumer.item.breadcrumbCatalog"), to: "/catalog" },
          { label: item?.title ?? t("consumer.item.fallbackTitle") },
        ]}
      />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{item?.title ?? t("consumer.item.fallbackTitle")}</h1>
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("common.actions.back")}
        </Button>
      </div>

      <AsyncBoundary loading={state.loading} error={state.error}>
        {item !== null ? (
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-base">{item.title}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {badge !== null ? <Badge variant={badge.variant}>{t("common.status." + item.status)}</Badge> : null}
                <span className="text-xs text-muted-foreground">
                  {t("common.sensitivity." + item.sensitivity)} · v
                  {item.publishedVersionNumber ?? item.currentVersionNumber}
                </span>
                {item.isStale ? (
                  <Badge variant="warning">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    {t("consumer.item.deprecated")}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="markdown">
                <Markdown>{item.body}</Markdown>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </AsyncBoundary>
    </div>
  );
}
