'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { SubscribeForm } from './SubscribeForm';

export function AnimatedHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Background Interactive Stars mapped to Mouse
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return; const ctx = canvas.getContext('2d');
    let animationFrameId: number; let w = canvas.width = window.innerWidth; let h = canvas.height = window.innerHeight;
    const pts = Array.from({length: 80}, () => ({
      x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.5 + 0.5,
      d: Math.random() * 0.5 - 0.25, c: `rgba(${Math.floor(Math.random()*100+100)}, ${Math.floor(Math.random()*150+100)}, 255, ${Math.random()*0.5 + 0.1})`
    }));
    const update = () => {
      if(!ctx) return; ctx.clearRect(0,0,w,h);
      pts.forEach(p => { p.y += p.d; if(p.y > h) p.y = 0; if(p.y < 0) p.y = h;
        ctx.beginPath(); ctx.fillStyle = p.c; ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      });
      animationFrameId = requestAnimationFrame(update);
    };
    update();
    const handleResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener('resize', handleResize);
    return () => { cancelAnimationFrame(animationFrameId); window.removeEventListener('resize', handleResize); };
  }, []);

  return (
    <div className="relative w-full min-h-[90vh] flex flex-col items-center justify-center pt-20 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />
      <div className="absolute inset-0 z-0" style={{
        background: "radial-gradient(ellipse at top center, rgba(59, 130, 246, 0.15) 0%, transparent 60%)"
      }}></div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-5xl px-6 text-center flex flex-col items-center justify-center"
      >
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
           className="mb-8 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest cursor-default shadow-[0_0_20px_rgba(59,130,246,0.1)]"
        >
          Daily Tactical Threat Intel
        </motion.div>

        <h1 className="text-white text-5xl md:text-[6.5rem] font-extrabold leading-[1.05] tracking-tight mb-8 drop-shadow-2xl">
          Never miss a <br/>
          <span className="text-brand-blue">critical zero-day.</span>
        </h1>

        <p className="text-gray-400 text-lg md:text-2xl max-w-3xl mx-auto mb-12 leading-relaxed drop-shadow-md">
          Cut through the noise. Get high-signal security insights, actionable mitigation practices, and trending threat tools delivered in one 5-minute read.
        </p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="w-full max-w-[500px] bg-[#111111]/80 backdrop-blur-xl border border-[#2B2B2B] p-2 rounded-full flex items-center shadow-2xl relative z-20"
        >
          <SubscribeForm mode="subscribe" className="flex w-full" />
        </motion.div>

        <motion.div 
           initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
           className="mt-16 flex flex-wrap items-center justify-center gap-8 md:gap-16 text-gray-500 font-semibold opacity-70 cursor-default uppercase text-[10px] tracking-widest"
        >
           <span>Google</span><span>Microsoft</span><span>Cloudflare</span><span>Palo Alto</span><span>Cisco</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
