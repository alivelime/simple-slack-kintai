import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Extract slack_user_id from identity data
      const slackIdentity = data.user.identities?.find(
        (i) => i.provider === "slack_oidc"
      );
      const slackUserId =
        slackIdentity?.identity_data?.provider_id ??
        slackIdentity?.id ??
        "";
      const displayName =
        data.user.user_metadata?.full_name ??
        data.user.user_metadata?.name ??
        data.user.email ??
        "";

      // Upsert into public.users using admin client (bypasses RLS)
      const admin = createAdminClient();
      await admin.from("users").upsert(
        {
          id: data.user.id,
          slack_user_id: slackUserId,
          display_name: displayName,
        },
        { onConflict: "id" }
      );

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to home
  return NextResponse.redirect(`${origin}/`);
}
