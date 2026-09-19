"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Hours = { day_of_week: number; is_closed: boolean; open_time: string | null; close_time: string | null; break_start: string | null; break_end: string | null };
const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ScheduleAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [rows, setRows] = useState<Hours[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { void (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace("/admin/login");
    const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) return router.replace("/admin/login");
    const { data } = await supabase.from("business_hours").select("day_of_week,is_closed,open_time,close_time,break_start,break_end").order("day_of_week");
    setRows((data as Hours[] || []));
  })(); }, [router, supabase]);

  function update(day: number, patch: Partial<Hours>) { setRows((current) => current.map((row) => row.day_of_week === day ? { ...row, ...patch } : row)); }
  async function save() {
    setSaving(true); setMessage("");
    const clean = rows.map((row) => row.is_closed ? { ...row, open_time: null, close_time: null, break_start: null, break_end: null, updated_at: new Date().toISOString() } : { ...row, updated_at: new Date().toISOString() });
    const { error } = await supabase.from("business_hours").upsert(clean, { onConflict: "day_of_week" });
    setMessage(error ? error.message : "Weekly schedule saved. New bookings will use it immediately."); setSaving(false);
  }

  return <main className="min-h-screen bg-[#f7f5f0] p-5 text-[#1c1b19] sm:p-10"><div className="mx-auto max-w-4xl"><Link href="/admin/dashboard" className="text-sm underline">← Admin dashboard</Link><h1 className="mt-5 text-3xl font-semibold">Weekly schedule</h1><p className="mt-2 text-[#70695f]">Set open days, hours and lunch breaks. A service cannot overlap the break.</p><div className="mt-7 space-y-3">{rows.map((row) => <div key={row.day_of_week} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-[130px_100px_1fr_1fr_1fr_1fr]"><strong className="self-center">{names[row.day_of_week]}</strong><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={row.is_closed} onChange={(e) => update(row.day_of_week, { is_closed: e.target.checked })} /> Closed</label>{!row.is_closed && <><label className="text-xs">Open<input type="time" value={row.open_time?.slice(0,5) || ""} onChange={(e) => update(row.day_of_week, { open_time: e.target.value })} className="mt-1 block w-full rounded border p-2" /></label><label className="text-xs">Close<input type="time" value={row.close_time?.slice(0,5) || ""} onChange={(e) => update(row.day_of_week, { close_time: e.target.value })} className="mt-1 block w-full rounded border p-2" /></label><label className="text-xs">Lunch starts<input type="time" value={row.break_start?.slice(0,5) || ""} onChange={(e) => update(row.day_of_week, { break_start: e.target.value || null })} className="mt-1 block w-full rounded border p-2" /></label><label className="text-xs">Lunch ends<input type="time" value={row.break_end?.slice(0,5) || ""} onChange={(e) => update(row.day_of_week, { break_end: e.target.value || null })} className="mt-1 block w-full rounded border p-2" /></label></>}</div>)}</div><button onClick={save} disabled={saving} className="mt-6 rounded-xl bg-[#1c1b19] px-5 py-3 font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save schedule"}</button>{message && <p className="mt-3 text-sm">{message}</p>}</div></main>;
}


