---
name: cross-review
description: 2体のチームエージェントを並行起動し、それぞれが独立してコードレビューしたうえで SendMessage でレビューを交換・議論して合意形成させる。結果をメインエージェントが集約して report/02_cross.md に保存する。AI駆動開発のレビュー比較デモ「クロスレビュー (2体合意形成型)」パターン。ユーザーが `/cross-review` で呼び出す。
---

# cross-review — クロスレビュー (別コンテキスト × 2体 × 相互レビュー)

このスキルは、比較デモの **3本目**。独立シングルレビューに「もう1体の独立視点」を足し、**両者がお互いのレビューを見て合意を取る** ことで、1体だけでは揺らぐ結論の信頼性を上げられる、というパターンを示す。

## 前提

- `report/00_internal.md` が存在する。なければ「先に `/self-review <機能名>` を実行してください」と伝えて停止する。

---

## 実行手順

### Step 1 — イントロ表示 (YouTube視聴者向け)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 Pattern 3 / 4 : クロスレビュー (2体合意形成)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【前提条件】
・Pattern 1 (self-review) が完了している
・report/00_internal.md が存在する

【実行内容】
1. 同じ「コードレビュアー」役のサブエージェントを 2 体、並行起動する
   (1通のメッセージで2体同時に Agent 呼び出し)
2. 各エージェントは互いの存在を知らないまま独立にレビューを書く
3. メインが双方のレビューを相手にも渡す (SendMessage 経由)
4. 各エージェントは相手のレビューを読んで自分の意見を更新し、
   合意可能な結論をまとめる
5. メインが両者の合意内容を統合し report/02_cross.md に保存する

【期待される効果】
✓ 独立な2視点 → どちらか片方だけでは見えなかった指摘が立体化する
✓ 相互レビューで 誤検知 / 重要度の過大評価 が削れる
✓ 合意された指摘は信頼度が高い (双方独立に賛成した指摘)

【このパターンのコスト】
・サブエージェント 2体ぶんのトークン
・メッセージ往復 (1〜2ラウンド)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 2 — チームを作って2体を並行起動する (ここが本パターンの核)

まず `TeamCreate` でレビュー用チームを作る (これにより SendMessage / 共有タスクリストが使える状態になる):

```
TeamCreate({
  team_name: "cross-review",
  agent_type: "review-coordinator",
  description: "クロスレビュー: 2体の独立レビュアーを合意形成させる"
})
```

続けて **同じ1メッセージ内で Agent ツールを2回呼び出して並列起動する**。直列で起動してはいけない。両方に `team_name: "cross-review"` を渡してチームに参加させる。

- エージェント A: `name: "reviewer-alpha"`, `subagent_type: "general-purpose"`, `team_name: "cross-review"`
- エージェント B: `name: "reviewer-beta"`, `subagent_type: "general-purpose"`, `team_name: "cross-review"`

両方に渡すプロンプト (相手の名前だけ差し替える):

```
あなたは独立したコードレビュアーです。同じ対象を別のレビュアー
「(相手の name)」も並行してレビューしています。最終的には相手と
合意を形成することを目指します。

## フェーズ1: 独立レビュー (いまこのフェーズ)

1. git diff または git status で直近の変更を把握する
2. CLAUDE.md と変更ファイルを読む
3. report/00_internal.md (実装者セルフレビュー) も参照する
4. 以下のJSONで返答してください:

{
  "reviewer": "(自分の name)",
  "summary": "3行以内で所見",
  "findings": [
    {"severity": "critical|major|minor", "area": "...", "detail": "..."}
  ],
  "merge_verdict": "approve | request_changes | block",
  "open_questions": ["相手に聞きたいこと (あれば)"]
}

## フェーズ2 (後で来ます)

メインから相手のレビューが SendMessage で送られてきます。そのとき:
- 相手の指摘のうち 同意できるもの / できないもの を仕分ける
- 自分の最初のレビューを修正してよい
- 合意できる最終版 と 最終判定 を同じJSON形式でもう一度返してください
  (フィールドに "agreement_with_peer": "full|partial|none" と
   "adjusted_points": [...] を追加)

フェーズ2の依頼が来るまで、待機しつつ上記JSONだけ返してください。
```

### Step 3 — 相手のレビューを相互に渡す

両エージェントから一次レビューが返ってきたら、**SendMessage を2件、並列で** 送る:

- `SendMessage(to: "reviewer-alpha", message: "Peer review from reviewer-beta:\n<beta の JSON>\n\nフェーズ2として、相手の指摘を取り込んだ最終版JSONを返してください。")`
- `SendMessage(to: "reviewer-beta", message: "Peer review from reviewer-alpha:\n<alpha の JSON>\n\nフェーズ2として、相手の指摘を取り込んだ最終版JSONを返してください。")`

両者から二次レビュー (合意を反映したJSON) を受け取る。

### Step 4 — 合意をメインで統合して保存する

メインエージェントが両者の二次レビューを読み、以下のテンプレートで report/02_cross.md に書き出す。

```markdown
# クロスレビュー報告書 (02_cross)

## メタ情報
- レビュー種別: クロスレビュー (別コンテキスト × 2体 × 相互レビュー)
- レビュアー: reviewer-alpha, reviewer-beta
- フロー: 独立レビュー → 相互開示 (SendMessage) → 合意形成 → メインで統合

## 対象機能
(report/00_internal.md から引用)

## 両者が合意した指摘 (信頼度 高)
| severity | area | detail |
|---|---|---|
| ... | ... | ... |

## 片方のみが挙げた指摘 (参考)
### reviewer-alpha のみ
- ...

### reviewer-beta のみ
- ...

## 意見が割れたが議論の末に解消した点
- ...

## 最終 merge 判定
- reviewer-alpha の判定: ...
- reviewer-beta の判定: ...
- **合意後の最終判定**: approve / request_changes / block

## self-review および single-review との比較
- セルフでは見えていなかったが2体とも拾った点: ...
- シングルレビューより堅牢になった理由: ...
```

### Step 5 — 終了時のサマリ

```
✅ Pattern 3 完了: クロスレビュー (2体合意形成)

レポート: report/02_cross.md
両者合意の指摘数: N
片方のみの指摘数: M
最終判定: (approve / request_changes / block)

次のステップ: /triple-review を実行して、
  3体になったときに何が起きるかを見る
```

---

## 重要な方針

- **必ず TeamCreate でチームを先に作ってから Agent を起動する**。`team_name` を渡すことで2体が同じチームに属し、SendMessage で名前指定の相互通信ができる
- **2体の起動は並行で** (1メッセージで2 Agent 呼び出し)。直列だと「2体が同時に独立に見ている」演出が壊れる
- **SendMessage の交換も並列で** (1メッセージで2 SendMessage)
- エージェント同士は名前で相手を認識するが、合意の集約は **メインエージェントが最後にまとめる** のが責務分離として明確
- 合意形成は 1ラウンド で打ち切る (YouTube尺に収めるため)。2ラウンド以上は triple-review 側で "発散" を演出するのでここでは不要
- 終了時は両エージェントへ `SendMessage({to, message: {type: "shutdown_request"}})` を送って後片付けする
