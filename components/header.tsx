import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import type { User } from "@/lib/types";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let dbUser: User | null = null;
  if (authUser) {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();
    dbUser = data;
  }

  return (
    <header className="border-b-2 border-foreground bg-card px-6 py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <Link href="/dashboard">
          <h1 className="font-heading text-2xl tracking-wide">
            🤠 The Kintai Saloon
          </h1>
        </Link>
        <div className="flex items-center gap-4">
          {dbUser?.is_admin && (
            <Link
              href="/dashboard/admin"
              className="text-sm font-bold hover:text-primary"
            >
              管理者ページ
            </Link>
          )}
          {dbUser && (
            <span className="text-sm text-muted-foreground">
              {dbUser.display_name}
            </span>
          )}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
