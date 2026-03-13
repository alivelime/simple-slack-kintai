# CLAUDE.md — The Kintai Saloon

このファイルは Claude Code がプロジェクトのコンテキストを把握するためのガイドです。

## プロジェクト概要

Slack スラッシュコマンドで打刻し、Web ダッシュボードで勤怠記録を確認する勤怠管理アプリ。
西部劇（ウエスタン）テーマの UI。

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router, Turbopack)
- **言語**: TypeScript (strict mode)
- **スタイリング**: Tailwind CSS v4 + shadcn/ui
- **DB / 認証**: Supabase (PostgreSQL, Auth, RLS)
- **認証方式**: Slack OIDC (`slack_oidc` プロバイダー)
- **デプロイ先**: Vercel

## よく使うコマンド

```bash
npm run dev      # 開発サーバー起動 (Turbopack)
npm run build    # プロダクションビルド
npm run start    # プロダクションサーバー起動
npm run lint     # ESLint 実行
```

## プロジェクト構造

- `app/` — Next.js App Router のページ・API ルート
  - `api/slack/route.ts` — Slack スラッシュコマンドの受信エンドポイント
  - `auth/callback/route.ts` — OAuth コールバック処理
  - `dashboard/` — ユーザー用・管理者用ダッシュボード
- `components/` — React コンポーネント (shadcn/ui は `components/ui/`)
- `lib/supabase/` — Supabase クライアント (browser / server / admin の 3 種)
- `lib/slack/` — Slack 署名検証ロジック
- `lib/types.ts` — 共通の TypeScript 型定義
- `supabase/migrations/` — データベースマイグレーション SQL
- `middleware.ts` — 認証ミドルウェア (`/dashboard/*` を保護)
- `docs/` — ドキュメント類

## 重要なアーキテクチャ決定

### Supabase クライアント 3 種の使い分け

| クライアント | ファイル | 用途 | RLS |
|---|---|---|---|
| Browser | `lib/supabase/client.ts` | クライアントコンポーネント | 有効 |
| Server | `lib/supabase/server.ts` | サーバーコンポーネント / Route Handler | 有効 |
| Admin | `lib/supabase/admin.ts` | Slack webhook / Auth callback | バイパス |

### タイムゾーン

- DB には UTC で保存
- 業務日付の算出は JST (`Asia/Tokyo`) で行う
- `toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })` で `YYYY-MM-DD` 形式を取得

### Slack コマンド処理フロー

1. `req.text()` で生の body を取得（署名検証に必要）
2. HMAC-SHA256 で署名検証 (`lib/slack/verify.ts`)
3. `URLSearchParams` で body をパース
4. `slack_user_id` で `users` テーブルを検索
5. `punch_records` テーブルに upsert / update

### 認証フロー

1. ユーザーが「Sign in with Slack」をクリック
2. Supabase Auth が Slack OIDC へリダイレクト
3. `/auth/callback` で `exchangeCodeForSession` を実行
4. `user.identities` から `slack_user_id` を抽出
5. admin client で `public.users` に upsert
6. `/dashboard` へリダイレクト

### RLS ポリシー

- `users` / `punch_records`: SELECT は自分 + 管理者のみ
- INSERT / UPDATE ポリシーなし → admin client (service_role) のみ書き込み可
- `is_admin()` 関数は `SECURITY DEFINER` で RLS 再帰を回避

## コーディング規約

- コンポーネントは関数コンポーネント + TypeScript
- サーバーコンポーネントを優先し、インタラクティブな部分のみ `"use client"`
- 状態管理は URL search params (`?month=YYYY-MM`) で行う
- スタイルは Tailwind CSS ユーティリティクラスを使用
- 西部劇テーマ: フォントは Rye (見出し) + Courier Prime (本文)
- 日本語 UI テキスト、Slack レスポンスは西部劇口調

## 進捗管理

- **進捗状況は `docs/setup-guide.md` の「進行状況」テーブルに記載**
- 会話の最後に必ず進捗テーブルを最新の状態に更新すること
- 現在の次ステップ: 手順 9（ローカル動作確認）進行中

## 環境変数

`.env.local` に設定（`.env.example` を参照）:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase プロジェクト URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (公開可)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (秘密)
- `SLACK_SIGNING_SECRET` — Slack App の Signing Secret (秘密)
