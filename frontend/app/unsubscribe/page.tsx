import { SubscribeForm } from "../../components/SubscribeForm";

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-[#09090b] px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <section className="rounded-md border border-zinc-800 bg-[#09090b] px-6 py-8 text-center sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Unsubscribe</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Leave the daily briefing anytime.</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
            Enter your email below and we will remove it from future newsletter sends.
          </p>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white px-6 py-7 text-zinc-900 sm:px-8">
          <h2 className="text-2xl font-bold">Stop receiving emails</h2>
          <p className="mt-2 text-sm text-zinc-600">Use the form below to unsubscribe from the newsletter list.</p>
          <div className="mt-5">
            <SubscribeForm
              mode="unsubscribe"
              variant="light"
              placeholder="Email address"
              buttonLabelOverride="Unsubscribe"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
