interface CategoryBadgeProps {
  category: string;
}

const colors: Record<string, string> = {
  "threat-intel": "badge-threat",
  vulnerabilities: "badge-vuln",
  government: "badge-gov",
  "ai-security": "badge-ai",
  research: "badge-research",
  "industry-news": "badge-industry"
};

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const colorClass = colors[category] || "badge-industry";
  return (
    <span className={`category-badge ${colorClass}`}>
      {category.replace(/-/g, " ")}
    </span>
  );
}
