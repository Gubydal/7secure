import Link from 'next/link';

export function Header() {
  return (
    <header className="w-full py-6 px-8 flex items-center justify-between mx-auto max-w-7xl">
      <Link href="/" className="flex items-center">
        <img src="/brand/7secure_logo.svg" alt="7secure" className="h-8" style={{ filter: 'brightness(0)' }} />
      </Link>
      
      <nav className="hidden md:flex items-center gap-8 font-bold text-sm">
        <Link href="/articles" className="hover:opacity-70 transition">Articles</Link>
        <Link href="/practices" className="hover:opacity-70 transition">Practices</Link>
        <Link href="/tools" className="hover:opacity-70 transition">Tools</Link>
      </nav>

      <Link href="/subscribe" className="bg-[#111111] text-white px-6 py-2.5 rounded-full font-bold text-sm tracking-wide hover:bg-black/80 transition">
        Subscribe
      </Link>
    </header>
  );
}
