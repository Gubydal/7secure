"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { supabasePublic, type GuideRecord } from "../lib/supabase";
import { Bot, Search, Send, Shield, Star } from "lucide-react";
import {
  buildCategoryList,
  getCategoryMeta,
  getCategoryLabel,
  normalizeCategory,
  type CategoryKey
} from "../lib/category-meta";

interface HomeArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  published_at: string;
  image_url?: string | null;
  source_name?: string | null;
}

const LOCAL_AUTH_KEY = "sevensecure_subscriber_email";

const markSubscriberSession = (email: string) => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(LOCAL_AUTH_KEY, email);
  window.dispatchEvent(new CustomEvent("sevensecure-auth-changed", { detail: { email } }));
};



export default function Home() {
  const [activeCategory, setActiveCategory] = useState<"all" | CategoryKey>("all");
  const [query, setQuery] = useState("");
  const [heroEmail, setHeroEmail] = useState("");
  const [heroSubscribeState, setHeroSubscribeState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [heroSubscribeMessage, setHeroSubscribeMessage] = useState("");

  const [articles, setArticles] = useState<HomeArticle[]>([]);
  const [practiceGuides, setPracticeGuides] = useState<GuideRecord[]>([]);
  const [toolGuides, setToolGuides] = useState<GuideRecord[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadArticles = async () => {
      const { data, error } = await supabasePublic
        .from("articles")
        .select("id,slug,title,summary,category,published_at,image_url,source_name")
        .order("published_at", { ascending: false })
        .limit(48);

      if (!isMounted) {
        return;
      }

      if (data && !error) {
        setArticles(data as HomeArticle[]);
        return;
      }

      setArticles([
        {
          id: "fallback-1",
          slug: "zero-day-exploit-vpn",
          title: "Zero-Day Exploit Found in Popular VPN",
          summary:
            "Attackers are exploiting a new vulnerability in market-leading VPN software. Here is how to patch it immediately.",
          category: "vulnerabilities",
          published_at: new Date().toISOString(),
          image_url: "/cover.avif",
          source_name: "7secure"
        },
        {
          id: "fallback-2",
          slug: "rise-of-ai-phishing",
          title: "The Rise of AI-Generated Phishing",
          summary:
            "How threat actors are utilizing LLMs to craft hyper-personalized and error-free phishing campaigns at scale.",
          category: "threat-intel",
          published_at: new Date().toISOString(),
          image_url: "/cover.avif",
          source_name: "7secure"
        }
      ]);
    };

    const loadGuides = async () => {
      const { data } = await supabasePublic
        .from("guides")
        .select("id,slug,title,summary,content,type,category,icon,url,image_url,is_active,published_at")
        .eq("is_active", true)
        .order("published_at", { ascending: false })
        .limit(20);

      if (!isMounted || !data) return;
      const guides = data as GuideRecord[];
      setPracticeGuides(guides.filter((g) => g.type === "practice").slice(0, 3));
      setToolGuides(guides.filter((g) => g.type === "tool").slice(0, 3));
    };

    loadArticles();
    loadGuides();

    return () => {
      isMounted = false;
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const dynamicCategories = buildCategoryList(articles.map((article) => article.category), 8);

    const baseOptions = [
      { key: "all" as const, label: "All", icon: <Star className="h-4 w-4" /> },
      ...dynamicCategories.map((category) => {
        const meta = getCategoryMeta(category);
        const Icon = meta.icon;
        return {
          key: category,
          label: meta.label,
          icon: <Icon className="h-4 w-4" />
        };
      })
    ];

    // Add Tools and Practices tabs
    return [
      ...baseOptions,
      { key: "tools-tab", label: "Tools", icon: <Bot className="h-4 w-4" />, isSpecial: true, href: "/tools" },
      { key: "practices-tab", label: "Practices", icon: <Shield className="h-4 w-4" />, isSpecial: true, href: "/practices" }
    ];
  }, [articles]);

  const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleHeroQuickSubscribe = async () => {
    const normalizedEmail = heroEmail.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setHeroSubscribeState("error");
      setHeroSubscribeMessage("Enter a valid email address.");
      return;
    }

    setHeroSubscribeState("submitting");
    setHeroSubscribeMessage("Sending...");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "",
          email: normalizedEmail,
          interests: []
        })
      });

      if (!response.ok) {
        throw new Error("Subscription request failed");
      }

      setHeroSubscribeState("success");
      setHeroSubscribeMessage("Subscribed. Check your inbox for confirmation.");
      setHeroEmail("");
      markSubscriberSession(normalizedEmail);
    } catch (error) {
      console.error("Hero quick subscribe failed:", error);
      setHeroSubscribeState("error");
      setHeroSubscribeMessage("Subscription failed. Please try again.");
    }
  };

  const filteredArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return articles.filter((article) => {
      const articleCategory = normalizeCategory(article.category);
      const categoryMatches = activeCategory === "all" || articleCategory === activeCategory;

      if (!categoryMatches) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        article.title,
        article.summary,
        article.source_name || "",
        getCategoryLabel(article.category)
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [activeCategory, articles, query]);

  const latestArticles = useMemo(() => filteredArticles.slice(0, 5), [filteredArticles]);
  const featuredPrimary = latestArticles[0] || null;
  const featuredSecondary = latestArticles.slice(1, 5);

  // Practice and tool guides are fetched directly from the guides table

  return (
    <div className="flex flex-col min-h-screen font-sans bg-[#09090b]">
      
      {/* 1. HERO SECTION (BLACK) */}
      <section className="relative z-30 flex min-h-svh w-full flex-col justify-center bg-[#09090b] pb-16 text-[#fafafa] md:min-h-[86svh] md:pb-18">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 pb-8 pt-8 text-center md:pt-10">
          <h1 className="mb-4 text-[1.9rem] font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-[3.25rem]">
            Master InfoSec with{" "}
            <span className="inline-flex items-center whitespace-nowrap bg-linear-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
              <span>Daily</span>
              <span className="ml-2">Updates</span>
            </span>
          </h1>
          <p className="mb-6 max-w-xl px-4 text-sm text-zinc-400 md:text-[0.95rem]">
            Get the latest cybersecurity news, understand current threats, and learn how to secure your infrastructure against modern attacks.
          </p>
          <div className="mx-auto mb-3 mt-3 flex w-full max-w-180 items-center overflow-hidden rounded-md border border-zinc-200 bg-white p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
            <input
              type="email"
              value={heroEmail}
              placeholder="Email Address"
              autoComplete="email"
              className="h-11 flex-1 border-none bg-transparent px-4 text-[14px] text-zinc-900 placeholder:text-zinc-500 outline-none sm:h-12 sm:px-5 sm:text-[15px]"
              onChange={(event) => {
                setHeroEmail(event.target.value);
                if (heroSubscribeState !== "idle") {
                  setHeroSubscribeState("idle");
                  setHeroSubscribeMessage("");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleHeroQuickSubscribe();
                }
              }}
            />
            <Button
              variant="primary"
              onPress={() => {
                void handleHeroQuickSubscribe();
              }}
              isDisabled={heroSubscribeState === "submitting"}
              className="flex h-11 min-w-max items-center justify-center gap-2 rounded-md bg-[#18181b] px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 sm:h-12 sm:px-6 sm:text-[15px]"
            >
              <span>{heroSubscribeState === "submitting" ? "Subscribing..." : "Subscribe"}</span>
              {heroSubscribeState === "submitting" ? null : (
                <Send className="h-4 w-4 shrink-0 translate-y-px stroke-[2px] opacity-90" />
              )}
            </Button>
          </div>
          {heroSubscribeMessage ? (
            <p
              className={`text-sm ${
                heroSubscribeState === "success"
                  ? "text-emerald-300"
                  : heroSubscribeState === "error"
                    ? "text-rose-300"
                    : "text-zinc-400"
              }`}
            >
              {heroSubscribeMessage}
            </p>
          ) : null}
          <div className="mt-7 flex flex-col items-center">
            <p className="mb-5 text-xs font-medium uppercase tracking-wider text-zinc-500 sm:text-sm">
              Join readers from leading companies
            </p>
            <div className="flex w-full items-center justify-center opacity-70 transition-opacity hover:opacity-90">
              <Image
                src="/icons.svg"
                alt="Leading Companies"
                width={567}
                height={107}
                className="h-auto max-w-full md:hidden"
              />
              <Image
                src="/icons-desktop.svg"
                alt="Leading Companies"
                width={1042}
                height={42}
                className="hidden h-auto max-w-full md:block"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. NEWSLETTER CONTENT (WHITE) -> Rounded top & bottom intersection */}
      <main className="relative z-20 -mt-6 w-full flex-1 rounded-t-md bg-white pb-20 pt-14 text-zinc-900 shadow-2xl md:-mt-8 md:pt-12">
        <div className="max-w-5xl mx-auto px-6 text-center">
          
          {/* SEARCH & FILTERS */}
          <div className="mb-16 flex flex-col items-center gap-6">
            {/* Centered Typography */}
            <div>
              <h2 className="mb-2 text-4xl font-bold text-zinc-900">Trending Topics</h2>
              <p className="text-lg text-zinc-500">The most useful InfoSec content — organized and categorized in one spot.</p>
            </div>

             <div className="mx-auto mb-2 mt-4 w-full max-w-4xl">
              {/* Flat Search Bar without heavy effects */}
              <div className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2.5 transition-all focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600">
                 <Search className="w-4 h-4 text-zinc-500 shrink-0" />
                 <input 
                    type="text" 
                    placeholder="Search articles, tools, models..." 
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="bg-transparent border-none outline-none w-full placeholder-zinc-400 text-zinc-800 text-sm" 
                 />
              </div>
            </div>

            {/* Categories Tags (Centered) */}
            <div className="mx-auto flex w-full max-w-4xl flex-wrap justify-center gap-3">
              {categoryOptions.map((cat) => {
                const isSpecial = (cat as any).isSpecial;
                const href = (cat as any).href;

                if (isSpecial) {
                  return (
                    <Link
                      key={cat.key}
                      href={href}
                      className="flex h-10 items-center gap-2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      {cat.icon}
                      {cat.label}
                    </Link>
                  );
                }

                return (
                  <button 
                    key={cat.key}
                    onClick={() => setActiveCategory(cat.key as any)}
                    className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-md border px-5 text-sm font-medium transition-colors ${activeCategory === cat.key ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"}`}
                  >
                    {cat.icon}
                    {cat.label}
                  </button>
                );
              })}
            </div>
            
          </div>

          {/* LATEST ARTICLES */}
          <section id="articles" className="mb-24">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-zinc-900">Latest Intel</h2>
            </div>

            {featuredPrimary ? (
              <div className="grid grid-cols-1 gap-4 text-left lg:grid-cols-3">
                <Link
                  href={`/articles/${featuredPrimary.slug}`}
                  className="group overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md lg:col-span-2"
                >
                  <div className="relative aspect-[2/1] w-full overflow-hidden bg-zinc-100">
                    <img
                      src={featuredPrimary.image_url || "/cover.avif"}
                      alt={featuredPrimary.title}
                      className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.01]"
                    />
                    <div className="absolute left-3 top-3 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-800">
                      {getCategoryLabel(featuredPrimary.category)}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="mb-2 text-xl font-bold leading-tight tracking-tight text-zinc-900 group-hover:text-blue-700 sm:text-2xl">
                      {featuredPrimary.title}
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {(featuredPrimary.source_name || "7secure")} • {new Date(featuredPrimary.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </Link>

                <div className="grid grid-cols-2 gap-3 lg:col-span-1 lg:grid-cols-1">
                  {featuredSecondary.map((article) => (
                    <Link
                      key={article.id}
                      href={`/articles/${article.slug}`}
                      className="group overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md"
                    >
                      <div className="relative aspect-[3/2] w-full overflow-hidden bg-zinc-100">
                        <img
                          src={article.image_url || "/cover.avif"}
                          alt={article.title}
                          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                        <div className="absolute left-2 top-2 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-800">
                          {getCategoryLabel(article.category)}
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="line-clamp-2 text-sm font-bold leading-tight text-zinc-900 group-hover:text-blue-700">
                          {article.title}
                        </h3>
                        <p className="mt-1 text-xs text-zinc-500">
                          {(article.source_name || "7secure")} • {new Date(article.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {!featuredPrimary && (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-zinc-500">
                No articles matched this category and search term.
              </div>
            )}

            <div className="mt-10 text-center">
               <a href="/articles" className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-6 font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50">
                 View all articles
               </a>
            </div>
          </section>

          {/* BEST PRACTICES & TOOLS */}
          <section id="practices" className="mb-10 text-center">
            <div className="mb-8">
              <h2 className="mb-2 text-3xl font-bold text-zinc-900">Best Practices & Tools</h2>
            </div>
            
            <div className="mx-auto grid max-w-5xl gap-6 text-left md:grid-cols-2">
              <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-6">
                <div className="mb-4 flex items-center gap-2 text-zinc-900">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <h3 className="text-xl font-bold">Security practices</h3>
                </div>
                <div className="space-y-3">
                  {practiceGuides.map((guide) => (
                    <a
                      key={guide.id}
                      href={`/articles/${guide.slug}`}
                      className="block rounded-md border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
                    >
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                        {guide.category.replace(/-/g, " ")}
                      </p>
                      <h4 className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900">{guide.title}</h4>
                    </a>
                  ))}
                </div>
                <a
                  href="/practices"
                  className="mt-5 inline-flex items-center text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                >
                  View all practices
                </a>
              </div>

              <div id="tools" className="rounded-md border border-zinc-200 bg-zinc-50/60 p-6">
                <div className="mb-4 flex items-center gap-2 text-zinc-900">
                  <Bot className="h-5 w-5 text-blue-600" />
                  <h3 className="text-xl font-bold">Tool watch</h3>
                </div>
                <div className="space-y-3">
                  {toolGuides.map((guide) => (
                    <a
                      key={guide.id}
                      href={guide.url || `/articles/${guide.slug}`}
                      target={guide.url ? "_blank" : undefined}
                      rel={guide.url ? "noopener noreferrer" : undefined}
                      className="block rounded-md border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
                    >
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                        {guide.category.replace(/-/g, " ")}
                      </p>
                      <h4 className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900">{guide.title}</h4>
                    </a>
                  ))}
                </div>
                <a
                  href="/tools"
                  className="mt-5 inline-flex items-center text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                >
                  View all tools
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* 3. INTERSECTION QUOTE SECTION (BLACK) */}
      <section className="w-full bg-[#09090b] px-6 py-20 text-center text-[#fafafa]">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h2 className="mb-8 text-2xl font-bold leading-snug md:text-4xl">
            "Information security is not a project, it's an ongoing discipline. Stay updated daily."
          </h2>
          <Button
            variant="primary"
            onPress={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("open-subscribe-modal"));
              }
            }}
            className="h-12 rounded-md bg-white px-8 font-bold text-black transition-colors hover:bg-zinc-200"
          >
            Subscribe to the Newsletter
          </Button>
        </div>
      </section>
    </div>
  );
}
