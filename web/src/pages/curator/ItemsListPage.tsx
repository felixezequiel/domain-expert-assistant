import { useState } from "react";
import { Link } from "react-router-dom";
import { collectionsApi, itemsApi, tagsApi } from "../../api/resources.ts";
import { LIFECYCLE_STATUSES, SENSITIVITY_LEVELS, type KnowledgeItemView } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary } from "../../components/AsyncBoundary.tsx";

// Curator item list with filters (collection, tag, status, sensitivity). Backend filters
// by collection + status server-side; tag + sensitivity are filtered client-side over the
// returned set (the list endpoint only accepts collectionId + status query params).
export function ItemsListPage(): JSX.Element {
  const collections = useAsync(() => collectionsApi.list(), []);
  const tags = useAsync(() => tagsApi.list(), []);

  const [collectionId, setCollectionId] = useState("");
  const [status, setStatus] = useState("");
  const [tagId, setTagId] = useState("");
  const [sensitivity, setSensitivity] = useState("");

  const items = useAsync(
    () => itemsApi.list(collectionId === "" ? undefined : collectionId, status === "" ? undefined : status),
    [collectionId, status],
  );

  const visibleItems = (items.data?.items ?? []).filter((item) => {
    const tagMatches = tagId === "" || item.tagIds.includes(tagId);
    const sensitivityMatches = sensitivity === "" || item.sensitivity === sensitivity;
    return tagMatches && sensitivityMatches;
  });

  return (
    <section>
      <div className="page-header">
        <h2>Items</h2>
        <Link className="button" to="/items/new">
          New item
        </Link>
      </div>

      <div className="filters">
        <select value={collectionId} onChange={(event) => setCollectionId(event.target.value)} aria-label="Collection filter">
          <option value="">All collections</option>
          {(collections.data?.collections ?? []).map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status filter">
          <option value="">All statuses</option>
          {LIFECYCLE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select value={tagId} onChange={(event) => setTagId(event.target.value)} aria-label="Tag filter">
          <option value="">All tags</option>
          {(tags.data?.tags ?? []).map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.label}
            </option>
          ))}
        </select>
        <select value={sensitivity} onChange={(event) => setSensitivity(event.target.value)} aria-label="Sensitivity filter">
          <option value="">All sensitivities</option>
          {SENSITIVITY_LEVELS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <AsyncBoundary loading={items.loading} error={items.error}>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Sensitivity</th>
              <th>Version</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item: KnowledgeItemView) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>
                  {item.status}
                  {item.isStale ? <span className="badge badge--stale">stale</span> : null}
                </td>
                <td>{item.sensitivity}</td>
                <td>{item.currentVersionNumber}</td>
                <td>
                  <Link to={`/items/${item.id}`}>Edit</Link>
                  <Link to={`/items/${item.id}/versions`}>Versions</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncBoundary>
    </section>
  );
}
