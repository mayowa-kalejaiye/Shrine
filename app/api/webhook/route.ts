import { NextRequest, NextResponse } from "next/server";

// Bachs webhooks: collection.succeeded, collection.failed, subscription.created, etc.
// Set this in Bachs dashboard -> Webhooks -> endpoint: https://yourdomain/api/webhook
// Verify signature via header (see Bachs docs: X-Bachs-Signature). For now we log.

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-bachs-signature") || req.headers.get("bachs-signature");

  let event: any;
  try { event = JSON.parse(raw); } catch { event = { raw }; }

  console.log("[bachs webhook]", { sig, event });

  // Example: on collection.succeeded, mark user as keeper
  // You'd lookup event.data.metadata / reference and update DB (e.g. drizzle + better-auth user)
  // For demo, we just ACK
  // if (event.type === "collection.succeeded") { await db.updateUser(...) }

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST Bachs webhooks here. See https://docs.bachs.io/webhooks" });
}
