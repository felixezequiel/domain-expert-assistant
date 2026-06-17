// Small presentation helpers shared across screens: human dates (formatted in the active UI
// language), markdown-stripped snippets (so search results don't show raw `#`/`**`/link
// syntax — finding U7), and lifecycle status styling. Pure functions, no React.
import i18n from "../i18n/index.ts";

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(i18n.language, { year: "numeric", month: "short", day: "numeric" });
}

/** Strip the common markdown markup so a body can be shown as a plain-text snippet/preview. */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/[*_~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type StatusBadgeVariant = "default" | "secondary" | "success" | "warning" | "outline" | "destructive";

const STATUS_BADGES: Record<string, { readonly label: string; readonly variant: StatusBadgeVariant }> = {
  draft: { label: "Draft", variant: "secondary" },
  in_review: { label: "In review", variant: "warning" },
  published: { label: "Published", variant: "success" },
  deprecated: { label: "Deprecated", variant: "outline" },
  archived: { label: "Archived", variant: "destructive" },
};

export function statusBadge(status: string): { readonly label: string; readonly variant: StatusBadgeVariant } {
  return STATUS_BADGES[status] ?? { label: status, variant: "secondary" };
}
