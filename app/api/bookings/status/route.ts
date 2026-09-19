import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const confirmation = (request.nextUrl.searchParams.get("confirmation") || "").trim().toUpperCase();

  if (!/^HAB-[A-Z0-9-]{6,60}$/.test(confirmation)) {
    return NextResponse.json({ error: "Please enter a valid booking confirmation number." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: booking, error } = await admin
    .from("bookings")
    .select(`
      confirmation_number,
      appointment_date,
      start_time,
      end_time,
      status,
      payment_status,
      service_price,
      deposit_amount,
      balance_amount,
      service:services(name)
    `)
    .eq("confirmation_number", confirmation)
    .maybeSingle();

  if (error) {
    console.error("Booking status lookup failed:", error);
    return NextResponse.json({ error: "We could not check that booking right now." }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: "No booking was found with that confirmation number." }, { status: 404 });
  }

  const service = Array.isArray(booking.service) ? booking.service[0] : booking.service;

  const paymentConfirmed = booking.payment_status === "deposit_paid" || booking.payment_status === "paid_full";
  const amountPaid = paymentConfirmed ? Number(booking.deposit_amount ?? 0) : 0;
  const amountDue = Math.max(Number(booking.service_price ?? 0) - amountPaid, 0);

  return NextResponse.json({
    booking: {
      confirmation_number: booking.confirmation_number,
      appointment_date: booking.appointment_date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      status: booking.status,
      payment_status: booking.payment_status,
      service_name: service?.name ?? "Service",
      service_price: Number(booking.service_price ?? 0),
      amount_paid: amountPaid,
      amount_due: amountDue,
    },
  });
}
