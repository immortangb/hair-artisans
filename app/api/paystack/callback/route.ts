import { NextResponse } from "next/server";
import { callSupabaseRpc } from "@/lib/server/supabase";

export const runtime = "nodejs";

async function verifyAndConfirm(reference: string) {
  const paystackKey = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackKey) throw new Error("Paystack has not been configured on the server.");

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackKey}` }, cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || !result.status || result.data?.status !== "success") {
    throw new Error("Payment was not completed.");
  }

  const rows = await callSupabaseRpc<Array<Record<string, unknown>>>("confirm_paystack_booking", {
    p_payment_reference: reference,
    p_paid_amount: Number(result.data.amount) / 100,
  });
  const booking = rows[0];
  if (!booking) throw new Error("Booking confirmation failed.");
  return booking;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference");
  const bookingUrl = new URL("/booking/confirmed", url.origin);
  if (!reference) {
    bookingUrl.searchParams.set("payment", "failed");
    return NextResponse.redirect(bookingUrl);
  }
  try {
    const booking = await verifyAndConfirm(reference);
    bookingUrl.searchParams.set("payment", "success");
    bookingUrl.searchParams.set("booking", String(booking.booking_id));
  } catch (error) {
    console.error("Paystack callback failed", error);
    bookingUrl.searchParams.set("payment", "failed");
  }
  return NextResponse.redirect(bookingUrl);
}

