# Starlink Rentals

A single-operator Starlink kit rental platform: instant address/date eligibility, transparent quoting, availability holds, e-sign rental agreement, manual Venmo payment, and an admin portal for running the business day to day.

Full build plan: [starlink-rental-blueprint.md](./starlink-rental-blueprint.md). Built phase by phase — see that document for architecture decisions, the data model, and the phased task list.

## Stack

Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, Prisma + PostgreSQL, Auth.js (credentials), Vitest, Playwright, GitHub Actions, Vercel.

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, NEXTAUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD,
                        # GOOGLE_MAPS_SERVER_KEY, BASE_ADDRESS
npx prisma migrate dev
npx prisma db seed     # creates the first admin user, and (once) the Setting row
npm run dev
```

`GOOGLE_MAPS_SERVER_KEY` needs the **Places API (New)** and **Routes API** enabled in Google Cloud Console — it's used server-side only (geocoding, driving distance, address autocomplete proxy), never sent to the browser.

Open [http://localhost:3000](http://localhost:3000) for the public site (`/quote` to book, `/status` to check a reservation), or [http://localhost:3000/admin](http://localhost:3000/admin) for the admin login.

## Scripts

| Script                            | What it does                                                  |
| --------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                     | Start the dev server                                          |
| `npm run build`                   | Production build                                              |
| `npm run lint`                    | ESLint                                                        |
| `npm run format` / `format:check` | Prettier write / check                                        |
| `npm run typecheck`               | Route type generation + `tsc --noEmit`                        |
| `npm run test`                    | Unit tests (Vitest)                                           |
| `npm run test:e2e`                | End-to-end tests (Playwright, builds and boots the app first) |

## Database

Prisma schema lives in [prisma/schema.prisma](./prisma/schema.prisma). Every schema change is a committed migration under `prisma/migrations` — never edit the database by hand.

```bash
npx prisma migrate dev --name <change>   # create + apply a migration locally
npx prisma studio                         # browse data
```

## Availability

Two layers keep the single physical kit from ever being double-booked (see [prisma/lib/availability.ts](./src/lib/availability.ts) and the exclusion-constraint migration):

- **Soft holds** (`awaiting_payment`): checked in application code against `holdExpiresAt`, so an expired-but-not-yet-cleaned-up hold never blocks new bookings in real time.
- **Hard bookings** (`payment_review` and beyond): enforced at the database level with a Postgres exclusion constraint (`btree_gist`) — two such reservations can never overlap, race conditions included.

`/api/cron/expire-holds` (wired up in [vercel.json](./vercel.json), daily by default — bump the schedule if you're on Vercel Pro) formally cancels expired holds for admin-facing accuracy, but correctness doesn't depend on how often it runs.

## Admin PWA

The `/admin` app is an installable PWA (manifest, icons, service worker) so it can be added to an iPhone Home Screen and opened standalone — a prerequisite for iOS web push in a later phase. On iOS: open `/admin/login` in Safari, tap Share → Add to Home Screen.

## Workflow

Trunk is `main`. Each phase of the blueprint is built on its own branch (`phase-0-foundation`, `phase-1-intake`, ...) and lands via a pull request with CI green — see the blueprint's section 12 for the full conventions.
