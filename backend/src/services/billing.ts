// Stripe billing for the paid visa risk report. Graceful: when STRIPE_SECRET_KEY
// is absent, everything is treated as free/unlocked so the app still runs and demos.
// Entitlements are in-memory for the MVP (persist to Mongo before production).
import Stripe from "stripe";
import { config, hasStripe } from "../config";

const stripe = hasStripe ? new Stripe(config.stripeSecretKey) : null;
const entitled = new Set<string>();

export function isEntitled(profileId: string): boolean {
  if (!hasStripe) return true; // no billing configured => unlocked for dev/demo
  return entitled.has(profileId);
}

export async function createCheckoutUrl(profileId: string): Promise<string | null> {
  if (!stripe) return null; // caller treats null as "free / already unlocked"
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(config.stripePriceUsd * 100),
          product_data: { name: "Yaar - Full F-1 Visa Risk Report" },
        },
      },
    ],
    success_url: `${config.publicUrl}/app/visa?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.publicUrl}/app/visa?canceled=1`,
    metadata: { profileId },
  });
  return session.url;
}

export async function confirmSession(sessionId: string): Promise<{ paid: boolean; profileId?: string }> {
  if (!stripe) return { paid: true };
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const profileId = (session.metadata?.profileId as string) || undefined;
  const paid = session.payment_status === "paid";
  if (paid && profileId) entitled.add(profileId);
  return { paid, profileId };
}
