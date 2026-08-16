import type { NextAuthConfig } from "next-auth";

// Edge-safe config: no providers here (Credentials needs Prisma, which needs
// Node APIs the Edge middleware runtime doesn't support). Middleware only
// needs to read the session and decide whether to redirect.
export const authConfig = {
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = request.nextUrl.pathname === "/admin/login";

      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL("/admin", request.nextUrl));
      }
      if (!isLoggedIn && !isLoginPage) {
        return false;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
