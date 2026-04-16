import Link from 'next/link';
import { supabasePublic, type ArticleRecord } from '../lib/supabase';
import { SubscribeForm } from '../components/SubscribeForm';

export const revalidate = 3600;

const getArticles = async (): Promise<ArticleRecord[]> => {
  const { data } = await supabasePublic
    .from('articles')
    .select('id,slug,title,summary,content,category,source_name,source_url,original_url,published_at,is_featured,tags,image_url')
    .order('published_at', { ascending: false })
    .limit(10);
  return (data as ArticleRecord[] | null) ?? [];
};

export default async function HomePage() {
  const articles = await getArticles();
  const featured = articles[0] || null;
  const recentList = articles.slice(1, 4);

  return (
    <main className="max-w-7xl mx-auto px-4 pb-24 md:px-8 flex flex-col gap-16 overflow-hidden">
      
      {/* HERO SECTION */}
      <section className="relative w-full rounded-[2.5rem] bg-[#111116] overflow-hidden text-center py-20 px-6 mt-4 shadow-2xl flex flex-col items-center justify-center">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top left, rgba(255, 110, 140, 0.15) 0%, transparent 50%), radial-gradient(circle at top right, rgba(0, 200, 255, 0.05) 0%, transparent 50%)' }}></div>
        
        <p className="text-brand-pink text-xs font-bold tracking-[0.25em] mb-8 uppercase">Daily Security Briefing</p>
        
        <h1 className="text-white text-5xl md:text-[5.5rem] font-bold leading-[1.05] tracking-tight max-w-4xl mx-auto mb-6">
          Learn cyber in <span className="text-brand-pink">5 minutes</span> a day.
        </h1>
        
        <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto mb-10">
          Get high-signal threat intelligence, practical security habits, and trending tools in one fast read.
        </p>

        {/* Real Subscribe Form Wrapped for Figma UI */}
        <div className="flex w-full max-w-[500px] mx-auto bg-[#1A1C23] border border-[#2B2D31] p-1.5 rounded-full items-center mb-8 relative z-10 transition-shadow focus-within:shadow-[0_0_0_2px_rgba(255,107,139,0.3)]">
          <SubscribeForm 
            mode="subscribe" 
            className="flex w-full"
          />
        </div>

        <div className="flex flex-wrap gap-4 justify-center mb-16 relative z-10">
          <Link href="/articles" className="bg-[#1A1C23] border border-[#2B2D31] text-white/90 px-6 py-2.5 rounded-full text-sm font-bold hover:bg-[#252830] transition">
            Browse articles
          </Link>
          <Link href="/practices" className="bg-[#1A1C23] border border-[#2B2D31] text-white/90 px-6 py-2.5 rounded-full text-sm font-bold hover:bg-[#252830] transition">
            Explore practices
          </Link>
        </div>

        <div className="relative z-10 w-full max-w-4xl opacity-80">
          <p className="text-gray-400 text-xs font-semibold mb-4">Trusted by teams using</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['Google', 'Microsoft', 'Cisco', 'Cloudflare', 'IBM', 'OpenAI'].map(brand => (
              <div key={brand} className="bg-[#16181D] border border-[#2B2D31] rounded-full px-8 py-2.5 text-[0.8rem] font-bold text-gray-300 hover:text-white transition cursor-default">
                {brand}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LATEST ARTICLES section */}
      <section className="bg-white rounded-[2.5rem] p-8 md:p-14 shadow-sm border border-[#E5E7EB]">
        <div className="flex justify-between items-end mb-10">
          <div>
            <p className="text-brand-pink text-xs font-bold tracking-[0.2em] mb-3 uppercase">Latest Articles</p>
            <h2 className="text-4xl font-extrabold tracking-tight mb-3">Latest Articles</h2>
            <p className="text-gray-500 max-w-xl text-sm leading-relaxed">The latest cybersecurity stories rewritten into concise blocks that are easy to scan.</p>
          </div>
          <Link href="/articles" className="bg-[#111] text-white px-6 py-2.5 rounded-full font-bold text-sm tracking-wide hover:bg-black/80 transition hidden md:block">
            Show more
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,1fr)] gap-8">
          {featured && (
            <div className="flex flex-col gap-4">
              <div className="w-full aspect-[4/3] rounded-2xl bg-gradient-to-br from-pink-100 to-indigo-100 mb-2 overflow-hidden border border-gray-100">
                {featured.image_url && <img src={featured.image_url} alt={featured.title} className="w-full h-full object-cover mix-blend-multiply opacity-80" />}
              </div>
              <div className="inline-block border border-brand-pink text-brand-pink text-[9px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest self-start">
                {featured.category || 'AI Security'}
              </div>
              <Link href={\/articles/\\} className="text-[1.75xl] md:text-[2rem] font-extrabold leading-tight hover:text-brand-pink transition-colors">
                {featured.title}
              </Link>
              <p className="text-gray-600 text-[1.1rem] leading-relaxed line-clamp-3">
                {featured.summary}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {recentList.map(a => (
              <div key={a.id} className="flex flex-col sm:flex-row gap-5 border border-gray-100 rounded-3xl p-4 hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition bg-white items-start">
                <div className="w-full sm:w-28 h-32 sm:h-28 rounded-[1.25rem] bg-gradient-to-br from-blue-50 to-orange-50 shrink-0 overflow-hidden border border-gray-50">
                  {a.image_url && <img src={a.image_url} alt={a.title} className="w-full h-full object-cover opacity-80" />}
                </div>
                <div className="flex-1 flex flex-col justify-center h-full">
                  <div className="inline-block border border-orange-400 text-orange-400 text-[9px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider self-start mb-2.5">
                    {a.category || 'Vulnerabilities'}
                  </div>
                  <Link href={\/articles/\\} className="text-[1.1rem] font-bold leading-tight hover:text-brand-pink transition-colors mb-2 line-clamp-2">
                    {a.title}
                  </Link>
                  <p className="text-gray-400 text-xs font-medium mt-auto">
                    {new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRENDING TOOLS */}
      <section className="bg-white rounded-[2.5rem] p-8 md:p-14 shadow-sm border border-[#E5E7EB]">
        <div className="flex justify-between items-end mb-10">
          <div>
            <p className="text-brand-pink text-xs font-bold tracking-[0.2em] mb-3 uppercase">Trending Tools</p>
            <h2 className="text-4xl font-extrabold tracking-tight mb-3">Tools worth keeping open</h2>
            <p className="text-gray-500 max-w-xl text-sm leading-relaxed">The references and utilities that reduce guesswork when something needs checking fast.</p>
          </div>
          <Link href="/tools" className="bg-[#111] text-white px-6 py-2.5 rounded-full font-bold text-sm tracking-wide hover:bg-black/80 transition hidden md:block">
            Show more
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { cat: 'Trending', title: 'Shodan for exposure tracking', desc: 'Monitor exposed services, risky ports, and unexpected internet-facing assets in your environment.', color: 'from-blue-50 to-indigo-100' },
            { cat: 'Automation', title: 'Use Feedly to centralize your threat intel', desc: 'Collect sources, tag stories, and move the most relevant articles into a clean daily workflow.', color: 'from-cyan-50 to-sky-100' },
            { cat: 'Analysis', title: 'VirusTotal for quick domain checks', desc: 'Fast reputation checks for domains, hashes, and URLs when something looks suspicious.', color: 'from-pink-50 to-rose-100' },
            { cat: 'Reference', title: 'NIST CSRC for control mapping', desc: 'Use the official source when you need a control, framework, or compliance reference that sticks.', color: 'from-orange-50 to-amber-100' }
          ].map((t, idx) => (
            <div key={idx} className="flex flex-col border border-gray-100 bg-[#FAFAFA] rounded-3xl hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition overflow-hidden h-full">
              <div className={\h-[140px] bg-gradient-to-br \ w-full\}></div>
              <div className="p-6 flex-1 flex flex-col pt-5">
                <p className="text-[#64748B] text-[10px] font-bold tracking-[0.15em] mb-3 uppercase">{t.cat}</p>
                <h3 className="text-lg font-bold leading-snug mb-3 text-[#111]">{t.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6 flex-1">{t.desc}</p>
                <Link href="/tools" className="text-brand-pink font-bold text-sm hover:underline underline-offset-4 mt-auto border-b border-transparent hover:border-brand-pink pb-0.5 inline-block self-start">Read more</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="bg-[#111116] rounded-[2.5rem] p-10 md:p-16 text-center text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-pink-500/10 to-transparent rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Never miss critical security updates</h2>
          <p className="text-gray-400 mb-10 max-w-lg mx-auto text-[0.95rem]">Join 7secure for your daily intelligence briefing in one modern email.</p>
          
          <div className="flex w-full max-w-[450px] mx-auto bg-[#1A1C23] border border-[#2B2D31] p-1.5 rounded-full items-center relative transition-shadow focus-within:shadow-[0_0_0_2px_rgba(255,107,139,0.3)]">
            <SubscribeForm 
              mode="subscribe" 
              className="flex w-full"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
