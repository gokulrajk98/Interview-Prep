# Interview Prep Hub — Private Cloud Edition

A personal interview-question manager built with HTML, CSS, JavaScript and Supabase. Once configured, your questions and categories sync to your private account across browsers and devices.

## Features

- Add, edit, delete and search interview questions.
- Organize questions by category, difficulty and preparation status.
- Store answers, code examples, practical scenarios and tags.
- Dashboard, preparation progress and revision queue.
- JSON export/import backups.
- Email/password sign-up and sign-in.
- Private per-user cloud storage with Supabase Row Level Security (RLS).
- First sign-in automatically migrates existing local browser questions to the signed-in account if that account has no cloud workspace yet.
- Local browser backup is retained as an additional safety copy.

## Important security note

The browser app uses only the Supabase project URL and the public anon/publishable key. Never put a Supabase `service_role` or secret key in `config.js` or any frontend file. Access is protected by the SQL Row Level Security policies in `supabase-setup.sql`.

## One-time Supabase setup

1. Create a free Supabase account at https://supabase.com/ and create a new project. Choose a strong database password and save it somewhere safe.
2. In the project dashboard, open **SQL Editor**, create a new query, paste the complete contents of `supabase-setup.sql`, and click **Run**. This creates the private workspace table and its user-specific access policies.
3. Open **Project Settings → API** (or **Connect**, depending on the dashboard layout). Copy the **Project URL** and the **anon/public** or **publishable** key. Do not copy a `service_role` or secret key.
4. Open `config.js` and replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY` with those two values. Keep the quotation marks.
5. In Supabase, open **Authentication → URL Configuration**. Set the Site URL to your Netlify website URL, for example `https://your-site-name.netlify.app`. Add that same URL to the Redirect URLs allowlist.
6. In **Authentication → Providers → Email**, leave Email enabled. For a personal app, email confirmation can remain enabled; after registration, open the confirmation email and then sign in.
7. Save the files and redeploy the entire folder to the same Netlify site. In Netlify, use **Deploys → Deploy manually** (or drag the updated folder into the site's deploy area). Do not create a different site if you want to retain the same browser origin and its local backup.
8. Open the Netlify URL, choose **Create an account**, register with your email and password, and sign in.

## Existing question bank and migration

When you sign in for the first time on this deployment, the app checks whether your account already has a cloud workspace. If it does not, it uploads the questions currently stored in this browser to your account. If the questions are still in the same Netlify site/browser profile, they should be available for migration automatically.

If you exported a JSON backup or your browser data is on another site origin, sign in on the device/browser where the backup is available and use **Backup & settings → Import backup**. The import will save the questions locally and then synchronize them to the cloud.

If the account already has cloud data, that cloud data is loaded as the authoritative copy. Export a backup from the old browser before signing in if you have unsynced questions there.

## Run locally

The Supabase-connected version should be served from a local web server rather than opened as a `file://` URL. Run this in the project folder:

```bash
python -m http.server 8000
```

Then open http://localhost:8000. Add `http://localhost:8000` to Supabase Authentication URL Configuration if you want to test sign-in locally.

## Files

- `index.html` — application and authentication UI.
- `styles.css` — responsive styles.
- `app.js` — question manager, authentication, cloud sync and backup logic.
- `config.js` — your Supabase project URL and public anon/publishable key.
- `supabase-setup.sql` — database table and Row Level Security policies.
- `README.md` — setup and deployment guide.

## Troubleshooting

- **Cloud setup is not complete:** confirm that `config.js` contains the correct Project URL and public anon/publishable key, then redeploy.
- **relation `user_workspaces` does not exist:** run `supabase-setup.sql` in the Supabase SQL Editor.
- **new row violates row-level security / permission denied:** verify that the SQL ran successfully and that you are signed in. Do not disable RLS to work around this.
- **email confirmation link returns to the wrong page:** check the Supabase Site URL and Redirect URLs allowlist.
- **questions are missing:** check the original browser/site origin and restore a JSON backup if needed.

Export JSON backups periodically. Cloud storage is not a substitute for backups.
