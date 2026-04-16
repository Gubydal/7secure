const fs = require('fs');
const content = import Image from 'next/image';
import { Button } from '@heroui/react';

export default function Home() {
  const articles = [
    {
      title: 'Zero-Day Exploit Found in Popular VPN',
      excerpt: 'Attackers are exploiting a new vulnerability in market-leading VPN software. Here is how to patch it immediately.',
      label: 'Oct 24, 2026',
    },
    {
      title: 'The Rise of AI-Generated Phishing',
      excerpt: 'How threat actors are utilizing LLMs to craft hyper-personalized and error-free phishing campaigns at scale.',
      label: 'Oct 22, 2026',
    },
    {
      title: 'Ransomware Gangs Pivot Strategy',
      excerpt: 'Extortion without encryption is becoming the new norm as gangs focus purely on data exfiltration.',
      label: 'Oct 20, 2026',
    },
    {
      title: 'New Authentication Standards',
      excerpt: 'Passkeys are finally reaching critical mass. What this means for enterprise security architectures.',
      label: 'Oct 18, 2026',
    },
  ];

  return (
    <div className=\lex flex-col min-h-screen bg-[#09090b] text-[#fafafa] font-sans\>
      <header className=\lex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#09090b]/80 backdrop-blur-md z-50\>
        <div className=\lex items-center\>
          <Image
            src=\/7secure_logo.svg\
            alt=\7secure logo\
            width={120}
            height={30}
            priority
          />
        </div>
        <nav className=\hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400\>
          <a href=\#\ className=\hover:text-white transition-colors\>Latest News</a>
          <a href=\#\ className=\hover:text-white transition-colors\>Playbook</a>
          <a href=\#\ className=\hover:text-white transition-colors\>Tools</a>
          <a href=\#\ className=\hover:text-white transition-colors\>Courses</a>
        </nav>
        <div className=\lex items-center gap-4\>
          <a href=\#\ className=\hidden sm:block text-sm font-medium text-zinc-400 hover:text-white transition-colors\>Login</a>
          <Button variant=\solid\ className=\g-white text-black font-semibold text-sm h-9 px-4 rounded-md hover:bg-zinc-200 transition-colors\>
            Subscribe
          </Button>
        </div>
      </header>

      <main className=\lex-1 w-full max-w-5xl mx-auto px-6 py-16 flex flex-col items-center\>
        <section className=\lex flex-col items-center text-center max-w-3xl mb-24 mt-10\>
          <Image
            src=\/Small_Icon.svg\
            alt=\7secure icon\
            width={48}
            height={48}
            className=\mb-8\
          />
          <h1 className=\	ext-5xl md:text-7xl font-bold tracking-tight text-white mb-6\>
            Master InfoSec in <br/>5 minutes a day.
          </h1>
          <p className=\	ext-lg md:text-xl text-zinc-400 mb-10 max-w-2xl\>
            Get the latest cybersecurity news, understand current threats, and learn how to secure your infrastructure against modern attacks.
          </p>
          
          <div className=\w-full max-w-md flex items-center bg-zinc-900 border border-white/10 p-1.5 rounded-xl transition focus-within:border-white/30\>
            <input 
              type=\email\ 
              placeholder=\Enter your email...\ 
              className=\lex-1 bg-transparent border-none outline-none text-white px-4 placeholder-zinc-500\
            />
            <Button variant=\solid\ className=\g-white text-black font-semibold h-11 px-6 rounded-lg ml-2 hover:bg-zinc-200 transition-colors\>
              Subscribe
            </Button>
          </div>

          <div className=\mt-16 flex flex-col items-center\>
            <p className=\	ext-sm font-medium text-zinc-500 mb-6 uppercase tracking-wider\>
              Join over 500,000+ engineers from companies like:
            </p>
            <div className=\lex flex-wrap justify-center items-center gap-8 opacity-60 grayscale\>
              <span className=\	ext-xl font-bold font-mono\>MICROSOFT</span>
              <span className=\	ext-xl font-bold font-mono\>CLOUDFLARE</span>
              <span className=\	ext-xl font-bold font-mono\>PALO ALTO</span>
              <span className=\	ext-xl font-bold font-mono\>CROWDSTRIKE</span>
            </div>
          </div>
        </section>

        <section className=\w-full mb-20 text-left\>
          <div className=\order-b border-white/10 pb-4 mb-8\>
            <h2 className=\	ext-3xl font-bold text-white mb-2\>Latest Intel</h2>
            <p className=\	ext-zinc-400\>The latest developments in InfoSec and Threat Intelligence.</p>
          </div>

          <div className=\grid grid-cols-1 md:grid-cols-2 gap-6\>
             {articles.map((article, i) => (
                <a href=\#\ key={i} className=\group block bg-zinc-900/50 border border-white/10 rounded-2xl p-6 hover:bg-zinc-900 hover:border-white/20 transition-all duration-200\>
                  <div className=\spect-[16/9] w-full bg-zinc-800 rounded-lg mb-6 overflow-hidden relative\>
                    <div className=\bsolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-900 opacity-50 group-hover:opacity-75 transition-opacity\></div>
                    <div className=\bsolute bottom-4 left-4 text-xs font-mono text-white/50 bg-black/50 px-2 py-1 rounded backdrop-blur-sm\>7SECURE BRIEF</div>
                  </div>
                  <p className=\	ext-sm text-zinc-500 font-mono mb-3\>{article.label}</p>
                  <h3 className=\	ext-xl font-semibold text-white mb-3 group-hover:text-blue-400 transition-colors\>{article.title}</h3>
                  <p className=\	ext-zinc-400 leading-relaxed line-clamp-2\>
                    {article.excerpt}
                  </p>
                </a>
             ))}
          </div>
          <div className=\mt-10 text-center\>
             <Button variant=\ordered\ className=\order-white/20 text-white hover:bg-white/5 bg-transparent font-medium h-10 px-6 rounded-md border\>
               View All
             </Button>
          </div>
        </section>

        <section className=\w-full mb-16 text-left\>
          <div className=\order-b border-white/10 pb-4 mb-8\>
            <h2 className=\	ext-3xl font-bold text-white mb-2\>Deep Dives</h2>
            <p className=\	ext-zinc-400\>In-depth technical writeups and strategic security frameworks.</p>
          </div>
          <div className=\lex flex-col gap-4\>
             {['Building a modern SOC from scratch', 'Deconstructing the latest APT29 Campaign', 'Automating malware analysis with AI'].map((exclusive, i) => (
               <a href=\#\ key={i} className=\lex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-xl border border-white/5 bg-zinc-900/30 hover:bg-zinc-900 hover:border-white/10 transition-all group gap-4\>
                 <div>
                   <h3 className=\	ext-lg font-semibold text-white group-hover:text-blue-400 transition-colors mb-1\>{exclusive}</h3>
                   <p className=\	ext-sm text-zinc-500\>Exclusive Technical Series</p>
                 </div>
                 <div className=\	ext-zinc-600 group-hover:text-white transition-colors\>
                    ?
                 </div>
               </a>
             ))}
          </div>
        </section>
      </main>

      <footer className=\order-t border-white/10 mt-auto py-12 px-6\>
        <div className=\max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6\>
          <Image src=\/7secure_logo.svg\ alt=\7secure logo\ width={100} height={25} className=\opacity-50 hover:opacity-100 transition-opacity\ />
          <div className=\lex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500\>
             <a href=\#\ className=\hover:text-white transition-colors\>Privacy Policy</a>
             <a href=\#\ className=\hover:text-white transition-colors\>Terms of Service</a>
             <a href=\#\ className=\hover:text-white transition-colors\>Contact</a>
          </div>
          <p className=\	ext-sm text-zinc-600\>© 2026 7secure Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}\;
fs.writeFileSync('src/app/page.tsx', content);
