-- Belt-and-suspenders for the hard "never overlap" constraint on paid/committed
-- reservations. Application-level checking (src/lib/availability.ts) covers
-- soft holds (awaiting_payment) since those depend on a time-based
-- holdExpiresAt that a static DB constraint can't evaluate — but once a
-- reservation reaches payment_review or beyond, the dates are meant to be
-- hard-booked (blueprint section 5), so the database itself refuses to let
-- two such rows ever overlap, race conditions included.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation"
  ADD CONSTRAINT reservation_no_overlap
  EXCLUDE USING gist (
    daterange("startDate"::date, "endDate"::date, '[)') WITH &&
  )
  WHERE (status IN ('payment_review', 'confirmed', 'scheduled', 'active', 'returned'));
