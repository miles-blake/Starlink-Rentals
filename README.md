# Starlink Rentals

A single-operator Starlink kit rental platform: instant address/date eligibility, transparent quoting, availability holds, e-sign rental agreement, manual Venmo payment, and an admin portal for running the business day to day.

Full build plan: [starlink-rental-blueprint.md](./starlink-rental-blueprint.md). Built phase by phase — see that document for architecture decisions, the data model, and the phased task list.

## Stack

Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, Prisma + PostgreSQL, Auth.js (credentials), Vitest, Playwright, GitHub Actions, Vercel.

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, NEXTAUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD,
                        # GOOGLE_MAPS_SERVER_KEY, BASE_ADDRESS, RESEND_API_KEY, FROM_EMAIL,
                        # BLOB_READ_WRITE_TOKEN
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

## Rental agreement e-sign

Between the Details and Confirmed steps of `/quote`, the renter reads and signs the rental agreement stored in `Setting.agreementText` (source of truth: [src/lib/agreement-text.ts](./src/lib/agreement-text.ts)). The "Sign" button stays disabled until the renter has scrolled the agreement to the bottom, checked the active (unchecked-by-default) agreement box, and typed their full name.

`POST /api/reservations/sign` ([src/app/api/reservations/sign/route.ts](./src/app/api/reservations/sign/route.ts)) then, server-side:

1. Re-verifies the reservation by public code + email (same generic error for both a bad code and a mismatched email, so the endpoint can't be used to probe valid codes).
2. Hashes the exact agreement text shown (SHA-256) so the signed record stays provably tied to the wording in effect at signing time, even if `agreementText` changes later.
3. Renders a signed PDF ([src/lib/agreement-pdf.tsx](./src/lib/agreement-pdf.tsx)) and uploads it to Vercel Blob (`access: "private"`).
4. Stores signer name, timestamp, agreement version, text hash, IP, user agent, and the PDF URL on the reservation — immutable once set; re-signing an already-signed reservation just returns the existing record instead of overwriting it.
5. Emails the signed PDF via Resend, best-effort — a delivery failure is logged but doesn't fail the request, since the signature and PDF are already durably stored.

Resend sandbox accounts can only deliver to the account's own signup address until a sending domain is verified in the Resend dashboard; real customer emails need that verification step first.

## Payments

Payment is manual Venmo, handed off after the agreement is signed: `/quote`'s Sign step leads into a Pay step showing a Venmo QR code and deep link (amount and a reference note prefilled), built by `ManualVenmoProvider` (`src/lib/payment-provider.ts`) from `Setting.venmoUsername`. The renter's "I have paid" button (`POST /api/reservations/pay`) transitions the reservation from `awaiting_payment` to `payment_review` — it does not itself confirm payment. The same Pay UI is reachable again later from `/status` (a "Pay now" button) for a renter who left and came back.

An admin then confirms the payment from the reservation detail page (`/admin/reservations/[id]`), which records the amount, transitions to `confirmed`, and emails a confirmation to the renter (best-effort, like the Phase 3 signed-agreement email).

`PaymentProvider` (same file) is a small interface so a future automated provider — e.g. Venmo via Braintree — could be swapped in without changing the API routes or UI, only `payment-provider.ts` itself.

## Admin portal

`/admin` (behind the login) covers day-to-day operations:

- **Dashboard** (`/admin`) — counts by status, rental revenue, deposits held/refunded, utilization over the next 30 days, upcoming drop-offs/returns, and holds expiring soon.
- **Reservations** (`/admin/reservations`) — search/filter/sort, and a detail page per reservation with the full record, status history, and the legal next-step actions.
- **Calendar** (`/admin/calendar`) — booked and blacked-out days at a glance; select a range to add a `BlackoutBlock`, which blocks new public bookings immediately (see [src/app/api/reservations/route.ts](./src/app/api/reservations/route.ts)).
- **Settings** (`/admin/settings`) — rates, deposit, delivery fee model, service radius, min rental days, hold window, Venmo username, contact phone, and cancellation policy text. Base address and the rental agreement text aren't editable here — the former needs re-geocoding, the latter a versioning workflow.

Every status change goes through [src/lib/reservation-state-machine.ts](./src/lib/reservation-state-machine.ts), the single source of truth for which transitions are legal for which actor (admin/customer/system). An illegal transition (e.g. skipping straight from `confirmed` to `active`) is rejected server-side and every legal one writes a `StatusEvent`, so the history on a reservation's detail page is always a complete, ordered audit trail — not just the current status.

## Admin PWA

The `/admin` app is an installable PWA (manifest, icons, service worker) so it can be added to an iPhone Home Screen and opened standalone — a prerequisite for iOS web push in a later phase. On iOS: open `/admin/login` in Safari, tap Share → Add to Home Screen.

## Workflow

Trunk is `main`. Each phase of the blueprint is built on its own branch (`phase-0-foundation`, `phase-1-intake`, ...) and lands via a pull request with CI green — see the blueprint's section 12 for the full conventions.
