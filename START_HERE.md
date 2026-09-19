# Hair-Artisans Barbershop — clean repair

This version has been reset from the supplied project and repaired for the following requirements:

- Business name: **Hair-Artisans Barbershop**
- Monday: Closed
- Tuesday: Closed
- Wednesday–Sunday: **10:00–17:00**
- New customer booking slots start at **10:00**
- New customer bookings cannot start before 10:00
- Closing time remains **17:00**
- Existing bookings are preserved. The project does **not** delete, cancel or edit the existing 09:00 or 09:30 bookings.
- No payment or SMS features were added.
- The existing Supabase RPC name `create_hair_artisans_booking` was intentionally kept so the frontend continues to match the database.

## 1. Install dependencies

From the project root in VS Code PowerShell:

```powershell
npm ci
```

If `npm ci` reports a lock-file/dependency problem, use:

```powershell
npm install
```

## 2. Test the website

```powershell
npm run build
npm run dev
```

Open the local address shown by Next.js.

## 3. Apply the Supabase booking-hours change

In Supabase → SQL Editor, run **only**:

`supabase_booking_hours_migration.sql`

This migration recreates the existing booking function with the exact current signature and changes only the minimum start-time rule from 09:00 to 10:00. It does not touch the `bookings` rows.

### Important

Do not use the full `supabase_setup.sql` as a production repair if your database already contains real bookings unless you specifically intend to re-run the complete setup. The small migration is the safe choice for the hours change.

## 4. Push to GitHub and deploy to Vercel

```powershell
git add .
git commit -m "Repair Hair-Artisans Barbershop branding and booking hours"
git push
```

Vercel should then build the pushed commit. If Vercel asks for a deployment, redeploy the latest commit.

## 5. Optional repair script

`update-booking-hours.js` is included as an idempotent repair helper. The supplied project is already repaired, so you normally do not need to run it.

If you do run it:

```powershell
node update-booking-hours.js
```

It changes only source files and does not make any Supabase database changes.
