"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/require-admin-session";

type ActionResult = { ok: true } | { ok: false; error: string };

const settingsSchema = z
  .object({
    firstDayRate: z.coerce.number().nonnegative(),
    dailyRate: z.coerce.number().nonnegative(),
    depositAmount: z.coerce.number().nonnegative(),
    deliveryFeeModel: z.enum(["flat", "per_mile"]),
    deliveryFeeFlat: z.coerce.number().nonnegative().optional(),
    deliveryFeePerMile: z.coerce.number().nonnegative().optional(),
    serviceRadiusMiles: z.coerce.number().positive(),
    minRentalDays: z.coerce.number().int().positive(),
    holdWindowHours: z.coerce.number().int().positive(),
    venmoUsername: z.string().trim().max(100).optional(),
    contactPhone: z.string().trim().max(30).optional(),
    cancellationPolicyText: z.string().trim().max(2000).optional(),
  })
  .refine(
    (data) =>
      data.deliveryFeeModel === "flat"
        ? data.deliveryFeeFlat !== undefined
        : data.deliveryFeePerMile !== undefined,
    { message: "Set a fee for the chosen delivery fee model." }
  );

export async function updateSettings(
  input: z.input<typeof settingsSchema>
): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    await requireAdminSession();
    const data = parsed.data;
    await prisma.setting.update({
      where: { id: 1 },
      data: {
        firstDayRate: data.firstDayRate,
        dailyRate: data.dailyRate,
        depositAmount: data.depositAmount,
        deliveryFeeModel: data.deliveryFeeModel,
        deliveryFeeFlat: data.deliveryFeeFlat ?? null,
        deliveryFeePerMile: data.deliveryFeePerMile ?? null,
        serviceRadiusMiles: data.serviceRadiusMiles,
        minRentalDays: data.minRentalDays,
        holdWindowHours: data.holdWindowHours,
        venmoUsername: data.venmoUsername || null,
        contactPhone: data.contactPhone || null,
        cancellationPolicyText: data.cancellationPolicyText || null,
      },
    });
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (error) {
    console.error("Update settings failed", error);
    return { ok: false, error: "Could not save settings. Please try again." };
  }
}
