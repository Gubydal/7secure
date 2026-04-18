import Link from "next/link";

export const runtime = "edge";

const starsForRating = (rating: number): string => {
  const safe = Math.min(5, Math.max(1, rating));
  return "★".repeat(safe) + "☆".repeat(5 - safe);
};

export default async function FeedbackThanksPage({
  searchParams
}: {
  searchParams: Promise<{ rating?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const rating = Number(params.rating || 0);
  const validRating = Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
  const saved = params.saved === "1";

  return (
    <div className="min-h-screen bg-[#09090b] px-4 py-12 text-white">
      <div className="mx-auto max-w-xl rounded-xl border border-zinc-700 bg-[#11131b] p-7 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Feedback received</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Thanks, we are reviewing your feedback.
        </h1>

        <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-zinc-600 bg-zinc-900/70 px-3 py-2 text-xs font-medium uppercase tracking-[0.1em] text-zinc-300">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
          Thinking through your rating
        </div>

        {validRating ? (
          <p className="mt-4 text-lg text-zinc-200">
            Your rating: <span className="font-semibold text-white">{starsForRating(validRating)}</span>
          </p>
        ) : null}

        <p className="mt-5 text-sm leading-7 text-zinc-300 sm:text-base">
          {saved
            ? "Your response has been saved successfully in our feedback database."
            : "We captured your click, but could not confirm data storage for this request."}
          {" "}
          You can close this tab and return to your inbox.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200"
          >
            Back to 7secure
          </Link>
        </div>
      </div>
    </div>
  );
}
