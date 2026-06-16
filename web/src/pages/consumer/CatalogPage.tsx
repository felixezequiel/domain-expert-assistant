import { useState } from "react";
import { Link } from "react-router-dom";
import { collectionsApi, itemsApi, tagsApi } from "../../api/resources.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary } from "../../components/AsyncBoundary.tsx";

// Catalog browse by collection (and tag, client-side). Shows published items the session
// is allowed to see; the read view is one click away.
export function CatalogPage(): JSX.Element {
  const collections = useAsync(() => collectionsApi.list(), []);
  const tags = useAsync(() => tagsApi.list(), []);
  const [collectionId, setCollectionId] = useState("");
  const [tagId, setTagId] = useState("");

  const items = useAsync(
    () => itemsApi.list(collectionId === "" ? undefined : collectionId, "published"),
    [collectionId],
  );

  const visibleItems = (items.data?.items ?? []).filter(
    (item) => tagId === "" || item.tagIds.includes(tagId),
  );

  return (
    <section>
      <h2>Catalog</h2>
      <div className="filters">
        <select aria-label="Collection" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
          <option value="">All collections</option>
          {(collections.data?.collections ?? []).map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
        <select aria-label="Tag" value={tagId} onChange={(event) => setTagId(event.target.value)}>
          <option value="">All tags</option>
          {(tags.data?.tags ?? []).map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.label}
            </option>
          ))}
        </select>
      </div>

      <AsyncBoundary loading={items.loading} error={items.error}>
        <ul className="results">
          {visibleItems.map((item) => (
            <li key={item.id} className="result">
              <Link to={`/catalog/${item.id}`} className="result__title">
                {item.title}
              </Link>
              {item.isStale ? <span className="badge badge--stale">stale</span> : null}
              <p className="result__meta">
                {item.sensitivity} · v{item.publishedVersionNumber ?? item.currentVersionNumber}
              </p>
            </li>
          ))}
        </ul>
        {visibleItems.length === 0 ? <p className="notice">No published items.</p> : null}
      </AsyncBoundary>
    </section>
  );
}
