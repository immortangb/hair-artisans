# Hair Artisan's Barbershop — repair and redeploy

## 1. Supabase
1. Open Supabase → SQL Editor.
2. Open `supabase_setup.sql`.
3. Run the entire file.
4. Run the final admin-user INSERT separately with your Supabase Auth email.
5. In Storage, confirm that `hair-artisan-images` exists and is public.

## 2. Local environment
Create `.env.local` locally with:

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Never upload `.env.local` to GitHub.

## 3. Local test

```bash
npm install
npm run build
npm run dev
```

Test:
- Admin login.
- Admin → Services → add a service with a picture.
- Admin → Our Work → upload a work picture, name the service/style and publish it.
- Admin → Website → change the homepage picture.
- Customer booking → confirm a free booking.
- Customer confirmation shows the booking number and says the chair is reserved.
- Admin Dashboard shows customer name, phone, email, service, date and time.
- Admin Calendar shows the reserved appointment.
- The booked time disappears for another customer.
- The booking page displays Our Work.

## 4. GitHub
Upload the project source files to GitHub. Do not upload:
- `.env.local`
- `.next`
- `node_modules`
- `.vercel`

## 5. Vercel
Import the GitHub repository into Vercel and add these Production Environment Variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Redeploy after saving them.

## 6. Admin controls after deployment
- `/admin/dashboard` — all bookings and customer details.
- `/admin/calendar` — daily reserved appointments.
- `/admin/customers` — customer list and history.
- `/admin/services` — add/edit/remove services and service pictures.
- `/admin/gallery` — add/edit/remove Our Work pictures and name each style/service.
- `/admin/website` — change the homepage main picture.
