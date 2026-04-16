import Link from 'next/link';
import { supabasePublic, type ArticleRecord } from '../lib/supabase';
import { AnimatedHero } from '../components/AnimatedHero';
import { SectionFade } from '../components/SectionFade';
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
    <main className="flex flex-col w-full bg-[#0A0A0A] overflow-hidden selection:bg-blue-600 selection:text-white pt-24">
      
      {/* 1. ANIMATED HERO SECTION (Full Width SaaS Look) */}
      <AnimatedHero />

      {/* 2. LATEST ARTICLES (Full Width Dark Section) */}
      <SectionFade className="w-full relative z-10 py-32 border-t border-white/[0.05] bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 w-full">
          <div className="flex flex-col md:flex-row justify-between md:items-end mb-20 gap-6">
            <div>
              <p className="text-blue-500 text-xs font-bold tracking-[0.2em] mb-4 uppercase">Latest Briefings</p>
              <h2 className="text-white text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Latest Articles</h2>
              <p className="text-gray-400 max-w-xl text-base leading-relaxed">High-signal intelligence rewritten into concise read protocols that respect your time.</p>
            </div>
            <Link href="/articles" className="bg-[#1A1A1A] border border-[#2B2B2B] text-white px-8 py-3 rounded-full font-bold text-sm tracking-wide hover:bg-[#252525] hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all">
              View all insights
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,1fr)] gap-10">
            {featured && (
              <div className="flex flex-col group cursor-pointer h-full">
                <div className="w-full relative aspect-[16/10] rounded-2xl bg-[#111] border border-white/[0.05] overflow-hidden mb-6 group-hover:border-blue-500/30 transition-colors">
                  {featured.image_url && <img src={featured.image_url} alt={featured.title} className="w-full h-full object-cover opacity-60 group-hover:scale-105 group-hover:opacity-80 transition-all duration-700 mix-blend-screen" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                  <div className="absolute bottom-6 left-6 flex items-center gap-3">
                    <span className="bg-blue-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-sm uppercase tracking-widest">
                      {featured.category || 'AI Security'}
                    </span>
                  </div>
                </div>
                <Link href={`/articles/${featured.slug}`} className="text-white text-[2rem] font-extrabold leading-[1.1] group-hover:text-blue-400 transition-colors mb-4">
                  {featured.title}
                </Link>
                <p className="text-gray-400 text-lg leading-relaxed line-clamp-3">
                  {featured.summary}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-6 h-full justify-between">
              {recentList.map(a => (
                <div key={a.id} className="group flex flex-col sm:flex-row gap-6 p-5 border border-white/[0.05] rounded-2xl hover:bg-white/[0.02] hover:border-blue-500/20 transition-all items-start h-full">
                  <div className="w-full sm:w-36 h-36 rounded-xl bg-[#111] overflow-hidden border border-white/[0.05] shrink-0">
                    {a.image_url && <img src={a.image_url} alt={a.title} className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-all duration-500" />}
                  </div>
                  <div className="flex-1 flex flex-col justify-between h-full py-1">
                    <div className="flex flex-col gap-3">
                      <span className="text-blue-500 text-[10px] font-bold uppercase tracking-wider">
                        {a.category || 'Vulnerabilities'}
                      </span>
                      <Link href={`/articles/${a.slug}`} className="text-white text-[1.2rem] font-bold leading-tight group-hover:text-blue-400 transition-colors line-clamp-2">
                        {a.title}
                      </Link>
                    </div>
                    <p className="text-gray-500 text-sm font-medium mt-4">
                      {new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionFade>

      {/* 3. TRENDING TOOLS */}
      <SectionFade className="w-full relative py-32 bg-black border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 w-full">
          <div className="flex flex-col md:flex-row justify-between md:items-end mb-16 gap-6">
            <div>
              <p className="text-blue-500 text-xs font-bold tracking-[0.2em] mb-4 uppercase">Trending Tools</p>
              <h2 className="text-white text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Tactical Arsenal</h2>
              <p className="text-gray-400 max-w-xl text-base leading-relaxed">The resources that remove guesswork and noise from your security operations.</p>
            </div>
            <Link href="/tools" className="bg-[#1A1A1A] border border-[#2B2B2B] text-white px-8 py-3 rounded-full font-bold text-sm tracking-wide hover:bg-[#252525] hover:border-blue-500/30 transition-all">
              Explore Arsenal
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { cat: 'Exposure', title: 'Shodan API Map', desc: 'Monitor exposed services and risky ports directly.', icon: 'M5 12h14M12 5l7 7-7 7' },
              { cat: 'Ingestion', title: 'Feedly Threat Board', desc: 'Centralize tagged stories into clean daily workflows.', icon: 'M4 6h16M4 12h16m-7 6h7' },
              { cat: 'Analysis', title: 'VirusTotal Graph', desc: 'Fast reputation context mapping for active threats.', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
              { cat: 'Compliance', title: 'NIST Cyber Engine', desc: 'Official references for control frameworks.', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' }
            ].map((t, idx) => (
              <div key={idx} className="group flex flex-col p-8 border border-white/[0.05] bg-[#0A0A0A] hover:bg-[#111] rounded-2xl hover:-translate-y-1 transition-all h-full shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 group-hover:text-blue-500 transition-all transform group-hover:translate-x-2 group-hover:-translate-y-2">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d={t.icon}></path></svg>
                </div>
                <div className="flex-1 flex flex-col relative z-10">
                  <p className="text-gray-500 text-[10px] font-bold tracking-[0.15em] mb-4 uppercase">{t.cat}</p>
                  <h3 className="text-xl font-bold leading-snug mb-3 text-white group-hover:text-blue-400 transition-colors">{t.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-8 flex-1">{t.desc}</p>
                  <Link href="/tools" className="text-blue-500 font-bold text-sm tracking-wide group-hover:underline underline-offset-4 decoration-blue-500/30 flex items-center gap-2">
                    Access tool 
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionFade>

      {/* 4. CALL TO ACTION FOOTING */}
      <SectionFade className="w-full border-t border-white/[0.05] bg-[#0A0A0A] py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-white">Join the frontline tier.</h2>
          <p className="text-gray-400 mb-12 text-lg md:text-xl">Stop drowning in noise. Subscribe for clear, vetted, and actionable cybersecurity intelligence.</p>
          
          <div className="flex w-full max-w-[450px] mx-auto bg-[#141414] border border-white/[0.1] p-1.5 rounded-full items-center relative transition-shadow focus-within:shadow-[0_0_0_2px_rgba(59,130,246,0.3)] shadow-2xl">
            <SubscribeForm 
              mode="subscribe" 
              className="flex w-full"
            />
          </div>
        </div>
      </SectionFade>

    </main>
  );
}
