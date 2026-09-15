# HomeStock v2 — Online Edition

## 1. Create Supabase project
Create a project at https://supabase.com/.

## 2. Create database
Open Supabase **SQL Editor**, paste `database.sql`, and run it.

## 3. Add project keys
Open `js/supabase-config.js` and replace:
- `YOUR_SUPABASE_PROJECT_URL`
- `YOUR_SUPABASE_ANON_KEY`

Use the **Project URL** and the browser-safe **anon/public key**. Never put a service-role key in this project.

## 4. Authentication
Supabase Auth handles passwords. If email confirmation is enabled, users must confirm their email before signing in.

## 5. Run locally
Because this is now an online web app, serve the folder from a local web server (VS Code Live Server is fine). Opening HTML with `file://` can cause browser restrictions.

## 6. Data model
Inventory, rooms, categories and activity belong to the signed-in household. Row Level Security prevents one household from reading another household's records.

## Important
The app keeps a browser cache for the existing UI, but Supabase is the online source of truth. The current v2 migration layer syncs data periodically. Before production launch, test multi-device editing and then enable/configure Supabase Realtime if true instant updates are required.
