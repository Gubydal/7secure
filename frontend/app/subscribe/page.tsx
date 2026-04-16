import { SubscribeForm } from "../../components/SubscribeForm";

export default function SubscribePage() {
  return (
    <div className="section-page">
      <section className="section-hero section-hero--dark">
        <p className="hero-kicker">Subscribe</p>
        <h1>Get one clean briefing every day.</h1>
        <p className="hero-subtext">
          Join 7secure for a concise daily newsletter focused on cyber news, practical plays, and useful tools.
        </p>
      </section>

      <section className="cta-block">
        <h2>Join the newsletter</h2>
        <p>Use the form below to receive the daily digest in your inbox.</p>
        <SubscribeForm mode="subscribe" className="subscribe-form-cta" placeholder="Email Address" buttonLabelOverride="Subscribe" />
      </section>
    </div>
  );
}
