'use client';

import Link from 'next/link';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { useState } from 'react';

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 20);
  });

  return (
    <motion.header
      initial={{ backgroundColor: "rgba(10, 10, 10, 0)", borderBottom: "1px solid rgba(255, 255, 255, 0)" }}
      animate={{ 
        backgroundColor: isScrolled ? "rgba(10, 10, 10, 0.85)" : "rgba(10, 10, 10, 0)",
        borderBottom: isScrolled ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0)",
        backdropFilter: isScrolled ? "blur(12px)" : "blur(0px)"
      }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 right-0 z-50 w-full py-5 px-6 md:px-12 flex items-center justify-between"
    >
      <div className="flex items-center max-w-7xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center">
          {/* Using brightness(0) invert(1) to make the black logo white for dark theme */}
          <img src="/brand/7secure_logo.svg" alt="7secure" className="h-8" style={{ filter: "brightness(0) invert(1)" }} />
        </Link>
        
        <nav className="hidden md:flex items-center gap-10 font-bold text-[13px] tracking-wide text-gray-300">
          <Link href="/articles" className="hover:text-white transition-colors">Articles</Link>
          <Link href="/practices" className="hover:text-white transition-colors">Practices</Link>
          <Link href="/tools" className="hover:text-white transition-colors">Tools</Link>
        </nav>

        <Link href="/subscribe" className="bg-white text-black px-6 py-2.5 rounded-full font-extrabold text-sm tracking-wide hover:bg-gray-200 transition-transform hover:scale-105 active:scale-95">
          Subscribe
        </Link>
      </div>
    </motion.header>
  );
}
