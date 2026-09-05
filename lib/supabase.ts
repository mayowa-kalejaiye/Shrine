import { createClient } from "@supabase/supabase-js";

// anon key is public by design (ships to browser) — security comes from RLS, not secrecy.
// never put the postgres password / service_role key here.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = URL && ANON ? createClient(URL, ANON) : null;
