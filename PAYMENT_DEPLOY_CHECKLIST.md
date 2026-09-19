# Hair Artisans payment deployment checklist

## Paystack Test Mode

Use the **Secret Key**, not the public key:

```env
PAYSTACK_SECRET_KEY=sk_test_...
```

The server will reject `pk_test_...` and `pk_live_...` values with a clear error.

## Supabase

For the current Supabase key format use:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

`SUPABASE_SERVICE_ROLE_KEY` is still accepted for older projects, but `SUPABASE_SECRET_KEY` is preferred.

## Vercel

Add the same server/client variables in Vercel Project Settings → Environment Variables, then redeploy.

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
PAYSTACK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_SITE_URL=https://your-real-domain.example
```

## Paystack webhook

Set the Paystack webhook URL to:

```text
https://your-real-domain.example/api/payments/webhook
```

## Booking amounts

The database booking function calculates the payment amount from the selected service price. A deposit is 30%; full payment is 100%. The browser does not send the amount to Paystack.
