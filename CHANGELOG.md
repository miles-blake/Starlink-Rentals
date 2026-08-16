# Changelog

All notable changes to this project are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## Phase 2 — Availability and reservations

- Availability engine (`src/lib/availability.ts`): half-open date-range overlap checking, fully unit tested against adjacent, same-day, containment, and identical-range edge cases.
- Reservation creation (`/api/reservations`): re-validates eligibility, pricing, and availability entirely server-side rather than trusting the client; generates a unique public code, freezes the pricing snapshot, and creates a soft hold (`holdWindowHours` from `Setting`).
- Double-booking is prevented two ways: soft holds (`awaiting_payment`) are checked dynamically against `holdExpiresAt` in application code, and a Postgres exclusion constraint (`btree_gist`) makes it physically impossible for two `payment_review`-or-later reservations to overlap, race conditions included.
- `/api/cron/expire-holds` (daily via `vercel.json`) formally cancels expired holds for admin-facing bookkeeping — availability correctness doesn't depend on its cadence.
- Public booking flow extends `/quote`: a Details step (name/email/phone) submits the hold and shows a confirmation with the public code. Pickup now has no distance limit — only delivery is gated by the 40-mile radius.
- `/status`: guest lookup by public code + email, with an identical error for "no such code" and "wrong email" so the endpoint can't be used to probe which codes exist.
- Fixed a Routes API parsing bug where a same-point route (booking at the base address itself) was misread as malformed, since Google omits `distanceMeters` for zero-distance routes instead of sending 0.

## Phase 1 — Eligibility and quote engine

- Pricing engine (`src/lib/pricing.ts`): $30 for day 1, +$20 per additional day, deposit, delivery fee, and total, all pure functions with full unit test coverage. Enforces `minRentalDays`.
- Eligibility engine (`src/lib/eligibility.ts`, `src/lib/google-maps.ts`): driving distance via the Routes API, geocoding via Places API (New), evaluated against `Setting.serviceRadiusMiles`.
- Address autocomplete is proxied through our own `/api/places/autocomplete` route rather than Google's client-side widget — the browser never receives a Google Maps key at all, so there's no second referrer-restricted key to manage.
- `/api/eligibility` and `/api/pricing`: rate-limited, Zod-validated, return only the client-safe fields (never raw Google API responses). Eligibility results are cached by `placeId` for a day.
- Public quote page at `/quote`: address autocomplete, date range picker, live itemized quote (or a clear not-eligible message), delivery/pickup toggle.
- `Setting` seeded with the real base address, service radius, and rates; `agreementText`/`cancellationPolicyText` are nullable until Phase 3 supplies real legal copy.

## Phase 0 — Foundation

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui scaffold, styled with a Starlink-inspired dark palette and Geist typography.
- Prisma schema covering every model from the blueprint's data model (Reservation, BlackoutBlock, ContactLog, NotificationLog, ConditionPhoto, StatusEvent, AdminUser, Setting) with the first migration applied against Postgres.
- Auth.js (NextAuth v5) credentials-based admin login, JWT sessions, `/admin` routes protected by a proxy (Next.js's middleware successor), and a seed script for the first admin user.
- Installable admin PWA: web app manifest, icons, standalone display, registered service worker.
- ESLint, Prettier (with Tailwind class sorting), Vitest, and Playwright configured, each with a passing smoke check.
- GitHub Actions CI: lint, format check, typecheck, unit tests, and build on every pull request into `main`.
- `.env.example`, README, and this changelog.
