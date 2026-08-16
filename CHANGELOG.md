# Changelog

All notable changes to this project are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## Phase 4 — Admin portal core

- Reservation lifecycle state machine (`src/lib/reservation-state-machine.ts`): a single source-of-truth transition table for every status change (confirm payment, schedule drop-off, mark active, mark returned, refund deposit, cancel), shared by the admin actions and the existing hold-expiry cron. Illegal transitions are rejected; every legal one writes a `StatusEvent`.
- Admin reservations list (`/admin/reservations`): search by name/email/code, filter by status, sort by date. Detail page (`/admin/reservations/[id]`) shows the full record, status history, and only the actions legal for the current status.
- Availability calendar (`/admin/calendar`): two-month view of booked and blacked-out days; select a range to create a `BlackoutBlock`, which blocks new public bookings immediately since the reservation-creation endpoint already queries it on every request.
- Settings editor (`/admin/settings`): rates, deposit, delivery fee model, service radius, min rental days, hold window, Venmo username, contact phone, cancellation policy text.
- Dashboard (`/admin`): counts by status, rental revenue, deposits held/refunded, utilization over a rolling 30-day window, upcoming drop-offs/returns, and holds expiring within 24 hours.
- All admin mutations are Next.js Server Actions, each independently re-checking the session server-side (defense in depth beyond the proxy/middleware gate) and validating the transition through the shared state machine before writing.

## Phase 3 — Rental agreement e-sign

- Rental agreement text (`src/lib/agreement-text.ts`) versioned and stored in `Setting.agreementText`/`agreementCurrentVersion`; the seed script keeps the database copy in sync with the source-controlled constant.
- `/api/reservations/sign`: server-side e-sign flow — verifies the reservation by public code + email, SHA-256 hashes the exact agreement text shown (so a signed record stays tied to its wording even if the agreement changes later), renders a signed PDF, uploads it to Vercel Blob (private), and stores signer name/timestamp/version/hash/IP/user agent immutably on the reservation. Idempotent: re-signing an already-signed reservation returns the existing record rather than overwriting it.
- Signed PDF is emailed to the renter via Resend as a best-effort step — delivery failure is logged but doesn't fail the signing request, since the signature and PDF are already durably stored.
- New Sign step in the `/quote` flow, between Details and Confirmed: scroll-gated agreement text, an active (unchecked-by-default) agreement checkbox, and a typed-name signature field, following ESIGN Act / UETA-style e-signature capture conventions.
- Known limitation: Resend's sandbox mode can only send to the account's own signup address until a sending domain is verified — real customer emails are blocked until that verification is done.

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
