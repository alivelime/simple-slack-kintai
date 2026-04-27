import { NextResponse } from "next/server";
import { verifySlackRequest } from "@/lib/slack/verify";
import { createAdminClient } from "@/lib/supabase/admin";

function jstToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function jstNow(): string {
  return new Date().toISOString();
}

// 日跨ぎ退勤を許容する最大時間 (出勤からこれを超えたら無効)
const MAX_OPEN_PUNCH_HOURS = 36;

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
    // 未退勤の punch がないかをチェック (日跨ぎで退勤忘れの可能性)
    const { data: openPunch } = await admin
      .from("punch_records")
      .select("date, punch_in")
      .eq("user_id", user.id)
      .not("punch_in", "is", null)
      .is("punch_out", null)
      .order("punch_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openPunch?.punch_in) {
      const punchInTime = new Date(openPunch.punch_in).toLocaleTimeString(
        "ja-JP",
        { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }
      );
      // 同日かどうかで文言を分ける
      if (openPunch.date === today) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: `🤠 おっと、相棒！今日はもう出勤済みだぜ (${punchInTime})。打ち間違いなら管理者に相談しな！`,
        });
      }
      return NextResponse.json({
        response_type: "ephemeral",
        text: `🤠 待ちな相棒！${openPunch.date} の出勤 (${punchInTime}) がまだ退勤されてないぜ。先に \`/punch out\` で退勤しな！`,
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
    // 日跨ぎ退勤に対応: 今日の record だけでなく "未退勤の最新 punch_in" を全期間から探す
    const { data: openPunch } = await admin
      .from("punch_records")
      .select("id, date, punch_in")
      .eq("user_id", user.id)
      .not("punch_in", "is", null)
      .is("punch_out", null)
      .order("punch_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!openPunch || !openPunch.punch_in) {
      // 今日のレコードに既に退勤済みのものがあるかも確認 (二重退勤の文言を出すため)
      const { data: closedToday } = await admin
        .from("punch_records")
        .select("punch_out")
        .eq("user_id", user.id)
        .eq("date", today)
        .not("punch_out", "is", null)
        .maybeSingle();

      if (closedToday?.punch_out) {
        const punchOutTime = new Date(closedToday.punch_out).toLocaleTimeString(
          "ja-JP",
          { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }
        );
        return NextResponse.json({
          response_type: "ephemeral",
          text: `🤠 おっと、相棒！今日はもう退勤済みだぜ (${punchOutTime})。打ち間違いなら管理者に相談しな！`,
        });
      }

      return NextResponse.json({
        response_type: "ephemeral",
        text: "🤠 おいおい、まだ出勤してないじゃないか！まずは `/punch in` で出勤しな！",
      });
    }

    // 出勤時刻と現在時刻の差を見て、古すぎる open punch は退勤忘れとして拒否する
    const punchInDate = new Date(openPunch.punch_in);
    const nowDate = new Date(now);
    const diffHours =
      (nowDate.getTime() - punchInDate.getTime()) / (1000 * 60 * 60);

    if (diffHours > MAX_OPEN_PUNCH_HOURS) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: `🤠 待ちな相棒！${openPunch.date} の出勤からもう ${Math.floor(diffHours)} 時間以上経ってるぜ。退勤忘れみたいだから管理者に相談しな！`,
      });
    }

    if (nowDate <= punchInDate) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "🤠 おかしいぞ、相棒！退勤時刻が出勤時刻より前になっちまう。管理者に相談しな！",
      });
    }

    const { error } = await admin
      .from("punch_records")
      .update({ punch_out: now })
      .eq("id", openPunch.id);

    if (error) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "🤠 おやおや、記録に失敗しちまったぜ…もう一度試してくれ！",
      });
    }

    // 日跨ぎだった場合は業務日 (出勤日) を明示する
    const crossedMidnight = openPunch.date !== today;
    const businessDateLabel = crossedMidnight
      ? `${openPunch.date} の勤務`
      : today;

    return NextResponse.json({
      response_type: "ephemeral",
      text: `🤠 お疲れさん、カウボーイ！退勤を記録したぜ！ゆっくり休みな！ (${businessDateLabel})`,
    });
  }

  return NextResponse.json({
    response_type: "ephemeral",
    text: '🤠 使い方: `/punch in` で出勤、`/punch out` で退勤だぜ、相棒！',
  });
}
