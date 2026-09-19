import { NextRequest, NextResponse } from "next/server";
import { confirmBookingPaymentByReference } from "@/lib/booking/payment-confirmation";

// ============================================================
// GET /api/payments/verify?reference=xxxx
// ============================================================
//
// Called by app/booking/callback/page.tsx right after Paystack
// redirects the customer back to the site. Re-verifies the
// transaction with Paystack and confirms the booking if it was
// paid. The Paystack webhook (app/api/payments/webhook) does the
// same confirmation independently, so the booking is still
// confirmed correctly even if the customer closes their browser
// before this redirect completes.
// ============================================================

export async function GET(request: NextRequest) {
  const reference =
    request.nextUrl.searchParams.get("reference") ||
    request.nextUrl.searchParams.get("trxref");

  if (!reference) {
    return NextResponse.json(
      { ok: false, message: "Missing payment reference." },
      { status: 400 },
    );
  }

  const result = await confirmBookingPaymentByReference(reference);

  if (!result.ok) {
    return NextResponse.json(result, { status: 402 });
  }

  return NextResponse.json(result);
}
