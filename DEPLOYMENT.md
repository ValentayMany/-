# Deploy to Cloudflare Workers

This project runs on Cloudflare Workers with static assets served from `public/`.
The Worker replaces the local Express API for `/api/*` routes.

## Prerequisites

1. A Cloudflare account.
2. A Supabase project with the tables from `supabase_schema.sql`.
3. Node.js installed locally.

## One-time setup

Run these commands from the project root:

```powershell
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
```

Use the same Supabase values currently defined in `.env`.

## Deploy

```powershell
npm run deploy
```

The deployed Worker will serve:

- `/` and static frontend files from `public/`
- `/api/staff`
- `/api/shifts`
- `/api/auth/login`
- `/api/users`
- `/api/config`

## Local Worker preview

```powershell
npm run worker:dev
```

For local preview, create a `.dev.vars` file with:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```
