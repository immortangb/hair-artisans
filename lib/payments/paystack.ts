import crypto from "crypto";

// ============================================================
// PAYSTACK HELPER (SERVER-ONLY)
// ============================================================
//
// Talks to the Paystack REST API directly with fetch - no SDK
// needed. Requires PAYSTACK_SECRET_KEY in your environment
// (Paystack dashboard -> Settings -> API Keys & Webhooks).
//
// Never import this file from a "use client" component: the
// secret key must never reach the browser.
// ============================================================

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;

  if (!key) {
    throw new Error("Missing PAYSTACK_SECRET_KEY environment variable.");
  }

  // Paystack's server-to-server API requires the Secret Key. A public
  // key (pk_test_... / pk_live_...) must never be used as a Bearer token.
  if (key.startsWith("pk_test_") || key.startsWith("pk_live_")) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is a public key. Use the Paystack Secret Key (sk_test_... for Test Mode or sk_live_... for Live Mode)."
    );
  }

  return key;
}

export type PaystackInitializeParams = {
  email: string;
  amountRands: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

export type PaystackInitializeResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

// Starts a Paystack "Standard" checkout. The customer is redirected
// to authorizationUrl to pay, then Paystack redirects them back to
// callbackUrl once they're done.
export async function initializePaystackTransaction(
  params: PaystackInitializeParams,
): Promise<PaystackInitializeResult> {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      // Paystack expects the smallest currency unit (cents for ZAR).
      amount: Math.round(params.amountRands * 100),
      currency: "ZAR",
      reference: params.reference,
      callback_url: params.callbackUrl,
      // Paystack documents metadata as a stringified JSON object. Sending it
      // as a JSON string also makes the value consistent between initialize
      // and verify responses across Paystack environments.
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    }),
  });

  const body = await response.json();

  if (!response.ok || !body?.status) {
    throw new Error(
      body?.message || "Could not start the Paystack payment.",
    );
  }

  return {
    authorizationUrl: body.data.authorization_url,
    accessCode: body.data.access_code,
    reference: body.data.reference,
  };
}

export type PaystackVerifyResult = {
  success: boolean;
  status: string;
  amountRands: number;
  currency: string;
  reference: string;
  paidAt: string | null;
  metadata: Record<string, unknown> | null;
  gatewayResponse: string | null;
};

// Re-checks a transaction directly with Paystack. Always call this
// instead of trusting the client's redirect or a webhook payload on
// its own - it is the only source of truth for whether money moved.
export async function verifyPaystackTransaction(
  reference: string,
): Promise<PaystackVerifyResult> {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
      },
      cache: "no-store",
    },
  );

  const body = await response.json();

  if (!response.ok || !body?.status) {
    throw new Error(
      body?.message || "Could not verify the Paystack payment.",
    );
  }

  const data = body.data;

  // Paystack may return metadata as an object or as a JSON string depending
  // on the API response/environment. Normalize it here so payment
  // confirmation does not depend on that representation.
  let normalizedMetadata: Record<string, unknown> | null = null;
  if (data?.metadata && typeof data.metadata === "object") {
    normalizedMetadata = data.metadata as Record<string, unknown>;
  } else if (typeof data?.metadata === "string" && data.metadata.trim()) {
    try {
      const parsed = JSON.parse(data.metadata);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        normalizedMetadata = parsed as Record<string, unknown>;
      }
    } catch {
      normalizedMetadata = null;
    }
  }

  return {
    success: data?.status === "success",
    status: data?.status ?? "unknown",
    amountRands: typeof data?.amount === "number" ? data.amount / 100 : 0,
    currency: data?.currency ?? "ZAR",
    reference: data?.reference ?? reference,
    paidAt: data?.paid_at ?? null,
    metadata: normalizedMetadata,
    gatewayResponse: data?.gateway_response ?? null,
  };
}

// Confirms a Paystack webhook request really came from Paystack by
// recomputing the HMAC SHA512 signature of the raw request body with
// the secret key and comparing it to the x-paystack-signature header.
export function verifyPaystackWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expected = crypto
    .createHmac("sha512", getSecretKey())
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signatureHeader),
    );
  } catch {
    // Different lengths etc. - definitely not a match.
    return false;
  }
}