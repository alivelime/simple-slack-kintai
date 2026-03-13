import { NextResponse } from "next/server";
import { verifySlackRequest } from "@/lib/slack/verify";
import { createAdminClient } from "@/lib/supabase/admin";

function jstToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function jstNow(): string {
  return new Date().toISOString();
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (!verifySlackRequest(signingSecret, timestamp, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const slackUserId = params.get("user_id") ?? "";
  const commandText = (params.get("text") ?? "").trim().toLowerCase();

  const admin = createAdminClient();

  // Look up user by slack_user_id
  const { data: user } = await admin
    .from("users")
    .select("id")
    .eq("slack_user_id", slackUserId)
    .single();

  if (!user) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "🤠 おっと、カウボーイ！まずサルーンで登録しな！ (Webアプリからサインインしてください)",
    });
  }

  const today = jstToday();
  const now = jstNow();

  if (commandText === "in") {
    // Check if already punched in today
    const { data: existing } = await admin
      .from("punch_records")
      .select("punch_in")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (existing?.punch_in) {
      const punchInTime = new Date(existing.punch_in).toLocaleTimeString(
        "ja-JP",
        { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }
      );
      return NextResponse.json({
        response_type: "ephemeral",
        text: `🤠 おっと、相棒！今日はもう出勤済みだぜ (${punchInTime})。打ち間違いなら管理者に相談しな！`,
      });
    }

    const { error } = await admin.from("punch_records").upsert(
      {
        user_id: user.id,
        date: today,
        punch_in: now,
      },
      { onConflict: "user_id,date" }
    );

    if (error) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "🤠 おやおや、記録に失敗しちまったぜ…もう一度試してくれ！",
      });
    }

    return NextResponse.json({
      response_type: "ephemeral",
      text: `🤠 よう、相棒！出勤を記録したぜ！今日も一日がんばりな！ (${today})`,
    });
  }

  if (commandText === "out") {
    // Check if there's a record for today
    const { data: existing } = await admin
      .from("punch_records")
      .select("id, punch_in, punch_out")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (!existing || !existing.punch_in) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "🤠 おいおい、まだ出勤してないじゃないか！まずは `/punch in` で出勤しな！",
      });
    }

    if (existing.punch_out) {
      const punchOutTime = new Date(existing.punch_out).toLocaleTimeString(
        "ja-JP",
        { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }
      );
      return NextResponse.json({
        response_type: "ephemeral",
        text: `🤠 おっと、相棒！今日はもう退勤済みだぜ (${punchOutTime})。打ち間違いなら管理者に相談しな！`,
      });
    }

    // Validate punch_out > punch_in
    if (new Date(now) <= new Date(existing.punch_in)) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "🤠 おかしいぞ、相棒！退勤時刻が出勤時刻より前になっちまう。管理者に相談しな！",
      });
    }

    const { error } = await admin
      .from("punch_records")
      .update({ punch_out: now })
      .eq("user_id", user.id)
      .eq("date", today);

    if (error) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "🤠 おやおや、記録に失敗しちまったぜ…もう一度試してくれ！",
      });
    }

    return NextResponse.json({
      response_type: "ephemeral",
      text: `🤠 お疲れさん、カウボーイ！退勤を記録したぜ！ゆっくり休みな！ (${today})`,
    });
  }

  return NextResponse.json({
    response_type: "ephemeral",
    text: '🤠 使い方: `/punch in` で出勤、`/punch out` で退勤だぜ、相棒！',
  });
}
