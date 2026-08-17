import { AdminLoginForm } from "./admin-login-form";

export default async function AdminLoginPage({
  searchParams,
}: PageProps<"/admin/login">) {
  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/admin";

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

        <AdminLoginForm callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}
