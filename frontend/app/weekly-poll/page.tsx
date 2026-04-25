export default function WeeklyPollPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">Weekly Poll</h1>
        <p className="mt-2 text-zinc-500">
          Share your perspective on the most pressing cybersecurity topics. Results are published every Friday.
        </p>

        <div className="mt-10 rounded-xl border border-zinc-200 bg-zinc-50 p-8">
          <h2 className="text-lg font-semibold text-zinc-900">This week's question</h2>
          <p className="mt-2 text-zinc-700">
            What is your organization's top security priority for the next quarter?
          </p>

          <div className="mt-6 space-y-3">
            {[
              "Zero Trust architecture rollout",
              "AI security governance",
              "Third-party / supply chain risk",
              "Incident response readiness",
              "Regulatory compliance (NIS2, DORA, etc.)"
            ].map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
              >
                <input type="radio" name="poll" className="h-4 w-4 text-zinc-900" />
                <span className="text-sm font-medium text-zinc-800">{option}</span>
              </label>
            ))}
          </div>

          <button className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-zinc-700">
            Submit vote
          </button>
        </div>

        <div className="mt-8 text-sm text-zinc-400">
          Polls refresh every Monday. Past results are available on request.
        </div>
      </div>
    </div>
  );
}
