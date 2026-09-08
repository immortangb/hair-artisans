"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader, { STORAGE_BUCKET } from "@/components/admin/ImageUploader";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_HERO = "/images/hero.jpg";

export default function WebsiteAdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [heroUrl, setHeroUrl] = useState(DEFAULT_HERO);
  const [heroPath, setHeroPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/admin/login");
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError || !admin) {
      await supabase.auth.signOut();
      router.replace("/admin/login");
      return;
    }

    setCheckingAuth(false);

    const { data: urlSetting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "hero_image_url")
      .maybeSingle();

    const { data: pathSetting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "hero_image_path")
      .maybeSingle();

    if (urlSetting?.value) setHeroUrl(urlSetting.value);
    if (pathSetting?.value) setHeroPath(pathSetting.value);
  }

  async function saveSetting(key: string, value: string) {
    const { error: saveError } = await supabase
      .from("site_settings")
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (saveError) throw saveError;
  }

  async function saveHero() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await saveSetting("hero_image_url", heroUrl);

      if (heroPath) {
        await saveSetting("hero_image_path", heroPath);
      }

      setMessage("Homepage picture saved.");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not save the homepage picture."
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetHero() {
    if (!window.confirm("Restore the original homepage picture?")) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await saveSetting("hero_image_url", DEFAULT_HERO);

      if (heroPath) {
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([heroPath]);

        if (storageError) console.warn(storageError);

        const { error: pathError } = await supabase
          .from("site_settings")
          .delete()
          .eq("key", "hero_image_path");

        if (pathError) console.warn(pathError);
      }

      setHeroUrl(DEFAULT_HERO);
      setHeroPath(null);
      setMessage("Homepage picture restored.");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not restore the homepage picture."
      );
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50">
        <p className="text-sm text-neutral-500">Checking access...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
              Hair Artisans
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Website Pictures</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Change the main picture shown on the homepage.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="rounded-xl border bg-white px-4 py-3 text-sm font-medium"
            >
              Dashboard
            </button>
            <button
              onClick={() => router.push("/")}
              className="rounded-xl border bg-white px-4 py-3 text-sm font-medium"
            >
              View website
            </button>
            <button
              onClick={logout}
              className="rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-600"
            >
              Logout
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-semibold">Homepage main picture</h2>
          <p className="mb-6 mt-1 text-sm text-neutral-500">
            This is the circular image at the top of the customer homepage.
          </p>

          <ImageUploader
            value={heroUrl}
            folder="site"
            label="Homepage picture"
            onChange={(url, path) => {
              setHeroUrl(url);
              setHeroPath(path);
              setMessage("");
              setError("");
            }}
          />

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void saveHero()}
              disabled={saving}
              className="rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save homepage picture"}
            </button>

            <button
              type="button"
              onClick={() => void resetHero()}
              disabled={saving}
              className="rounded-xl border px-5 py-3 font-semibold disabled:opacity-50"
            >
              Restore original picture
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-semibold">Other website pictures</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Service-card pictures are managed from <strong>Admin → Services</strong>.
            Customer work photos are managed from <strong>Admin → Our Work</strong>.
            Our Work also appears on the booking page.
          </p>
        </section>
      </div>
    </main>
  );
}
