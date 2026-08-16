import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchAddressSuggestions } from "@/lib/google-maps";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const bodySchema = z.object({
  input: z.string().trim().min(3).max(200),
});

// Server-only key — the browser never sees it. This proxy replaces the
// usual client-side Places widget (which would need a second,
// referrer-restricted browser key) with a same-origin call instead.
const API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`autocomplete:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!API_KEY) {
    return NextResponse.json(
      { error: "Address lookup is not configured" },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const suggestions = await fetchAddressSuggestions(
      parsed.data.input,
      API_KEY
    );
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Address autocomplete failed", error);
    return NextResponse.json(
      { error: "Address lookup failed" },
      { status: 502 }
    );
  }
}
