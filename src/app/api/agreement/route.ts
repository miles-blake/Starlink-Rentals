import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`agreement:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  if (!settings?.agreementText) {
    return NextResponse.json(
      { error: "Agreement is not configured yet" },
      { status: 503 }
    );
  }

  return NextResponse.json({
    text: settings.agreementText,
    version: settings.agreementCurrentVersion,
  });
}
