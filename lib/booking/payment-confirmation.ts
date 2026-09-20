import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";

// ============================================================
// PAYMENT CONFIRMATION (SERVER-ONLY)
// ============================================================
//
// This is the single place that turns "Paystack says this
// reference was paid" into "this booking is confirmed in our
// database". Both the browser redirect back from Paystack
// (app/api/payments/verify) and the Paystack webhook
// (app/api/payments/webhook) call this same function, so a
// booking is confirmed exactly once no matter which one gets
// there first.
//
// There is no confirmation email - the client sees their
// confirmation on screen (app/booking/callback) and is asked to
// screenshot it and show it to the barber.
// ============================================================

export type ConfirmPaymentResult =
  | {
      ok: true;
      alreadyProcessed: boolean;
      booking: {
        id: number;
        confirmation_number: string;
        service_name: string;
        appointment_date: string;
        start_time: string;
        service_price: number;
        deposit_amount: number;
        balance_amount: number;
        payment_status: string;
        customer_name: string;
      };
    }
  | { ok: false; message: string };

export async function confirmBookingPaymentByReference(
  reference: string,
): Promise<ConfirmPaymentResult> {
  const admin = createAdminClient();

  // 1. Always re-check with Paystack directly. Never trust a
  //    query-string parameter or webhook body on its own.
  let verification;

  try {
    verification = await verifyPaystackTransaction(reference);
  } catch (error) {
    console.error("Paystack verification failed:", error);
    return { ok: false, message: "Could not verify the payment with Paystack." };
  }

  if (!verification.success) {
    return {
      ok: false,
      message:
        verification.gatewayResponse ||
        "The payment was not successful. Please try again.",
    };
  }

  // Paystack can return metadata in different representations. The payment
  // reference is also stored on the booking, so use metadata first and fall
  // back to the stored reference. This makes callback/webhook confirmation
  // reliable even if Paystack returns empty/stringified metadata.
  let bookingId = Number(
    (verification.metadata as Record<string, unknown> | null)?.booking_id,
  );

  // 2. Load the booking + related customer/service info.
  const bookingSelect = `
        id,
        confirmation_number,
        appointment_date,
        start_time,
        status,
        payment_status,
        service_price,
        deposit_amount,
        balance_amount,
        payment_reference,
        customer:customers ( full_name, email ),
        service:services ( name )
      `;

  let booking: any = null;
  let bookingError: any = null;

  if (Number.isFinite(bookingId) && bookingId > 0) {
    const result = await admin
      .from("bookings")
      .select(bookingSelect)
      .eq("id", bookingId)
      .maybeSingle();
    booking = result.data;
    bookingError = result.error;
  }

  if (!booking) {
    const result = await admin
      .from("bookings")
      .select(bookingSelect)
      .eq("payment_reference", reference)
      .maybeSingle();
    booking = result.data;
    bookingError = result.error;
    if (booking) bookingId = Number(booking.id);
  }

  if (bookingError || !booking) {
    console.error("Booking lookup failed:", bookingError, { reference, metadata: verification.metadata });
    return { ok: false, message: "We could not find that booking for this payment." };
  }

  // Paystack's amount is returned in the currency's smallest unit. For ZAR,
  // compare cents exactly after converting the database amount to cents.
  if (verification.currency !== "ZAR") {
    return { ok: false, message: "The payment currency does not match this booking." };
  }

  const expectedAmount = Number(booking.deposit_amount ?? 0);
  const expectedCents = Math.round(expectedAmount * 100);
  const paidCents = Math.round(Number(verification.amountRands) * 100);

  if (!Number.isFinite(expectedCents) || expectedCents <= 0 || paidCents !== expectedCents) {
    console.error(
      `Amount mismatch for booking ${booking.id}: expected R${expectedAmount.toFixed(2)} (${expectedCents} cents), got R${verification.amountRands.toFixed(2)} (${paidCents} cents)`,
    );
    return {
      ok: false,
      message: "The amount paid does not match this booking. Please contact the shop.",
    };
  }

  const customer = Array.isArray(booking.customer)
    ? booking.customer[0]
    : booking.customer;
  const service = Array.isArray(booking.service)
    ? booking.service[0]
    : booking.service;

  // Idempotency: if this booking was already confirmed (for example the
  // browser callback and webhook both fired), return the existing result.
  if (
    booking.payment_status === "deposit_paid" ||
    booking.payment_status === "paid_full"
  ) {
    return {
      ok: true,
      alreadyProcessed: true,
      booking: {
        id: booking.id,
        confirmation_number: booking.confirmation_number ?? `HA-${booking.id}`,
        service_name: service?.name ?? "Service",
        appointment_date: booking.appointment_date,
        start_time: booking.start_time,
        service_price: Number(booking.service_price ?? 0),
        deposit_amount: Number(booking.deposit_amount ?? 0),
        balance_amount: Number(booking.balance_amount ?? 0),
        payment_status: booking.payment_status,
        customer_name: customer?.full_name ?? "Customer",
      },
    };
  }

  const paidInFull = expectedAmount >= Number(booking.service_price ?? 0);
  const newPaymentStatus = paidInFull ? "paid_full" : "deposit_paid";

  // Mark the booking confirmed + paid.
  const { error: updateError } = await admin
    .from("bookings")
    .update({
      status: "confirmed",
      payment_status: newPaymentStatus,
      payment_reference: reference,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  if (updateError) {
    console.error("Could not update booking after payment:", updateError);
    return { ok: false, message: "Payment succeeded but the booking could not be updated. Please contact the shop." };
  }

  return {
    ok: true,
    alreadyProcessed: false,
    booking: {
      id: booking.id,
      confirmation_number: booking.confirmation_number ?? `HA-${booking.id}`,
      service_name: service?.name ?? "Service",
      appointment_date: booking.appointment_date,
      start_time: booking.start_time,
      service_price: Number(booking.service_price ?? 0),
      deposit_amount: expectedAmount,
      balance_amount: paidInFull ? 0 : Number(booking.balance_amount ?? 0),
      payment_status: newPaymentStatus,
      customer_name: customer?.full_name ?? "Customer",
    },
  };
}