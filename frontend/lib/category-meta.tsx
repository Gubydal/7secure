import type { LucideIcon } from "lucide-react";
import {
  Bot,
  FlaskConical,
  Landmark,
  LayoutGrid,
  Search,
  Shield
} from "lucide-react";

export type CategoryKey =
  | "industry-news"
  | "threat-intel"
  | "vulnerabilities"
  | "ai-security"
  | "research"
  | "government";

export const CATEGORY_ORDER: CategoryKey[] = [
  "industry-news",
  "threat-intel",
  "vulnerabilities",
  "ai-security",
  "research",
  "government"
];

export const CATEGORY_META: Record<CategoryKey, { label: string; icon: LucideIcon }> = {
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
    .replace(/\s+/g, "-") as CategoryKey;

  return CATEGORY_ORDER.includes(normalized) ? normalized : "industry-news";
};

export const getCategoryLabel = (value: string | null | undefined): string => {
  return CATEGORY_META[normalizeCategory(value)].label;
};
