import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import {
  verifyAdminCredentials,
  isAdminLocked,
  recordFailedAttempt,
  clearFailedAttemptsAndLockout,
  consumeOtp,
} from "@/lib/admin-login-security";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otpCode: { label: "Code", type: "text" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        const otpCode = credentials?.otpCode;
        if (
          typeof email !== "string" ||
          typeof password !== "string" ||
          typeof otpCode !== "string"
        ) {
          return null;
        }

        const admin = await verifyAdminCredentials(email, password);
        if (!admin) return null;
        if (isAdminLocked(admin)) return null;

        const otpValid = await consumeOtp(admin, otpCode);
        if (!otpValid) {
          await recordFailedAttempt(admin.id);
          return null;
        }

        await clearFailedAttemptsAndLockout(admin.id);
        await prisma.adminUser.update({
          where: { id: admin.id },
          data: { lastLoginAt: new Date() },
        });

        return { id: admin.id, email: admin.email };
      },
    }),
  ],
});
