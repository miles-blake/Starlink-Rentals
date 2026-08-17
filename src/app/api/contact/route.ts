import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

// The contact number is meant to be public — it's how renters reach the
// operator (see the "Text the owner" feature). This endpoint exists so
// client components (which can't read Setting directly) can render it,
// without exposing any other Setting fields.
export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`contact:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  return NextResponse.json({ contactPhone: settings?.contactPhone ?? null });
}
