import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, BookOpen, History, Loader2, Save, ScrollText, Send } from "lucide-react";
import { collectionsApi, itemsApi, tagsApi } from "../../api/resources.ts";
import { useCapabilities } from "../../auth/AuthContext.tsx";
import { SENSITIVITY_LEVELS } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary, ErrorNotice } from "../../components/AsyncBoundary.tsx";
import { MarkdownEditor } from "../../components/MarkdownEditor.tsx";
import { TaxonomyCombobox, type TaxonomyOption } from "../../components/TaxonomyCombobox.tsx";
import { TagPicker, type TagOption } from "../../components/TagPicker.tsx";
import { statusBadge } from "../../lib/format.ts";
import { Breadcrumbs } from "../../components/Breadcrumbs.tsx";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import { Input } from "../../components/ui/input.tsx";
import { Label } from "../../components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select.tsx";
import { toast } from "../../components/ui/sonner.tsx";

// Create or edit a knowledge item. On edit, content + tags are sent together so one Save is
// one version (the backend coalesces them and no-ops when nothing changed — findings B1/P2).
// Changing the collection on Save additionally moves the item (finding B3). Save/Submit are
// only offered for statuses where the transition is valid (finding P3).
export function ItemEditorPage(): JSX.Element {
  const { t } = useTranslation();
  const { itemId } = useParams<{ itemId: string }>();
  const isEdit = itemId !== undefined;
  const navigate = useNavigate();
  const capabilities = useCapabilities();

  const collections = useAsync(() => collectionsApi.list(), []);
  const tags = useAsync(() => tagsApi.list(), []);
  const existing = useAsync(
    () => (isEdit ? itemsApi.get(itemId) : Promise.resolve(null)),
    [itemId],
  );

  const [collectionId, setCollectionId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sensitivity, setSensitivity] = useState<string>("internal");
  const [selectedTags, setSelectedTags] = useState<ReadonlyArray<string>>([]);
  // Options created inline are appended locally so the new collection/tag is selectable
  // immediately, with no detour to Settings and no refetch.
  const [createdCollections, setCreatedCollections] = useState<ReadonlyArray<TaxonomyOption>>([]);
  const [createdTags, setCreatedTags] = useState<ReadonlyArray<TagOption>>([]);
  const [savedCollectionId, setSavedCollectionId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const item = existing.data;
    if (item !== null) {
      setCollectionId(item.collectionId);
      setSavedCollectionId(item.collectionId);
      setTitle(item.title);
      setBody(item.body);
      setSensitivity(item.sensitivity);
      setSelectedTags(item.tagIds);
      setStatus(item.status);
      setRejectionReason(item.lastRejectionReason);
    }
  }, [existing.data]);

  const collectionOptions: ReadonlyArray<TaxonomyOption> = [
    ...(collections.data?.collections ?? []).map((collection) => ({ value: collection.id, label: collection.name })),
    ...createdCollections,
  ];
  const tagOptions: ReadonlyArray<TagOption> = [
    ...(tags.data?.tags ?? []).map((tag) => ({ id: tag.id, label: tag.label })),
    ...createdTags,
  ];

  const createCollection = async (name: string): Promise<TaxonomyOption> => {
    const created = await collectionsApi.create(name);
    const option = { value: created.id, label: created.name };
    setCreatedCollections((current) => [...current, option]);
    return option;
  };

  const createTag = async (label: string): Promise<TagOption> => {
    const created = await tagsApi.create(label);
    const option = { id: created.id, label: created.label };
    setCreatedTags((current) => [...current, option]);
    return option;
  };

  const save = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      if (isEdit) {
        const result = await itemsApi.edit(itemId, { title, body, sensitivity, tagIds: selectedTags });
        if (collectionId !== savedCollectionId) {
          await itemsApi.move(itemId, collectionId);
          setSavedCollectionId(collectionId);
        }
        setStatus(result.status);
        toast.success(t("knowledge.editor.toast.saved"));
      } else {
        const result = await itemsApi.create({ collectionId, title, body, tagIds: selectedTags, sensitivity });
        toast.success(t("knowledge.editor.toast.created"));
        navigate(`/items/${result.id}`);
      }
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const submitForReview = async (): Promise<void> => {
    if (!isEdit) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await itemsApi.submit(itemId);
      setStatus(result.status);
      setRejectionReason(null);
      toast.success(t("knowledge.editor.toast.submitted"));
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const badge = status !== null ? statusBadge(status) : null;
  // The backend allows edit/move only from draft or published; submit only from draft.
  const canEdit = !isEdit || status === "draft" || status === "published";
  const canSubmit = isEdit && status === "draft";

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t("knowledge.editor.breadcrumbItems"), to: "/items" },
          { label: isEdit ? t("knowledge.editor.editTitle") : t("knowledge.editor.newTitle") },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? t("knowledge.editor.editTitle") : t("knowledge.editor.newTitle")}
          </h1>
          {badge !== null && status !== null ? (
            <Badge variant={badge.variant}>{t("common.status." + status)}</Badge>
          ) : null}
        </div>
        {isEdit && itemId !== undefined ? (
          <nav className="flex flex-wrap items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to={`/items/${itemId}/versions`}>
                <History className="mr-1.5 h-4 w-4" />
                {t("knowledge.editor.openVersions")}
              </Link>
            </Button>
            {status === "published" ? (
              <Button asChild variant="ghost" size="sm">
                <Link to={`/catalog/${itemId}`}>
                  <BookOpen className="mr-1.5 h-4 w-4" />
                  {t("knowledge.editor.openRead")}
                </Link>
              </Button>
            ) : null}
            {capabilities.canAudit ? (
              <Button asChild variant="ghost" size="sm">
                <Link to={`/audit?aggregateId=${itemId}`}>
                  <ScrollText className="mr-1.5 h-4 w-4" />
                  {t("knowledge.editor.openAudit")}
                </Link>
              </Button>
            ) : null}
          </nav>
        ) : null}
      </div>

      {rejectionReason !== null && status === "draft" ? (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            <span className="font-medium">{t("knowledge.editor.rejectedByReviewer")}</span> {rejectionReason}
          </span>
        </div>
      ) : null}

      {error !== null ? <ErrorNotice error={error} /> : null}

      <AsyncBoundary loading={existing.loading} error={existing.error}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("knowledge.editor.contentCard")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="item-collection">{t("knowledge.editor.collectionLabel")}</Label>
                <TaxonomyCombobox
                  id="item-collection"
                  ariaLabel={t("knowledge.editor.collectionLabel")}
                  options={collectionOptions}
                  value={collectionId}
                  onChange={setCollectionId}
                  onCreate={canEdit ? createCollection : undefined}
                  disabled={!canEdit}
                  placeholder={t("knowledge.editor.collectionPlaceholder")}
                  searchPlaceholder={t("knowledge.editor.collectionSearch")}
                />
                {isEdit ? (
                  <p className="text-xs text-muted-foreground">{t("knowledge.editor.moveHint")}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-sensitivity">{t("knowledge.editor.sensitivityLabel")}</Label>
                <Select value={sensitivity} onValueChange={setSensitivity}>
                  <SelectTrigger id="item-sensitivity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SENSITIVITY_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {t("common.sensitivity." + level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-title">{t("knowledge.editor.titleLabel")}</Label>
              <Input id="item-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>{t("knowledge.editor.tagsLabel")}</Label>
              <TagPicker
                options={tagOptions}
                value={selectedTags}
                onChange={setSelectedTags}
                onCreate={canEdit ? createTag : undefined}
                disabled={!canEdit}
              />
            </div>

            <MarkdownEditor value={body} onChange={setBody} />

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void save()} disabled={busy || !canEdit}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isEdit ? t("common.actions.save") : t("common.actions.create")}
              </Button>
              {canSubmit ? (
                <Button type="button" variant="secondary" onClick={() => void submitForReview()} disabled={busy}>
                  <Send className="mr-2 h-4 w-4" />
                  {t("knowledge.editor.submitForReview")}
                </Button>
              ) : null}
            </div>
            {isEdit && !canEdit && status !== null ? (
              <p className="text-sm text-muted-foreground">
                {t("knowledge.editor.lockedNote", { status: t("common.status." + status) })}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </AsyncBoundary>
    </div>
  );
}
