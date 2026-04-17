"use client";

import ReactMarkdown from "react-markdown";

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="article-markdown text-[17px] leading-8 text-zinc-800">
      <ReactMarkdown
        components={{
          h1: (props) => <h1 className="mt-0 mb-6 text-3xl font-semibold tracking-tight text-zinc-950 md:text-4xl" {...props} />,
          h2: (props) => <h2 className="mt-10 mb-4 text-2xl font-semibold tracking-tight text-zinc-950 md:text-[1.75rem]" {...props} />,
          h3: (props) => <h3 className="mt-8 mb-3 text-xl font-semibold tracking-tight text-zinc-950" {...props} />,
          p: (props) => <p className="mb-5 text-[17px] leading-8 text-zinc-700" {...props} />,
          ul: (props) => <ul className="my-5 list-disc space-y-2 pl-6 text-zinc-700" {...props} />,
          ol: (props) => <ol className="my-5 list-decimal space-y-2 pl-6 text-zinc-700" {...props} />,
          li: (props) => <li className="pl-1" {...props} />,
          a: (props) => <a className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900" {...props} />,
          blockquote: (props) => <blockquote className="my-6 border-l-4 border-zinc-300 bg-zinc-50 px-5 py-4 text-zinc-700" {...props} />,
          hr: () => <hr className="my-10 border-zinc-200" />,
          strong: (props) => <strong className="font-semibold text-zinc-950" {...props} />,
          code: ({ children, ...props }) => <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.9em] text-zinc-900" {...props}>{children}</code>,
          pre: (props) => <pre className="my-6 overflow-x-auto rounded-2xl bg-zinc-950 p-5 text-sm leading-7 text-zinc-100" {...props} />,
          img: (props) => <img className="my-8 w-full rounded-2xl border border-zinc-200 object-cover" {...props} />
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}