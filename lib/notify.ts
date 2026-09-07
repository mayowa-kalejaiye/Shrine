import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";

// $0 sender: your Gmail over SMTP (500/day free). Needs an app password, NOT your login:
// Google Account → Security → 2-Step Verification ON → App passwords → generate.
// Same credential can also be pasted into Supabase Auth → SMTP to fix magic-link deliverability.
const USER = process.env.EMAIL_USER || "";
const PASS = process.env.EMAIL_PASS || "";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let tx: ReturnType<typeof nodemailer.createTransport> | null = null;

function transport(): ReturnType<typeof nodemailer.createTransport> | null {
  if (!USER || !PASS) return null;
  if (!tx) {
    tx = nodemailer.createTransport({
      service: "gmail",
      auth: { user: USER, pass: PASS },
    });
  }
  return tx;
}

export function alertsConfigured(): boolean {
  return !!USER && !!PASS;
}

export async function sendAlertEmail(to: string, subject: string, text: string): Promise<boolean> {
  const t = transport();
  if (!t) return false;
  try {
    await t.sendMail({
      from: `shrine <${USER}>`,
      to,
      subject,
      text: `${text}\n\n—\nyou get these because you locked this handle on shrine with alerts on. turn off: open shrine → sign in pill → claim modal → alerts off.`,
    });
    return true;
  } catch {
    return false;
  }
}

// Fire-and-forget safe (never throws): email everyone subscribed to the memory
// author's handle. Throttled per author (5/hr) so a viral memory can't burn the
// 500/day Gmail quota. Seed-id memories miss the lookup and skip silently.
export async function notifySubscribers(opts: {
  memoryId: string;
  actorHandle: string;
  kind: "felt" | "comment";
  snippet: string;
  origin: string;
}): Promise<void> {
  try {
    if (!URL || !ANON || !SERVICE || !alertsConfigured()) return;
    const sb = createClient(URL, ANON);
    const { data: mem } = await sb
      .from("memories")
      .select("handle,city,line")
      .eq("id", opts.memoryId)
      .single();
    const author = (mem as any)?.handle as string | undefined;
    if (!author || author === opts.actorHandle) return;
    const nrl = rateLimit(`notif:${author}`, 5, 3600000);
    if (!nrl.ok) return;
    const admin = createClient(URL, SERVICE);
    const { data: subs } = await admin.from("alerts").select("email").eq("handle", author);
    const emails = [...new Set(((subs || []) as any[]).map((s) => s.email).filter(Boolean))];
    if (!emails.length) return;
    const link = opts.origin ? `${opts.origin}/?memory=${opts.memoryId}` : "";
    const subject =
      opts.kind === "felt"
        ? `@${opts.actorHandle} felt your memory in ${(mem as any).city}`
        : `@${opts.actorHandle} replied to your memory in ${(mem as any).city}`;
    const text =
      opts.kind === "felt"
        ? `"${String((mem as any).line).slice(0, 120)}..."\n\n@${opts.actorHandle} felt this.\n\nsee it: ${link}`
        : `"${String((mem as any).line).slice(0, 120)}..."\n\n@${opts.actorHandle} said: "${opts.snippet.slice(0, 200)}"\n\nsee it: ${link}`;
    await sendAlertEmail(emails.join(","), subject, text);
  } catch {
    // notifications never break writes
  }
}
