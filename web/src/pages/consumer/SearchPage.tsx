import { useState } from "react";
import { Link } from "react-router-dom";
import { collectionsApi, searchApi } from "../../api/resources.ts";
import { SENSITIVITY_LEVELS, type SearchResult } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { ErrorNotice, Loading } from "../../components/AsyncBoundary.tsx";

// Human search (PRD-5 parity, session-authed). Results carry attribution (title, collection,
// published date) and a freshness flag (stale = deprecated-but-served).
export function SearchPage(): JSX.Element {
  const collections = useAsync(() => collectionsApi.list(), []);
  const [query, setQuery] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [sensitivityCeiling, setSensitivityCeiling] = useState("");
  const [results, setResults] = useState<ReadonlyArray<SearchResult>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [searched, setSearched] = useState(false);

  const run = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await searchApi.search(
        query,
        collectionId === "" ? undefined : collectionId,
        sensitivityCeiling === "" ? undefined : sensitivityCeiling,
      );
      setResults(response.results);
      setSearched(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Search</h2>
      <form className="filters" onSubmit={(event) => void run(event)}>
        <input
          aria-label="Query"
          placeholder="Search the knowledge base…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select aria-label="Collection" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
          <option value="">All collections</option>
          {(collections.data?.collections ?? []).map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Sensitivity ceiling"
          value={sensitivityCeiling}
          onChange={(event) => setSensitivityCeiling(event.target.value)}
        >
          <option value="">Any sensitivity</option>
          {SENSITIVITY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <button type="submit">Search</button>
      </form>

      {error !== null ? <ErrorNotice error={error} /> : null}
      {loading ? <Loading /> : null}

      {searched && !loading && error === null ? (
        <ul className="results" data-testid="search-results">
          {results.map((result) => (
            <li key={`${result.itemId}-${result.chunkIndex}`} className="result">
              <div className="result__head">
                <Link to={`/catalog/${result.itemId}`} className="result__title">
                  {result.title}
                </Link>
                {result.stale ? <span className="badge badge--stale">stale</span> : null}
              </div>
              <p className="result__snippet">{result.content}</p>
              <p className="result__meta">
                Collection <code>{result.collectionId}</code> · {result.sensitivity} · published{" "}
                {result.publishedAt} · score {result.score.toFixed(3)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {searched && !loading && error === null && results.length === 0 ? (
        <p className="notice">No results.</p>
      ) : null}
    </section>
  );
}
