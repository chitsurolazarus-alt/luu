# Luu Travels & Logistics — Shuttle Booking Website

A complete shuttle booking website for **Luu Travels & Logistics (Pty) Ltd**, connecting Gauteng and Limpopo. Built with plain HTML/CSS/JS, Supabase (auth + database), and Leaflet.js for maps.

## 1. Set up Supabase

1. Go to your Supabase project's **SQL Editor**: https://supabase.com/dashboard/project/gwzpzvwermsfnputttdo/sql
2. Paste the entire contents of `supabase/schema.sql` and run it. This creates all tables, triggers, Row Level Security policies, and seeds default time slots.

## 2. Create the admin account

Supabase requires auth users to be created through the Auth system (not by inserting directly into a table):

1. In the Supabase dashboard, go to **Authentication → Users → Add user**.
2. Create a user with:
   - Email: `princemahapa20@gmail.com`
   - Password: `Prince@2001`
   - Confirm the email automatically (toggle "Auto Confirm User").
3. Copy the new user's **UUID** from the Auth dashboard.
4. Back in the SQL Editor, run:
   ```sql
   insert into users (id, email, full_name, phone, role)
   values ('<PASTE-UUID-HERE>', 'princemahapa20@gmail.com', 'Prince Mahapa', '0000000000', 'admin')
   on conflict (id) do update set role = 'admin';
   ```
5. Log in at `pages/admin-login.html` with that email/password.

## 3. Replace placeholder images

Two placeholder images were generated so the site works out of the box:
- `assets/logo.png` — replace with the real Luu Travels logo (used as the favicon and in the navbar/footer).
- `assets/hero-bg.jpg` — replace with a real hero photo (shuttle, road, or team photo).

Keep the same filenames so no code changes are needed.

## 4. Configuration

`js/config.js` already contains the Supabase URL, anon key, and pricing (R2.50/km, 14 seats max). The anon key is safe to expose in client-side code — it only allows what the Row Level Security policies permit.

## 5. Deploy

Upload the whole `luu-travels-booking/` folder to any static web host (Netlify, Vercel, GitHub Pages, cPanel, etc.) — no build step is required. Open `index.html` as the entry point.

## 6. Test checklist

- [ ] Register a new customer account (check inbox for confirmation email, since Supabase requires email confirmation by default — you can disable this in **Authentication → Providers → Email** if you want instant access).
- [ ] Log in as that customer, go to **Book a Trip**.
- [ ] As admin, add a driver (**Admin → Drivers → Add Driver**), then a trip (**Admin → Trips → Add Trip**) assigning that driver.
- [ ] As the customer, book the trip, then view it on **My Dashboard**.
- [ ] As admin, change the booking status to "Confirmed" — the customer's dashboard will then show a **Track Driver** button.
- [ ] To simulate live tracking, update a driver's `current_location` in the `drivers` table, e.g.:
  ```sql
  update drivers set current_location = '{"lat": -25.75, "lng": 28.19}' where id = '<driver-id>';
  ```
  The customer's tracking map refreshes every 10 seconds.

## File structure

```
luu-travels-booking/
├── index.html
├── assets/            (logo.png, hero-bg.jpg)
├── css/               (style.css, booking.css, admin.css, dashboard.css)
├── js/                (config.js, auth.js, main.js, booking.js, admin.js, dashboard.js, map.js)
├── pages/             (login, register, dashboard, booking, admin-login, admin-dashboard, forgot/reset password)
└── supabase/schema.sql
```

## Notes

- Card payments are wired up as a disabled option in the booking UI — enable it once a payment gateway (e.g. PayFast, Yoco, or Stripe) is integrated. Search `Card payments are coming soon` in `js/booking.js` for the placeholder.
- Booking reference numbers follow the format `LUU-YYMMDD-XXXX`, generated automatically by a database trigger.
- Row Level Security is enabled on every table — customers can only see their own bookings/profile; admins (role = 'admin' in the `users` table) can see and manage everything.
