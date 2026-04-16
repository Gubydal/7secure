import Link from "next/link";
export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900">
      <div className="text-center p-12 border border-zinc-200 rounded-xl shadow-sm max-w-lg">
        <h1 className="text-4xl font-bold mb-4 capitalize">contact</h1>
        <p className="text-zinc-500 mb-8 leading-relaxed">
          This page is currently being optimized and built out with our full dataset. Content will be available shortly.
        </p>
        <Link href="/" className="px-6 py-2.5 bg-zinc-900 text-white rounded font-medium hover:bg-zinc-800 transition-colors">
          ← Return Home
        </Link>
      </div>
    </div>
  );
}
