import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { AdminUser } from "@/generated/prisma/client";

export const OTP_EXPIRY_MINUTES = 10;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function findAdminByEmail(
  email: string
): Promise<AdminUser | null> {
  return prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
}

export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<AdminUser | null> {
  const admin = await findAdminByEmail(email);
  if (!admin) return null;

  const valid = await bcrypt.compare(password, admin.passwordHash);
  return valid ? admin : null;
}

export function isAdminLocked(admin: Pick<AdminUser, "lockedUntil">): boolean {
  return !!admin.lockedUntil && admin.lockedUntil.getTime() > Date.now();
}

export function lockoutRemainingMinutes(
  admin: Pick<AdminUser, "lockedUntil">
): number {
  if (!admin.lockedUntil) return 0;
  const ms = admin.lockedUntil.getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / 60_000));
}

/** Increments the failure counter and applies a lockout once the threshold is hit. */
export async function recordFailedAttempt(adminId: string): Promise<void> {
  const admin = await prisma.adminUser.update({
    where: { id: adminId },
    data: { failedLoginAttempts: { increment: 1 } },
  });

  if (admin.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    await prisma.adminUser.update({
      where: { id: adminId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000),
      },
    });
  }
}

export async function clearFailedAttemptsAndLockout(
  adminId: string
): Promise<void> {
  await prisma.adminUser.update({
    where: { id: adminId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

/** Generates a fresh OTP code, stores its hash, and returns the plaintext code to email. */
export async function issueOtp(adminId: string): Promise<string> {
  const code = generateOtpCode();
  const otpCodeHash = await bcrypt.hash(code, 10);
  await prisma.adminUser.update({
    where: { id: adminId },
    data: {
      otpCodeHash,
      otpCodeExpiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000),
    },
  });
  return code;
}

export async function consumeOtp(
  admin: Pick<AdminUser, "id" | "otpCodeHash" | "otpCodeExpiresAt">,
  code: string
): Promise<boolean> {
  if (!admin.otpCodeHash || !admin.otpCodeExpiresAt) return false;
  if (admin.otpCodeExpiresAt.getTime() < Date.now()) return false;

  const valid = await bcrypt.compare(code, admin.otpCodeHash);
  if (valid) {
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { otpCodeHash: null, otpCodeExpiresAt: null },
    });
  }
  return valid;
}
