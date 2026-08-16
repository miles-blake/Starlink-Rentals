import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function authenticate(formData: FormData) {
  "use server";

  const callbackUrl = (formData.get("callbackUrl") as string) || "/admin";

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const params = new URLSearchParams({ error: "CredentialsSignin" });
      redirect(`/admin/login?${params.toString()}`);
    }
    throw error;
  }
}

export default async function AdminLoginPage({
  searchParams,
}: PageProps<"/admin/login">) {
  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/admin";
  const hasError = typeof params.error === "string";

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-foreground font-mono text-sm font-medium tracking-tight">
            Starlink Rentals
          </span>
          <h1 className="text-foreground mt-3 text-2xl font-semibold">
            Admin sign in
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Operator access only.
          </p>
        </div>

        <form
          action={authenticate}
          className="border-border bg-card flex flex-col gap-4 rounded-xl border p-6"
        >
          <input type="hidden" name="callbackUrl" value={callbackUrl} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {hasError ? (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
            >
              Incorrect email or password.
            </p>
          ) : null}

          <Button type="submit" className="mt-1">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
