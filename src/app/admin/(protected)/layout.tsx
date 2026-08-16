import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function AdminShellLayout({
  children,
}: LayoutProps<"/admin">) {
  const session = await auth();

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/admin/login" });
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-4 sm:px-10">
        <span className="text-foreground font-mono text-sm font-medium tracking-tight">
          Starlink Rentals · Admin
        </span>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground hidden text-sm sm:inline">
            {session?.user?.email}
          </span>
          <form action={handleSignOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col px-6 py-8 sm:px-10">
        {children}
      </main>
    </div>
  );
}
