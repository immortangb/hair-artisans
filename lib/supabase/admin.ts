import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// ============================================================
// SERVER-ONLY SUPABASE CLIENT (SERVICE ROLE)
// ============================================================
//
// This client uses the Supabase SERVICE ROLE key, which bypasses
// Row Level Security. It can read and write any row in the
// database, so it must never be imported into a "use client"
// file or sent to the browser in any way.
//
// It is used by the payment API routes (app/api/payments/*) to:
//   - read a booking's price/deposit without needing the visitor
//     to be logged in as admin
//   - mark a booking as paid once Paystack confirms the charge
//
// Requires SUPABASE_SERVICE_ROLE_KEY in your environment
// (Supabase dashboard -> Project Settings -> API -> service_role
// secret key). Never prefix this variable with NEXT_PUBLIC_.
// ============================================================

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}