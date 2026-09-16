import { NextResponse } from "next/server";
import { callSupabaseRpc } from "@/lib/server/supabase";

export const runtime = "nodejs";

type PaymentBooking = {
  booking_id: number;
  amount: number;
  reference: string;
};

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { fullName, phone, email, notes, serviceId, appointmentDate, startTime, paymentOption } = payload;

    if (
      typeof fullName !== "string" || typeof phone !== "string" || !isValidEmail(email) ||
      !Number.isInteger(Number(serviceId)) || typeof appointmentDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || typeof startTime !== "string" ||
      !/^\d{2}:\d{2}$/.test(startTime) || !["deposit", "full"].includes(paymentOption)
    ) {
      return NextResponse.json({ error: "Please provide valid booking and payment details." }, { status: 400 });
    }

    const reference = `HA_${crypto.randomUUID().replaceAll("-", "")}`;
    const bookingRows = await callSupabaseRpc<PaymentBooking[]>("create_paystack_booking", {
      p_full_name: fullName.trim(),
      p_phone: phone.trim(),
      p_email: email.trim().toLowerCase(),
      p_notes: typeof notes === "string" ? notes.trim() || null : null,
      p_service_id: Number(serviceId),
      p_appointment_date: appointmentDate,
      p_start_time: startTime,
      p_payment_option: paymentOption,
      p_payment_reference: reference,
    });

    const booking = bookingRows[0];
    if (!booking) throw new Error("Could not create the pending booking.");
    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!paystackKey || !appUrl) {
      throw new Error("Paystack has not been configured on the server.");
    }

    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${paystackKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        amount: Math.round(Number(booking.amount) * 100),
        reference: booking.reference,
        callback_url: `${appUrl.replace(/\/$/, "")}/api/paystack/callback`,
        metadata: { booking_id: booking.booking_id, payment_option: paymentOption },
      }),
      cache: "no-store",
    });
    const paystack = await paystackResponse.json();

    if (!paystackResponse.ok || !paystack.status || !paystack.data?.authorization_url) {
      throw new Error(paystack.message || "Paystack could not start the payment.");
    }

    return NextResponse.json({ authorizationUrl: paystack.data.authorization_url });
  } catch (error) {
    console.error("Paystack initialization failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start payment." }, { status: 500 });
  }
}


