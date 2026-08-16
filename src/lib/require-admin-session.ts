import { auth } from "@/auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in.");
    this.name = "UnauthorizedError";
  }
}

/**
 * Defense in depth for Server Actions: the proxy (middleware) already keeps
 * signed-out users off every /admin page, but a Server Action is a public
 * endpoint in its own right and must check auth itself rather than trust
 * that it was only ever reachable from a page the middleware protected.
 */
export async function requireAdminSession() {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError();
  }
  return session;
}
