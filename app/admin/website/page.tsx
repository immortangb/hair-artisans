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
  const [bookingsPaused, setBookingsPaused] = useState(false);
  const [pausedMessage, setPausedMessage] = useState(
    "Online bookings are temporarily paused. Please check back soon."
  );
  const [savingPause, setSavingPause] = useState(false);
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

    const { data: pauseSettings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["bookings_paused", "bookings_paused_message"]);

    const pausedValue = pauseSettings?.find(
      (row) => row.key === "bookings_paused"
    )?.value;
    const pausedMessageValue = pauseSettings?.find(
      (row) => row.key === "bookings_paused_message"
    )?.value;

    if (pausedValue) setBookingsPaused(pausedValue === "true");
    if (pausedMessageValue) setPausedMessage(pausedMessageValue);
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

  async function togglePausedBookings(newValue: boolean) {
    setSavingPause(true);
    setMessage("");
    setError("");

    try {
      await saveSetting("bookings_paused", newValue ? "true" : "false");
      setBookingsPaused(newValue);
      setMessage(
        newValue
          ? "Bookings are now paused - customers can no longer book online."
          : "Bookings are open again."
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not update booking availability."
      );
    } finally {
      setSavingPause(false);
    }
  }

  async function savePausedMessage() {
    setSavingPause(true);
    setMessage("");
    setError("");

    try {
      await saveSetting("bookings_paused_message", pausedMessage.trim());
      setMessage("Message saved.");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Could not save the message."
      );
    } finally {
      setSavingPause(false);
    }
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
              Hair Artisans Barbershop
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
              onClick={() => router.push("/admin/hours")}
              className="rounded-xl border bg-white px-4 py-3 text-sm font-medium"
            >
              Hours
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Booking availability</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Pause online bookings while you set things up (e.g. Paystack
                is still in test mode). Customers won&apos;t be able to
                start a new booking until you resume - this is enforced on
                the server, not just hidden in the app.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void togglePausedBookings(!bookingsPaused)}
              disabled={savingPause}
              className={`shrink-0 rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-50 ${
                bookingsPaused
                  ? "bg-green-700 hover:bg-green-800"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {savingPause
                ? "Saving..."
                : bookingsPaused
                  ? "Resume bookings"
                  : "Pause bookings"}
            </button>
          </div>

          <div
            className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
              bookingsPaused
                ? "bg-red-50 text-red-700"
                : "bg-green-50 text-green-700"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                bookingsPaused ? "bg-red-600" : "bg-green-600"
              }`}
            />
            {bookingsPaused ? "Bookings are currently paused" : "Bookings are currently open"}
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium">
              Message shown to customers while paused
            </label>
            <textarea
              value={pausedMessage}
              onChange={(event) => setPausedMessage(event.target.value)}
              rows={2}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-black"
            />
            <button
              type="button"
              onClick={() => void savePausedMessage()}
              disabled={savingPause}
              className="mt-3 rounded-xl border px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              Save message
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm md:p-8">
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
            Customer work photos are managed from <strong>Admin → Our Work</strong>
            and appear on the homepage.
          </p>
        </section>
      </div>
    </main>
  );
}