# Supabase Account Setup for Watchstrapper

## 1. Run the SQL migration

Run the SQL in:

- `/tmp/watchstrap-mobile-fixes/supabase/migrations/20260319_personal_collection.sql`

Fastest path:

1. Open your Supabase project
2. Go to `SQL Editor`
3. Paste the file contents
4. Run it once

This creates:

- `profiles`
- `saved_watches`
- `saved_straps`
- `favorite_straps`
- `saved_looks`
- storage buckets:
  - `user-watches`
  - `user-straps`
  - `user-looks`
- row-level security and storage policies
- the `handle_new_user_profile()` trigger that writes `full_name` into `profiles`

## 2. Add the env vars

Local / Netlify env vars:

```bash
NEXT_PUBLIC_SUPABASE_URL=YOUR_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

The app currently only requires those two client-safe values.

## 3. Configure auth URLs

In Supabase:

`Authentication` -> `URL Configuration`

Set:

- `Site URL`
  - `https://watchstrapper.com`

Add redirect URLs:

- `https://watchstrapper.com/auth/callback`
- `https://watchstrapper.netlify.app/auth/callback`
- `http://localhost:3000/auth/callback`

If your Netlify preview/domain differs, add that exact callback URL too.

## 4. Enable email/password auth

In Supabase:

`Authentication` -> `Providers` -> `Email`

Recommended:

- enable `Email`
- enable `Confirm email`
- keep password sign-in on

The app already sends:

- `full_name`
- `email`
- `password`

and uses:

- `/auth/callback`

for session restoration after email confirmation.

## 5. Add branded auth emails

In Supabase:

`Authentication` -> `Email Templates`

Use the files in:

- `/tmp/watchstrap-mobile-fixes/supabase/email-templates/confirm-signup.html`
- `/tmp/watchstrap-mobile-fixes/supabase/email-templates/reset-password.html`
- `/tmp/watchstrap-mobile-fixes/supabase/email-templates/magic-link.html`
- `/tmp/watchstrap-mobile-fixes/supabase/email-templates/change-email.html`

Important:

- keep the `{{ .ConfirmationURL }}` placeholder intact
- Supabase replaces it with the working auth link

## 6. If you want fully branded sending

For true branded email delivery, you also need:

- custom SMTP configured in Supabase
- your own sending domain
- a branded sender name / from address

Without custom SMTP:

- the email HTML branding works
- but the sender identity will still be Supabase-managed

## 7. What to verify after setup

1. Create a new account in the app
2. Confirm the email arrives with the Watchstrapper template
3. Click the primary CTA
4. Confirm it returns to:
   - `/auth/callback`
   - then `/`
5. Confirm the signed-in shell shows the user's `full_name`
6. Save a watch, strap, and look
7. Reopen the app and confirm those saved items persist
