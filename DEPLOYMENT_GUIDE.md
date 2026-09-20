# Hair Artisans Barbershop — Deployment Guide

This is the one guide you need. It replaces `START_HERE.md`,
`DEPLOY_HAIR_ARTISANS.md`, `PAYSTACK_SETUP.md`,
`PAYMENT_DEPLOY_CHECKLIST.md` and `SETUP_DEPOSITS_PAYSTACK.md`,
which described the project at different, now-outdated stages and
have been removed to avoid conflicting instructions.

## What the site does today

- Customers book a service, choose a date/time, and pay a **30%
  deposit or the full price** via **Paystack**.
- A booking stays **pending** until Paystack confirms the payment,
  then becomes **confirmed** automatically (both via the browser
  redirect and a Paystack webhook, so it works even if the customer
  closes their browser right after paying).
- On confirmation, the customer sees an on-screen **confirmation
  number** (e.g. `HAB-20260919-000123`), the amount paid, and the
  amount still due. **No email is sent** — the customer is told to
  screenshot the page and show it to the barber.
- Customers can look up an existing booking anytime at
  `/booking/status` using that confirmation number — it shows the
  service, date, time, booking status, payment status, price,
  amount paid and amount still due. The homepage has a "Check
  Booking" link in the header and a dedicated "Already booked?"
  section pointing here.
- Business hours (open days, times, and the daily lunch break) are
  editable from **Admin → Hours** — nothing is hardcoded.
- Admin can **reschedule** an existing booking's date/time from
  **Admin → Dashboard**, with the same open-hours/lunch-break/
  double-booking checks as a new booking.

---

## 1. Local setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in real values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
SUPABASE_SECRET_KEY=sb_secret_YOUR_KEY
PAYSTACK_SECRET_KEY=sk_test_YOUR_SECRET_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Notes:
- Use the **Secret Key** for Paystack (`sk_test_...` / `sk_live_...`),
  never the public key (`pk_test_...`) — the app rejects it with a
  clear error if you paste the wrong one.
- If your Supabase project still uses the older key names
  (`NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`),
  those still work — the app checks for either naming.
- Never commit `.env.local` to GitHub.

```bash
npm run build
npm run dev
```

Open the local address Next.js prints (usually `http://localhost:3000`).

---

## 2. Supabase

1. Open your Supabase project → **SQL Editor**.
2. Open `supabase_final_setup.sql` from this project, copy the
   whole file, paste it in, and **Run**. It's the only SQL script
   you need — safe to run more than once, and safe on a database
   that already has real bookings. It sets up business hours,
   deposits, confirmation numbers, and admin rescheduling together.
3. Run this separately, with your own admin login email, to grant
   yourself admin access (find it at the bottom of `supabase_setup.sql`
   if you need the exact statement again):
   ```sql
   insert into public.admin_users(user_id)
   select id from auth.users where email = 'YOUR-ADMIN-EMAIL'
   on conflict (user_id) do nothing;
   ```
   (Sign up that email via `/admin/login` first if you haven't.)
4. In **Storage**, confirm the `hair-artisan-images` bucket exists
   and is public — `supabase_final_setup.sql`'s parent script
   (`supabase_setup.sql`) creates it on a fresh project; it's
   already there if you're continuing from an existing project.

---

## 3. Paystack

1. Sign up at https://paystack.com — South African businesses are
   fully supported.
2. Dashboard → **Settings → API Keys & Webhooks** → copy your
   **Secret Key**. Use the **Test** key (`sk_test_...`) first.
3. Set the **Webhook URL** to:
   ```text
   https://your-deployed-domain.com/api/payments/webhook
   ```
   (add this once you have a real domain from Vercel, step 5 below)
4. Test card for South Africa (ZAR):
   Card `4084 0840 8408 4081`, any future expiry, CVV `408`,
   PIN `0000`, OTP `123456`.

---

## 4. GitHub

Push the project. Do **not** commit:
- `.env.local`
- `.next`
- `node_modules`
- `.vercel`

---

## 5. Vercel

1. Import the GitHub repo into Vercel.
2. Add these under **Project Settings → Environment Variables**
   (same values as your `.env.local`):
   ```text
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
   SUPABASE_SECRET_KEY                    (or SUPABASE_SERVICE_ROLE_KEY)
   PAYSTACK_SECRET_KEY
   NEXT_PUBLIC_SITE_URL                   (your real vercel.app or custom domain)
   ```
3. Deploy. Once live, go back to Paystack and set the webhook URL
   (step 3 above) to your real Vercel domain.

---

## 6. Test the full flow end to end

1. Go to `/booking`, pick a service, date and time.
2. Enter your details — email is required (Paystack needs it to
   process the payment).
3. Choose "Pay 30% deposit" or "Pay in full" and continue — you're
   redirected to Paystack's checkout.
4. Pay with the test card from step 3 above.
5. You land back on `/booking/callback` with a confirmed booking:
   confirmation number, amount paid, and amount still due, all on
   screen. Screenshot it (that's the flow customers use).
6. Copy the confirmation number, go to `/booking/status`, paste it
   in (or just click "Check Booking" from the callback page, which
   pre-fills it) — you should see the same booking details.
7. Check **Admin → Dashboard** — the booking shows "confirmed" with
   a "Deposit paid" or "Paid in full" badge.
8. Try **Admin → Dashboard → Reschedule** on that booking to confirm
   the date/time editor works.

Once everything works with test keys, switch `PAYSTACK_SECRET_KEY`
to your live secret key (`sk_live_...`) to accept real payments.

---

## Admin panel reference

- `/admin/dashboard` — all bookings, payment status, reschedule.
- `/admin/calendar` — daily view of appointments.
- `/admin/customers` — customer list and history.
- `/admin/services` — add/edit/remove services and photos.
- `/admin/gallery` — "Our Work" photos shown on the homepage.
- `/admin/website` — homepage hero image.
- `/admin/hours` — weekly business hours + lunch break.

## What changed technically (for reference)

- **Deposits**: `create_hair_artisans_booking()` computes a 30%
  deposit (or full price) and creates the booking as `pending`
  until payment succeeds.
- **Payments**: `/api/payments/initialize` starts a Paystack
  checkout; `/api/payments/verify` confirms it when the customer is
  redirected back; `/api/payments/webhook` is the reliable
  server-to-server confirmation.
- **Confirmation numbers**: assigned inside
  `create_hair_artisans_booking()` as `HAB-YYYYMMDD-000123`
  (South African date + zero-padded booking id), looked up by
  `/api/bookings/status` for the `/booking/status` page.
- **No email**: `app/booking/callback/page.tsx` shows the
  confirmation on screen and tells the client to screenshot it.
- **Hours & lunch break**: stored in the `business_hours` table,
  editable from `/admin/hours`, read dynamically everywhere —
  nothing is hardcoded.
- **Rescheduling**: `admin_reschedule_booking()` only an admin can
  call; it recomputes the end time from the service duration and
  re-runs the same open-hours/lunch-break/double-booking checks as
  a new booking.
- **Abandoned payments**: a `pending` booking stops blocking its
  slot after 30 minutes if payment is never completed.
