"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Search, Scissors, CalendarDays, Clock3 } from "lucide-react";

const BUSINESS_NAME = "Hair-Artisans Barbershop";

function money(value: number) { return `R${value.toFixed(2)}`; }
function dateZA(value: string) {
  return new Intl.DateTimeFormat("en-ZA", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" }).format(new Date(`${value}T12:00:00+02:00`));
}
function statusLabel(status: string) {
  return status === "confirmed" ? "Confirmed" : status === "pending" ? "Awaiting payment" : status.replaceAll("_", " ");
}

type Booking = { confirmation_number: string; appointment_date: string; start_time: string; end_time: string; status: string; payment_status: string; service_name: string; service_price: number; amount_paid: number; amount_due: number; };

export default function BookingStatusPage() {
  const [confirmation, setConfirmation] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function checkStatus(event: FormEvent) {
    event.preventDefault();
    setError(""); setBooking(null); setLoading(true);
    try {
      const value = confirmation.trim().toUpperCase();
      const response = await fetch(`/api/bookings/status?confirmation=${encodeURIComponent(value)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Booking not found.");
      setBooking(data.booking);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not check the booking."); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-[#f7f5f0] px-5 py-12 text-[#1c1b19]">
      <div className="mx-auto max-w-2xl">
        <Link href="/booking" className="text-sm font-medium underline">← Back to booking</Link>
        <section className="mt-6 rounded-3xl border border-[#ded9cf] bg-white p-7 shadow-sm sm:p-10">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#efe7d5]"><Search className="h-6 w-6 text-[#806a40]" /></div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.25em] text-[#806a40]">{BUSINESS_NAME}</p>
            <h1 className="mt-2 text-3xl font-semibold">Check booking status</h1>
            <p className="mt-3 text-sm leading-6 text-[#70695f]">Enter the booking confirmation number shown after you paid.</p>
          </div>

          <form onSubmit={checkStatus} className="mt-7 space-y-3">
            <label className="block text-sm font-medium">Booking confirmation number</label>
            <input value={confirmation} onChange={(e) => setConfirmation(e.target.value.toUpperCase())} placeholder="HAB-20260919-000123" className="w-full rounded-xl border border-[#d7d1c8] px-4 py-3 font-medium tracking-wide outline-none focus:border-[#806a40]" required />
            <button disabled={loading} className="w-full rounded-xl bg-[#1c1b19] px-5 py-3 font-semibold text-white disabled:opacity-60">{loading ? "Checking..." : "Check appointment"}</button>
          </form>

          {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          {booking && (
            <div className="mt-7 rounded-2xl border border-[#ded9cf] bg-[#faf9f6] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e0d8] pb-4">
                <span className="text-sm text-[#77716a]">Confirmation</span><strong>{booking.confirmation_number}</strong>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="flex gap-3"><Scissors className="h-5 w-5 text-[#806a40]"/><div><p className="text-xs uppercase text-[#88827a]">Service</p><p className="font-medium">{booking.service_name}</p></div></div>
                <div className="flex gap-3"><CalendarDays className="h-5 w-5 text-[#806a40]"/><div><p className="text-xs uppercase text-[#88827a]">Date</p><p className="font-medium">{dateZA(booking.appointment_date)}</p></div></div>
                <div className="flex gap-3"><Clock3 className="h-5 w-5 text-[#806a40]"/><div><p className="text-xs uppercase text-[#88827a]">Time</p><p className="font-medium">{booking.start_time.slice(0,5)} - {booking.end_time.slice(0,5)}</p></div></div>
              </div>
              <div className="mt-6 space-y-2 border-t border-[#e4e0d8] pt-5 text-sm">
                <div className="flex justify-between"><span className="text-[#77716a]">Booking status</span><strong>{statusLabel(booking.status)}</strong></div>
                <div className="flex justify-between"><span className="text-[#77716a]">Payment status</span><strong>{statusLabel(booking.payment_status)}</strong></div>
                <div className="flex justify-between"><span className="text-[#77716a]">Service price</span><strong>{money(booking.service_price)}</strong></div>
                <div className="flex justify-between"><span className="text-[#77716a]">Amount paid</span><strong>{money(booking.amount_paid)}</strong></div>
                <div className="flex justify-between text-base"><span className="font-medium">Amount still due</span><strong>{money(booking.amount_due)}</strong></div>
              </div>
              <p className="mt-5 rounded-xl bg-[#efe7d5] p-4 text-sm leading-6 text-[#5f4b21]">Keep this confirmation number and show your booking confirmation to the barber when you arrive.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
