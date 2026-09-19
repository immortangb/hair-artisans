"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  Loader2,
  Scissors,
} from "lucide-react";
import { BUSINESS_NAME, BUSINESS_TIMEZONE } from "@/lib/booking/config";

type VerifiedBooking = {
  id: number;
  service_name: string;
  appointment_date: string;
  start_time: string;
  service_price: number;
  deposit_amount: number;
  balance_amount: number;
  payment_status: string;
  customer_name: string;
};

type ViewState =
  | { status: "loading" }
  | { status: "success"; booking: VerifiedBooking }
  | { status: "error"; message: string };

function formatRand(amount: number): string {
  return `R${Number(amount).toFixed(0)}`;
}

function formatDate(dateString: string): string {
  const date = new Date(`${dateString}T12:00:00`);

  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.slice(0, 5).split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function CallbackContent() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    const reference =
      searchParams.get("reference") || searchParams.get("trxref");

    if (!reference) {
      setView({
        status: "error",
        message: "We could not find a payment reference in the link.",
      });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(
          `/api/payments/verify?reference=${encodeURIComponent(reference)}`
        );
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok || !data?.ok) {
          setView({
            status: "error",
            message:
              data?.message ||
              "We could not confirm your payment. Please try again or contact the shop.",
          });
          return;
        }

        setView({ status: "success", booking: data.booking });
      } catch (error) {
        console.error("Verify request failed:", error);

        if (!cancelled) {
          setView({
            status: "error",
            message:
              "Something went wrong while confirming your payment. Please contact the shop.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  if (view.status === "loading") {
    return (
      <div className="w-full rounded-3xl border border-[#ded9cf] bg-white p-8 text-center shadow-sm sm:p-12">
        <Loader2 className="mx-auto mb-6 h-10 w-10 animate-spin text-[#806a40]" />
        <h1 className="mb-2 text-2xl font-semibold">Confirming your payment...</h1>
        <p className="text-[#77716a]">
          Please wait a moment, this only takes a few seconds.
        </p>
      </div>
    );
  }

  if (view.status === "error") {
    return (
      <div className="w-full rounded-3xl border border-[#ded9cf] bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>

        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
          Payment not confirmed
        </p>

        <h1 className="mb-4 text-3xl font-semibold sm:text-4xl">
          Something didn&apos;t go through
        </h1>

        <p className="mx-auto mb-8 max-w-xl leading-7 text-[#66615a]">
          {view.message} Your booking has not been confirmed and your slot
          may be released after 30 minutes if payment isn&apos;t completed.
        </p>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/booking"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#1c1b19] px-6 font-medium text-white transition hover:bg-[#34312d]"
          >
            Try again
          </Link>

          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#d5d0c7] bg-white px-6 font-medium text-[#1c1b19] transition hover:bg-[#f5f2ec]"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const { booking } = view;
  const paidInFull = booking.payment_status === "paid_full";

  return (
    <div className="w-full rounded-3xl border border-[#ded9cf] bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#efe7d5]">
        <CheckCircle2 className="h-10 w-10 text-[#806a40]" />
      </div>

      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#806a40]">
        Booking confirmed
      </p>

      <h1 className="mb-4 text-3xl font-semibold sm:text-4xl">
        You&apos;re booked!
      </h1>

      <p className="mx-auto mb-8 max-w-xl leading-7 text-[#66615a]">
        Thanks, {booking.customer_name}. Your appointment at {BUSINESS_NAME}{" "}
        is confirmed and your payment has gone through.
      </p>

      <div className="mx-auto mb-8 flex max-w-md items-start gap-3 rounded-2xl border border-[#e7c98d] bg-[#fdf6e6] p-4 text-left">
        <Camera className="mt-0.5 h-5 w-5 shrink-0 text-[#916b1f]" />
        <p className="text-sm leading-6 text-[#6b5316]">
          <span className="font-semibold">
            Please take a screenshot of this page
          </span>{" "}
          and show it to the barber when you arrive - it&apos;s your proof
          of booking and payment.
        </p>
      </div>

      <div className="mx-auto mb-8 max-w-md rounded-2xl border border-[#ded9cf] bg-[#faf9f6] p-6 text-left">
        <div className="mb-5 flex items-center justify-between border-b border-[#e4e0d8] pb-4">
          <span className="text-sm text-[#77716a]">Booking number</span>
          <span className="font-semibold">HA-{booking.id}</span>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Scissors className="mt-0.5 h-5 w-5 shrink-0 text-[#806a40]" />
            <div>
              <p className="text-xs uppercase tracking-wide text-[#88827a]">
                Service
              </p>
              <p className="font-medium">{booking.service_name}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#806a40]" />
            <div>
              <p className="text-xs uppercase tracking-wide text-[#88827a]">
                Date
              </p>
              <p className="font-medium">
                {formatDate(booking.appointment_date)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-[#806a40]" />
            <div>
              <p className="text-xs uppercase tracking-wide text-[#88827a]">
                Time
              </p>
              <p className="font-medium">{formatTime(booking.start_time)}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2 border-t border-[#e4e0d8] pt-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[#77716a]">Service price</span>
            <span className="font-medium">
              {formatRand(booking.service_price)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#77716a]">Paid today</span>
            <span className="font-medium">
              {formatRand(booking.deposit_amount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#77716a]">
              {paidInFull ? "Balance" : "Due at the shop"}
            </span>
            <span
              className={`font-semibold ${
                paidInFull ? "text-green-700" : "text-[#806a40]"
              }`}
            >
              {paidInFull ? "Paid in full" : formatRand(booking.balance_amount)}
            </span>
          </div>
        </div>
      </div>

      <p className="mb-8 text-sm leading-6 text-[#77716a]">
        Please arrive a few minutes before your appointment. If you need
        to make a change, contact the shop directly.
      </p>

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#1c1b19] px-6 font-medium text-white transition hover:bg-[#34312d]"
        >
          Back to home
        </Link>

        <Link
          href="/booking"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#d5d0c7] bg-white px-6 font-medium text-[#1c1b19] transition hover:bg-[#f5f2ec]"
        >
          Make another booking
        </Link>
      </div>
    </div>
  );
}

export default function BookingCallbackPage() {
  return (
    <main className="min-h-screen bg-[#f7f5f0] text-[#1c1b19]">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-5 py-16">
        <Suspense
          fallback={
            <div className="w-full rounded-3xl border border-[#ded9cf] bg-white p-8 text-center shadow-sm sm:p-12">
              <Loader2 className="mx-auto mb-6 h-10 w-10 animate-spin text-[#806a40]" />
              <h1 className="text-2xl font-semibold">Loading...</h1>
            </div>
          }
        >
          <CallbackContent />
        </Suspense>
      </div>
    </main>
  );
}