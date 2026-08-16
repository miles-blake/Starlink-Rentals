"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/require-admin-session";

type ActionResult = { ok: true } | { ok: false; error: string };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const createSchema = z.object({
  startDate: z.string().regex(DATE_ONLY),
  endDate: z.string().regex(DATE_ONLY),
  reason: z.string().trim().max(200).optional(),
});

export async function createBlackout(input: {
  startDate: string;
  endDate: string;
  reason?: string;
}): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Pick a start and end date." };
  }

  const startDate = parseDateOnly(parsed.data.startDate);
  const endDate = parseDateOnly(parsed.data.endDate);
  if (endDate <= startDate) {
    return { ok: false, error: "End date must be after the start date." };
  }

  try {
    await requireAdminSession();
    await prisma.blackoutBlock.create({
      data: { startDate, endDate, reason: parsed.data.reason || undefined },
    });
    revalidatePath("/admin/calendar");
    return { ok: true };
  } catch (error) {
    console.error("Create blackout failed", error);
    return { ok: false, error: "Could not create the blackout block." };
  }
}

export async function deleteBlackout(id: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await prisma.blackoutBlock.delete({ where: { id } });
    revalidatePath("/admin/calendar");
    return { ok: true };
  } catch (error) {
    console.error("Delete blackout failed", error);
    return { ok: false, error: "Could not delete the blackout block." };
  }
}
