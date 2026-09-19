import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initializePaystackTransaction } from "@/lib/payments/paystack";

// ============================================================
// POST /api/payments/initialize
// ============================================================
//
// Body: { bookingId: number }
//
// 1. Looks up the booking (created moments earlier via the public
//    create_hair_artisans_booking RPC, status = "pending").
// 2. Charges the booking's deposit_amount (30% minimum, or the
//    full price if the client chose to pay in full) - the AMOUNT
//    IS NEVER TRUSTED FROM THE CLIENT, it is read straight from
//    the database row the RPC already computed server-side.
// 3. Starts a Paystack "Standard" checkout and returns the URL to
//    redirect the browser to.
// ============================================================

function getSiteUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  ).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  let body: { bookingId?: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const bookingId = Number(body.bookingId);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: "A valid bookingId is required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: booking, error } = await admin
    .from("bookings")
    .select(
      `
        id,
        payment_status,
        deposit_amount,
        service_price,
        customer:customers ( full_name, email )
      `,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) {
    console.error("Booking lookup failed:", error);
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (booking.payment_status !== "pending") {
    return NextResponse.json(
      { error: "This booking has already been paid or is no longer pending." },
      { status: 409 },
    );
  }

  const customer = Array.isArray(booking.customer)
    ? booking.customer[0]
    : booking.customer;

  if (!customer?.email) {
    return NextResponse.json(
      { error: "An email address is required to take payment." },
      { status: 400 },
    );
  }

  const amount = Number(booking.deposit_amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid payment amount." }, { status: 400 });
  }

  const reference = `hab_${bookingId}_${Date.now()}`;
  const callbackUrl = `${getSiteUrl(request)}/booking/callback`;

  try {
    const transaction = await initializePaystackTransaction({
      email: customer.email,
      amountRands: amount,
      reference,
      callbackUrl,
      metadata: {
        booking_id: bookingId,
        customer_name: customer.full_name,
      },
    });

    await admin
      .from("bookings")
      .update({ payment_reference: reference })
      .eq("id", bookingId);

    return NextResponse.json({
      authorizationUrl: transaction.authorizationUrl,
      reference: transaction.reference,
    });
  } catch (paystackError) {
    console.error("Paystack initialize error:", paystackError);

    return NextResponse.json(
      {
        error:
          paystackError instanceof Error
            ? paystackError.message
            : "Could not start the payment. Please try again.",
      },
      { status: 502 },
    );
  }
}
