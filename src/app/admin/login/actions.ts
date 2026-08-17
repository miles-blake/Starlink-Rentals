"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import {
  findAdminByEmail,
  isAdminLocked,
  lockoutRemainingMinutes,
  recordFailedAttempt,
  issueOtp,
  OTP_EXPIRY_MINUTES,
} from "@/lib/admin-login-security";

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function requestAdminOtp(
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ip = await clientIp();
  if (!checkRateLimit(`admin-otp-request:${ip}`, 10, 60_000)) {
    return { ok: false, error: "Too many attempts. Try again shortly." };
  }

  const admin = await findAdminByEmail(email);
  if (!admin) {
    return { ok: false, error: "Incorrect email or password." };
  }

  if (isAdminLocked(admin)) {
    return {
      ok: false,
      error: `Account locked. Try again in ${lockoutRemainingMinutes(admin)} minute(s).`,
    };
  }

  const validPassword = await bcrypt.compare(password, admin.passwordHash);
  if (!validPassword) {
    await recordFailedAttempt(admin.id);
    return { ok: false, error: "Incorrect email or password." };
  }

  const code = await issueOtp(admin.id);

  try {
    await sendEmail({
      to: admin.email,
      subject: "Your Starlink Rentals admin sign-in code",
      text: `Your sign-in code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not request this, ignore this email.`,
    });
  } catch (error) {
    console.error("Failed to send admin OTP email", error);
    return {
      ok: false,
      error: "Could not send a sign-in code. Try again shortly.",
    };
  }

  return { ok: true };
}

export async function verifyOtpAndSignIn(
  email: string,
  password: string,
  otpCode: string,
  callbackUrl: string
): Promise<{ ok: false; error: string }> {
  const ip = await clientIp();
  if (!checkRateLimit(`admin-otp-verify:${ip}`, 10, 60_000)) {
    return { ok: false, error: "Too many attempts. Try again shortly." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      otpCode,
      redirectTo: callbackUrl,
    });
    return { ok: false, error: "" };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Incorrect or expired code." };
    }
    throw error;
  }
}
