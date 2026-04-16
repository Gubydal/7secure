"use client";

import Image from "next/image";
import { Button, Modal, Input, CheckboxGroup, Checkbox } from "@heroui/react";
import { useState, useEffect } from "react";

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = [
    "Most Popular", "All", "Agents", "Consumer", "Code", "Marketing", "Content Creator", "Security", "Operations"
  ];

  // Placeholder for Supabase Articles
  const [articles, setArticles] = useState([
    {
      id: 1,
      title: "Zero-Day Exploit Found in Popular VPN",
      excerpt: "Attackers are exploiting a new vulnerability in market-leading VPN software. Here is how to patch it immediately.",
      label: "Security",
      author: "7secure",
      authorImage: "/Small_Icon.svg", // Default 7secure author
      cover: "/cover.avif", // Place for cover image
      date: "Oct 24, 2026",
    },
    {
      id: 2,
      title: "The Rise of AI-Generated Phishing",
      excerpt: "How threat actors are utilizing LLMs to craft hyper-personalized and error-free phishing campaigns at scale.",
      label: "Agents",
      author: "Jane Doe",
      authorImage: "/avatar.png",
      cover: "/cover.avif",
      date: "Oct 22, 2026",
    }
  ]);

  return (
    <div className="flex flex-col min-h-screen font-sans bg-[#09090b]">
      
      {/* 1. HERO SECTION (BLACK) */}
      <section className="w-full bg-[#09090b] text-[#fafafa] flex flex-col justify-start relative pb-32">
        {/* Navigation */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-4 sticky top-0 bg-[#09090b]/80 backdrop-blur-md z-50">
          <div className="flex items-center">
            <Image src="/7secure_logo.svg" alt="7secure logo" width={130} height={35} priority className="pl-2" />
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
          <button className="md:hidden p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>
            </svg>
          </button>
        </header>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-[70px] left-0 w-full bg-[#09090b] border-b border-white/10 flex flex-col p-4 gap-4 z-40">
            <a href="#articles" className="text-white font-medium" onClick={() => setIsMobileMenuOpen(false)}>Latest News</a>
            <a href="#practices" className="text-white font-medium" onClick={() => setIsMobileMenuOpen(false)}>Playbook</a>
            <a href="#tools" className="text-white font-medium" onClick={() => setIsMobileMenuOpen(false)}>Tools</a>
            <hr className="border-white/10" />
            <a href="/login" className="text-white font-medium">Login</a>
            <Button variant="primary" onPress={() => setIsOpen(true)} className="bg-white text-black font-semibold text-sm h-10 w-full rounded-md mt-2">
              Subscribe
            </Button>
          </div>
        )}

        <div className="flex-1 w-full max-w-5xl mx-auto px-6 pt-16 pb-8 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6">
            Master InfoSec with <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-600">Daily Updates</span>
          </h1>
          <p className="text-base md:text-lg text-zinc-400 mb-10 max-w-2xl px-4">
            Get the latest cybersecurity news, understand current threats, and learn how to secure your infrastructure against modern attacks.
          </p>
          
          <div className="w-full max-w-md flex flex-col sm:flex-row items-center bg-zinc-900 border border-white/10 p-1.5 rounded-xl transition focus-within:border-white/30">
            <input 
              type="email" 
              placeholder="Enter your email..." 
              className="flex-1 w-full bg-transparent border-none outline-none text-white px-4 py-2 sm:py-0 placeholder-zinc-500"
            />
            <Button variant="primary" onPress={() => setIsOpen(true)} className="bg-blue-600 text-white font-semibold h-11 w-full sm:w-auto px-6 rounded-lg sm:ml-2 hover:bg-blue-500 transition-colors mt-2 sm:mt-0">
              Subscribe
            </Button>
          </div>

          <div className="mt-16 flex flex-col items-center">
            <p className="text-sm font-medium text-zinc-500 mb-6 uppercase tracking-wider">
              Join readers from leading companies
            </p>
            <div className="flex justify-center items-center opacity-60 hover:opacity-80 transition-opacity">
              <Image src="/icons.svg" alt="Leading Companies" width={300} height={40} className="max-w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. NEWSLETTER CONTENT (WHITE) -> Rounded top intersection */}
      <main className="flex-1 w-full bg-white text-zinc-900 rounded-t-[2.5rem] -mt-10 relative z-10 pt-16 pb-20 shadow-[-10px_-10px_30px_0px_rgba(0,0,0,0.5)]">
        <div className="max-w-5xl mx-auto px-6">
          
          {/* SEARCH & FILTERS */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
            <div className="flex flex-wrap gap-2 overflow-x-auto w-full md:w-auto pb-2 scrollbar-hide">
              {categories.map((cat) => (
                <Button 
                  key={cat}
                  variant={activeCategory === cat ? "primary" : "outline"} 
                  onPress={() => setActiveCategory(cat)}
                  className={`h-9 px-4 text-sm font-medium border-zinc-200 whitespace-nowrap rounded-md ${activeCategory === cat ? 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800' : 'bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
                >
                  {cat === "Most Popular" && <span className="mr-1">★</span>}
                  {cat}
                </Button>
              ))}
            </div>
            
            <div className="w-full md:w-64">
              <Input 
                 placeholder="Search articles, tools..." 
                 className="w-full bg-white border border-zinc-200 hover:border-zinc-300 focus-within:border-blue-500 shadow-sm text-zinc-800"
              />
            </div>
          </div>

          {/* LATEST ARTICLES */}
          <section id="articles" className="mb-20">
            <div className="flex justify-between items-end border-b border-zinc-200 pb-4 mb-8">
              <div>
                <h2 className="text-3xl font-bold text-zinc-900 mb-2">Latest Intel</h2>
                <p className="text-zinc-500">The latest developments in InfoSec and Threat Intelligence.</p>
              </div>
              <a href="#" className="hidden sm:block text-blue-600 font-medium hover:text-blue-700">View All →</a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {articles.map((article) => (
                  <article key={article.id} className="group flex flex-col bg-white border border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-300 hover:shadow-lg transition-all duration-200 cursor-pointer text-left">
                    <div className="aspect-[16/9] w-full bg-zinc-100 relative overflow-hidden">
                      {/* Image Place holder for Supabase cover images */}
                      <Image src={article.cover} alt="Cover" fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur text-xs font-mono text-zinc-800 px-2 py-1 rounded">
                        {article.label}
                      </div>
                    </div>
                    
                    <div className="p-6 flex flex-col flex-1">
                      <p className="text-xs text-zinc-400 font-mono mb-3">{article.date}</p>
                      <h3 className="text-xl font-bold text-zinc-900 mb-3 leading-tight group-hover:text-blue-600 transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-zinc-600 text-sm leading-relaxed line-clamp-2 mb-6 flex-1">
                        {article.excerpt}
                      </p>
                      
                      {/* Author Area */}
                      <div className="flex items-center mt-auto border-t border-zinc-100 pt-4">
                        <div className="w-8 h-8 rounded-full bg-zinc-200 overflow-hidden relative mr-3 border border-zinc-200">
                           <Image src={article.authorImage} alt={article.author} fill className="object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">{article.author}</p>
                          <p className="text-xs text-zinc-500">Security Researcher</p>
                        </div>
                      </div>
                    </div>
                  </article>
               ))}
            </div>
            <div className="mt-8 text-center sm:hidden">
               <Button variant="outline" className="w-full border-zinc-200 font-medium text-zinc-700 h-10 rounded-md">
                 View All Articles
               </Button>
            </div>
          </section>

          {/* BEST PRACTICES & TOOLS */}
          <section id="practices" className="mb-10 text-left">
            <div className="border-b border-zinc-200 pb-4 mb-8">
              <h2 className="text-3xl font-bold text-zinc-900 mb-2">Best Practices & Tools</h2>
              <p className="text-zinc-500">Deep technical writeups and strategic security frameworks.</p>
            </div>
            <div className="flex flex-col gap-4">
               {["Building a modern SOC from scratch", "Automating malware analysis with AI", "Cloud Security Posture Management"].map((exclusive, i) => (
                 <a href="#" key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300 transition-all group gap-4">
                   <div className="flex items-start gap-4">
                     <div className="w-10 h-10 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
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
               <div className="mt-4 text-center">
                 <a href="#tools" className="text-blue-600 font-medium hover:text-blue-700 text-sm">View all tools and practices →</a>
               </div>
            </div>
          </section>
        </div>
      </main>

      {/* 3. INTERSECTION QUOTE SECTION (BLACK) */}
      <section className="w-full bg-[#09090b] text-[#fafafa] py-24 px-6 text-center border-t border-white/5 relative z-0">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-bold mb-6 leading-snug">
            "Information security is not a project, it's an ongoing discipline. Stay updated daily."
          </h2>
          <Button variant="primary" onPress={() => setIsOpen(true)} className="bg-white text-black font-bold h-12 px-8 rounded-lg hover:bg-zinc-200 transition-colors">
            Subscribe to the Newsletter
          </Button>
        </div>
      </section>

      {/* 4. FOOTER (WHITE) */}
      <footer className="w-full bg-white border-t border-zinc-200 py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-4">
             <Image src="/7secure_logo.svg" alt="7secure logo" width={100} height={25} className="brightness-0" />
             <p className="text-sm text-zinc-500 mt-2">Empowering teams with actionable security intel.</p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-zinc-600">
             <a href="#" className="hover:text-zinc-900 transition-colors">Playbook</a>
             <a href="#" className="hover:text-zinc-900 transition-colors">Tools</a>
             <a href="#" className="hover:text-zinc-900 transition-colors">Privacy Policy</a>
             <a href="#" className="hover:text-zinc-900 transition-colors">Terms</a>
          </div>

          <div className="flex gap-4">
             <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 cursor-pointer">X</div>
             <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 cursor-pointer">in</div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-8 pt-8 border-t border-zinc-100 text-center text-sm text-zinc-400">
          © 2026 7secure Inc. All rights reserved.
        </div>
      </footer>

      <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
        <div className="bg-white rounded-lg p-6 max-w-lg mx-auto mt-20 relative text-zinc-900 border border-zinc-200 shadow-2xl z-50">
        <div className="flex flex-col items-center justify-center">
          <Image src="/Small_Icon.svg" alt="Icon" width={32} height={32} className="mb-2 brightness-0" />
          <h2 className="text-2xl font-bold">Join the Community</h2>
          <p className="text-sm text-zinc-500 font-normal">Get the latest InfoSec news directly to your inbox.</p>
        </div>
        <div className="flex flex-col gap-4 mt-6">
          <Input autoFocus aria-label="Full Name" placeholder="Jane Doe" className="border-zinc-300"/>
          <Input aria-label="Email" placeholder="jane@company.com" className="border-zinc-300"/>
          
          <div className="mt-2">
            <p className="text-sm font-medium text-zinc-700 mb-2">My Interests:</p>
            <div className="flex gap-4">
              <Checkbox defaultSelected value="news">Daily News</Checkbox>
              <Checkbox defaultSelected value="tools">Tools</Checkbox>
              <Checkbox value="deepdives">Deep Dives</Checkbox>
            </div>
          </div>
        </div>
        <div className="flex gap-4 mt-8 justify-end border-t border-zinc-100 pt-4">
          <Button variant="outline" onPress={() => setIsOpen(false)} className="border-zinc-300 text-zinc-700 font-medium">
            Cancel
          </Button>
          <Button variant="primary" onPress={() => setIsOpen(false)} className="bg-blue-600 text-white font-medium hover:bg-blue-700">
            Subscribe Now
          </Button>
        </div>
        </div>
      </Modal>

    </div>
  );
}
