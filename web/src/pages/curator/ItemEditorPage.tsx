import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Loader2, Save, Send } from "lucide-react";
import { collectionsApi, itemsApi, tagsApi } from "../../api/resources.ts";
import { SENSITIVITY_LEVELS } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary, ErrorNotice } from "../../components/AsyncBoundary.tsx";
import { MarkdownEditor } from "../../components/MarkdownEditor.tsx";
import { statusBadge } from "../../lib/format.ts";
import { Breadcrumbs } from "../../components/Breadcrumbs.tsx";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
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

function sameTagSet(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const other = new Set(b);
  return a.every((value) => other.has(value));
}

// Create or edit a knowledge item. On edit the backend's PUT only accepts title/body/
// sensitivity, so tag changes go through the dedicated retag endpoint — but ONLY when the
// tags actually changed, otherwise every Save would spawn a redundant version (finding B1).
export function ItemEditorPage(): JSX.Element {
  const { itemId } = useParams<{ itemId: string }>();
  const isEdit = itemId !== undefined;
  const navigate = useNavigate();

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
  const [savedTags, setSavedTags] = useState<ReadonlyArray<string>>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const item = existing.data;
    if (item !== null) {
      setCollectionId(item.collectionId);
      setTitle(item.title);
      setBody(item.body);
      setSensitivity(item.sensitivity);
      setSelectedTags(item.tagIds);
      setSavedTags(item.tagIds);
      setStatus(item.status);
      setRejectionReason(item.lastRejectionReason);
    }
  }, [existing.data]);

  const toggleTag = (id: string): void => {
    setSelectedTags((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const save = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      if (isEdit) {
        const result = await itemsApi.edit(itemId, { title, body, sensitivity });
        if (!sameTagSet(selectedTags, savedTags)) {
          await itemsApi.retag(itemId, selectedTags);
          setSavedTags(selectedTags);
        }
        setStatus(result.status);
        toast.success("Saved");
      } else {
        const result = await itemsApi.create({ collectionId, title, body, tagIds: selectedTags, sensitivity });
        toast.success("Item created");
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
      toast.success("Submitted for review");
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const badge = status !== null ? statusBadge(status) : null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Items", to: "/items" }, { label: isEdit ? "Edit item" : "New item" }]} />
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{isEdit ? "Edit item" : "New item"}</h1>
        {badge !== null ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
      </div>

      {rejectionReason !== null && status === "draft" ? (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            <span className="font-medium">Rejected by reviewer:</span> {rejectionReason}
          </span>
        </div>
      ) : null}

      {error !== null ? <ErrorNotice error={error} /> : null}

      <AsyncBoundary loading={existing.loading} error={existing.error}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="item-collection">Collection</Label>
                <Select value={collectionId} onValueChange={setCollectionId} disabled={isEdit}>
                  <SelectTrigger id="item-collection">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(collections.data?.collections ?? []).map((collection) => (
                      <SelectItem key={collection.id} value={collection.id}>
                        {collection.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-sensitivity">Sensitivity</Label>
                <Select value={sensitivity} onValueChange={setSensitivity}>
                  <SelectTrigger id="item-sensitivity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SENSITIVITY_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-title">Title</Label>
              <Input id="item-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {(tags.data?.tags ?? []).map((tag) => (
                  <label key={tag.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedTags.includes(tag.id)}
                      onCheckedChange={() => toggleTag(tag.id)}
                    />
                    {tag.label}
                  </label>
                ))}
              </div>
            </div>

            <MarkdownEditor value={body} onChange={setBody} />

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void save()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isEdit ? "Save" : "Create"}
              </Button>
              {isEdit ? (
                <Button type="button" variant="secondary" onClick={() => void submitForReview()} disabled={busy}>
                  <Send className="mr-2 h-4 w-4" />
                  Submit for review
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </AsyncBoundary>
    </div>
  );
}
