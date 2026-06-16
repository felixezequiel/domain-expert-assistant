import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collectionsApi, itemsApi, tagsApi } from "../../api/resources.ts";
import { SENSITIVITY_LEVELS } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary, ErrorNotice } from "../../components/AsyncBoundary.tsx";
import { MarkdownEditor } from "../../components/MarkdownEditor.tsx";

// Create or edit a knowledge item. Collection / tags / sensitivity are first-class fields
// (PRD-6 §5). On create we send the full payload; on edit the backend's PUT only accepts
// title/body/sensitivity, so tag changes go through the dedicated retag endpoint.
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
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const item = existing.data;
    if (item !== null) {
      setCollectionId(item.collectionId);
      setTitle(item.title);
      setBody(item.body);
      setSensitivity(item.sensitivity);
      setSelectedTags(item.tagIds);
      setStatus(item.status);
    }
  }, [existing.data]);

  const toggleTag = (id: string): void => {
    if (selectedTags.includes(id)) {
      setSelectedTags(selectedTags.filter((value) => value !== id));
    } else {
      setSelectedTags([...selectedTags, id]);
    }
  };

  const save = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    try {
      if (isEdit) {
        const result = await itemsApi.edit(itemId, { title, body, sensitivity });
        await itemsApi.retag(itemId, selectedTags);
        setStatus(result.status);
        setNotice("Saved.");
      } else {
        const result = await itemsApi.create({ collectionId, title, body, tagIds: selectedTags, sensitivity });
        setNotice("Created.");
        navigate(`/items/${result.id}`);
      }
    } catch (caught) {
      setError(caught);
    }
  };

  const submitForReview = async (): Promise<void> => {
    if (!isEdit) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const result = await itemsApi.submit(itemId);
      setStatus(result.status);
      setNotice("Submitted for review.");
    } catch (caught) {
      setError(caught);
    }
  };

  return (
    <section>
      <h2>{isEdit ? "Edit item" : "New item"}</h2>
      {status !== null ? <p className="notice">Status: {status}</p> : null}
      {error !== null ? <ErrorNotice error={error} /> : null}
      {notice !== null ? <p className="notice notice--ok">{notice}</p> : null}

      <AsyncBoundary loading={existing.loading} error={existing.error}>
        <div className="card">
          <label htmlFor="item-collection">Collection</label>
          <select
            id="item-collection"
            value={collectionId}
            disabled={isEdit}
            onChange={(event) => setCollectionId(event.target.value)}
          >
            <option value="">Select…</option>
            {(collections.data?.collections ?? []).map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>

          <label htmlFor="item-title">Title</label>
          <input id="item-title" value={title} onChange={(event) => setTitle(event.target.value)} />

          <label htmlFor="item-sensitivity">Sensitivity</label>
          <select id="item-sensitivity" value={sensitivity} onChange={(event) => setSensitivity(event.target.value)}>
            {SENSITIVITY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>

          <fieldset className="roles">
            <legend>Tags</legend>
            {(tags.data?.tags ?? []).map((tag) => (
              <label key={tag.id} htmlFor={`item-tag-${tag.id}`}>
                <input
                  id={`item-tag-${tag.id}`}
                  type="checkbox"
                  checked={selectedTags.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                />
                {tag.label}
              </label>
            ))}
          </fieldset>

          <MarkdownEditor value={body} onChange={setBody} />

          <div className="modal__actions">
            <button type="button" onClick={() => void save()}>
              {isEdit ? "Save" : "Create"}
            </button>
            {isEdit ? (
              <button type="button" onClick={() => void submitForReview()}>
                Submit for review
              </button>
            ) : null}
          </div>
        </div>
      </AsyncBoundary>
    </section>
  );
}
