# Changelog

All notable changes to this project are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## Phase 0 — Foundation

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui scaffold, styled with a Starlink-inspired dark palette and Geist typography.
- Prisma schema covering every model from the blueprint's data model (Reservation, BlackoutBlock, ContactLog, NotificationLog, ConditionPhoto, StatusEvent, AdminUser, Setting) with the first migration applied against Postgres.
- Auth.js (NextAuth v5) credentials-based admin login, JWT sessions, `/admin` routes protected by a proxy (Next.js's middleware successor), and a seed script for the first admin user.
- Installable admin PWA: web app manifest, icons, standalone display, registered service worker.
- ESLint, Prettier (with Tailwind class sorting), Vitest, and Playwright configured, each with a passing smoke check.
- GitHub Actions CI: lint, format check, typecheck, unit tests, and build on every pull request into `main`.
- `.env.example`, README, and this changelog.
