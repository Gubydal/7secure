"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Shield, Wrench } from "lucide-react";
import { supabasePublic, type GuideRecord } from "../../../lib/supabase";

export default function GuideDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [guide, setGuide] = useState<GuideRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let isMounted = true;

    const loadGuide = async () => {
      const { data, error } = await supabasePublic
        .from("guides")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (!isMounted) return;

      if (!error && data) {
        setGuide(data as GuideRecord);
      }
      setIsLoading(false);
    };

    loadGuide();
    return () => { isMounted = false; };
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white text-zinc-900">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 rounded bg-zinc-200" />
            <div className="h-12 w-full rounded bg-zinc-200" />
            <div className="h-4 w-3/4 rounded bg-zinc-200" />
            <div className="space-y-3">
              <div className="h-4 w-full rounded bg-zinc-100" />
              <div className="h-4 w-full rounded bg-zinc-100" />
              <div className="h-4 w-5/6 rounded bg-zinc-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="min-h-screen bg-white text-zinc-900">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 text-center">
          <h1 className="text-2xl font-bold">Guide not found</h1>
          <p className="mt-2 text-zinc-500">The guide you are looking for does not exist or has been removed.</p>
          <Link href="/tools" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">
            <ArrowLeft className="h-4 w-4" /> Back to guides
          </Link>
        </div>
      </div>
    );
  }

  const backHref = guide.type === "tool" ? "/tools" : "/practices";
  const backLabel = guide.type === "tool" ? "Tools" : "Practices";
  const TypeIcon = guide.type === "tool" ? Wrench : Shield;

  // Parse the markdown-like content into rendered HTML sections
  const renderContent = (content: string) => {
    const lines = content.split("\n");
    const elements: React.JSX.Element[] = [];
    let currentListItems: string[] = [];
    let key = 0;

    const flushList = () => {
      if (currentListItems.length > 0) {
        elements.push(
          <ul key={key++} className="mb-6 space-y-2 pl-1">
            {currentListItems.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed text-zinc-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-zinc-900">$1</strong>') }} />
              </li>
            ))}
          </ul>
        );
        currentListItems = [];
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("## ")) {
        flushList();
        elements.push(
          <h2 key={key++} className="mb-3 mt-8 text-xl font-bold text-zinc-900 first:mt-0">
            {trimmed.slice(3)}
          </h2>
        );
      } else if (trimmed.startsWith("- ")) {
        currentListItems.push(trimmed.slice(2));
      } else if (trimmed.length > 0) {
        flushList();
        elements.push(
          <p key={key++} className="mb-4 text-[15px] leading-relaxed text-zinc-700" dangerouslySetInnerHTML={{
            __html: trimmed.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-zinc-900">$1</strong>')
          }} />
        );
      }
    }
    flushList();
    return elements;
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Back navigation */}
        <Link
          href={backHref}
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        {/* Header */}
        <div className="mb-8 border-b border-zinc-200 pb-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <TypeIcon className="h-5 w-5" />
            </div>
            <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-600">
              {guide.category.replace(/-/g, " ")}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            {guide.title}
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-zinc-600">
            {guide.summary}
          </p>
          {guide.url && (
            <a
              href={guide.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100"
            >
              Visit official site
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* Content */}
        <article className="prose-custom">
          {renderContent(guide.content)}
        </article>

        {/* Footer */}
        <div className="mt-12 border-t border-zinc-200 pt-8 text-center">
          <p className="text-sm text-zinc-500">
            Published {new Date(guide.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
          <Link
            href={backHref}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            View all {backLabel.toLowerCase()}
          </Link>
        </div>
      </div>
    </div>
  );
}
