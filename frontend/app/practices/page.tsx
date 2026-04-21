"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Search, ShieldCheck } from "lucide-react";
import { supabasePublic, type GuideRecord } from "../../lib/supabase";

const summaryToChecklist = (summary: string): string[] => {
  const parts = summary
    .split(/[.;]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(0, 3);
};

export default function Page() {
  const [guides, setGuides] = useState<GuideRecord[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadGuides = async () => {
      const { data, error } = await supabasePublic
        .from("guides")
        .select("id,slug,title,summary,content,type,category,icon,url,image_url,is_active,published_at")
        .eq("type", "practice")
        .eq("is_active", true)
        .order("published_at", { ascending: false })
        .limit(50);

      if (!isMounted) return;

      if (!error && data) {
        setGuides(data as GuideRecord[]);
      }
      setIsLoading(false);
    };

    loadGuides();
    return () => { isMounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guides;
    return guides.filter((g) =>
      `${g.title} ${g.summary} ${g.category}`.toLowerCase().includes(q)
    );
  }, [guides, query]);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 border-b border-zinc-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Practices</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Security playbooks and operational recommendations for active teams — curated by 7secure.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-lg flex-1 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2.5 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search practices, hardening, and response guides"
              className="w-full border-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </div>
          <p className="text-sm text-zinc-500">
            Showing <span className="font-semibold text-zinc-800">{filtered.length}</span> practice{filtered.length === 1 ? "" : "s"}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100" />
            ))}
          </div>
        ) : null}

        {!isLoading && filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center text-zinc-500">
            No practices found. Check back soon — we are adding more regularly.
          </div>
        ) : null}

        {!isLoading && filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((guide) => {
              const checklist = summaryToChecklist(guide.summary);

              return (
                <Link
                  key={guide.id}
                  href={`/articles/${guide.slug}`}
                  className="group rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-medium text-zinc-700">
                          {guide.category.replace(/-/g, " ")}
                        </span>
                      </div>

                      <h2 className="mt-2 line-clamp-2 text-lg font-semibold tracking-tight text-zinc-900 group-hover:text-blue-700">
                        {guide.title}
                      </h2>

                      <div className="mt-3 grid gap-2">
                        {checklist.map((point, i) => (
                          <p key={i} className="flex items-start gap-2 text-sm leading-6 text-zinc-600">
                            <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-blue-600" />
                            <span className="line-clamp-2">{point}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
