// Bachs.io — Payments & Billing for African SaaS
// Docs: https://docs.bachs.io
// Base: sandbox https://sandbox-api.bachs.io  |  live https://api.bachs.io
// Auth: Authorization: Bearer sk_sandbox_... / sk_live_...

const BACHS_BASE = process.env.BACHS_API_BASE || "https://sandbox-api.bachs.io";
const BACHS_KEY = process.env.BACHS_API_KEY || "sk_sandbox_placeholder";

export type BachsCurrency = "USD" | "NGN";

export interface CreateCheckoutArgs {
  email: string;
  name?: string;
  currency: BachsCurrency; // $1 vs ₦500 — PPP bid pricing
  productId?: string; // if you have a catalog product
  reference?: string;
  metadata?: Record<string,string>;
  success_url: string;
  cancel_url: string;
}

// Pricing: $1 USD = ₦500 NGN  (bid-style micro-payment for high adoption)
// We use `pricing` ad-hoc so we don't need a catalog product upfront.
// Bachs will handle FX if we only sent USD, but we want exact ₦500, so we use currency_options.
export async function createBachsCheckout(args: CreateCheckoutArgs) {
  if (!process.env.BACHS_API_KEY || BACHS_KEY.includes("placeholder")) {
    // No key yet — return mock for local dev so you can still click through
    console.warn("[bachs] BACHS_API_KEY not set — returning mock checkout_url");
    return {
      checkout_id: "chk_mock_" + Math.random().toString(36).slice(2),
      checkout_url: args.success_url + `?checkout_id=chk_mock&mock=1&currency=${args.currency}`,
      status: "open" as const,
      mock: true,
    };
  }

  // Ad-hoc pricing: $1 USD, ₦500 NGN exact
  // See docs: POST /v1/checkout-sessions with `pricing` + `currency_options`
  const body: any = {
    // Either product_cart OR pricing — we use pricing for micro-bid
    pricing: {
      currency: args.currency, // lock to what user selected
      amount: args.currency === "USD" ? "1.00" : "500.00",
      price_type: "fixed" as const,
      // If user pays in the other currency, use exact override vs FX
      currency_options: {
        USD: "1.00",
        NGN: "500.00",
      },
    },
    customer: {
      email: args.email,
      name: args.name || args.email.split("@")[0],
    },
    success_url: args.success_url,
    cancel_url: args.cancel_url,
    reference: args.reference,
    metadata: {
      product: "void_keeper",
      currency: args.currency,
      ...args.metadata,
    },
    // optional: expires_in_minutes: 60,
  };

  // If you create a real product in Bachs dashboard, prefer product_cart:
  // body = { product_cart: [{ product_id: args.productId }], customer: ..., success_url, cancel_url }

  const res = await fetch(`${BACHS_BASE}/v1/checkout-sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BACHS_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Bachs ${res.status}: ${JSON.stringify(data)}`);
  }
  return data as { checkout_id: string; checkout_url: string; status: string; expires_at: string };
}

export function getBachsEnvInfo() {
  const isSandbox = BACHS_BASE.includes("sandbox") || (BACHS_KEY || "").startsWith("sk_sandbox");
  return { base: BACHS_BASE, isSandbox, hasKey: !BACHS_KEY.includes("placeholder") };
}
