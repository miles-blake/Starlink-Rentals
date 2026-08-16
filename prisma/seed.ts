import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { geocodeAddress } from "../src/lib/google-maps";
import { AGREEMENT_TEXT, AGREEMENT_VERSION } from "../src/lib/agreement-text";

async function seedAdmin(prisma: PrismaClient) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment to seed the admin user."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.adminUser.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash },
    create: { email: email.toLowerCase(), passwordHash },
  });

  console.log(`Seeded admin user: ${admin.email}`);
}

async function seedSettings(prisma: PrismaClient) {
  const existing = await prisma.setting.findUnique({ where: { id: 1 } });

  if (existing) {
    // Syncs the agreement text/version from the source-controlled constant.
    // A stopgap until Phase 4's admin settings editor can do this as a
    // deliberate action — fine for now since no signatures exist yet to
    // worry about invalidating.
    if (
      existing.agreementText !== AGREEMENT_TEXT ||
      existing.agreementCurrentVersion !== AGREEMENT_VERSION
    ) {
      await prisma.setting.update({
        where: { id: 1 },
        data: {
          agreementText: AGREEMENT_TEXT,
          agreementCurrentVersion: AGREEMENT_VERSION,
        },
      });
      console.log(
        `Updated Setting.agreementText to version ${AGREEMENT_VERSION}`
      );
    } else {
      console.log("Setting row already exists and agreement text is current.");
    }
    return;
  }

  const baseAddressInput = process.env.BASE_ADDRESS;
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;

  if (!baseAddressInput || !apiKey) {
    console.log(
      "Skipping Setting seed: BASE_ADDRESS and GOOGLE_MAPS_SERVER_KEY must both be set."
    );
    return;
  }

  const { lat, lng, formattedAddress } = await geocodeAddress(
    baseAddressInput,
    apiKey
  );

  await prisma.setting.create({
    data: {
      id: 1,
      baseAddress: formattedAddress,
      baseLat: lat,
      baseLng: lng,
      serviceRadiusMiles: 40,
      firstDayRate: 30,
      dailyRate: 20,
      depositAmount: 300,
      deliveryFeeModel: "flat",
      deliveryFeeFlat: 15,
      minRentalDays: 1,
      holdWindowHours: 12,
      agreementCurrentVersion: AGREEMENT_VERSION,
      agreementText: AGREEMENT_TEXT,
      cancellationPolicyText:
        "Full refund if cancelled 48 hours or more before the rental start date. The refundable deposit is returned on any cancellation, since it is collateral against the unit rather than payment for the rental.",
      notificationChannels: { push: true, email: true, sms: false },
      notificationEvents: {},
    },
  });

  console.log(`Seeded Setting: base = ${formattedAddress} (${lat}, ${lng})`);
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  await seedAdmin(prisma);
  await seedSettings(prisma);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
