import { SubscribeForm } from "../../components/SubscribeForm";

export default function UnsubscribePage() {
  return (
    <div className="section-page">
      <section className="section-hero section-hero--dark">
        <p className="hero-kicker">Unsubscribe</p>
        <h1>Leave the daily briefing anytime.</h1>
        <p className="hero-subtext">
          Enter your email below and we’ll remove it from future newsletter sends.
        </p>
      </section>

      <section className="cta-block">
        <h2>Stop receiving emails</h2>
        <p>Use the form below to unsubscribe from the newsletter list.</p>
        <SubscribeForm mode="unsubscribe" className="subscribe-form-cta" placeholder="Email Address" buttonLabelOverride="Unsubscribe" />
      </section>
    </div>
  );
}
