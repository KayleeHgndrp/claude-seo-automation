import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

// Server-side defence in depth: even though middleware gates /admin, we
// re-check the session here so the layout never renders for a signed-out user.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/admin/outreach");

  return (
    <div className="min-h-screen">
      <header className="border-b border-navy/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <span className="font-semibold text-navy">Studio Radixs · Outreach</span>
          <span className="text-xs text-navy/50">{user.email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
