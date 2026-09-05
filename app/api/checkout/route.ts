import { NextRequest, NextResponse } from "next/server";
import { createBachsCheckout } from "@/lib/bachs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const currency = (body.currency === "NGN" ? "NGN" : "USD") as "USD"|"NGN";
    // In real app, get from better-auth session
    const email = body.email || "keeper@void.so";
    const name = body.name || "Void Keeper";

    const origin = req.nextUrl.origin;

    const checkout = await createBachsCheckout({
      email,
      name,
      currency,
      success_url: `${origin}/success`,
      cancel_url: `${origin}/cancel`,
      reference: `void_${Date.now()}`,
      metadata: { source: "void_paywall" },
    });

    return NextResponse.json(checkout, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "checkout failed", detail: String(e) }, { status: 500 });
  }
}

// allow GET for quick testing: /api/checkout?currency=NGN
export async function GET(req: NextRequest) {
  const currency = req.nextUrl.searchParams.get("currency") === "NGN" ? "NGN" : "USD";
  const origin = req.nextUrl.origin;
  try {
    const checkout = await createBachsCheckout({
      email: "test@void.so",
      currency,
      success_url: `${origin}/success`,
      cancel_url: `${origin}/cancel`,
    });
    return NextResponse.json(checkout);
  } catch(e:any){
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
