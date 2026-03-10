"use server";

import { cookies } from "next/headers";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase env vars for auth");
}

export async function getCurrentUserProfile() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;

  if (!accessToken) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const userId = authData.user.id;

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, company, role, staff_type, customer_tier, created_at, is_active")
    .eq("id", userId)
    .eq("is_active", true)
    .limit(1);

  if (profileError || !profiles || profiles.length === 0) return null;

  return profiles[0];
}
