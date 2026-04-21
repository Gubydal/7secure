"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Search, Star, Wrench } from "lucide-react";
import { supabasePublic, type GuideRecord } from "../../lib/supabase";

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
        .eq("type", "tool")
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
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tools</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Curated security tools, frameworks, and platforms — reviewed and recommended by 7secure.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-lg flex-1 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2.5 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools, frameworks, or platforms"
              className="w-full border-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </div>
          <p className="text-sm text-zinc-500">
            Showing <span className="font-semibold text-zinc-800">{filtered.length}</span> tool{filtered.length === 1 ? "" : "s"}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100" />
            ))}
          </div>
        ) : null}

        {!isLoading && filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center text-zinc-500">
            No tools found. Check back soon — we are adding more regularly.
          </div>
        ) : null}

        {!isLoading && filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filtered.map((guide) => (
              <Link
                key={guide.id}
                href={guide.url || `/articles/${guide.slug}`}
                target={guide.url ? "_blank" : undefined}
                rel={guide.url ? "noopener noreferrer" : undefined}
                className="group rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-5 transition-all hover:border-zinc-300 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="line-clamp-2 text-lg font-semibold tracking-tight text-zinc-900">{guide.title}</h2>
                      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-700" />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">{guide.summary}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 font-medium text-zinc-700">
                        {guide.category.replace(/-/g, " ")}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
