# クロスレビュー報告書 (02_cross)

## メタ情報
- レビュー種別: クロスレビュー (別コンテキスト × 2体 × 相互レビュー)
- レビュアー: reviewer-alpha, reviewer-beta
- フロー: 独立レビュー (フェーズ1) → 相互開示 (SendMessage) → 合意形成 (フェーズ2) → メインで統合
- 合意ラウンド数: 1
- 最終 merge 判定 (両者一致): **request_changes**

## 対象機能
> Slack の `/punch out` を日跨ぎでも使えるようにする。23:50 に出勤して翌 00:30 に退勤しても、「まだ出勤してない」と弾かれず、出勤側の業務日 (= 前日) に退勤時刻が記録されるようにする。
> (report/00_internal.md より引用)

---

## 両者が合意した指摘 (信頼度: 高)

### 🔴 Major

| # | area | detail | 起点 |
|---|---|---|---|
| C1 | `app/api/slack/route.ts:117-142` (out / `closedToday` の日付境界バグ) | 二重退勤メッセージ用の `closedToday` が `eq('date', today)` 限定。**日跨ぎで前日 in / 前日 out 済の状態で 00:10 過ぎに `/punch out` 追い打ちが来ると `closedToday` は空になり、「まだ出勤してない」というミスリード案内が返る**。本機能の趣旨 (日跨ぎを救う) と矛盾。`closedToday` を最新 closed punch を全期間検索 + 直近 24h 判定に変えるか、「最新 punch (open/closed 問わず) を 1 件取り状態判定する」方式に再設計する。 | alpha → beta 全面同意 |
| C2 | `app/api/slack/route.ts` (in 分岐 / UX デッドエンド) | `in` で全期間 open punch を検知したら「先に out しろ」と返すが、その open punch が **36h 超過なら out 側でも弾かれユーザーが自力復帰不能**。`in` 側でも `MAX_OPEN_PUNCH_HOURS` 超過なら管理者誘導 (もしくは強制 close + 新規 in) に分岐すべき。 | beta → alpha 全面同意 |
| C3 | `app/api/slack/route.ts:107-167` (race condition / 並行 `/punch out`) | open punch を `select → update by id` の 2 ステップで処理しているため、同時実行で同一 id が二重 close される余地がある。**`update ... where id = ? and punch_out is null` の条件付き update + affected rows = 0 を二重退勤として扱う 1 クエリ方式に統一すべき**。`/punch in` 側も UNIQUE(user_id, date) 違反時の汎用エラーを二重出勤メッセージにマップしたい。 | 両者独立に指摘 |
| C4 | 要件 / docs 反映 (業務日定義 + 36h 値 + 1 日 1 セッション制約) | (a)「業務日 = 出勤日」前提が docs / CLAUDE.md に明記されていない、(b) `MAX_OPEN_PUNCH_HOURS = 36` がプロダクト合意値か不明 (深夜+仮眠で 24h 超のケース)、(c) UNIQUE(user_id, date) は中抜け 2 セッション要件のブロッカー。**3 点まとめて方針を docs に明文化し、env 化できる箇所 (36h) は env 化する**。 | 両者独立に指摘 |

### 🟡 Minor

| # | area | detail | 起点 |
|---|---|---|---|
| C5 | 退勤完了文言に出勤 HH:mm 併記 | 日跨ぎ時 `${openPunch.date} の勤務` のみだと「どの打刻に対する退勤か」が不明瞭。`openPunch.punch_in` は手元にあるので HH:mm を併記する。00_internal でも著者自身が言及。 | 両者合意 (00_internal も同意) |
| C6 | `in` 案内文の 2 段階フロー明示 | 「先に `/punch out` しな」だけでは out 後に当日分 in を忘れる導線になる。「out した後に改めて `/punch in` で今日の出勤を打刻しな」と 2 段階を明示。 | alpha → beta 同意 |
| C7 | ヘルパ抽出 / 可読性 | in / out 双方の「最新 open punch を取る」クエリが複製。`toLocaleTimeString('ja-JP', {timeZone: 'Asia/Tokyo', ...})` が 3 箇所複製。out 分岐の入れ子が深い。**`fetchOpenPunch(admin, userId)` / `fetchLatestClosedPunch(admin, userId, withinHours)` / `formatJstHm()` を抽出**して DRY 化 + 関数分割。 | alpha (ヘルパ抽出) + beta (formatJstHm) 統合 |

---

## 片方のみが挙げた指摘 (参考)

### reviewer-alpha のみ
- **`supabase/migrations` (UNIQUE と将来要件)** [minor]: UNIQUE(user_id, date) が中抜け 2 セッション要件のブロッカーになる可能性。docs に方針メモ。
  → beta は phase2 で C4 (要件 / docs 反映) にまとめて統合した。実質合意。

### reviewer-beta のみ
- **`MAX_OPEN_PUNCH_HOURS` の env 化** [minor]: 値の根拠が要件未紐付け。env で上書き可能に。
  → alpha も C4 (要件 / docs 反映) で同主旨を major として挙げており、実質合意。

> **結論**: 「片方のみ」と分類されたものはいずれも phase2 で相手側に取り込まれており、最終的に **両者の意見はほぼ完全一致**。

---

## 意見が割れたが議論の末に解消した点

| 論点 | フェーズ1の差分 | フェーズ2での解消 |
|---|---|---|
| `in` 案内文の修正範囲 | alpha は minor (文言補強)、beta は major (36h ガード欠如で UX デッドエンド) | beta が UX デッドエンド観点で major、alpha がその一部として「2 段階フロー文言」を minor (C6) に分離。**major 化に統合**。 |
| race 対策の責務 | alpha は具体策 (条件付き update) を提示、beta は方針提示のみ | alpha の具体策を beta が採用し、`in` 側の UNIQUE 違反 race も同じ finding に追記して 1 件に集約 (C3)。 |
| `formatJstHm` 抽出 | alpha は気づいていなかった | alpha が beta の指摘を受け入れ採用 (C7)。 |

---

## 最終 merge 判定
- reviewer-alpha (phase1): `request_changes`
- reviewer-beta (phase1): `request_changes`
- **合意後の最終判定**: **`request_changes`** (両者一致)

合意プロセスで判定が変わることはなく、両者最初から `request_changes` で一致。理由は **C1 (closedToday の日跨ぎバグ)・C2 (UX デッドエンド)・C3 (race) の major 3 件が merge 前に対応必須** という判断。

---

## 合意できなかった (オープンのまま残す) 点

両者ともプロダクトオーナー判断が必要と認識:

1. `in` 側で古い open punch を検知したとき、(a) 36h 超過なら管理者誘導、(b) 36h 以内なら「先に out → 改めて in」の 2 段階フロー案内、で確定してよいか? それとも「古い open を強制 close + 新規 in を許可」の運用にするか?
2. race 対策 (C3) は同 PR で直すか、別 issue 化するか? (両者とも同 PR を推奨)
3. `MAX_OPEN_PUNCH_HOURS = 36` のままで良いか / env 化するか? 「業務日 = 出勤日」前提を CLAUDE.md / docs/setup-guide.md のどちらに明文化するか?

---

## self-review (00_internal) との比較

### セルフでは見えていなかったが 2 体とも独立に拾った点 (= バイアスで埋もれていた)
- **C1 (closedToday の日付境界バグ)**: セルフでは「`closedToday` の追加クエリがやや煩雑」と書かれただけで、**日跨ぎで誤案内が返るバグ**だとは認識されていない。実装直後の確証バイアスの典型例。
- **C2 (UX デッドエンド)**: セルフでも「フロー的に微妙」と言及はあるが、minor 扱い。クロスでは「ユーザーが自力復帰不能」という UX 深刻度を 2 体とも major と評価。
- **C4 の docs 反映**: セルフでは「自分では判断できない点」として保留扱い。クロスでは「docs に明文化すべき」と能動的アクションに昇格。

### セルフでも触れられていたが、クロスで具体化された点
- 同時実行の race condition: セルフは「Postgres の楽観ロック等を入れるべきかは要件と運用次第」と曖昧。クロスでは **`update ... where id=? and punch_out is null` の 1 クエリ化** という具体策に落ちた。
- 退勤完了メッセージの HH:mm 併記: セルフ・クロス両者で言及。一致。

---

## single-review (01_single) との比較

### シングルが拾い、クロスが拾えなかった指摘 (要注意)
- **R1 (同日 2 回目 `/punch in` で `punch_in` を上書きする退行)** [single の major]: 同日 9:00 in → 18:00 out の後に同日 19:00 in (打ち間違い) が来ると、未退勤チェックが punch_out IS NULL 限定なので素通りし、`upsert` が走って `punch_in=19:00` で上書き、`punch_out=18:00` のまま不整合レコードが生まれる。**クロスの 2 体ともこの退行を見落としている**。
  → 「2 体寄せれば見えるとは限らない」例。**シングルレビュアーが diff を読み込む粒度がたまたま深かった** ため拾えた可能性が高い。クロスでは合意形成のオーバーヘッドで個々の深掘り時間が削られた可能性も。
- **Y1 (DB エラー時のロギング欠如)** [single の minor]: クロスは指摘なし。

### クロスが拾い、シングルが拾わなかった指摘
- **C1 (closedToday の日付境界バグ)**: シングルでも触れられていない。クロスでは alpha が独立に発見。
- **C3 の `/punch in` 側 UNIQUE 違反 race**: シングルでは触れられていない。

### 解釈
- **シングルレビューは "深さ" に強い**: 1 体に diff 全体の文脈が乗るので、退行検知のような重い分析が回る。
- **クロスレビューは "幅" に強い**: 独立な 2 視点で別々の角度から拾えるが、片方が見落とすと両方とも見落とすケースもある。
- 1 つのレビューだけで完結させるのは危険。**シングル + クロスを併用したほうが網羅性が高い** という示唆。

---

## このパターンの効果と限界

### 効果 (期待通りに作用した点)
- ✅ alpha 単独では minor だった「`in` 案内文補強」が、beta の「UX デッドエンド」観点と合流して **major に格上げ** された (重要度の補正)。
- ✅ alpha が見落としていた `formatJstHm` の DRY、beta が見落としていた `closedToday` の日付境界バグが、相互開示で **両者の最終版に取り込まれた** (網羅性の向上)。
- ✅ race 対策が「方針のみ」から「具体的な 1 クエリ化」に **解像度が上がった** (議論による具体化)。
- ✅ 最終判定 `request_changes` が独立にも合意後にも一致。**判定の信頼度が上がった**。

### 限界 (このパターンでは取りこぼした点)
- ❌ シングルが拾った R1 の退行 (同日 2 回目 `/punch in` 上書き) を **クロス 2 体ともスルー**。独立な 2 体でも重なる盲点が存在しうる。
- ❌ 合意形成プロセスで議論したのは「重要度・具体策」であり、**新たな指摘の発見** ではない。フェーズ 2 で新規 finding はほぼ出ていない。
- ❌ 1 ラウンドで打ち切ったため、「片方のみ」で残った指摘が完全には解消しなかったケースもある (実害は小さい)。

---

## 次のステップへの示唆
- C1 / C2 / C3 + R1 (single 由来) の **major 4 件を最優先で修正** すること。
- C4 の docs 反映は別 PR でも可だが、merge 前に「業務日 = 出勤日」の方針を確定しないと再議論が起きる。
- 「`/triple-review` を実行して、3 体になったときに発散と網羅性がどう変わるか」を観察するのが次パターン。
