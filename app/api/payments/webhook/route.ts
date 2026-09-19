import { NextRequest, NextResponse } from "next/server";
import { verifyPaystackWebhookSignature } from "@/lib/payments/paystack";
import { confirmBookingPaymentByReference } from "@/lib/booking/payment-confirmation";

// ============================================================
// POST /api/payments/webhook
// ============================================================
//
// Register this exact URL in the Paystack dashboard under
// Settings -> API Keys & Webhooks -> Webhook URL, e.g.
//   https://yourdomain.com/api/payments/webhook
//
// This is the RELIABLE way payments get confirmed - unlike the
// browser redirect (/api/payments/verify), it fires even if the
// customer closes the tab right after paying. Both routes call
// the same confirmBookingPaymentByReference() function, which is
// safe to run twice for the same booking.
// ============================================================

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    console.error("Paystack webhook signature mismatch.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Only charge.success moves a booking to confirmed. Other events
  // (e.g. charge.failed) are acknowledged so Paystack stops
  // retrying, but do not need any action here.
  if (event.event === "charge.success" && event.data?.reference) {
    const result = await confirmBookingPaymentByReference(event.data.reference);

    if (!result.ok) {
      console.error("Webhook could not confirm booking:", result.message);
    }
  }

  // Always respond 200 quickly so Paystack does not keep retrying.
  return NextResponse.json({ received: true });
}
