import Link from "next/link";
import type { EditorialCard as EditorialCardData } from "../lib/newsletter-content";

interface EditorialCardProps {
  card: EditorialCardData;
  className?: string;
}

export function EditorialCard({ card, className }: EditorialCardProps) {
  return (
    <article className={`editorial-card tone-${card.tone} ${className || ""}`.trim()}>
      <div className="editorial-card-visual" aria-hidden="true" />
      <div className="editorial-card-body">
        <span className="editorial-card-eyebrow">{card.eyebrow}</span>
        <h3>
          <Link href={card.href}>{card.title}</Link>
        </h3>
        <p>{card.summary}</p>
        <Link href={card.href} className="editorial-card-link">
          Read more
        </Link>
      </div>
    </article>
  );
}
