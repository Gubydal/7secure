import { SubscribeForm } from "../../components/SubscribeForm";

export default function SubscribePage() {
  return (
    <section className="cta-block">
      <h1>Subscribe to 7secure</h1>
      <p>Get one clean daily briefing at 7:00 AM UTC with top cyber + AI security stories.</p>
      <SubscribeForm mode="subscribe" />
    </section>
  );
}
