# Sunaidi Design Central

A bilingual (English / العربية, full RTL) social-media marketing platform for
running the social calendars of **multiple events** from one dashboard —
scheduling, cross-posting, AI captions, analytics, approvals, and an admin
console with per-event API integrations and MFA.

This is a production implementation (Next.js + TypeScript + Prisma + a real
API/auth backend) of the design prototype that was handed off from Claude
Design. The original design bundle is preserved under [`project/`](project/)
(HTML prototype) and [`chats/`](chats/) (the design conversation).

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Prisma** ORM over **SQLite** (`prisma/dev.db`)
- **Auth**: credential login → real **TOTP** two-factor (otplib) → signed
  cookie session (jose); role-gated actions; "acting as" switcher
- REST API under `src/app/api/*`; the client is a single authenticated SPA

> **Just want it online?** Skip to
> [Deploy to a live URL](#deploy-to-a-live-url-vercel--neon-postgres) — no
> terminal needed.

## Getting started (local)

Requires a **Postgres** database. The easiest is a free one from
[neon.tech](https://neon.tech) — create a project and copy its connection
string into `DATABASE_URL`.

```bash
cp .env.example .env  # set DATABASE_URL (Postgres), AUTH_SECRET, demo 2FA bypass
npm install
npm run db:reset      # create schema + seed demo data (events, users, posts…)
npm run dev           # http://localhost:3000
```

Then open the site, click **Open the app**, and sign in with the demo account:

| Field | Value |
| ----- | ----- |
| Email | `sara@sunaidiexpo.com` |
| Password | `password` |
| 2FA code | `123456` (demo bypass) |

The **SSO** button signs in directly. Other seeded users (Maya — Manager,
Omar — Editor, Lina — Viewer, …) all use password `password`; switch between
them in the app via the **avatar menu** ("Acting as") to see the role-gated
approval flow.

## Deploy to a live URL (Vercel + Neon Postgres)

No terminal required — the app **creates its own tables and seeds demo data on
first load**, so there are no database commands to run.

1. **Create a database** at https://neon.tech (free): New Project → copy the
   **direct** connection string (the one *without* `-pooler` in the host).
2. **Import to Vercel**: https://vercel.com → Log in with GitHub → **Add New →
   Project** → import `Sunaidiexpo225/SDC`.
3. **Set environment variables** (Project → Settings → Environment Variables):
   - `DATABASE_URL` = the Neon direct connection string from step 1
   - `AUTH_SECRET` = any long random string
   - `AUTH_DEMO_BYPASS` = `1` (keeps the `123456` demo code working; set `0` later for real TOTP)
4. **Deploy.** Open the resulting `https://…vercel.app` URL and sign in with
   `sara@sunaidiexpo.com` / `password` / `123456`.

The first build runs `prisma db push` to create the tables; the first page load
seeds the demo events, users and posts automatically.

### Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run dev` | Dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run db:push` | Sync schema to the DB |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Reset + reseed |

## Features

- **Landing page** — hero, features, how-it-works, CTA; EN/عربي toggle.
- **Login** — two-panel sign-in with a real TOTP 2FA step + SSO.
- **Dashboard** — KPIs with sparklines, reach chart, audience-by-event bars,
  auto-sliding upcoming-posts strip, per-event cards.
- **Compose** — reuse library assets, AI caption/hashtag generation (per tone
  & language), per-account platform toggles, day + time picker, scheduling.
- **Calendar** — month grid scoped to the active event, post detail panel,
  delete, per-post analytics.
- **Library** — filterable assets, "use in a post".
- **Analytics** — KPIs, views chart, per-account performance table, top posts,
  content-format split, best-time, range dropdown, per-post analytics modal.
- **Approvals** — role-gated review modal (Managers/Admins approve or decline;
  Editors discard; Viewers read-only), with inline caption editing.
- **Admin console** — Team & access (roles + MFA setup with QR), Events
  (rename/recolour/add), per-event **Integrations** (add/remove accounts,
  connect API keys), and Settings (language, week start, AI tone, require-MFA,
  auto-publish) that drive the whole product live.

Everything is scoped to the selected event; events, accounts, and users are
fully dynamic. All follower counts and analytics are modelled from real
stored data so they scale when live platform data is plugged in.

## Architecture notes

- **Data model** (`prisma/schema.prisma`): `Event` → `SocialAccount` (holds
  connection state + API key), `Post`, `Approval`, `User`, `Setting`.
- **API** (`src/app/api/*`): REST route handlers with zod validation. Mutations
  are role-aware; approval approve/decline require Manager/Admin.
- **Client** (`src/components/app`): `AppProvider` loads `/api/app`, holds UI
  state, and exposes actions that call the API and refetch. Screens/modals are
  pixel-faithful ports of the design.
- **i18n** (`src/lib/i18n.ts`): full EN/AR dictionary; `LangProvider` manages
  language + direction.

### Production checklist

- Set a strong `AUTH_SECRET` and `AUTH_DEMO_BYPASS=0` (the `123456` bypass is
  for the demo only — real TOTP is enforced when it's off).
- Swap SQLite for a hosted database (update `datasource` + `DATABASE_URL`).
- Wire the **Integrations** "Connect" flow to each platform's real OAuth, and
  the **Generate with AI** route (`/api/ai/caption`) to an LLM (server-side,
  key kept off the client). Both are stubbed with deterministic mock data today.
