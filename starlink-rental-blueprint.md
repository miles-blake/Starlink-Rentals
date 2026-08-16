# Starlink Rental Platform: Build Blueprint

A complete, phased build plan for a single-operator Starlink rental business. This document is written to be handed to Claude Code phase by phase. Each phase has a goal, a git branch name, a task list, and acceptance criteria. Build in order. Do not start a phase until the previous phase's acceptance criteria pass and its branch is merged.

**Repository:** `https://github.com/miles-blake/Starlink-Rentals.git`

Claude Code: this is the project repo. Before anything else, connect to it, use it as `origin`, and do all work here. If it is empty, initialize the project inside it on `main`. If it already has content, clone it and work from what is there. Every phase is a branch off `main` pushed to this remote, and every phase ends in a pull request into `main` on this repo. Full workflow rules are in section 12; the exact first steps are in Phase 0.

---

## 1. What we are building

A website where customers can:

1. Enter their address and rental dates and instantly see whether they are within the service radius (40 miles of ZIP 84606) and what it will cost.
2. Get a clear quote: daily rate times number of days, plus a refundable deposit, plus a delivery fee if applicable.
3. Reserve the unit for specific dates (with double-booking protection, since there is only one physical kit).
4. Sign a short rental agreement.
5. Pay via Venmo through a payment link, then mark themselves as paid.
6. Message the operator through the site to arrange drop-off or pickup.

And an admin portal where the operator can:

1. Review every reservation with full details: customer contact, address, dates, distance, pricing, payment status.
2. Confirm Venmo payments and deposit refunds with one click.
3. See an availability calendar and block dates for personal use or maintenance.
4. Message customers, log condition photos at handoff and return, and track the reservation through its full lifecycle.
5. See simple business stats: revenue, utilization, upcoming drop-offs and returns.

---

## 2. Key architectural decisions

Read these before writing any code. They shape everything.

### 2.1 Payment: manual Venmo now, automated later

Venmo's standalone Developer and Payouts APIs are retired and closed to new businesses. There is no supported way to read your Venmo account and auto-detect a payment. Therefore:

- **Now (Phase 5):** The site generates a Venmo deep link or QR code prefilled with amount and a unique reference note. The customer pays, then taps "I have paid." The reservation moves to a `payment_review` state. The operator verifies the payment in the real Venmo app and clicks "Confirm payment" in the admin portal.
- **Later (documented, not built now):** Route Venmo through PayPal/Braintree for webhook-based auto-confirmation. This needs a US business entity and Braintree onboarding.

To make the later swap painless, define a `PaymentProvider` interface with a `ManualVenmoProvider` implementation now. All payment logic goes through this interface. Nothing outside the provider knows how confirmation happens.

### 2.2 Single physical unit means availability is a hard constraint

There is exactly one kit. Two reservations must never overlap. Build a real availability engine, not an afterthought:

- A reservation for `[startDate, endDate]` may only be created if those dates do not overlap any existing reservation in an active state, and do not overlap any blackout block.
- When a customer submits a reservation, place a **soft hold** on the dates for a configurable window (default 24 hours) while they pay. If they do not pay in time, the hold expires and the dates free up. This prevents someone tying up your calendar without paying, and prevents two people racing for the same week.

### 2.3 This handles real PII and real money

Addresses, phone numbers, and payment details are sensitive. The admin portal must be genuinely locked down (see Phase 7). The rental agreement, deposit terms, and cancellation policy are legal artifacts. Get real terms in place before launch.

### 2.4 Google Maps calls cost money and must be protected

Every geocode and distance call bills your Google account. Never expose your server API key to the browser. Rate-limit the public eligibility endpoint, cache your base location's coordinates, and cache geocoding results per address. Use a separate, HTTP-referrer-restricted browser key only for the address autocomplete widget.

---

## 3. Recommended tech stack

Chosen for cohesion, strong Claude Code support, low cost at low volume, and a clean upgrade path.

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Full-stack in one repo, server actions and API routes together, deploys to Vercel with zero config |
| UI | React + Tailwind CSS + shadcn/ui | Fast to build a clean admin UI and a simple public flow |
| Database | PostgreSQL (Neon or Supabase) | Reliable relational store, generous free tier |
| ORM | Prisma | Type-safe schema, easy migrations |
| Validation | Zod | One schema shared by forms and API validation |
| Admin auth | Auth.js (NextAuth) credentials, single admin, email OTP as second factor | Free, self-contained, no per-seat cost |
| Email | Resend | Simple transactional email for confirmations and notifications |
| SMS (optional) | Twilio | Return reminders and drop-off texts, only if you want it |
| Maps | Google Maps Platform: Geocoding, Distance Matrix, Places Autocomplete, optional Address Validation | You already have an account |
| File storage | Vercel Blob or Supabase Storage | Condition photos at handoff and return |
| Payments | Manual Venmo provider now, Braintree/PayPal seam later | See 2.1 |
| Scheduled jobs | Vercel Cron | Expire holds, send return reminders, fire time-based alerts |
| Admin app shell | Installable PWA (web app manifest + standalone) | Home-screen app on your iPhone, and the prerequisite for iOS web push |
| Admin push | Pushover or ntfy (recommended) with a Web Push option | Reliable native alerts to your iPhone via one HTTP call per event |
| Testing | Vitest (unit), Playwright (end to end) | Covers logic and the booking flow |
| CI | GitHub Actions | Lint, typecheck, test on every PR |
| Monitoring (optional) | Sentry | Catch runtime errors in production |
| Hosting | Vercel | Native Next.js target, cron included |

If you would rather not run a separate database, Supabase gives you Postgres, storage, and auth in one place. The blueprint works either way. Default assumption below is Neon for the database plus Vercel Blob for storage, but note the swap is trivial.

---

## 4. Data model

Prisma schema, described in plain terms. Field lists are the target, not exhaustive down to every timestamp.

**Reservation**
- `id`, `publicId` (short human-friendly code like `SL-7Q3K` for customer reference)
- `status` (see state machine in section 5)
- Customer: `customerName`, `customerEmail`, `customerPhone`
- Address: `addressLine1`, `addressLine2`, `city`, `state`, `zip`, `lat`, `lng`, `formattedAddress`, `googlePlaceId`
- Eligibility: `distanceMiles`, `withinRadius` (bool), `deliveryFee`
- Dates: `startDate`, `endDate`, `holdExpiresAt`, `createdAt`, `updatedAt`
- Pricing snapshot (frozen at reservation time so later config changes do not alter past quotes): `dailyRate`, `numberOfDays`, `rentalSubtotal`, `depositAmount`, `deliveryFee`, `totalDue`
- Payment: `paymentStatus` (`unpaid`, `deposit_paid`, `paid_in_full`, `refunded`, `partially_refunded`), `venmoReference`, `amountPaid`, `paidConfirmedAt`, `depositRefundedAt`, `depositRefundAmount`
- Fulfillment: `fulfillmentMethod` (`delivery` or `pickup`), `dropoffScheduledAt`, `returnScheduledAt`, `actualReturnAt`
- Agreement: `agreementSignedAt`, `agreementVersion`, `agreementSignerName`, `agreementSignerIp`, `agreementSignerUserAgent`, `agreementTextHash` (SHA-256 of the exact text the renter saw), `signedPdfUrl`
- Admin: `internalNotes`
- Relations: `contactLog[]`, `conditionPhotos[]`, `statusEvents[]`

**BlackoutBlock**
- `id`, `startDate`, `endDate`, `reason` (personal use, maintenance), `createdAt`

**ContactLog** (human conversation happens over text/iMessage, not in the app; this is an optional admin-side note of what was discussed)
- `id`, `reservationId`, `note` (for example "texted, confirmed 3pm drop-off"), `createdAt`

**NotificationLog** (record of admin alerts sent, for dedupe and audit; prevents re-sending the same time-based alert on every cron tick)
- `id`, `reservationId` (nullable for non-reservation alerts), `eventType`, `channel` (`push`, `sms`, `email`), `sentAt`, `success`

**ConditionPhoto**
- `id`, `reservationId`, `phase` (`dropoff`, `return`), `url`, `caption`, `createdAt`

**StatusEvent** (audit trail)
- `id`, `reservationId`, `fromStatus`, `toStatus`, `actor` (`system`, `admin`, `customer`), `note`, `createdAt`

**AdminUser**
- `id`, `email`, `passwordHash`, `otpSecret` or email-OTP flow, `createdAt`, `lastLoginAt`

**Setting** (single row or key-value)
- `baseAddress`, `baseLat`, `baseLng` (geocoded once and cached), `serviceRadiusMiles` (default 40), `dailyRate`, `depositAmount`, `deliveryFeeModel` (flat or per-mile), `deliveryFeeFlat`, `deliveryFeePerMile`, `minRentalDays`, `holdWindowHours` (default 24), `venmoUsername`, `contactPhone` (the Google Voice or business number renters text), `agreementCurrentVersion`, `agreementText`, `cancellationPolicyText`, `notificationChannels` (which channels are active), `notificationEvents` (per-event on/off), `quietHours` (optional window to hold non-urgent alerts)

---

## 5. Reservation lifecycle (state machine)

Every transition writes a `StatusEvent`. Illegal transitions are rejected server-side.

```
                submit (eligible + dates free)
   [rejected] <-- (out of radius OR dates unavailable) -- INTAKE
        |                                                    |
        |                                          creates soft hold
        v                                                    v
   dead end                                         [awaiting_payment]
                                                             |
                              customer taps "I have paid"    |
                                                             v
                                                     [payment_review]
                                          admin confirms  |        | admin rejects / hold expires
                                                          v        v
                                                    [confirmed]   [cancelled]
                                                          |
                                        admin schedules drop-off/pickup
                                                          v
                                                    [scheduled]
                                                          |
                                              unit handed to customer
                                                          v
                                                     [active]
                                                          |
                                                  unit returned
                                                          v
                                                    [returned]
                                                          |
                                            admin refunds deposit
                                                          v
                                                   [completed]
```

Additional rules:
- `cancelled` reachable from `awaiting_payment`, `payment_review`, `confirmed`, `scheduled` (with policy-based deposit handling).
- A hold only blocks the calendar while status is `awaiting_payment` or `payment_review`. On `confirmed` and beyond, the dates are hard-booked. On expiry or cancel, they free up.
- Availability check counts as "blocking": any reservation in `awaiting_payment`, `payment_review`, `confirmed`, `scheduled`, `active`, `returned` (deposit not yet settled), plus any BlackoutBlock.

---

## 6. Feature list

**MVP (must ship):**
- Address + date intake with Places Autocomplete
- Radius eligibility check via Google Maps
- Quote generation (rental + deposit + delivery fee)
- Availability check with soft holds
- Reservation creation with unique public code
- Rental agreement e-sign (typed name + timestamp + version)
- Venmo payment handoff with prefilled amount and reference
- Customer "I have paid" action
- One-tap "Text the owner" handoff (opens the renter's Messages app / iMessage prefilled)
- Guest checkout: no account, reservation retrieved by public code + email
- Customer status page showing where they are in the process and what is next
- Admin login
- Admin reservation list and detail view
- Admin confirm payment, confirm return, refund deposit
- Availability calendar and blackout management
- Transactional emails (reservation received, payment confirmed, drop-off scheduled)

**Robust extras (build in later phases):**
- Condition photos at drop-off and return
- Return reminder automation with add-to-calendar (.ics) for the return date
- Deposit refund tracking and partial refunds for damage or late return
- Admin dashboard stats (revenue, utilization rate, upcoming events)
- Cancellation and reschedule requests from the status page
- Setup guide / FAQ page (Starlink setup steps, power, coverage, what is included)
- Optional automated SMS notifications (payment confirmed, drop-off, return reminder)

---

## 6.5 Renter experience: removing friction

The whole point is that a renter can go from "do you cover my address" to "it is booked" in a couple of minutes on their phone, with zero confusion about what happens next. Design every screen against that.

**Before they commit**
- Mobile-first. Assume every renter is on a phone. Thumb-friendly targets, no tiny date pickers.
- "Use my current location" button that reverse-geocodes their GPS to prefill the address, so most people never type an address.
- Address autocomplete so partial typing still works, with the eligibility answer appearing the instant they pick a result.
- A date picker that greys out unavailable and blacked-out dates, so a renter cannot even select a range that is taken. Price updates live as they change the dates ("4 days = $X").
- One honest, itemized quote: rental, refundable deposit (clearly labeled refundable), delivery fee, total. No fee appears later that was not shown here.
- Photos of the actual kit and a plain list of what is included (dish, router, cables, mount). People want to see what they are getting.
- "Email me this quote" so they can leave and come back via a link without re-entering anything.

**Committing**
- A visible progress indicator across the flow: Quote, Details, Sign, Pay, Scheduled. They always know how many steps remain.
- Carry every field forward. Name, email, phone, and address entered once are never asked for again.
- Guest checkout only. No password to create. They retrieve their reservation later with the public code plus their email.

**After they book**
- A status page reachable from a link in their email (no login) that shows the current step, what is next, drop-off/pickup details once scheduled, and a button to text the owner.
- "Text the owner" is the primary contact method (see section 10): one tap opens their Messages app with a prefilled note referencing their reservation code.
- Automatic emails at each milestone so they are never left wondering: reservation received, payment confirmed, drop-off scheduled, return reminder, deposit refunded.
- An add-to-calendar (.ics) button for the return date, plus a reminder email a day before, so returning on time is effortless.
- A short setup guide and FAQ (how to set up the dish, power needs, what to do if it rains, coverage, speeds) linked from the confirmation page and the drop-off email. This makes the renter happier and cuts down on how often they need to text you.
- Self-serve reschedule and cancel requests from the status page, subject to your policy, so they do not have to hunt for how to reach you to make a change.

---

## 7. Google Maps integration design

Origin is your base address, geocoded once and stored in `Setting.baseLat/baseLng`. Do not re-geocode it on every request.

Eligibility flow (server-side only):
1. Customer types address into a Places Autocomplete widget (browser key, referrer-restricted). This returns a `placeId` and formatted address.
2. Client sends `placeId` to your server.
3. Server geocodes the `placeId` to lat/lng (Geocoding API, cache by `placeId`).
4. Server computes distance from base to destination.

Distance method, pick one and make it configurable:
- **Driving distance (recommended for a delivery business):** Distance Matrix API, origin = base, destination = customer. More honest for "within 40 miles for drop-off." Costs one call per check.
- **Straight-line radius (cheaper):** Haversine formula on the two coordinate pairs, no extra API call. Use if you want to minimize cost and treat 40 miles as a radius.

Return to the client only: `withinRadius`, `distanceMiles` (rounded), and computed `deliveryFee`. Never return raw API responses.

Cost controls:
- Rate-limit the eligibility endpoint per IP (for example 10 checks per minute).
- Cache geocode results by `placeId` and Distance Matrix results by `placeId` for a day.
- Keep the server key server-only in environment variables. Restrict it in Google Cloud to the specific APIs used.

---

## 8. Payment design

`PaymentProvider` interface (implement `ManualVenmoProvider` now):

- `buildPaymentRequest(reservation)` returns a Venmo deep link and/or QR payload with amount and note prefilled. Note format: `Starlink rental {publicId}`.
- `getInstructions(reservation)` returns human-readable steps for the customer.
- Confirmation is manual: the admin action `confirmPayment(reservationId, amount, kind)` records the payment and transitions state. `kind` is `deposit`, `balance`, or `full`.

Payment amounts:
- Total due = rental subtotal + deposit + delivery fee. Decide (see open questions) whether you collect deposit and rental together up front, or deposit first and balance at drop-off. Model supports both via `amountPaid` and `paymentStatus`.
- Deposit refund is its own admin action after `returned`, supporting full or partial refund (partial when deducting for damage or late return), writing `depositRefundedAt` and `depositRefundAmount`, then moving to `completed`.

Important caveat to surface in the UI and terms: Venmo personal transfers between friends are reversible and lack purchase protection. Goods-and-services Venmo payments carry a fee but offer protection. Decide which you want and state it in your terms.

Documented future path (do not build now): a `BraintreeVenmoProvider` implementing the same interface, with a webhook route that auto-confirms and transitions state. Leave a `// FUTURE:` comment marker at the interface.

---

## 9. Admin portal design

Routes under `/admin`, protected by Auth.js middleware.

- **Dashboard:** counts by status, revenue this month, utilization rate (booked days / available days), list of upcoming drop-offs and returns, holds expiring soon, reservations awaiting payment confirmation.
- **Reservations list:** filterable by status, searchable by name/email/public code, sortable by date. Each row shows status, dates, payment status, distance.
- **Reservation detail:** full customer and address block, a "text this renter" link, map thumbnail, pricing breakdown, payment actions (confirm payment, refund deposit), fulfillment actions (schedule drop-off, mark active, mark returned), agreement status and signed PDF, condition photos, contact-log notes, internal notes, status history.
- **Calendar:** month view showing booked ranges, holds, and blackout blocks. Create and delete blackout blocks here.
- **Settings:** edit base address, radius, daily rate, deposit, delivery fee model, hold window, Venmo username, contact phone number, agreement text and version, cancellation policy.

Every state-changing action is a server action with authorization checks and Zod validation, and writes a `StatusEvent`.

---

## 10. Communication design (text handoff, no in-app messaging)

You are right that building a message system is the wrong call here. People prefer texting, iMessage handles it natively between Apple devices, and you avoid maintaining an inbox. So split communication cleanly:

- **System to renter = email (and optional automated SMS).** One-way, automated milestone notifications: reservation received, payment confirmed, drop-off scheduled, return reminder, deposit refunded. The app sends these; no reply is expected.
- **Human back-and-forth = direct text to your phone.** The renter's status page and their emails include a "Text the owner" button. On a phone this is an `sms:` deep link, for example `sms:+18015551234?&body=Hi, this is Jane about Starlink rental SL-7Q3K`. Tapping it opens their Messages app with your number and a prefilled note that already references their reservation code. If you both use Apple devices this threads as iMessage automatically. On desktop, show the number plus a QR code they can scan to text from their phone.

You reply from your own phone like any normal text. Nothing to build beyond generating the correct link.

**Privacy recommendation:** do not publish your personal cell. Get a free Google Voice number (or a cheap dedicated line) that forwards to your phone and set it as `Setting.contactPhone`. Renters text that number, it rings and threads on your device, and your personal number stays private. If you ever want to hand the business off or stop, you change one setting.

**Keeping a record:** since the conversation lives in your Messages app, the admin portal does not capture message content. If you want a paper trail on a reservation, jot a one-line `ContactLog` note ("texted, confirmed 3pm Friday drop-off") on the reservation detail. Optional, for your own reference.

**Trade-off to accept:** you lose a centralized, searchable message history inside the portal. For a one-person rental business this is a good trade for simplicity and for meeting renters where they already are.

---

## 10.5 Admin notifications and push

You run this from your iPhone, so alerts must reach your phone reliably and immediately. Draw a hard line between two audiences:

- **You (the operator):** get push notifications for everything that happens. This is the system in this section.
- **Renters:** get email, and optionally SMS. They will not install anything, so their channel stays email/SMS (covered in sections 6.5 and 10). Do not try to push to renters.

### The iOS reality (important for setup)

On iPhone, a website can only send push notifications after it is added to the Home Screen as a web app. A plain Safari tab cannot receive push. This is an Apple rule, not a limitation of the build. Because you are installing your own admin app once, this is a one-time setup step, not a problem.

Your one-time setup on the iPhone 16 Pro (iOS 26):
1. Open the admin site in Safari.
2. Tap Share, then Add to Home Screen.
3. Open the app from its new Home Screen icon (on iOS 26 it opens as a standalone web app).
4. In the app, tap Enable notifications and allow the permission prompt.

To make this possible, the admin app must be an installable PWA (web app manifest, standalone display, service worker). That is added in Phase 0.

### Recommended channel strategy

iOS web push is fine for informational alerts but is less reliable than a native app, which matters for money-critical events. So use a layered approach behind one abstraction:

- **Primary: a dedicated push service with a native iOS app.** Pushover (one-time purchase, very reliable, supports priority and custom sounds), ntfy (free, open source), or a Telegram bot (free). Your server makes one HTTP call per event and it pushes natively to your phone. This is the most reliable path and almost nothing to build. Recommended as your main alert channel.
- **Optional: native Web Push from your installed PWA.** No third party, alerts come from your own app. Slightly more to build and a little less reliable on iOS. Add it if you want a fully self-contained system.
- **Fallback for critical events: SMS via Twilio.** For "payment received" and "return overdue," also fire an SMS so it always lands even if push is delayed.

Build a `Notifier` service so events do not care which channel delivers them. Each event maps to one or more channels and a priority. Swapping Pushover for Web Push later is a channel change, not a rewrite.

### Every event you get notified about

Immediate (fired by the server action that changes state):
- New reservation submitted and agreement signed, awaiting payment. Priority: normal.
- Renter tapped "I have paid," now awaiting your confirmation. Priority: high, action needed.
- Renter requested a reschedule. Priority: high.
- Renter cancelled a reservation. Priority: normal.
- A reservation you confirmed is now fully booked (confirmation of your own action). Priority: low, optional.

Time-based (fired by Vercel Cron, deduped via NotificationLog so each fires once):
- Unpaid hold expiring soon (for example 2 hours left). Priority: normal.
- Hold expired and dates freed. Priority: normal.
- Drop-off scheduled for today. Priority: normal, morning of.
- Return due today. Priority: high.
- Return overdue (past return date, not marked returned). Priority: high, also SMS.
- Deposit refund still pending (unit returned N days ago, not yet refunded). Priority: normal reminder.
- Optional daily digest each morning: today's drop-offs, returns, and anything awaiting action. Priority: low.

### Reliability and hygiene

- Every send writes a NotificationLog row. Time-based alerts check the log so a nightly cron does not re-send the same "overdue" alert every run; cap to once per day per reservation per event.
- Respect optional quiet hours for non-urgent alerts. High-priority events (payment received, overdue return) ignore quiet hours.
- Settings let you toggle channels and individual events on or off, so you can tune the noise.

---

## 11. Security, privacy, legal

- Admin auth: hashed passwords (bcrypt/argon2), secure session cookies, email OTP second factor, lockout after repeated failures.
- All `/admin` and all admin server actions behind auth middleware. Verify authorization inside each action, not just at the route.
- Secrets in environment variables only. Never ship keys to the client except the referrer-restricted Maps browser key.
- Input validation with Zod on every public endpoint. Rate-limit public endpoints (eligibility, reservation submit, messaging).
- CSRF protection on mutations, security headers, HTTPS only.
- Store only what you need. Do not log full addresses or phone numbers in plaintext application logs.
- Legal artifacts before launch: rental agreement with liability and damage terms, deposit terms, cancellation policy, terms of service, privacy policy. These are business documents you provide; the app versions and timestamps them.

---

## 12. Repository and workflow conventions

Claude Code should follow these on every phase.

- **Remote:** `origin` is `https://github.com/miles-blake/Starlink-Rentals.git`. All branches, commits, and pull requests live on this repo. Push work to this remote; never work only locally.
- **Branching:** trunk is `main`, always deployable. One branch per phase: `phase-0-foundation`, `phase-1-intake`, and so on. For sub-work, `feature/<phase>-<short-name>`. Protect `main` so changes land through pull requests, not direct pushes.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). Small, focused commits.
- **Pull requests:** open a PR per phase into `main`. PR description lists what changed and checks off the phase acceptance criteria. Do not self-merge until CI is green.
- **CI (GitHub Actions):** on every PR run lint, typecheck, unit tests, and a build. Block merge on failure.
- **Migrations:** every schema change is a committed Prisma migration. Never edit the database by hand.
- **Env:** maintain `.env.example` with every variable documented and no secrets. Never commit real `.env`.
- **Tests:** each phase ships with tests for its core logic. Booking, availability, pricing, and eligibility must have unit tests. The end-to-end booking flow gets a Playwright test by Phase 6.
- **Definition of done per phase:** code + tests + passing CI + updated `.env.example` + short entry in `CHANGELOG.md` + acceptance criteria checked.

---

## 13. Phased execution plan

Hand these to Claude Code one at a time.

### Phase 0: Foundation
**Branch:** `phase-0-foundation`
**Goal:** A running skeleton with tooling, CI, database, and deploy wired up.
**Tasks:**
- Connect to the repo at `https://github.com/miles-blake/Starlink-Rentals.git` and set it as `origin`. Clone it if it has content; otherwise initialize the project inside it. Create `main`, add a sensible `.gitignore` (Node, Next.js, env files), make the initial commit, and push to `origin`.
- Create the `phase-0-foundation` branch and do the rest of this phase's work there, opening a pull request into `main` at the end.
- Initialize Next.js + TypeScript + Tailwind + shadcn/ui.
- Add Prisma, connect Postgres, create the initial schema (all models from section 4) and first migration.
- Set up Auth.js scaffolding (admin login page, session, protected `/admin` shell, no features yet).
- Make the admin app an installable PWA: web app manifest, icons, standalone display, and a registered service worker. This is the prerequisite for iOS web push later.
- Add ESLint, Prettier, Vitest, Playwright config.
- Add GitHub Actions CI (lint, typecheck, test, build).
- Add `.env.example`, `README.md`, `CHANGELOG.md`.
- Deploy to Vercel; confirm the skeleton loads and the database connects.
**Acceptance criteria:**
- The project lives on `https://github.com/miles-blake/Starlink-Rentals.git` with `main` and a `phase-0-foundation` PR.
- CI green on the PR.
- App deploys and loads a placeholder home page and an admin login.
- The admin app can be added to the iPhone Home Screen and opens standalone.
- `npx prisma migrate` runs cleanly; all models exist.
- A seeded admin user can log in and reach an empty admin shell.

### Phase 1: Eligibility and quote engine
**Branch:** `phase-1-intake`
**Goal:** Customer enters address and dates and gets an instant eligibility answer and price.
**Tasks:**
- Places Autocomplete address input (browser key).
- Server eligibility endpoint: geocode by placeId, compute distance from base, return within-radius + distance + delivery fee. Cache and rate-limit.
- Pricing engine: daily rate times days, deposit, delivery fee, total. Pure functions with unit tests. Enforce `minRentalDays`.
- Public quote UI showing the breakdown and an eligible/not-eligible result.
- Seed `Setting` with base address (geocode once), radius 40, and your rates.
**Acceptance criteria:**
- Entering an in-range address and valid dates shows a correct itemized quote.
- An out-of-range address shows a clear not-eligible message and no reservation path.
- Pricing and distance logic covered by unit tests.
- Eligibility endpoint is rate-limited and never exposes the server key.

### Phase 2: Availability and reservations
**Branch:** `phase-2-reservations`
**Goal:** Turn a quote into a held reservation without double-booking.
**Tasks:**
- Availability engine: overlap check against blocking reservations and blackout blocks. Unit tested against edge cases (adjacent dates, same-day, overlap).
- Reservation creation: generate `publicId`, freeze pricing snapshot, set status `awaiting_payment`, create a soft hold with `holdExpiresAt`.
- Vercel Cron job to expire stale holds and free dates.
- Public reservation confirmation page with the public code.
- Customer status page reachable by `publicId` + email.
**Acceptance criteria:**
- Two overlapping reservations cannot both exist; the second is refused with a clear message.
- A hold expires on schedule and frees the dates.
- Creating a reservation freezes pricing so later settings changes do not alter it.
- Availability logic has thorough unit tests.

### Phase 3: Rental agreement e-sign
**Branch:** `phase-3-agreement`
**Goal:** Capture a binding, frictionless electronic signature before payment, with no third-party service.

**How the signing works (recommended approach):** a built-in click-to-sign. The renter sees the full agreement text on screen (not just a link to it), types their legal name as the signature, checks an "I have read and agree" box, and taps Sign. This is a valid electronic signature under the US ESIGN Act and state UETA for a low-stakes consumer rental, as long as you capture three things: intent to sign, attribution to the signer, and an exact copy of what they agreed to. Do not just use a bare checkbox for something covering an expensive device and a deposit. Capture a typed name at minimum. This is not legal advice; have your final agreement text reviewed if you want certainty.

A paid e-sign service (DocuSign, Dropbox Sign) is available but is overkill here: it adds cost, a redirect or email round-trip, and friction, for no meaningful benefit at this scale. Build the in-app version and keep the interface clean enough to swap later if you ever need it.

**Tasks:**
- Render the current agreement text inline from `Setting.agreementText`, versioned by `agreementCurrentVersion`. Require the renter to scroll through it on mobile before the Sign button enables.
- Prefill the signature name field from the name they already entered, but require them to actively type it to sign (active intent, not a pre-checked box).
- On sign, record: `agreementSignerName`, `agreementSignedAt`, `agreementVersion`, `agreementSignerIp`, `agreementSignerUserAgent`, and `agreementTextHash` (SHA-256 of the exact text shown).
- Generate a PDF of the signed agreement embedding the text, signer name, timestamp, version, and hash. Store it (`signedPdfUrl`) and email a copy to the renter.
- Keep the signed record immutable. If the agreement text changes later, that is a new version; past signatures stay tied to the version and hash they signed.
- Block progression to payment until signed.

**Acceptance criteria:**
- Renter cannot reach payment without a completed signature.
- The stored record includes name, timestamp, version, IP, user agent, and the text hash.
- A signed PDF is generated, stored, and emailed to the renter.
- Changing the agreement text bumps the version without altering any prior signed record.

### Phase 4: Admin portal core
**Branch:** `phase-4-admin`
**Goal:** Full operational control of reservations.
**Tasks:**
- Reservations list (filter, search, sort).
- Reservation detail with all data, pricing, and status history.
- State-machine actions: confirm payment, schedule drop-off, mark active, mark returned, refund deposit, cancel. Each validates the transition and writes a `StatusEvent`.
- Availability calendar with blackout create/delete.
- Settings editor.
- Dashboard with counts, revenue, utilization, upcoming events, expiring holds.
**Acceptance criteria:**
- Every legal transition works from the UI and illegal ones are rejected.
- Blackout blocks immediately affect public availability.
- Dashboard numbers reconcile with underlying data.
- All admin actions require auth and are authorization-checked server-side.

### Phase 5: Payments (manual Venmo)
**Branch:** `phase-5-payments`
**Goal:** Customer pays via Venmo and the operator confirms.
**Tasks:**
- `PaymentProvider` interface + `ManualVenmoProvider`.
- Payment page: Venmo deep link and QR prefilled with amount and reference, plus instructions and the reversibility caveat.
- Customer "I have paid" action moves reservation to `payment_review`.
- Admin confirm-payment action records amount and kind, transitions to `confirmed`, sends confirmation email.
- Deposit refund action (full or partial) at `returned`, moving to `completed`.
- Leave a documented `BraintreeVenmoProvider` seam.
**Acceptance criteria:**
- End-to-end: quote, reserve, sign, pay handoff, mark paid, admin confirm, reservation `confirmed`.
- Deposit refund records amount and completes the reservation.
- Swapping providers would require no changes outside the provider.

### Phase 6: Communication, photos, notifications
**Branch:** `phase-6-comms`
**Goal:** Text handoff, condition records, renter emails, and full admin push notifications. No message system to build.
**Tasks:**
- "Text the owner" handoff: generate the `sms:` deep link with `Setting.contactPhone` and a prefilled body referencing the public code. Show it as a button on the status page and in emails; show number + QR on desktop.
- "Text this renter" link on the admin reservation detail. Optional one-line `ContactLog` note field.
- Condition photo upload at drop-off and return (Vercel Blob or Supabase Storage), attached to the correct reservation and phase.
- Renter transactional emails: reservation received, payment confirmed, drop-off scheduled, return reminder (cron), deposit refunded. Include an add-to-calendar (.ics) attachment for the return date.
- Setup guide / FAQ page linked from the confirmation page and drop-off email.
- **Admin notifications (`Notifier` service):** implement the channel abstraction and wire the recommended channel (Pushover or ntfy) first. Enable native Web Push from the installed PWA as a second channel. Add SMS fallback for critical events.
- Fire every immediate event from the relevant server action, and every time-based event from Vercel Cron, logging each to NotificationLog and deduping so time-based alerts send at most once per day per reservation.
- Add an admin notification settings screen to toggle channels, individual events, and quiet hours. Add a "send test notification" button.
- Optional Twilio SMS for renter-facing milestones behind a feature flag.
- Playwright end-to-end test covering the full booking flow.
**Acceptance criteria:**
- The text-owner and text-renter links open Messages with the correct number and prefilled reference.
- Photos attach to the correct reservation and phase.
- Renter milestone emails fire on time and the return reminder includes a working .ics.
- Every event in section 10.5 triggers an admin notification on the chosen channel, with high-priority events also sent via SMS.
- Time-based alerts do not duplicate across cron runs.
- A test notification reaches the installed PWA on the iPhone and the Pushover/ntfy app.
- End-to-end test passes in CI.

### Phase 7: Hardening and launch
**Branch:** `phase-7-hardening`
**Goal:** Production-ready security, reliability, and polish.
**Tasks:**
- Email OTP second factor and login lockout for admin.
- Rate limiting and abuse protection on all public endpoints.
- Security headers, CSRF checks, HTTPS enforcement.
- Sentry error monitoring (optional).
- Legal pages: terms, privacy, cancellation policy, agreement finalized.
- Accessibility and mobile pass on the public flow.
- Load a realistic seed, run a full manual dry run, fix gaps.
**Acceptance criteria:**
- Admin requires second factor and locks out on repeated failures.
- Public endpoints are rate-limited and validated.
- Legal pages present and linked.
- Full manual dry run from booking to deposit refund succeeds on production.

---

## 14. Environment variables

Document all of these in `.env.example`:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `GOOGLE_MAPS_SERVER_KEY` (server only), `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` (referrer-restricted)
- `RESEND_API_KEY`, `FROM_EMAIL`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (optional; also used for critical-event SMS fallback)
- `PUSHOVER_TOKEN`, `PUSHOVER_USER_KEY` (if using Pushover) or `NTFY_TOPIC`, `NTFY_SERVER` (if using ntfy)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (only if enabling native Web Push from the PWA)
- `BLOB_READ_WRITE_TOKEN` or Supabase storage keys
- `ADMIN_EMAIL` (for seeding the first admin)
- `SENTRY_DSN` (optional)
- App config that is not secret can live in the `Setting` table instead of env.

---

## 15. Testing strategy

- **Unit (Vitest):** pricing, distance/eligibility, availability overlap, hold expiry, state-machine transitions. These are the business core and must be well covered.
- **End to end (Playwright):** the full customer path (quote, reserve, sign, pay handoff, mark paid) and the key admin path (confirm payment, schedule, mark returned, refund).
- **CI:** all of the above on every PR.

---

## 16. Post-launch enhancements (backlog, not now)

- Braintree/PayPal Venmo for automated confirmation.
- Multiple units if you expand (the model generalizes: add a `Unit` entity and scope availability per unit).
- Discount rules (weekly rate, repeat-customer discount).
- Automated ID or deposit verification.
- Review request email after completion.
- Simple analytics on where demand comes from.

---

## 17. Decisions to make before Phase 1

Answer these and give them to Claude Code with Phase 1. They are business choices, not engineering ones:

1. **Daily rate** and **deposit amount**?
2. **Delivery fee:** flat fee, or per-mile past some free radius? Any pickup option at your location with no fee?
3. **Distance basis:** driving distance or straight-line radius for the 40-mile rule?
4. **Payment timing:** collect deposit plus full rental up front, or deposit first and balance at drop-off?
5. **Minimum rental length** (days)?
6. **Hold window** length (default 24 hours)?
7. **Cancellation policy:** what is refundable and when?
8. **Venmo payment type:** friends-and-family (free, reversible) or goods-and-services (fee, protected)?
9. **SMS:** do you want Twilio texts to renters, or email only to start?
10. **Admin push channel:** Pushover (one-time purchase, most reliable), ntfy (free), a Telegram bot (free), or native Web Push from the installed app? You can start with one and add others later.
11. **Contact number:** will you use a Google Voice or dedicated business number for renters to text, or your personal cell?

---

This is the complete plan. Start with Phase 0, keep each phase on its own branch, and do not merge a phase until its acceptance criteria pass. Give me your answers to section 17 and I can turn each phase into a precise task prompt for Claude Code.
