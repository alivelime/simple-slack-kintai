# トリプルレビュー報告書 (03_triple) — 発散のまま人間判断へ

## メタ情報
- レビュー種別: トリプルレビュー (3体 × 異流派 × 合意未達)
- レビュアー:
  - **stylist** (スタイル警察) — 命名 / 一貫性 / コメント密度 / 西部劇口調
  - **type-hawk** (型の鷹) — TypeScript 型安全性 / マイクロ最適化 / メモリ
  - **test-nitpicker** (テストの亡霊) — テスト網羅性 / 境界値 / エッジケース
- 結果: **合意に至らず**。最終判断はユーザーに委譲する。
- 備考: メインエージェントは "判事" として動かない。発散をそのまま並置する。

## 対象機能 (report/00_internal.md より引用)

> Slack の `/punch out` を日跨ぎでも使えるようにする。23:50 に出勤して翌 00:30 に退勤しても、「まだ出勤してない」と弾かれず、出勤側の業務日 (= 前日) に退勤時刻が記録されるようにする。

主な変更:
- `MAX_OPEN_PUNCH_HOURS = 36` を追加 (退勤忘れの暴発防止)
- `out` ブランチを「今日の `date` を探す」方式から「全期間から `punch_out IS NULL` の最新を 1 件取る」方式へ
- `out` の二重退勤メッセージのため `closedToday` 追加クエリを実装
- `in` 側にも未退勤 punch チェックを追加
- 日跨ぎ時は `YYYY-MM-DD の勤務` と業務日を明示

## 3者の立場サマリ

| 観点 | stylist | type-hawk | test-nitpicker |
|---|---|---|---|
| 流派 | スタイル / 命名 / 表現 | 型安全 / マイクロ最適 | テスト網羅 / エッジケース |
| 最終判定 | `request_changes` | `request_changes` | **`block`** |
| 譲れない点の数 | 4 | 2 | 5 |
| ピアとの合意度 | partial | **none** | **none** |
| 流派優先度の主張 | 「動いてもラベルが嘘なら美意識として許せない」 | 「DB 境界が any のままだと型は守ってない」 | 「テストが 0 件の議論はそもそも前提が崩れている」 |

## 3者が挙げた指摘 (流派別・そのまま併記)

### stylist (スタイル警察) が譲らない点

- **`jstNow()` の命名の嘘** (route.ts:9-11): 中身は `new Date().toISOString()` で UTC ISO 文字列を返しているのに、名前が JST を匂わせる。`jstToday()` と並んで頻出するため読み手のミスリードを増幅している。リネーム (`nowIsoUtc()` / `nowIso()`) または実装を JST に揃える必要あり。
- **西部劇口調にトーン統一規範が無い**: 「相棒」「カウボーイ」「おっと」「おいおい」「おやおや」「おかしいぞ」「待ちな」が並列。同じ意味の不正系で文頭が 5 種類ブレている。「歓迎」「軽い注意」「却下」「ねぎらい」の 4 トーンに整理し、`lib/slack/messages.ts` のような場所で 1 箇所管理すべき。今のままでは「西部劇テーマ」ではなく「西部劇単語の散弾銃」。
- **コメントの言語混在**: route.ts:36 の英語コメント `// Look up user by slack_user_id` だけが残置され、追加コメントは全部日本語。CLAUDE.md の日本語 UI 指針と矛盾。
- **WHAT を語る冗長コメント**: route.ts:70 / 144 / 176 はコードを読めば分かる WHAT。残すなら WHY (なぜ全期間スキャンか / なぜ 36h か) に書き換えるべき。
- (補足) ユーザー文言の重複 (`管理者に相談しな！` が 4 回など)、マジック文字列 `'in'`/`'out'`、生の `1000*60*60`、`'Asia/Tokyo'`/`'ja-JP'`/`'en-CA'` の直書きを `lib/time.ts` などに集約すべき。

### type-hawk (型の鷹) が譲らない点

- **Supabase クライアントが `<Database>` ジェネリクス無し** (lib/supabase/admin.ts): `createAdminClient()` の戻りが `SupabaseClient<any, ...>` 相当になり、route.ts の `openPunch` は実態として `any`。strict mode を名乗りながら DB 境界が `any` なのは strict の看板倒れ。`supabase gen types typescript` で `Database` 型を生成するか、最低 `.returns<{ id: string; date: string; punch_in: string | null }>()` を全クエリに付ける必要あり。
- **out の update が race に対して無防備**: `.is('punch_out', null)` を WHERE に持たないため、同時実行で後勝ち上書きが発生する。`.eq('id', openPunch.id).is('punch_out', null)` を足すだけで楽観ロック相当になり、affected rows = 0 を 409 として返せる。**これだけは型云々の前に挙動の正しさの問題**。
- (補足) narrow 後の再アクセスで narrowing を捨てている (route.ts:65-66, 117, 145)、`new Date(now)` の重複アロケーション (route.ts:51, 146)、out が 2 ラウンドトリップ (1 クエリで limit 2 にすべき)、Intl.DateTimeFormat のモジュールスコープキャッシュ欠如、`type SlackResponse` の不在、など。

### test-nitpicker (テストの亡霊) が譲らない点

- **テストが 0 件**: `*.test.*` / `*.spec.*` で 0 ヒット、`package.json` に test スクリプトも jest/vitest 依存も無い。route.ts の 11 分岐 (in 3 / out 5 / 未知 / 未登録 / 署名失敗) を仕込んだのに自動回帰がゼロ。
- **「前日 in / 今日 out 済み + 翌日 3 度目 out」で誤メッセージが出るリグレッション**: closedToday は `today` で探すが、レコードの `date` は前日のままなので翌日になるとヒットしない。openPunch=null かつ closedToday=null となり「まだ出勤してない」が誤表示される。**self-review でも他 reviewer でも気付かれていない実バグ**。
- **境界値テスト 4 ケース**: 23:59:59.999 JST in / 00:00:00.000 JST in / 36h ちょうど / 36h+1ms。仕様の境界が実行可能な形で固定されていない。
- **race condition の検証も防御も無い**: `/punch out` 2 連打、`/punch in` を 23:59:59 と 00:00:00 で同時投入すると 2 行が別 date で作られて両方 open のまま残る。
- **`UNIQUE(user_id, date)` 制約の存在確認**: `upsert(onConflict: 'user_id,date')` の前提が口約束のまま。マイグレーションに SQL があるか SQL を PR に貼って明示すべき。
- (補足) 閏日 / 月末 / 年末の日跨ぎ、`maybeSingle()` で同 date 複数行 → PGRST116、Supabase JS の date 型シリアライズ仕様、署名検証失敗 / replay attack、全角ＩＮ / `'in 13:00'` の入力サニタイズ、未登録ユーザー、`Math.floor(NaN)` / 未来時刻、など。

## 対立の構造

### stylist ↔ type-hawk
- stylist: 「`jstNow()` の命名は嘘で気持ち悪い」
- type-hawk: 「命名の嘘は型じゃなく慣習の問題で守備範囲外。型が `any` のままだと文言を直しても壊れている方が深刻」
- → スタイル流派は「読んで意味が通ること」、型流派は「型で挙動を強制すること」を優先。両者は重ならず合成不能。

### type-hawk ↔ test-nitpicker
- type-hawk: 「テストを書いても DB 境界が `any` なら何をテストしても通る。型の固定が先」
- test-nitpicker: 「型は退却した防衛線、テストは前線の歩哨。両方要る。`new Date(now)` のアロケーション削減や branded type は完全に nice to have」
- → race condition の防ぎ方で唯一交錯する。type-hawk は「WHERE 句一行で殺す」、test-nitpicker は「殺したならその効果をテストで証明しろ」。**部分合意あり (どちらも optimistic lock の必要性を認める) が、優先順位は逆**。

### stylist ↔ test-nitpicker
- stylist: 「文言の正確性 (= 前日 closed 時の誤メッセージ) はスタイル管轄でもあるので合流できる」
- test-nitpicker: 「命名や西部劇口調の議論は全部後回し。今はラベルの色を議論している場合ではない」
- → test-nitpicker は stylist の「文言の外出し」だけテスト容易性の観点で部分同意。それ以外は「全部 nice to have」と切り捨て。

## 合意できた点 (あれば)

- **唯一に近い合流点**: `out` の race を `.is('punch_out', null)` で殺すという施策は type-hawk が指摘し、test-nitpicker が「採用するならテストでも証明しろ」と部分同意。stylist は守備範囲外として干渉せず尊重。
- **ユーザー文言の `lib/slack/messages.ts` 外出し**: stylist の non_negotiable で、test-nitpicker が「テスト容易性の観点で部分同意」と唯一明示同意したスタイル系の改善。
- それ以外は **流派が違うため合成不能**。

## ⚠️ ユーザーへの判断委譲

以下の論点について、どの立場を採用するか **ユーザー自身が選んでください**。メインエージェントは判事として裁定しません。

### 論点 1 — 何を merge ブロッカーとするか?
- **stylist**: 「命名 (`jstNow`) と文言外出しを直さない限り approve しない」
- **type-hawk**: 「Database ジェネリクスと `.is('punch_out', null)` を直さない限り approve しない」
- **test-nitpicker**: 「テストが 0 件 + 前日 closed リグレッションが残る限り **block**」

→ どの流派の non_negotiable を「真の merge ブロッカー」として採用しますか? 全部か、優先順位を付けるか、特定の 1〜2 流派を選ぶか。

### 論点 2 — テスト導入のスコープ判断
- **stylist**: 「テスト 0 件はプロジェクト既存事実。今回の PR の責任ではない」
- **type-hawk**: 「テスト追加より型の固定が先」
- **test-nitpicker**: 「vitest 導入 + 11 分岐網羅 + 境界値 4 ケース + race 検証は **本 PR で必須**」

→ vitest 導入をこの PR に含めますか? それとも別 PR / フォロー Issue として切り出しますか?

### 論点 3 — `closedToday` リグレッション (前日 closed + 翌日 3 度目 out)
- test-nitpicker のみが指摘。**他 2 reviewer と self-review は見落とし**。
- 「openPunch=null かつ closedToday=null (= 前日 close 済みで翌日になっている) のときに『まだ出勤してない』と誤表示する」
- → これを実バグとして本 PR で直しますか? それとも別チケットに切り出しますか?

### 論点 4 — race condition の扱い
- **type-hawk**: WHERE 句一行 (`.is('punch_out', null)`) で楽観ロック相当を入れる
- **test-nitpicker**: 楽観ロックを入れるなら効果をテストで証明する。in 側の `23:59:59 vs 00:00:00` 同時実行による 2 行作成も検証
- **stylist**: 干渉せず尊重 (守備範囲外)

→ 楽観ロックのみ入れますか? + テスト検証もしますか? + UNIQUE 制約確認も?

### 論点 5 — 命名の嘘 (`jstNow()`)
- stylist のみがリネームを強く主張。type-hawk は「リネームに同意するとしても、UTC を返すと比較時に時差バグを生むという型由来の理由で」と条件付き同意。test-nitpicker は「全部後回し」。
- → リネームしますか? `nowIsoUtc()` / `nowIso()` / その他?

### 論点 6 — 西部劇口調のトーン統一
- stylist のみが強く主張 (4 トーン化 + `lib/slack/messages.ts` 外出し)。
- → ブランドの一貫性として直しますか? それともプロダクトとして「動けば良い」と判断しますか?

各論点への回答で、最終的な merge 可否と作業順序を決定してください。

## 教訓メモ (YouTube用)

- **3体それぞれに流派があり、合成できない重箱の隅があった**: 命名の嘘 / 型の `any` / テスト 0 件は、それぞれ別の世界観の中で「これさえ直せば良い」と語られている。重ねると「全部直せ」になり結局スコープが膨張する。
- **レビュアー数を増やしても "意思決定コストが人間に戻る"**: 合意に至らないので、本 PR を通すかどうかは結局ユーザーの判断に戻ってきた。レビュー結果が増えただけで、判断自体は減らなかった。
- **唯一の本物のバグ (前日 closed リグレッション) は最も狭い流派 (テスト) でしか発見されなかった**: 流派が広い (= 関心が抽象的) だと具体的なリグレッションは見えにくい。test-nitpicker のような「狭くて深い」レビュアーは外せない一方、その独断 (= block) を採用するかは別判断。
- **2 体クロスレビュー (`/cross-review`) との差**: クロスは合意形成型、トリプルは発散維持型。レビュアーを 1 人増やしただけで、合意のコストが指数的に上がる。
- **AI 駆動開発でも「人間の判断点」を残す必然性**: 流派の優先順位という価値判断は、レビュアーをいくら積んでも自動化できない。
