import { SubscribeForm } from "../../components/SubscribeForm";

export default function UnsubscribePage() {
  return (
    <section className="cta-block">
      <h1>Unsubscribe from 7secure</h1>
      <p>Enter your email to stop receiving future daily digests.</p>
      <SubscribeForm mode="unsubscribe" />
    </section>
  );
}
