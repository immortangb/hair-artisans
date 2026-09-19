# Paystack repair notes

## Root cause fixed

The previous transaction reference was generated as:

`hab_${bookingId}_${Date.now()}`

That contains underscores.

Paystack's current Transaction API documentation says transaction references may contain only alphanumeric characters plus `-`, `.`, and `=`. The repaired project now generates:

`hab-${bookingId}-${Date.now()}`

This is the main fix for the initialization failure that prevented the Paystack checkout URL from being returned.

## Additional payment fixes

- Amount is sent as a string containing the ZAR subunit amount.
- The server checks that Paystack returned a real `authorization_url`.
- The booking page uses `window.location.assign()` to navigate to the returned checkout URL.
- The Paystack secret remains server-only.
- Browser callback verification re-checks the transaction directly with Paystack.
- Webhook requests are checked using Paystack's HMAC signature.
- The booking is only marked confirmed after successful Paystack verification.

## Before redeploying

Rotate the old Supabase and Paystack secret keys because the old `.env.local` was included in the original uploaded ZIP.

Then add the replacement values to Vercel environment variables.
