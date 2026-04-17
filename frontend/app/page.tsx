"use client";

import Image from "next/image";
import { Button } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabasePublic } from "../lib/supabase";
import { Bot, CheckCircle2, Search, Send, Shield, Star, X } from "lucide-react";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
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

const getSourceInitials = (sourceName?: string | null): string => {
  const cleaned = (sourceName || "7secure")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim();

  if (!cleaned) {
    return "7S";
  }

  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "7S";
};

const PRACTICE_CATEGORY_SET = new Set<CategoryKey>([
  "vulnerabilities",
  "threat-intel",
  "research",
  "government"
]);

const TOOL_CATEGORY_SET = new Set<CategoryKey>([
  "ai-security",
  "industry-news",
  "vulnerabilities",
  "threat-intel"
]);

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"all" | CategoryKey>("all");
  const [query, setQuery] = useState("");

  // Subscription Modal State
  const [modalStep, setModalStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);

  const [articles, setArticles] = useState<HomeArticle[]>([]);

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
    const availableCategories = new Set<CategoryKey>(
      articles.map((article) => normalizeCategory(article.category))
    );

    const orderedCategories = (availableCategories.size
      ? CATEGORY_ORDER.filter((category) => availableCategories.has(category))
      : CATEGORY_ORDER
    ).map((category) => ({
      key: category,
      label: CATEGORY_META[category].label,
      Icon: CATEGORY_META[category].icon
    }));

    return [
      { key: "all" as const, label: "All", icon: <Star className="h-4 w-4" /> },
      ...orderedCategories.map((category) => {
        const Icon = category.Icon;
        return {
          key: category.key,
          label: category.label,
          icon: <Icon className="h-4 w-4" />
        };
      })
    ];
  }, [articles]);

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
    () =>
      articles
        .filter((article) => PRACTICE_CATEGORY_SET.has(normalizeCategory(article.category)))
        .slice(0, 3),
    [articles]
  );

  const featuredToolArticles = useMemo(
    () =>
      articles
        .filter((article) => TOOL_CATEGORY_SET.has(normalizeCategory(article.category)))
        .slice(0, 3),
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
      <section className="relative flex w-full flex-col justify-start bg-[#09090b] pb-16 text-[#fafafa] md:pb-20">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-6 pt-8 text-center md:pt-10">
          <h1 className="mb-5 text-3xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
            Master InfoSec with <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600">Daily Updates</span>
          </h1>
          <p className="mb-8 max-w-2xl px-4 text-sm text-zinc-400 md:text-base">
            Get the latest cybersecurity news, understand current threats, and learn how to secure your infrastructure against modern attacks.
          </p>
          <div className="mx-auto mb-4 mt-4 flex w-full max-w-[760px] items-center overflow-hidden rounded-[0.9rem] border border-zinc-200 bg-white p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.20)]">
            <input
              type="email"
              placeholder="Email Address"
              autoComplete="email"
              className="h-11 flex-1 border-none bg-transparent px-4 text-[14px] text-zinc-900 placeholder:text-zinc-500 outline-none sm:h-12 sm:px-5 sm:text-[15px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") setIsOpen(true);
              }}
            />
            <Button
              variant="primary"
              onPress={() => setIsOpen(true)}
              className="flex h-11 min-w-max items-center justify-center gap-2 rounded-[0.65rem] bg-[#18181b] px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 sm:h-12 sm:rounded-[0.75rem] sm:px-6 sm:text-[15px]"
            >
              <span>Subscribe</span>
              <Send className="h-4 w-4 shrink-0 translate-y-px stroke-[2px] opacity-90" />
            </Button>
          </div>
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
      <main className="relative z-20 -mt-6 w-full flex-1 rounded-t-[2.5rem] bg-white pb-20 pt-12 text-zinc-900 shadow-2xl md:-mt-8">
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
                  <article key={article.id} onClick={() => window.location.href=`/articles/${article.slug}`} className="group flex flex-col bg-white border border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-300 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer relative bg-clip-padding">
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100">
                      <img
                        src={article.image_url || "/cover.avif"}
                        alt={article.title}
                        className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                      <div className="absolute bottom-3 left-3 bg-white border border-zinc-200 shadow-sm text-xs font-bold text-zinc-800 px-3 py-1.5 rounded-md backdrop-blur">
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
                        <div className="w-9 h-9 rounded-full bg-zinc-200 overflow-hidden relative mr-3 border border-zinc-200 flex items-center justify-center shrink-0 text-zinc-600 text-xs font-bold">
                          {getSourceInitials(article.source_name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 leading-none">{(article.source_name || "7secure")}</p>
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
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-6">
                <div className="mb-4 flex items-center gap-2 text-zinc-900">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <h3 className="text-xl font-bold">Security practices</h3>
                </div>
                <div className="space-y-3">
                  {featuredPracticeArticles.map((article) => (
                    <a
                      key={article.id}
                      href={`/articles/${article.slug}`}
                      className="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
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

              <div id="tools" className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-6">
                <div className="mb-4 flex items-center gap-2 text-zinc-900">
                  <Bot className="h-5 w-5 text-blue-600" />
                  <h3 className="text-xl font-bold">Tool watch</h3>
                </div>
                <div className="space-y-3">
                  {featuredToolArticles.map((article) => (
                    <a
                      key={article.id}
                      href={`/articles/${article.slug}`}
                      className="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
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

      {/* 4. EXTANDED FOOTER (WHITE) */}
      <footer className="w-full bg-white border-t border-zinc-200 py-16 px-6 relative z-10 mt-12 md:mt-24 rounded-t-[2.5rem]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
          
          <div className="flex flex-col items-start gap-4 md:col-span-1">
              <Image src="/7secure_logo.svg" alt="7secure logo" width={90} height={24} className="brightness-0" />
             <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
               Empowering teams with actionable security intel directly to your inbox.
             </p>
             <div className="flex gap-4 mt-2">
               <a href="https://x.com" aria-label="X" className="w-8 h-8 rounded border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 hover:text-black hover:border-zinc-400 transition-colors">
                 <span className="text-[11px] font-bold tracking-wide">X</span>
               </a>
               <a href="https://linkedin.com" className="w-8 h-8 rounded border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:text-blue-700 hover:border-blue-200 transition-colors">
                 <svg fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
               </a>
             </div>
          </div>
          
          <div className="flex flex-col gap-3">
             <h4 className="font-semibold text-zinc-900">Content</h4>
             <a href="/articles" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Latest News</a>
             <a href="/practices" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Best Practices</a>
             <a href="/tools" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Trending Tools</a>
          </div>

          <div className="flex flex-col gap-3">
             <h4 className="font-semibold text-zinc-900">Legal</h4>
             <a href="/privacy" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Privacy Policy</a>
             <a href="/terms" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Terms of Service</a>
             <a href="/cookies" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Cookie Policy</a>
          </div>
          
          <div className="flex flex-col gap-3">
             <h4 className="font-semibold text-zinc-900">Company</h4>
             <a href="/about" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">About Us</a>
             <a href="/contact" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Contact</a>
             <a href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Sign In</a>
          </div>

        </div>
        <div className="max-w-5xl mx-auto mt-12 pt-8 border-t border-zinc-100 text-center md:text-left text-sm text-zinc-400">
          © 2026 7secure Inc. All rights reserved.
        </div>
      </footer>

      {/* FIXED SUBSCRIPTION MODAL W/ WORKFLOW & ANIMATION */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20, transition: { duration: 0.2 } }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md relative overflow-hidden"
            >
              
              {/* Close Button */}
              <button 
                 onClick={() => setIsOpen(false)}
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
