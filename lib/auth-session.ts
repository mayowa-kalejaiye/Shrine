import { createClient as createServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

// Verified Supabase session user (id + email) from request cookies.
// Null = signed out (or session refresh failed). Server-side only.
export async function sessionUser(): Promise<{ id: string; email: string | null } | null> {
  try {
    const sup = await createServer();
    const { data } = await sup.auth.getUser();
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// True if `handle` is locked to a DIFFERENT signed-in account than the caller.
// Unlinked handles and signed-out callers pass (legacy grace for pre-auth pins).
export async function handleLockedByOther(handle: string): Promise<boolean> {
  try {
    const me = await sessionUser();
    if (!me || !URL || !ANON) return false;
    const sb = createClient(URL, ANON);
    const { data } = (await sb.from("users").select("auth_user_id").eq("handle", handle).limit(1).maybeSingle()) as any;
    return !!data?.auth_user_id && data.auth_user_id !== me.id;
  } catch {
    return false;
  }
}
