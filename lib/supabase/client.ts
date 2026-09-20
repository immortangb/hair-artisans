import { createBrowserClient } from "@supabase/ssr";

// ============================================================
// BROWSER SUPABASE CLIENT (PUBLIC / ANON KEY)
// ============================================================
//
// This never throws synchronously. Several pages in this app call
// createClient() directly in their component body (not inside a
// useEffect), and Next.js still executes that render once on the
// server during static generation ("next build"). If this threw
// when env vars were missing - or if we passed empty strings, which
// @supabase/ssr itself rejects with its own throw - a single
// misconfigured build (env vars not yet set in Vercel, a preview
// branch without them, this sandbox, etc.) would crash the ENTIRE
// production build, every route, not just the pages that need
// Supabase.
//
// Instead, if the real vars are missing we log a clear console
// error and construct the client with obviously-fake placeholder
// values that still satisfy @supabase/ssr's own validation. Nothing
// in this app calls Supabase during the server-side prerender pass
// (all real calls happen client-side, after hydration, inside
// useEffect/event handlers), so this placeholder client is never
// actually used to make a request - it only exists so module
// evaluation and the initial render don't crash. On Vercel, with
// the real env vars set, this fallback path is never hit.
// ============================================================

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder-key-set-real-env-vars";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    console.error(
      "Supabase public environment variables are not configured. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
        "(or NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  return createBrowserClient(
    url || PLACEHOLDER_URL,
    publishableKey || PLACEHOLDER_KEY,
  );
}
