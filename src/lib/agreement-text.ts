// The rental agreement's source of truth. Version-controlled and reviewable
// like any other change — bump AGREEMENT_VERSION whenever AGREEMENT_TEXT
// changes, since past signatures stay tied to the version and text hash
// they actually signed (see prisma/schema.prisma, Reservation.agreementTextHash).
//
// This is a draft written for the operator to review (ideally with a
// lawyer) before real customers sign it — see the Phase 3 PR description.

export const AGREEMENT_VERSION = "2";

export const AGREEMENT_TEXT = `STARLINK RENTALS — RENTAL AGREEMENT (Version ${AGREEMENT_VERSION})

This Rental Agreement ("Agreement") is between Miles Holt Blake, operating as Starlink Rentals ("Operator"), and the renter identified at signing ("Renter"), and covers the rental of the Starlink satellite internet equipment described in the associated reservation (the "Equipment").

1. Equipment. The Equipment consists of one Starlink dish, one Starlink router, mounting hardware, and associated cables, provided in good working condition. The Equipment must remain connected to a continuous power source for the duration of use — a standard wall outlet is sufficient. If outlet access will be limited during the rental, Renter may add a Jackery 300 portable battery rental (fee shown in the itemized quote) as an alternative power source. Starlink Rentals is an independent rental service and is not affiliated with, endorsed by, or sponsored by Starlink or SpaceX. Operator makes no warranty regarding internet speed, latency, uptime, or coverage, as these depend on Starlink's own network, service terms, weather, and the Renter's location and installation.

2. Rental Period. The rental begins and ends on the dates specified in the Renter's reservation. Renter agrees to have the Equipment available for pickup or return, as applicable, at the scheduled time.

3. Fees. Renter agrees to pay the rental fee, refundable deposit, and any delivery or battery-rental fee shown in the itemized quote at the time of reservation. These amounts are fixed at booking and will not change due to later rate adjustments.

4. Payment. Payment is due in full, including the deposit, before drop-off or pickup, via Venmo (goods and services) or another method specified by Operator at the time.

5. Deposit. The deposit is fully refundable upon return of the Equipment in the same condition it was provided, ordinary wear and tear excepted. If the Equipment is returned damaged, missing parts, or not returned at all, Operator may deduct the reasonable cost of repair, replacement, or the then-current fair market value of the Equipment from the deposit. If damage or loss exceeds the deposit amount, Renter is responsible for the remaining cost.

6. Renter Responsibilities. Renter agrees to: (a) use the Equipment only for its intended purpose; (b) not modify, disassemble, or attempt to repair the Equipment; (c) take reasonable care to protect the Equipment from weather damage, theft, and loss while in Renter's possession; and (d) return the Equipment at the agreed time and in the condition it was received.

7. Delivery and Pickup. Delivery is available within Operator's service area for the delivery fee shown at booking; pickup at Operator's location is available at no charge regardless of distance. Operator will coordinate exact drop-off and return logistics directly with Renter.

8. Cancellation. Reservations cancelled 48 hours or more before the rental start date receive a full refund of all amounts paid, including the deposit. Cancellations made less than 48 hours before the start date are not entitled to a refund of the rental fee, though the deposit — being collateral rather than payment for the rental — is still returned in full.

9. Late Returns. If Renter fails to return the Equipment by the scheduled return date and time, Renter will be charged a late fee equal to twice (2x) the daily rental rate shown in Renter's reservation, calculated hourly (1/24 of the daily late-fee amount for each hour, or part of an hour, the Equipment remains outstanding beyond the scheduled return time). This late fee may be deducted from the deposit or billed separately, and Operator may treat the Equipment as lost if it is not returned within a reasonable time after attempted contact.

10. Limitation of Liability. Operator is not liable for any indirect, incidental, or consequential damages arising from Renter's use of the Equipment, including loss of internet service, data, or business. Operator's total liability under this Agreement will not exceed the total amount paid by Renter for the rental.

11. Electronic Signature. By typing your name below and clicking "Sign," you agree that your electronic signature is legally binding, that you have read and agree to the full text of this Agreement above, and that you intend to be bound by its terms to the same extent as a handwritten signature.

12. Governing Law. This Agreement is governed by the laws of the State of Utah.

Questions about this Agreement can be directed to Operator through the contact method provided on the reservation status page.`;
