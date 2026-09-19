# New Features Setup Guide

This covers the changes made to your site:
1. 30% minimum deposit (or pay in full) on every booking
2. On-screen booking confirmation after payment - the client
   screenshots it and shows it to the barber (no email is sent)
3. 12:00-12:30 daily lunch break (blocked from booking)
4. Editable weekly schedule (Admin -> Hours)
5. Paystack as the payment provider
6. Admin can reschedule an existing booking's date and time
7. Business name updated everywhere to "Hair Artisans Barbershop"

Follow these steps in order. None of this will break your existing
bookings, customers, services or photos.

---

## Step 1: Run the database script

1. Open your Supabase project -> **SQL Editor**.
2. Open `supabase_final_setup.sql` from this project folder, copy
   the whole file, paste it into the SQL Editor, and click **Run**.
3. That's the only script you need to run. It's safe to run more
   than once. It sets up:
   - the `business_hours` table (seeded with your current Wed-Sun
     10:00-17:00 schedule + a 12:00-12:30 lunch break)
   - the deposit-aware booking function
   - the admin reschedule function

## Step 2: Get your Supabase service role key

1. Supabase Dashboard -> your project -> **Project Settings -> API**.
2. Copy the **service_role** secret key (NOT the anon/public key you
   already have).
3. This key can read/write everything in your database, so keep it
   secret - never put it in a file that starts with `NEXT_PUBLIC_`,
   never share it, never commit it to a public GitHub repo.

## Step 3: Create a Paystack account

1. Sign up at https://paystack.com (South African businesses are
   fully supported).
2. In the Paystack dashboard -> **Settings -> API Keys & Webhooks**,
   copy your **Secret Key**. Start with the **Test** secret key
   (starts with `sk_test_`) so you can try the whole flow with fake
   card numbers before going live.
3. On the same page, set your **Webhook URL** to:
   `https://your-deployed-site.com/api/payments/webhook`
   (replace with your real domain once deployed - you can add this
   after your first deploy).
4. Paystack's test card for South Africa (ZAR):
   Card number `4084 0840 8408 4081`, any future expiry date, CVV
   `408`, PIN `0000`, OTP `123456`.

## Step 4: Fill in your environment variables

Open `.env.local` in this project. Your existing Supabase URL and
anon key are untouched. Fill in the new values added below them:

```
SUPABASE_SERVICE_ROLE_KEY=...        (from Step 2)
PAYSTACK_SECRET_KEY=...              (from Step 3)
NEXT_PUBLIC_SITE_URL=https://your-deployed-site.com
```

If you deploy on Vercel, add the exact same variables under
**Project Settings -> Environment Variables** there too - `.env.local`
only works on your own computer, not on the live site.

An email address is still collected during booking (Paystack
requires one to process the payment), but no confirmation email is
sent by the site - Paystack itself may email its own payment
receipt, but your booking confirmation is on-screen only.

## Step 5: Set your business hours

1. Run the site, log in to `/admin/login`, and open **Admin -> Hours**.
2. Your current Wed-Sun 10:00-17:00 schedule with a 12:00-12:30 lunch
   break is already seeded in. Adjust any day, time, or the lunch
   break from there and click **Save business hours**.
3. Changes apply immediately - no code changes or redeploys needed.

## Step 6: Test the full flow

1. Go to `/booking`, pick a service, date and time.
2. Enter an email address (required by Paystack, not used for
   confirmation).
3. On the final step, choose "Pay 30% deposit" or "Pay in full", and
   click through to Paystack's checkout.
4. Use the Paystack test card from Step 3.
5. You should land back on `/booking/callback` with a confirmed
   booking on screen - the customer takes a screenshot of this page
   and shows it to the barber.
6. Check **Admin -> Dashboard** - the booking should show as
   "confirmed" with a "Deposit paid" or "Paid in full" badge.

Once everything works with test keys, swap `PAYSTACK_SECRET_KEY` for
your live secret key (`sk_live_...`) to accept real payments.

## Step 7: Rescheduling a booking

From **Admin -> Dashboard**, any pending or confirmed booking has a
**Reschedule** button. Pick a new date and time and save - the same
checks used for new bookings apply automatically (the shop must be
open, the time must be within hours, it can't overlap the lunch
break, and it can't clash with another booking).

---

## What changed technically (for reference)

- **Deposits**: `create_hair_artisans_booking()` now computes a 30%
  deposit (or full price) and creates the booking as `pending` until
  payment succeeds.
- **Payments**: `/api/payments/initialize` starts a Paystack
  checkout; `/api/payments/verify` confirms it when the customer is
  redirected back; `/api/payments/webhook` is the reliable
  server-to-server confirmation (register this URL in Paystack).
- **No email**: there is no email-sending code in this project.
  `app/booking/callback/page.tsx` shows the confirmation on screen
  and tells the client to screenshot it.
- **Hours & lunch break**: stored in the `business_hours` table,
  editable from `/admin/hours`, and read dynamically by both the
  booking page and the database function - nothing is hardcoded.
- **Rescheduling**: `admin_reschedule_booking()` is a database
  function that only an admin can call. It recomputes the booking's
  end time from the service duration and re-runs the same open-hours
  / lunch-break / double-booking checks as a new booking.
- **Abandoned payments**: if a customer starts checkout but never
  finishes, their `pending` booking stops blocking the slot after 30
  minutes automatically.
