# 環境構築手順書

このドキュメントでは、The Kintai Saloon を動作させるために必要な環境構築手順をすべて記載しています。

---

## 進行状況

| # | 作業項目 | ステータス | 備考 |
|---|---------|-----------|------|
| 1 | プロジェクトスキャフォールド | ✅ 完了 | Next.js 16 + Tailwind + shadcn/ui |
| 2 | アプリケーションコード実装 | ✅ 完了 | 全ページ・API・コンポーネント実装済み |
| 3 | ビルド確認 | ✅ 完了 | `npm run build` 成功 |
| 4 | Supabase プロジェクト作成 | ✅ 完了 | 下記手順を参照 |
| 5 | Supabase データベースマイグレーション | ✅ 完了 | SQL を実行する |
| 6 | Supabase Auth に Slack OIDC を設定 | ✅ 完了 | Slack App の作成が先 |
| 7 | Slack App 作成 | ✅ 完了 | `/punch` コマンドの設定 |
| 8 | 環境変数の設定 (.env.local) | ✅ 完了 | 4〜7 の情報が必要 |
| 9 | ローカル動作確認 | ✅ 完了 | ログイン・打刻・ダッシュボード |
| 10 | Vercel デプロイ | ⬜ 未着手 | GitHub 連携 + 環境変数 |
| 11 | 本番 URL を Slack App に反映 | ⬜ 未着手 | Vercel の本番ドメイン |
| 12 | 管理者ユーザー設定 | ⬜ 未着手 | SQL で is_admin=true に変更 |

---

## 前提条件

- **Node.js**: v20 以上
- **npm**: v10 以上
- **ブラウザ**: Chrome / Firefox / Safari（モダンブラウザ）
- **アカウント**:
  - [Supabase](https://supabase.com/) アカウント（無料プランで可）
  - [Slack](https://slack.com/) ワークスペースの管理者権限
  - [Vercel](https://vercel.com/) アカウント（デプロイ時に必要、無料プランで可）
  - [GitHub](https://github.com/) アカウント（Vercel 連携に必要）

---

## 手順 4: Supabase プロジェクト作成

### 4-1. Supabase にサインアップ / ログイン

1. https://supabase.com/ にアクセス
2. 「Start your project」または「Sign In」をクリック
3. GitHub アカウントでログイン（推奨）

### 4-2. 新規プロジェクトを作成

1. ダッシュボードの「New Project」をクリック
2. 以下を入力:
   - **Project name**: `kintai-saloon`（任意の名前）
   - **Database Password**: 強力なパスワードを設定（後で使わないがメモしておく）
   - **Region**: `Northeast Asia (Tokyo)` を選択（日本に近いリージョン）
   - **Pricing Plan**: Free を選択
3. 「Create new project」をクリック
4. プロジェクトの作成完了まで 1〜2 分待つ

### 4-3. API キーをメモ

プロジェクト作成後、以下の値をメモしておきます（後で `.env.local` に設定します）:

1. 左サイドバーの **⚙️ Project Settings** → **API** を開く
2. 以下の値をコピー:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` に使用
     - 例: `https://abcdefghijklmnop.supabase.co`
   - **anon (public) key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY` に使用
     - 「Project API keys」セクションの `anon` `public` と書かれたキー
   - **service_role (secret) key** → `SUPABASE_SERVICE_ROLE_KEY` に使用
     - 「Project API keys」セクションの `service_role` `secret` と書かれたキー
     - ⚠️ **このキーは絶対に公開しないでください**（RLS をバイパスします）

> 参考: [Supabase Docs — API Settings](https://supabase.com/docs/guides/api)

---

## 手順 5: Supabase データベースマイグレーション

### 5-1. SQL Editor を開く

1. Supabase ダッシュボードの左サイドバーで **SQL Editor** をクリック
2. 「New query」をクリック

### 5-2. マイグレーション SQL を実行

1. プロジェクトの `supabase/migrations/001_initial.sql` の内容をすべてコピー
2. SQL Editor に貼り付け
3. **「Run」** ボタン（または `Ctrl+Enter` / `Cmd+Enter`）をクリック
4. 「Success. No rows returned」と表示されれば成功

### 5-3. テーブルの確認

1. 左サイドバーの **Table Editor** をクリック
2. 以下の 2 テーブルが作成されていることを確認:
   - `users` — カラム: id, slack_user_id, display_name, is_admin, created_at
   - `punch_records` — カラム: id, user_id, date, punch_in, punch_out, created_at

### 5-4. RLS の確認

1. 左サイドバーの **Authentication** → **Policies** をクリック
2. `users` テーブルと `punch_records` テーブルそれぞれに SELECT ポリシーが設定されていることを確認

> 参考: [Supabase Docs — Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)

---

## 手順 6: Supabase Auth に Slack OIDC を設定

> ⚠️ この手順は「手順 7: Slack App 作成」で取得する Client ID / Client Secret が必要です。
> 先に手順 7 を完了してから戻ってきてください。

### 6-1. Supabase で Slack (OIDC) プロバイダーを有効化

1. Supabase ダッシュボードの左サイドバーで **Authentication** をクリック
2. **Configuration** セクションの **Providers** をクリック
3. プロバイダー一覧から **Slack (OIDC)** を見つけてクリック（展開される）
   - ⚠️ 「Slack」ではなく **「Slack (OIDC)」** を選んでください。旧 Slack プロバイダーは非推奨です。
4. **Enable Slack (OIDC) provider** のトグルをオンにする
5. 以下を入力:
   - **Client ID**: 手順 7-3 でコピーした Slack App の Client ID
   - **Client Secret**: 手順 7-3 でコピーした Slack App の Client Secret
6. **Callback URL (for OAuth)** の値をコピーしておく
   - 形式: `https://<project-ref>.supabase.co/auth/v1/callback`
   - この値は手順 7-4 で Slack App に設定します
7. **Save** をクリック

> 参考: [Supabase Docs — Login with Slack](https://supabase.com/docs/guides/auth/social-login/auth-slack)

---

## 手順 7: Slack App 作成

### 7-1. Slack App を新規作成

1. https://api.slack.com/apps にアクセス
2. **「Create New App」** をクリック
3. **「From scratch」** を選択
4. 以下を入力:
   - **App Name**: `Kintai Saloon`（任意の名前）
   - **Pick a workspace**: 打刻を使いたい Slack ワークスペースを選択
5. **「Create App」** をクリック

### 7-2. Signing Secret をコピー

1. 作成した App の **Basic Information** ページが表示される
2. **App Credentials** セクションの **Signing Secret** の **「Show」** をクリック
3. 表示された値をコピー → `SLACK_SIGNING_SECRET` に使用
   - ⚠️ この値は秘密にしてください

### 7-3. OAuth の Client ID / Client Secret をコピー

1. 同じ **Basic Information** ページの **App Credentials** セクションで:
   - **Client ID** をコピー → 手順 6-1 で使用
   - **Client Secret** の **「Show」** → 表示された値をコピー → 手順 6-1 で使用

### 7-4. OAuth & Permissions の設定

1. 左サイドバーの **OAuth & Permissions** をクリック
2. **Redirect URLs** セクションで:
   - **「Add New Redirect URL」** をクリック
   - 手順 6-1 でコピーした Supabase の Callback URL を貼り付け
     - 例: `https://abcdefghijklmnop.supabase.co/auth/v1/callback`
   - **「Add」** → **「Save URLs」** をクリック
3. **User Token Scopes** セクションまでスクロール
4. 以下の 3 つのスコープを追加:
   - `openid`
   - `profile`
   - `email`
   - ⚠️ **他のスコープは追加しないでください**（Sign In With Slack はこの 3 つのみサポート）

### 7-5. スラッシュコマンドの作成

1. 左サイドバーの **Slash Commands** をクリック
2. **「Create New Command」** をクリック
3. 以下を入力:
   - **Command**: `/punch`
   - **Request URL**: `https://<your-domain>/api/slack`
     - ローカル開発中の場合: 一旦ダミーの URL (例: `https://example.com/api/slack`) を入力
     - Vercel デプロイ後に本番 URL に更新します（手順 11）
   - **Short Description**: `出勤・退勤を記録`
   - **Usage Hint**: `in または out`
4. **「Save」** をクリック

### 7-6. App をワークスペースにインストール

1. 左サイドバーの **Install App** をクリック
2. **「Install to Workspace」** をクリック
3. 権限の確認画面で **「許可する」** をクリック

> 参考:
> - [Slack Docs — Implementing slash commands](https://docs.slack.dev/interactivity/implementing-slash-commands/)
> - [Slack — Verifying requests from Slack](https://api.slack.com/authentication/verifying-requests-from-slack)

---

## 手順 8: 環境変数の設定 (.env.local)

### 8-1. .env.local ファイルを作成

```bash
cp .env.example .env.local
```

### 8-2. 値を入力

`.env.local` をテキストエディタで開き、手順 4〜7 で取得した値を入力します:

```env
# Supabase（手順 4-3 で取得）
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role Key（手順 4-3 で取得、秘密）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Slack Signing Secret（手順 7-2 で取得、秘密）
SLACK_SIGNING_SECRET=abc123def456...
```

> ⚠️ `.env.local` は `.gitignore` に含まれているため、Git にコミットされません。
> 値を他の場所に安全にバックアップしておくことを推奨します。

---

## 手順 9: ローカル動作確認

### 9-1. 開発サーバーの起動

```bash
npm run dev
```

ターミナルに以下のように表示されます:

```
▲ Next.js 16.x.x (Turbopack)
- Local:        http://localhost:3000
```

### 9-2. ランディングページの確認

1. ブラウザで http://localhost:3000 を開く
2. 「🤠 The Kintai Saloon」のタイトルと「Sign in with Slack」ボタンが表示されることを確認

### 9-3. Slack ログインの確認

1. 「Sign in with Slack」ボタンをクリック
2. Slack の認証画面にリダイレクトされる
3. 「許可する」をクリック
4. `/dashboard` にリダイレクトされ、月別の勤怠テーブルが表示されることを確認
5. ヘッダーに自分の表示名が表示されていることを確認

### 9-4. Slack コマンドの確認（ローカル環境）

ローカルで Slack コマンドをテストするには、ngrok や Cloudflare Tunnel などのトンネルツールが必要です:

```bash
# ngrok を使う場合
npx ngrok http 3000
```

1. 表示された HTTPS URL をコピー（例: `https://xxxx-xxxx.ngrok-free.app`）
2. Slack App の Slash Commands 設定で Request URL を更新:
   - `https://xxxx-xxxx.ngrok-free.app/api/slack`
3. Slack で以下を実行:
   ```
   /punch in
   ```
   → 「🤠 よう、相棒！出勤を記録したぜ！」と表示される
4. ダッシュボード（ブラウザ）をリロードし、今日の出勤時間が表示されることを確認
5. Slack で以下を実行:
   ```
   /punch out
   ```
   → 「🤠 お疲れさん、カウボーイ！退勤を記録したぜ！」と表示される
6. ダッシュボードをリロードし、退勤時間と勤務時間が表示されることを確認

---

## 手順 10: Vercel デプロイ

### 10-1. GitHub リポジトリを作成

```bash
git init
git add -A
git commit -m "Initial commit: The Kintai Saloon MVP"
```

GitHub でリポジトリを新規作成し、プッシュします:

```bash
git remote add origin https://github.com/<your-username>/slack-kintai.git
git branch -M main
git push -u origin main
```

### 10-2. Vercel にインポート

1. https://vercel.com/new にアクセス
2. **「Import Git Repository」** で先ほど作成した GitHub リポジトリを選択
3. **Framework Preset** が「Next.js」になっていることを確認

### 10-3. 環境変数を設定

デプロイ画面の **Environment Variables** セクションで、以下の 4 つを追加:

| Name | Value | 備考 |
|------|-------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | 手順 4-3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | 手順 4-3 |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | 手順 4-3 |
| `SLACK_SIGNING_SECRET` | `abc123...` | 手順 7-2 |

### 10-4. デプロイ

1. **「Deploy」** をクリック
2. ビルドが完了するまで待つ（通常 1〜2 分）
3. 表示された本番 URL をメモ（例: `https://slack-kintai.vercel.app`）

> 参考:
> - [Vercel Docs — Environment Variables](https://vercel.com/docs/environment-variables)
> - [Next.js Deployment Guide](https://nextjs.org/docs/app/building-your-application/deploying)

---

## 手順 11: 本番 URL を Slack App に反映

### 11-1. スラッシュコマンドの Request URL を更新

1. https://api.slack.com/apps にアクセスし、作成した App を選択
2. 左サイドバーの **Slash Commands** をクリック
3. `/punch` コマンドの鉛筆アイコン（編集）をクリック
4. **Request URL** を Vercel の本番 URL に更新:
   - `https://slack-kintai.vercel.app/api/slack`
5. **「Save」** をクリック

### 11-2. OAuth Redirect URL の確認

1. 左サイドバーの **OAuth & Permissions** をクリック
2. **Redirect URLs** に Supabase の Callback URL が設定されていることを確認
   - Vercel の URL ではなく、Supabase の `https://<project-ref>.supabase.co/auth/v1/callback` が正しい
   - （OAuth のリダイレクトは Supabase Auth が処理するため）

---

## 手順 12: 管理者ユーザー設定

### 12-1. 自分の Slack User ID を確認

1. Slack アプリで自分のプロフィールを開く
2. **「⋯」（その他）** → **「メンバー ID をコピー」** をクリック
   - 例: `U01ABCDEFGH`

### 12-2. 管理者フラグを設定

1. Supabase ダッシュボードの **SQL Editor** を開く
2. 以下の SQL を実行（`U01ABCDEFGH` は自分の Slack User ID に置き換え）:

```sql
UPDATE users SET is_admin = true WHERE slack_user_id = 'U01ABCDEFGH';
```

3. 「Success. 1 row affected」と表示されれば成功

### 12-3. 管理者ページの確認

1. Web アプリにログインした状態で http://localhost:3000/dashboard/admin（またはVercelの本番URL）にアクセス
2. ヘッダーに「管理者ページ」リンクが表示されていることを確認
3. 全ユーザーの打刻記録が表示されることを確認

---

## トラブルシューティング

### ログインボタンを押しても何も起きない

- `.env.local` の `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が正しいか確認
- Supabase ダッシュボードで Slack (OIDC) プロバイダーが有効になっているか確認
- ブラウザの開発者ツール (Console) でエラーメッセージを確認

### Slack ログイン後にエラーページが表示される

- Slack App の OAuth & Permissions → Redirect URLs に Supabase の Callback URL が設定されているか確認
  - 正しい形式: `https://<project-ref>.supabase.co/auth/v1/callback`
- Supabase の Slack (OIDC) プロバイダーの Client ID / Client Secret が正しいか確認

### `/punch in` で「まずサルーンで登録しな！」と表示される

- Web アプリから一度ログインする必要があります（初回ログイン時に `users` テーブルにレコードが作成されます）

### `/punch in` で「dispatch_failed」と表示される

- Slack App の Slash Commands → Request URL が正しいか確認
- ローカル開発の場合: ngrok などのトンネルが起動しているか確認
- Vercel デプロイの場合: 本番 URL が正しいか確認

### 管理者ページにアクセスできない

- `users` テーブルの `is_admin` が `true` に設定されているか確認
- ログアウトしてから再度ログインしてみる

---

## 参考リンク

- [Supabase Docs — Login with Slack](https://supabase.com/docs/guides/auth/social-login/auth-slack)
- [Supabase Docs — Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Slack Docs — Implementing slash commands](https://docs.slack.dev/interactivity/implementing-slash-commands/)
- [Slack — Verifying requests from Slack](https://api.slack.com/authentication/verifying-requests-from-slack)
- [Vercel Docs — Environment Variables](https://vercel.com/docs/environment-variables)
- [Next.js Deployment Guide](https://nextjs.org/docs/app/building-your-application/deploying)
