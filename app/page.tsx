import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginButton } from "@/components/login-button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <h1 className="font-heading text-5xl tracking-wide">
        🤠 The Kintai Saloon
      </h1>
      <p className="text-lg text-muted-foreground">
        Slackで打刻、Webで確認。カウボーイスタイルの勤怠管理。
      </p>
      <LoginButton />
    </div>
  );
}
