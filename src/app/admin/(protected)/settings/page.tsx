import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Settings — Admin",
};

export default async function SettingsPage() {
  const settings = await prisma.setting.findUnique({ where: { id: 1 } });

  if (!settings) {
    return (
      <div className="flex flex-1 flex-col items-start justify-center">
        <h1 className="text-foreground text-2xl font-semibold">
          Settings not configured
        </h1>
        <p className="text-muted-foreground mt-1 max-w-md text-sm">
          Run the seed script with BASE_ADDRESS and GOOGLE_MAPS_SERVER_KEY set
          to create the initial Setting row.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Settings
        </span>
        <h1 className="text-foreground mt-1 text-2xl font-semibold">
          Business settings
        </h1>
        <p className="text-muted-foreground mt-1 max-w-md text-sm">
          Base address ({settings.baseAddress}) and the rental agreement text
          aren&apos;t editable here yet — base address needs re-geocoding and
          agreement text needs a versioning workflow, both out of scope for now.
        </p>
      </div>

      <SettingsForm
        initial={{
          firstDayRate: Number(settings.firstDayRate),
          dailyRate: Number(settings.dailyRate),
          depositAmount: Number(settings.depositAmount),
          batteryDailyRate: Number(settings.batteryDailyRate),
          deliveryFeeModel: settings.deliveryFeeModel,
          deliveryFeeFlat: settings.deliveryFeeFlat
            ? Number(settings.deliveryFeeFlat)
            : null,
          deliveryFeePerMile: settings.deliveryFeePerMile
            ? Number(settings.deliveryFeePerMile)
            : null,
          serviceRadiusMiles: settings.serviceRadiusMiles,
          minRentalDays: settings.minRentalDays,
          holdWindowHours: settings.holdWindowHours,
          venmoUsername: settings.venmoUsername ?? "",
          contactPhone: settings.contactPhone ?? "",
          cancellationPolicyText: settings.cancellationPolicyText ?? "",
        }}
      />
    </div>
  );
}
