# The Kintai Saloon 🤠

Slack のスラッシュコマンド (`/punch in` / `/punch out`) で打刻し、Web ダッシュボードで勤怠記録を確認できる勤怠管理アプリです。西部劇（ウエスタン）テーマの UI が特徴です。

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | [Next.js](https://nextjs.org/) 16 (App Router, Turbopack) |
| 言語 | TypeScript |
| スタイリング | [Tailwind CSS](https://tailwindcss.com/) v4 + [shadcn/ui](https://ui.shadcn.com/) |
| バックエンド / DB | [Supabase](https://supabase.com/) (PostgreSQL, Auth, RLS) |
| 認証 | Slack OIDC (Supabase Auth 経由) |
| デプロイ | [Vercel](https://vercel.com/) |

## 主な機能

- **Slack スラッシュコマンド打刻** — `/punch in` で出勤、`/punch out` で退勤を記録
- **Web ダッシュボード** — 月別の打刻記録を帳簿風テーブルで表示
- **管理者ページ** — 全ユーザーの打刻記録を一覧表示・ユーザーフィルター付き
- **RLS (Row Level Security)** — ユーザーは自分の記録のみ閲覧可能、管理者は全員分を閲覧可能
- **JST 対応** — 日付はすべて日本時間 (Asia/Tokyo) で算出

## プロジェクト構成

```
.
├── app/
│   ├── api/slack/route.ts        # Slack スラッシュコマンド受信エンドポイント
│   ├── auth/callback/route.ts    # OAuth コールバック
│   ├── dashboard/
│   │   ├── page.tsx              # ユーザー用ダッシュボード
│   │   ├── admin/page.tsx        # 管理者用ページ
│   │   └── layout.tsx            # ダッシュボード共通レイアウト
│   ├── layout.tsx                # ルートレイアウト
│   ├── page.tsx                  # ランディングページ（ログイン）
│   └── globals.css               # 西部劇テーマのカラーパレット
├── components/
│   ├── ui/                       # shadcn/ui コンポーネント
│   ├── header.tsx                # ヘッダー（ナビゲーション）
│   ├── login-button.tsx          # Slack ログインボタン
│   ├── sign-out-button.tsx       # サインアウトボタン
│   ├── month-selector.tsx        # 月選択コンポーネント
│   ├── attendance-table.tsx      # 勤怠テーブル
│   └── admin-user-filter.tsx     # 管理者用ユーザーフィルター
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # ブラウザ用 Supabase クライアント
│   │   ├── server.ts             # サーバー用 Supabase クライアント
│   │   └── admin.ts              # 管理用 Supabase クライアント (service_role)
│   ├── slack/
│   │   └── verify.ts             # Slack 署名検証
│   └── types.ts                  # TypeScript 型定義
├── supabase/
│   └── migrations/
│       └── 001_initial.sql       # データベーススキーマ
├── docs/
│   └── setup-guide.md            # 環境構築手順書
└── middleware.ts                  # 認証ミドルウェア
```

## クイックスタート

### 前提条件

- Node.js 20 以上
- npm
- Supabase アカウント
- Slack ワークスペースの管理者権限

### セットアップ

詳細な手順は [`docs/setup-guide.md`](docs/setup-guide.md) を参照してください。

```bash
# 依存関係インストール
npm install

# 環境変数を設定
cp .env.example .env.local
# .env.local を編集して各値を入力

# 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

### Slack コマンドの使い方

```
/punch in   — 出勤打刻
/punch out  — 退勤打刻
```

### 管理者の設定

Supabase の SQL Editor で以下を実行します:

```sql
UPDATE users SET is_admin = true WHERE slack_user_id = 'U01XXXXXXXX';
```

## アーキテクチャの要点

- **Supabase クライアント 3 種**: browser (RLS有効) / server (RLS有効 + cookies) / admin (RLS バイパス)
- **OAuth プロバイダー名**: `slack_oidc`（`slack` ではない）
- **タイムゾーン**: DB は UTC 保存、業務日付は JST (`Asia/Tokyo`) で算出
- **状態管理**: URL の search params (`?month=YYYY-MM`) を使用、クライアント側データフェッチ不要
- **Slack ボディ解析**: 署名検証のため `req.text()` → `URLSearchParams` の順序で処理

## ライセンス

Private
