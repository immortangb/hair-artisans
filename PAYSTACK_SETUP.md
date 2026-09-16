# Paystack, booking email and schedule setup

1. In Supabase SQL Editor, run `supabase_paystack_schedule_migration.sql` once (after the existing `supabase_setup.sql`). It creates the 30% deposit/full-payment workflow, editable schedule, and a 12:00–12:30 lunch break.
2. Copy `.env.example` to `.env.local` and fill in the new variables. `SUPABASE_SERVICE_ROLE_KEY` and `PAYSTACK_SECRET_KEY` are server secrets: never prefix them with `NEXT_PUBLIC_` and never commit them.
3. In Paystack, set the callback URL to `https://YOUR-DOMAIN/api/paystack/callback`. Use a test secret key until a full test payment works, then replace it with your live secret key.
4. Create a verified sender domain in Resend and place that verified sender in `BOOKING_EMAIL_FROM`. Confirmation emails are sent after Paystack verifies payment.
5. Deploy, then sign in as admin and visit `/admin/schedule` to edit days, opening times and lunch breaks. Existing schedule defaults: Wednesday–Sunday, 10:00–17:00; Monday/Tuesday closed; lunch 12:00–12:30.

The booking screen requires an email address because it is where the confirmation is delivered. A payment holds a slot for 15 minutes; only verified payments become confirmed bookings.


