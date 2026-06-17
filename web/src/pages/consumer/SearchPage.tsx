import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AlertTriangle, Search } from "lucide-react";
import { collectionsApi, searchApi } from "../../api/resources.ts";
import { SENSITIVITY_LEVELS, type SearchResult } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { ErrorNotice, Loading } from "../../components/AsyncBoundary.tsx";
import { formatDate, stripMarkdown } from "../../lib/format.ts";
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

const ALL_COLLECTIONS = "all";
const ANY_SENSITIVITY = "all";
const SNIPPET_LENGTH = 280;
const SCORE_DECIMALS = 2;

// Indexing prepends the item title to the chunk text (better recall), so the stored content
// starts with the title — which we already render as the card heading. Strip that leading
// title from the displayed snippet so it isn't duplicated under the heading.
function stripLeadingTitle(text: string, title: string): string {
  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0 || !text.startsWith(trimmedTitle)) {
    return text;
  }
  return text.slice(trimmedTitle.length).trimStart();
}

// Trim the plain-text snippet to a readable length without cutting mid-grapheme awkwardly,
// adding an ellipsis when truncated (finding U7 — snippets are stripped of markdown markup).
function snippetOf(content: string, title: string): string {
  const text = stripLeadingTitle(stripMarkdown(content), title);
  if (text.length <= SNIPPET_LENGTH) {
    return text;
  }
  return `${text.slice(0, SNIPPET_LENGTH).trimEnd()}…`;
}

// Human search (PRD-5 parity, session-authed). Results carry attribution (title, collection
// NAME, published date) and a freshness flag (stale = deprecated-but-served).
export function SearchPage(): JSX.Element {
  const { t } = useTranslation();
  const collections = useAsync(() => collectionsApi.list(), []);
  const [query, setQuery] = useState("");
  const [collectionId, setCollectionId] = useState(ALL_COLLECTIONS);
  const [sensitivityCeiling, setSensitivityCeiling] = useState(ANY_SENSITIVITY);
  const [results, setResults] = useState<ReadonlyArray<SearchResult>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [searched, setSearched] = useState(false);

  const collectionNames = new Map<string, string>(
    (collections.data?.collections ?? []).map((collection) => [collection.id, collection.name]),
  );

  const showResults = searched && !loading && error === null;

  const run = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await searchApi.search(
        query,
        collectionId === ALL_COLLECTIONS ? undefined : collectionId,
        sensitivityCeiling === ANY_SENSITIVITY ? undefined : sensitivityCeiling,
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
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("consumer.search.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("consumer.search.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(event) => void run(event)}>
            <div className="space-y-1.5">
              <Label htmlFor="search-query">{t("consumer.search.queryLabel")}</Label>
              <Input
                id="search-query"
                aria-label={t("consumer.search.queryLabel")}
                placeholder={t("consumer.search.placeholder")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
              <div className="space-y-1.5">
                <Label htmlFor="search-collection">{t("consumer.search.collectionLabel")}</Label>
                <Select value={collectionId} onValueChange={setCollectionId}>
                  <SelectTrigger id="search-collection" aria-label={t("consumer.search.collectionLabel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_COLLECTIONS}>{t("consumer.search.allCollections")}</SelectItem>
                    {(collections.data?.collections ?? []).map((collection) => (
                      <SelectItem key={collection.id} value={collection.id}>
                        {collection.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="search-sensitivity">{t("consumer.search.sensitivityLabel")}</Label>
                <Select value={sensitivityCeiling} onValueChange={setSensitivityCeiling}>
                  <SelectTrigger id="search-sensitivity" aria-label={t("consumer.search.sensitivityLabel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_SENSITIVITY}>{t("consumer.search.anySensitivity")}</SelectItem>
                    {SENSITIVITY_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {t("common.sensitivity." + level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="sm:col-start-2 sm:row-start-1">
              <Search className="mr-2 h-4 w-4" />
              {t("common.actions.search")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error !== null ? <ErrorNotice error={error} /> : null}
      {loading ? <Loading /> : null}

      {showResults ? <SearchResults results={results} collectionNames={collectionNames} /> : null}
    </div>
  );
}

function SearchResults({
  results,
  collectionNames,
}: {
  readonly results: ReadonlyArray<SearchResult>;
  readonly collectionNames: ReadonlyMap<string, string>;
}): JSX.Element {
  const { t } = useTranslation();
  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t("consumer.search.noResults")}
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-3" data-testid="search-results">
      {results.map((result) => {
        const collectionName = collectionNames.get(result.collectionId) ?? result.collectionId;
        return (
          <li key={`${result.itemId}-${result.chunkIndex}`}>
            <Card>
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">
                    <Link to={`/catalog/${result.itemId}`} className="text-foreground hover:underline">
                      {result.title}
                    </Link>
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    title={t("consumer.search.relevanceTooltip", { score: result.score.toFixed(SCORE_DECIMALS) })}
                  >
                    {t("consumer.search.match")}
                  </Badge>
                  {result.stale ? (
                    <Badge variant="warning">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {t("consumer.search.deprecated")}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{snippetOf(result.content, result.title)}</p>
                <p className="text-xs text-muted-foreground">
                  {collectionName} · {t("common.sensitivity." + result.sensitivity)} ·{" "}
                  {t("consumer.search.publishedOn", { date: formatDate(result.publishedAt) })}
                </p>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
