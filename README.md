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
                        # BLOB_READ_WRITE_TOKEN, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
                        # VAPID_SUBJECT
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

`test:e2e` needs a real `.env` (Google Maps, Resend, Blob) since it exercises the full booking flow against real services and the real database — it isn't part of the GitHub Actions CI job (which only runs lint/format/typecheck/unit-tests/build) and needs to be run locally before merging a change that touches the booking flow.

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

## Communication & notifications

- **Text the owner**: a scheme-`sms:` deep link built from `Setting.contactPhone` and the reservation's public code, shown on the confirmation screen, `/status`, and in renter emails ([src/lib/sms-link.ts](./src/lib/sms-link.ts), [src/components/text-owner-link.tsx](./src/components/text-owner-link.tsx)). On a wider screen it also renders a QR code so a desktop visitor can scan it with their phone. Nothing is stored server-side — tapping it just opens the renter's own Messages app.
- **Text this renter**: the same idea in reverse, on the admin reservation detail page, plus a one-line `ContactLog` note field for keeping a manual record of what was discussed (the conversation itself lives in Messages, not the app).
- **Condition photos**: uploaded from the reservation detail page at drop-off and return, stored in Vercel Blob (private) and tagged by phase (`ConditionPhoto.phase`).
- **Renter emails**: reservation received, agreement signed, payment confirmed, drop-off scheduled (with an `.ics` calendar attachment for the return date — [src/lib/ics.ts](./src/lib/ics.ts)), a same-day return reminder (cron, also with the `.ics`), and deposit refunded. All best-effort — a delivery failure is logged, never blocks the underlying action.
- **Setup guide / FAQ** at [`/faq`](./src/app/faq/page.tsx), linked from the confirmation screen and the drop-off email.
- **Admin push notifications**: Web Push from the installed PWA only (no third-party push service — see the decision below), behind a `Notifier` abstraction ([src/lib/notifier.ts](./src/lib/notifier.ts)) so adding another channel later is additive. Enable it and send a test notification at `/admin/notifications`, which also has per-event toggles and a quiet-hours window (compared in UTC). Immediate events (agreement signed, payment awaiting confirmation, payment confirmed) fire from the relevant route/action; time-based events (hold expiring/expired, drop-off today, return due/overdue, deposit refund pending) fire from `/api/cron/daily-tasks`, deduped once per reservation per event per day via `NotificationLog`.

**Scope decisions, not oversights:** the blueprint lists Twilio SMS (renter-facing, and an admin critical-event fallback) and Pushover/ntfy as admin push options — none of those are implemented here. The operator chose Web Push as the only admin channel and email-only for renters, to avoid a Twilio account/cost. See `.env.example`'s Phase 6 section if that changes later.

## Admin PWA

The `/admin` app is an installable PWA (manifest, icons, service worker) so it can be added to an iPhone Home Screen and opened standalone — required for iOS Web Push, which only works from a Home-Screen-installed app, never a plain Safari tab. On iOS: open `/admin/login` in Safari, tap Share → Add to Home Screen, open the app from its new icon, then enable notifications at `/admin/notifications`.

## Security

- **Admin login**: email + password, then a 6-digit code emailed to the admin's address (10-minute expiry, single use — [src/lib/admin-login-security.ts](./src/lib/admin-login-security.ts)). 5 failed password-or-code attempts locks the account for 15 minutes. The password never leaves the browser between steps — the client component holds it in memory and submits it together with the code on final sign-in ([src/app/admin/login](./src/app/admin/login)).
- **Security headers** (CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS) are set for every route in [next.config.ts](./next.config.ts). The CSP allows `'unsafe-inline'` scripts because the App Router streams RSC payloads via inline `self.__next_f.push` tags — see the comment above `cspHeader` for the reasoning and the residual-risk tradeoff.
- **CSRF**: every admin mutation is a Server Action, not a cookie-authenticated API route, so Next.js's built-in Origin-vs-Host check on Server Actions (enforced framework-side since 13.4) covers them — no extra CSRF middleware is needed. Public API routes under `/api/**` don't rely on cookies for auth, so they're not CSRF targets either.
- **Rate limiting**: every public customer-facing `/api/**` route calls `checkRateLimit()` ([src/lib/rate-limit.ts](./src/lib/rate-limit.ts)), including the new OTP request/verify actions. The two cron routes are gated by `CRON_SECRET` instead.
- **Legal pages**: [`/terms`](./src/app/terms/page.tsx) (including the live `Setting.cancellationPolicyText`) and [`/privacy`](./src/app/privacy/page.tsx) are linked from every public page's footer ([src/components/legal-footer.tsx](./src/components/legal-footer.tsx)). Both are operator-review drafts, not legal advice.

## Workflow

Trunk is `main`. Each phase of the blueprint is built on its own branch (`phase-0-foundation`, `phase-1-intake`, ...) and lands via a pull request with CI green — see the blueprint's section 12 for the full conventions.
