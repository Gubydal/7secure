export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">Contact</h1>
        <p className="mt-2 text-zinc-500">
          Reach out for partnerships, editorial feedback, or security inquiries.
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">General inquiries</h2>
            <p className="mt-2 text-sm text-zinc-600">
              For partnerships, advertising, and press:
            </p>
            <a
              href="mailto:hello@7secure.io"
              className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              hello@7secure.io
            </a>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Security research</h2>
            <p className="mt-2 text-sm text-zinc-600">
              To report vulnerabilities or share research:
            </p>
            <a
              href="mailto:security@7secure.io"
              className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              security@7secure.io
            </a>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Editorial</h2>
            <p className="mt-2 text-sm text-zinc-600">
              For corrections, source tips, or story ideas:
            </p>
            <a
              href="mailto:editorial@7secure.io"
              className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              editorial@7secure.io
            </a>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Social</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Follow us for daily threat intel and updates.
            </p>
            <div className="mt-3 flex gap-4">
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-700">X</a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-700">LinkedIn</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
