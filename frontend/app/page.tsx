"use client";

import Image from "next/image";
import { Button, Checkbox } from "@heroui/react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Star, 
  LayoutGrid, 
  Bot, 
  Users, 
  Code, 
  Rocket, 
  PenTool, 
  Shield, 
  Briefcase,
  Search,
  CheckCircle2,
  X,
  Menu
} from "lucide-react";

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");

  // Subscription Modal State
  const [modalStep, setModalStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);

  const categories = [
    { name: "Most Popular", icon: <Star className="w-4 h-4" /> },
    { name: "All", icon: <LayoutGrid className="w-4 h-4" /> },
    { name: "Agents", icon: <Bot className="w-4 h-4" /> },
    { name: "Consumer", icon: <Users className="w-4 h-4" /> },
    { name: "Code", icon: <Code className="w-4 h-4" /> },
    { name: "Marketing", icon: <Rocket className="w-4 h-4" /> },
    { name: "Content", icon: <PenTool className="w-4 h-4" /> },
    { name: "Security", icon: <Shield className="w-4 h-4" /> },
    { name: "Operations", icon: <Briefcase className="w-4 h-4" /> }
  ];

  // Placeholder for Supabase Articles
  const [articles, setArticles] = useState([
    {
      id: 1,
      title: "Zero-Day Exploit Found in Popular VPN",
      excerpt: "Attackers are exploiting a new vulnerability in market-leading VPN software. Here is how to patch it immediately.",
      label: "Security",
      author: "7secure",
      authorImage: "/Small_Icon.svg", 
      cover: "/cover.avif", 
      date: "Oct 24, 2026",
    },
    {
      id: 2,
      title: "The Rise of AI-Generated Phishing",
      excerpt: "How threat actors are utilizing LLMs to craft hyper-personalized and error-free phishing campaigns at scale.",
      label: "Agents",
      author: "Jane Doe",
      authorImage: "/cover.avif",
      cover: "/cover.avif",
      date: "Oct 22, 2026",
    }
  ]);

  const toggleInterest = (interest: string) => {
    setInterests(prev => 
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const handleSubscribeSubmit = () => {
    // Trigger Success Animation
    setIsSuccess(true);
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
      <section className="w-full bg-[#09090b] text-[#fafafa] flex flex-col justify-start relative pb-32">
        {/* Navigation */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-4 sticky top-0 bg-[#09090b]/80 backdrop-blur-md z-40 border-b border-white/10">
          <div className="flex items-center">
            <a href="/">
               <Image src="/7secure_logo.svg" alt="7secure logo" width={130} height={35} priority className="pl-2" />
            </a>
          </div>
          
          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <a href="#articles" className="hover:text-white transition-colors">Latest News</a>
            <a href="#practices" className="hover:text-white transition-colors">Playbook</a>
            <a href="#tools" className="hover:text-white transition-colors">Tools</a>
          </nav>
          
          <div className="hidden md:flex items-center gap-4">
            <a href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Login</a>
            <Button variant="primary" onPress={() => setIsOpen(true)} className="bg-white text-black font-semibold text-sm h-9 px-4 rounded-md hover:bg-zinc-200 transition-colors">
              Subscribe
            </Button>
          </div>

          {/* Mobile Nav Toggle */}
          <button className="md:hidden p-2 text-zinc-400 hover:text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden absolute top-[70px] left-0 w-full bg-[#09090b] border-b border-white/10 flex flex-col p-4 gap-4 z-30"
            >
              <a href="#articles" className="text-white font-medium pl-2" onClick={() => setIsMobileMenuOpen(false)}>Latest News</a>
              <a href="#practices" className="text-white font-medium pl-2" onClick={() => setIsMobileMenuOpen(false)}>Playbook</a>
              <a href="#tools" className="text-white font-medium pl-2" onClick={() => setIsMobileMenuOpen(false)}>Tools</a>
              <hr className="border-white/10 my-2" />
              <a href="/login" className="text-white font-medium pl-2">Login</a>
              <Button variant="primary" onPress={() => { setIsMobileMenuOpen(false); setIsOpen(true); }} className="bg-white text-black font-semibold text-sm h-10 w-full rounded-md mt-2">
                Subscribe
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 w-full max-w-5xl mx-auto px-6 pt-16 pb-8 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6">
            Master InfoSec with <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600">Daily Updates</span>
          </h1>
          <p className="text-base md:text-lg text-zinc-400 mb-10 max-w-2xl px-4">
            Get the latest cybersecurity news, understand current threats, and learn how to secure your infrastructure against modern attacks.
          </p>
          
          <div className="mt-8 flex flex-col items-center">
            <p className="text-sm font-medium text-zinc-500 mb-6 uppercase tracking-wider">
              Join readers from leading companies
            </p>
            <div className="flex justify-center items-center opacity-60 hover:opacity-80 transition-opacity">
              {/* Replace generic texts with actual company logo SVG line */}
              <Image src="/icons.svg" alt="Leading Companies" width={400} height={45} className="max-w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. NEWSLETTER CONTENT (WHITE) -> Rounded top intersection */}
      <main className="flex-1 w-full bg-white text-zinc-900 rounded-t-[2.5rem] -mt-10 relative z-10 pt-16 pb-20 shadow-[-10px_-10px_30px_0px_rgba(0,0,0,0.5)]">
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
                    className="bg-transparent border-none outline-none w-full placeholder-zinc-400 text-zinc-800 text-sm" 
                 />
              </div>
            </div>

            {/* Categories Tags (Centered) */}
            <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
              {categories.map((cat) => (
                <button 
                  key={cat.name}
                  onClick={() => setActiveCategory(cat.name)}
                  className={`flex items-center gap-2 h-10 px-5 text-sm font-medium border whitespace-nowrap rounded-full transition-colors ${activeCategory === cat.name ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'}`}
                >
                  {cat.icon}
                  {cat.name}
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
               {articles.map((article) => (
                  <article key={article.id} onClick={() => window.location.href=`/articles/${article.id}`} className="group flex flex-col bg-white border border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-300 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer relative bg-clip-padding">
                    <div className="aspect-[16/9] w-full bg-zinc-200 relative overflow-hidden flex items-center justify-center">
                      <span className="text-zinc-400 font-mono text-xs">Cover Image Placeholder</span>
                      <div className="absolute bottom-3 left-3 bg-white border border-zinc-200 shadow-sm text-xs font-bold text-zinc-800 px-3 py-1.5 rounded-md backdrop-blur">
                        {article.label}
                      </div>
                    </div>
                    
                    <div className="p-6 flex flex-col flex-1">
                      <p className="text-xs text-zinc-400 font-mono mb-3">{article.date}</p>
                      <h3 className="text-xl font-bold text-zinc-900 mb-3 leading-tight group-hover:text-blue-600 transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-zinc-600 text-sm leading-relaxed line-clamp-3 mb-6 flex-1">
                        {article.excerpt}
                      </p>
                      
                      {/* Author Area */}
                      <div className="flex items-center mt-auto border-t border-zinc-100 pt-5">
                        <div className="w-9 h-9 rounded-full bg-zinc-200 overflow-hidden relative mr-3 border border-zinc-200 flex items-center justify-center shrink-0 text-zinc-400 text-xs font-bold">
                           <Image src={article.authorImage} alt={article.author} fill className="object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 leading-none">{article.author}</p>
                          <p className="text-xs text-zinc-500 mt-1">Source Analysis</p>
                        </div>
                      </div>
                    </div>
                  </article>
               ))}
            </div>
            
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
            
            <div className="flex flex-col gap-4 max-w-3xl mx-auto text-left">
               {["Building a modern SOC from scratch", "Automating malware analysis with AI", "Cloud Security Posture Management"].map((exclusive, i) => (
                 <a href="/practices" key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded border border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 hover:border-zinc-300 transition-all group gap-4">
                   <div className="flex items-start gap-4">
                     <div className="w-10 h-10 rounded border border-zinc-200 bg-white text-blue-600 flex items-center justify-center shrink-0">
                       <Shield className="w-5 h-5"/>
                     </div>
                     <div>
                       <h3 className="text-lg font-bold text-zinc-900 group-hover:text-blue-600 transition-colors mb-1">{exclusive}</h3>
                       <p className="text-sm text-zinc-500">Framework Guide • Updated Today</p>
                     </div>
                   </div>
                   <div className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                      →
                   </div>
                 </a>
               ))}
               <div className="mt-8 text-center pt-4">
                 <a href="/tools" className="text-blue-600 font-medium hover:text-blue-700 text-sm inline-flex items-center gap-1">
                   View all tools and practices <span aria-hidden="true">&rarr;</span>
                 </a>
               </div>
            </div>
          </section>
        </div>
      </main>

      {/* 3. INTERSECTION QUOTE SECTION (BLACK) */}
      <section className="w-full bg-[#09090b] text-[#fafafa] py-24 px-6 text-center border-t border-white/5 relative z-0">
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
      <footer className="w-full bg-white border-t border-zinc-200 py-16 px-6 relative z-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
          
          <div className="flex flex-col items-start gap-4 md:col-span-1">
             <Image src="/7secure_logo.svg" alt="7secure logo" width={110} height={28} className="brightness-0" />
             <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
               Empowering teams with actionable security intel directly to your inbox.
             </p>
             <div className="flex gap-4 mt-2">
               <a href="https://twitter.com" className="w-8 h-8 rounded border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:text-blue-500 hover:border-blue-200 transition-colors">
                 <svg fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
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
                  <Image src="/Small_Icon.svg" alt="Icon" width={36} height={36} className="mb-3 brightness-0" />
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
