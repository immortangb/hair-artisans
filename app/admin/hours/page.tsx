"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  fetchBusinessHours,
  getDayName,
  type DaySchedule,
  type WeekSchedule,
} from "@/lib/booking/schedule";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first, Sunday last

function emptyDay(dayOfWeek: number): DaySchedule {
  return {
    day_of_week: dayOfWeek,
    is_open: false,
    open_time: null,
    close_time: null,
    break_start: null,
    break_end: null,
  };
}

// The <input type="time"> element wants "HH:MM"; Postgres `time`
// columns come back as "HH:MM:SS". These two helpers convert
// between the two without pulling in a date library.
function toInputTime(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

function toDbTime(value: string): string | null {
  if (!value) return null;
  return `${value}:00`;
}

export default function HoursAdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<Record<number, DaySchedule>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    await loadHours();
  }

  async function loadHours() {
    setLoading(true);

    const schedule: WeekSchedule = await fetchBusinessHours(supabase);

    const byDay: Record<number, DaySchedule> = {};

    for (const dayOfWeek of DAY_ORDER) {
      byDay[dayOfWeek] =
        schedule.find((d) => d.day_of_week === dayOfWeek) ??
        emptyDay(dayOfWeek);
    }

    setDays(byDay);
    setLoading(false);
  }

  function updateDay(dayOfWeek: number, patch: Partial<DaySchedule>) {
    setDays((current) => ({
      ...current,
      [dayOfWeek]: { ...current[dayOfWeek], ...patch },
    }));
    setMessage("");
    setError("");
  }

  function validate(): string | null {
    for (const dayOfWeek of DAY_ORDER) {
      const day = days[dayOfWeek];

      if (!day.is_open) continue;

      if (!day.open_time || !day.close_time) {
        return `${getDayName(dayOfWeek)}: please set an opening and closing time, or mark the day closed.`;
      }

      if (day.open_time >= day.close_time) {
        return `${getDayName(dayOfWeek)}: closing time must be after opening time.`;
      }

      if ((day.break_start && !day.break_end) || (!day.break_start && day.break_end)) {
        return `${getDayName(dayOfWeek)}: please set both a lunch start and end time, or leave both empty.`;
      }

      if (day.break_start && day.break_end) {
        if (day.break_start >= day.break_end) {
          return `${getDayName(dayOfWeek)}: lunch end time must be after lunch start time.`;
        }

        if (day.break_start < day.open_time || day.break_end > day.close_time) {
          return `${getDayName(dayOfWeek)}: the lunch break must fall within business hours.`;
        }
      }
    }

    return null;
  }

  async function saveHours() {
    setMessage("");
    setError("");

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const rows = DAY_ORDER.map((dayOfWeek) => {
        const day = days[dayOfWeek];

        return {
          day_of_week: dayOfWeek,
          is_open: day.is_open,
          open_time: day.is_open ? day.open_time : null,
          close_time: day.is_open ? day.close_time : null,
          break_start: day.is_open ? day.break_start : null,
          break_end: day.is_open ? day.break_end : null,
          updated_at: new Date().toISOString(),
        };
      });

      const { error: saveError } = await supabase
        .from("business_hours")
        .upsert(rows, { onConflict: "day_of_week" });

      if (saveError) throw saveError;

      setMessage("Business hours saved.");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not save business hours. Please try again."
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
            <h1 className="mt-1 text-3xl font-semibold">Business Hours</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Set which days you&apos;re open, your hours, and your lunch
              break. Changes apply immediately to the booking page.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/dashboard"
              className="rounded-xl border bg-white px-4 py-3 text-sm font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/"
              className="rounded-xl border bg-white px-4 py-3 text-sm font-medium"
            >
              View website
            </Link>
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
          {loading ? (
            <p className="text-sm text-neutral-500">Loading hours...</p>
          ) : (
            <div className="space-y-4">
              {DAY_ORDER.map((dayOfWeek) => {
                const day = days[dayOfWeek];

                return (
                  <div
                    key={dayOfWeek}
                    className="rounded-2xl border border-neutral-200 p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-lg font-semibold">
                        {getDayName(dayOfWeek)}
                      </span>

                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={day.is_open}
                          onChange={(event) =>
                            updateDay(dayOfWeek, {
                              is_open: event.target.checked,
                              open_time:
                                event.target.checked && !day.open_time
                                  ? "10:00:00"
                                  : day.open_time,
                              close_time:
                                event.target.checked && !day.close_time
                                  ? "17:00:00"
                                  : day.close_time,
                            })
                          }
                          className="h-4 w-4"
                        />
                        Open
                      </label>
                    </div>

                    {day.is_open && (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                              Opens
                            </label>
                            <input
                              type="time"
                              value={toInputTime(day.open_time)}
                              onChange={(event) =>
                                updateDay(dayOfWeek, {
                                  open_time: toDbTime(event.target.value),
                                })
                              }
                              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                              Closes
                            </label>
                            <input
                              type="time"
                              value={toInputTime(day.close_time)}
                              onChange={(event) =>
                                updateDay(dayOfWeek, {
                                  close_time: toDbTime(event.target.value),
                                })
                              }
                              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                              Lunch from
                            </label>
                            <input
                              type="time"
                              value={toInputTime(day.break_start)}
                              onChange={(event) =>
                                updateDay(dayOfWeek, {
                                  break_start: toDbTime(event.target.value),
                                })
                              }
                              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                              Lunch until
                            </label>
                            <input
                              type="time"
                              value={toInputTime(day.break_end)}
                              onChange={(event) =>
                                updateDay(dayOfWeek, {
                                  break_end: toDbTime(event.target.value),
                                })
                              }
                              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => void saveHours()}
                disabled={saving}
                className="mt-2 w-full rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50 sm:w-auto"
              >
                {saving ? "Saving..." : "Save business hours"}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
