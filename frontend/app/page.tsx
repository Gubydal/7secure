"use client";

import Image from "next/image";
import { Button } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabasePublic } from "../lib/supabase";
import { Bot, CheckCircle2, Search, Send, Shield, Star, X } from "lucide-react";
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

const PRACTICE_KEYWORDS =
  /(practice|playbook|guide|checklist|hardening|mitigation|response|defense|incident|baseline|detection|remediation|compliance|policy)/i;

const TOOL_KEYWORDS =
  /(tool|platform|framework|scanner|agent|automation|open[-\s]?source|github|model|cli|integration|vendor|product|release)/i;

const articleSignal = (article: Pick<HomeArticle, "title" | "summary" | "category">): string =>
  `${article.title} ${article.summary} ${article.category}`.toLowerCase();

const isLikelyPracticeArticle = (article: HomeArticle): boolean => {
  const signal = articleSignal(article);
  if (PRACTICE_KEYWORDS.test(signal)) {
    return true;
  }

  const category = normalizeCategory(article.category);
  return /(vulnerab|threat|research|government|compliance|security-control)/.test(category);
};

const isLikelyToolArticle = (article: HomeArticle): boolean => {
  const signal = articleSignal(article);
  if (TOOL_KEYWORDS.test(signal)) {
    return true;
  }

  const category = normalizeCategory(article.category);
  return /(ai|tool|automation|platform|product|framework)/.test(category);
};

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"all" | CategoryKey>("all");
  const [query, setQuery] = useState("");
  const [heroEmail, setHeroEmail] = useState("");
  const [heroSubscribeState, setHeroSubscribeState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [heroSubscribeMessage, setHeroSubscribeMessage] = useState("");

  // Subscription Modal State
  const [modalStep, setModalStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);

  const [articles, setArticles] = useState<HomeArticle[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("subscribe") === "1") {
      setIsOpen(true);
      params.delete("subscribe");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, []);

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

    loadArticles();

    return () => {
      isMounted = false;
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const dynamicCategories = buildCategoryList(articles.map((article) => article.category), 10);

    return [
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

  const latestArticles = useMemo(() => filteredArticles.slice(0, 4), [filteredArticles]);

  const featuredPracticeArticles = useMemo(
    () => {
      const focused = articles.filter((article) => isLikelyPracticeArticle(article));
      const selected = focused.slice(0, 3);

      if (selected.length >= 3) {
        return selected;
      }

      const used = new Set(selected.map((article) => article.id));
      const fillers = articles.filter((article) => !used.has(article.id)).slice(0, 3 - selected.length);
      return [...selected, ...fillers];
    },
    [articles]
  );

  const featuredToolArticles = useMemo(
    () => {
      const focused = articles.filter((article) => isLikelyToolArticle(article));
      const selected = focused.slice(0, 3);

      if (selected.length >= 3) {
        return selected;
      }

      const used = new Set(selected.map((article) => article.id));
      const fillers = articles.filter((article) => !used.has(article.id)).slice(0, 3 - selected.length);
      return [...selected, ...fillers];
    },
    [articles]
  );

  const toggleInterest = (interest: string) => {
    setInterests(prev => 
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const handleSubscribeSubmit = async () => {
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, interests }),
      });
      if (!res.ok) {
        console.error("Subscription failed");
        // You might want to show an error toast here
      }
    } catch (err) {
      console.error(err);
    }
    
    // Trigger Success Animation
    setIsSuccess(true);
    setModalStep(4);
    setTimeout(() => {
      setIsOpen(false);
      // Reset after close animation completes
      setTimeout(() => {
        setIsSuccess(false);
        setModalStep(1);
        setName("");
        setEmail("");
        setInterests([]);
      }, 500);
    }, 2000);
  };

  return (
    <div className="flex flex-col min-h-screen font-sans bg-[#09090b]">
      
      {/* 1. HERO SECTION (BLACK) */}
      <section className="relative flex min-h-[100svh] w-full flex-col justify-center bg-[#09090b] pb-20 text-[#fafafa] md:min-h-[92svh] md:pb-24">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 pb-10 pt-10 text-center md:pt-14">
          <h1 className="mb-5 text-[2.35rem] font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Master InfoSec with{" "}
            <span className="inline-flex items-center whitespace-nowrap bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
              <span>Daily</span>
              <span className="ml-2">Updates</span>
            </span>
          </h1>
          <p className="mb-8 max-w-2xl px-4 text-sm text-zinc-400 md:text-base">
            Get the latest cybersecurity news, understand current threats, and learn how to secure your infrastructure against modern attacks.
          </p>
          <div className="mx-auto mb-4 mt-4 flex w-full max-w-[760px] items-center overflow-hidden rounded-[0.75rem] border border-zinc-200 bg-white p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.20)]">
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
              className="flex h-11 min-w-max items-center justify-center gap-2 rounded-[0.55rem] bg-[#18181b] px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 sm:h-12 sm:rounded-[0.65rem] sm:px-6 sm:text-[15px]"
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
          <div className="mt-8 flex flex-col items-center">
            <p className="text-sm font-medium text-zinc-500 mb-6 uppercase tracking-wider">
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
      <main className="relative z-20 -mt-8 w-full flex-1 rounded-t-[1.05rem] bg-white pb-20 pt-16 text-zinc-900 shadow-2xl md:-mt-10 md:rounded-t-[1.4rem] md:pt-12">
        <div className="max-w-5xl mx-auto px-6 text-center">
          
          {/* SEARCH & FILTERS */}
          <div className="flex flex-col items-center gap-6 mb-16">
            {/* Centered Typography */}
            <div>
              <h2 className="text-4xl font-bold text-zinc-900 mb-2">Trending Topics</h2>
              <p className="text-zinc-500 text-lg">The most useful InfoSec content — organized and categorized in one spot.</p>
            </div>

             <div className="w-full max-w-md mx-auto mt-4 mb-4">
              {/* Flat Search Bar without heavy effects */}
              <div className="flex items-center gap-2 px-3 py-2.5 border border-zinc-300 rounded focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600 transition-all bg-white">
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
            <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
              {categoryOptions.map((cat) => (
                <button 
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex items-center gap-2 h-10 px-5 text-sm font-medium border whitespace-nowrap rounded-full transition-colors ${activeCategory === cat.key ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'}`}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              ))}
            </div>
            
          </div>

          {/* LATEST ARTICLES */}
          <section id="articles" className="mb-24">
            <div className="border-b border-zinc-200 pb-4 mb-10">
              <h2 className="text-3xl font-bold text-zinc-900 mb-2">Latest Intel</h2>
              <p className="text-zinc-500">The latest developments in InfoSec and Threat Intelligence.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
               {latestArticles.map((article) => (
                  <article key={article.id} onClick={() => window.location.href=`/articles/${article.slug}`} className="group flex flex-col bg-white border border-zinc-200 rounded-lg overflow-hidden hover:border-zinc-300 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer relative bg-clip-padding">
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100">
                      <img
                        src={article.image_url || "/cover.avif"}
                        alt={article.title}
                        className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                      <div className="absolute bottom-3 left-3 bg-white border border-zinc-200 shadow-sm text-xs font-bold text-zinc-800 px-3 py-1.5 rounded-sm backdrop-blur">
                        {getCategoryLabel(article.category)}
                      </div>
                    </div>
                    
                    <div className="p-6 flex flex-col flex-1">
                      <p className="text-xs text-zinc-400 font-mono mb-3">{new Date(article.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                      <h3 className="text-xl font-bold text-zinc-900 mb-3 leading-tight group-hover:text-blue-600 transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-zinc-600 text-sm leading-relaxed line-clamp-3 mb-6 flex-1">
                        {article.summary}
                      </p>
                      
                      {/* Author Area */}
                      <div className="flex items-center mt-auto border-t border-zinc-100 pt-5">
                        <div className="mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 p-2">
                          <img
                            src="/brand/Small_Icon.svg"
                            alt="7secure icon"
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 leading-none">7secure</p>
                          <p className="text-xs text-zinc-500 mt-1">Source Analysis</p>
                        </div>
                      </div>
                    </div>
                  </article>
               ))}
            </div>
            {latestArticles.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-zinc-500">
                No articles matched this category and search term.
              </div>
            )}
            
            <div className="mt-12 text-center">
               <a href="/articles" className="inline-flex items-center justify-center font-medium text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 h-10 px-6 rounded-md transition-colors">
                 View All Articles
               </a>
            </div>
          </section>

          {/* BEST PRACTICES & TOOLS */}
          <section id="practices" className="mb-10 text-center">
            <div className="border-b border-zinc-200 pb-4 mb-10">
              <h2 className="text-3xl font-bold text-zinc-900 mb-2">Best Practices & Tools</h2>
              <p className="text-zinc-500">Deep technical writeups and strategic security frameworks.</p>
            </div>
            
            <div className="mx-auto grid max-w-5xl gap-6 text-left md:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-6">
                <div className="mb-4 flex items-center gap-2 text-zinc-900">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <h3 className="text-xl font-bold">Security practices</h3>
                </div>
                <div className="space-y-3">
                  {featuredPracticeArticles.map((article) => (
                    <a
                      key={article.id}
                      href={`/articles/${article.slug}`}
                      className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
                    >
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                        {getCategoryLabel(article.category)}
                      </p>
                      <h4 className="mt-1 text-sm font-semibold text-zinc-900 line-clamp-2">{article.title}</h4>
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

              <div id="tools" className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-6">
                <div className="mb-4 flex items-center gap-2 text-zinc-900">
                  <Bot className="h-5 w-5 text-blue-600" />
                  <h3 className="text-xl font-bold">Tool watch</h3>
                </div>
                <div className="space-y-3">
                  {featuredToolArticles.map((article) => (
                    <a
                      key={article.id}
                      href={`/articles/${article.slug}`}
                      className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
                    >
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                        {getCategoryLabel(article.category)}
                      </p>
                      <h4 className="mt-1 text-sm font-semibold text-zinc-900 line-clamp-2">{article.title}</h4>
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
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
          <h2 className="text-2xl md:text-4xl font-bold mb-8 leading-snug">
            "Information security is not a project, it's an ongoing discipline. Stay updated daily."
          </h2>
          <Button variant="primary" onPress={() => setIsOpen(true)} className="bg-white text-black font-bold h-12 px-8 rounded-lg hover:bg-zinc-200 transition-colors">
            Subscribe to the Newsletter
          </Button>
        </div>
      </section>

      {/* FIXED SUBSCRIPTION MODAL W/ WORKFLOW & ANIMATION */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20, transition: { duration: 0.2 } }}
              className="bg-white rounded-lg shadow-2xl w-full max-w-md relative overflow-hidden"
            >
              
              {/* Close Button */}
              <button 
                 onClick={() => setIsOpen(false)}
                  aria-label="Close subscription modal"
                  title="Close"
                 className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 bg-zinc-50 rounded-full p-1"
              >
                 <X className="w-5 h-5" />
              </button>

              <div className="p-8">
                {/* Header */}
                <div className="flex flex-col items-center justify-center mb-8">
                  <Image src="/Small_Icon.svg" alt="Icon" width={32} height={32} className="mb-3 bg-[#09090b] rounded-full p-1.5" />
                  <h2 className="text-2xl font-bold text-zinc-900 text-center">Join 7secure</h2>
                  {modalStep !== 4 && (
                    <p className="text-sm text-zinc-500 mt-1 text-center">Step {modalStep} of 3</p>
                  )}
                </div>

                {/* Form Steps */}
                <div className="min-h-[140px] flex flex-col justify-center">
                  
                  {modalStep === 1 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <label className="block text-sm font-semibold text-zinc-900 mb-2">What should we call you?</label>
                      <input 
                        type="text" 
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe" 
                        onKeyDown={(e) => { if(e.key === 'Enter' && name) setModalStep(2); }}
                        className="w-full border border-zinc-300 rounded-md px-4 py-2.5 text-zinc-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      />
                    </motion.div>
                  )}

                  {modalStep === 2 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                      <label className="block text-sm font-semibold text-zinc-900 mb-3">Which topics interest you most?</label>
                      <div className="flex flex-wrap gap-2">
                        {["News", "Tools", "Agents", "Deep Dives", "Security"].map((tag) => {
                          const isSelected = interests.includes(tag);
                          return (
                            <button
                               key={tag}
                               onClick={() => toggleInterest(tag)}
                               className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${isSelected ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400'}`}
                            >
                               {isSelected && <CheckCircle2 className="w-3.5 h-3.5 inline-block mr-1 opacity-70" />}
                               {tag}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {modalStep === 3 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                      <label className="block text-sm font-semibold text-zinc-900 mb-2">Where should we send the intel?</label>
                      <input 
                        type="email" 
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@company.com" 
                        onKeyDown={(e) => { if(e.key === 'Enter' && email) handleSubscribeSubmit(); }}
                        className="w-full border border-zinc-300 rounded-md px-4 py-2.5 text-zinc-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      />
                    </motion.div>
                  )}

                  {modalStep === 4 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -40, scale: 0.8 }} 
                      animate={{ opacity: 1, y: 0, scale: 1 }} 
                      className="flex flex-col items-center justify-center py-4"
                    >
                      <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
                         <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold text-zinc-900">You're on the list!</h3>
                      <p className="text-sm text-zinc-500 mt-2 text-center">Check your inbox to confirm your subscription.</p>
                    </motion.div>
                  )}

                </div>

                {/* Footer Controls */}
                {modalStep < 4 && (
                  <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-zinc-100">
                    {modalStep > 1 && (
                      <button 
                        onClick={() => setModalStep(s => s - 1)} 
                        className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
                      >
                        Back
                      </button>
                    )}
                    <button 
                       onClick={() => {
                         if (modalStep === 1 && !name) return;
                         if (modalStep === 2 && interests.length === 0) return; // or let them skip
                         if (modalStep === 3) {
                           handleSubscribeSubmit();
                         } else {
                           setModalStep(s => s + 1);
                         }
                       }}
                       disabled={(modalStep === 1 && !name) || (modalStep === 3 && !email)}
                       className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {modalStep === 3 ? "Complete Subscription" : "Next Step"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
