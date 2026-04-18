import type { LucideIcon } from "lucide-react";
import {
  Bot,
  FlaskConical,
  Landmark,
  LayoutGrid,
  Search,
  Shield
} from "lucide-react";

export type CategoryKey = string;

export const CATEGORY_ORDER: CategoryKey[] = [
  "industry-news",
  "threat-intel",
  "vulnerabilities",
  "ai-security",
  "research",
  "government"
];

export const CATEGORY_META: Record<string, { label: string; icon: LucideIcon }> = {
  "industry-news": { label: "Industry News", icon: LayoutGrid },
  "threat-intel": { label: "Threat Intel", icon: Shield },
  vulnerabilities: { label: "Vulnerabilities", icon: Search },
  "ai-security": { label: "AI Security", icon: Bot },
  research: { label: "Research", icon: FlaskConical },
  government: { label: "Government", icon: Landmark }
};

export const normalizeCategory = (value: string | null | undefined): CategoryKey => {
  const normalized = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "industry-news";
};

const toTitleCase = (value: string): string =>
  value
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const getCategoryMeta = (
  value: string | null | undefined
): { label: string; icon: LucideIcon } => {
  const normalized = normalizeCategory(value);
  const known = CATEGORY_META[normalized];

  if (known) {
    return known;
  }

  return {
    label: toTitleCase(normalized),
    icon: LayoutGrid
  };
};

export const buildCategoryList = (
  values: Array<string | null | undefined>,
  maxCategories = 10
): CategoryKey[] => {
  const counts = new Map<string, number>();

  for (const value of values) {
    const normalized = normalizeCategory(value);
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  const orderedKnown = CATEGORY_ORDER.filter((category) => counts.has(category));

  const dynamic = [...counts.entries()]
    .filter(([category]) => !CATEGORY_ORDER.includes(category))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category]) => category);

  const combined = [...orderedKnown, ...dynamic];

  return combined.slice(0, maxCategories);
};

export const getCategoryLabel = (value: string | null | undefined): string => {
  return getCategoryMeta(value).label;
};
