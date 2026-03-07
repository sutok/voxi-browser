# Voxi 開発TODO

## 方針

| 項目 | 内容 |
|------|------|
| 認証 | Firebase Auth（Google / メール） |
| プラン管理 | Firebase Custom Claims + Firestore |
| 課金 | Stripe（サブスク） |
| バックエンド | Cloud Run（GCP） |
| タブ音声認識 | OpenAI Whisper API（有償のみ） |
| 無償 vs 有償の差別化 | 無償トライアル期間あり → 期間後は月間利用分数の上限 |

## プラン設計

| プラン | 内容 |
|--------|------|
| **トライアル** | 新規登録から一定期間、有償機能をすべて無料で利用可能 |
| **無償（期間終了後）** | マイクのみ・月間15分まで |
| **有償（Pro）** | マイク＋タブ音声・無制限・Stripe課金 |

> トライアル期間は要検討（例: 14日）

---

## フェーズ 1: Firebase Auth 導入

- [ ] Firebase プロジェクト作成
- [ ] Firebase JS SDK を拡張機能に追加（popup で使用）
- [ ] Google ログイン / メールログイン実装
- [ ] ログイン状態を chrome.storage に保持
- [ ] ポップアップに ログイン / ログアウト UI 追加
- [ ] 未ログイン時は文字起こし機能を無効化

---

## フェーズ 2: プラン管理

- [ ] Firestore に users コレクション作成
  ```
  users/{uid}
    plan: 'trial' | 'free' | 'pro'
    trialEndsAt: timestamp     // 登録日 + トライアル期間
    minutesUsed: number        // 当月利用分数
    minutesLimit: number       // trial/pro: 無制限 / free: 15分
    periodStart: timestamp
  ```
- [ ] Firebase Custom Claims に plan を埋め込む（バックエンドで付与）
- [ ] トライアル期限チェックのバックエンド処理（期限切れで free に自動移行）
- [ ] ポップアップで残り利用分数 / トライアル残日数を表示
- [ ] 上限到達時は文字起こし停止 + アップグレード案内を表示

---

## フェーズ 3: Stripe 課金

- [ ] Stripe アカウント作成・月額プラン設定
- [ ] Firebase Extensions「Run Payments with Stripe」導入
  - Firestore の customers コレクションと自動連携
- [ ] ポップアップにアップグレードボタン追加
  - クリックで Stripe Checkout へ遷移（外部ブラウザで開く）
- [ ] Stripe Webhook → Cloud Functions → Custom Claims 更新
- [ ] 解約時のダウングレード処理（pro → free）

---

## フェーズ 4: バックエンド（Cloud Run）

- [ ] Cloud Run プロジェクト作成（Node.js / Python）
- [ ] エンドポイント設計
  ```
  POST /transcribe
    Header: Authorization: Bearer {Firebase IDトークン}
    Body: audio/webm（チャンク）
    Response: { text: string }
  ```
- [ ] Firebase IDトークン検証ミドルウェア実装
- [ ] Firestore でプラン・トライアル期限・利用分数チェック
- [ ] trial / pro のみ OpenAI Whisper API 呼び出し
- [ ] 利用分数を Firestore に記録

---

## フェーズ 5: タブ音声文字起こし（trial / pro 機能）

- [ ] manifest.json に `tabCapture` 権限追加
- [ ] service-worker.js に tabCapture.capture() 実装
- [ ] offscreen.js に AudioWorklet でタブ音声チャンク分割実装
  - チャンク長: 5〜10秒
  - フォーマット: audio/webm（MediaRecorder）
- [ ] チャンクを Cloud Run `/transcribe` に送信
- [ ] 結果を `{ source: 'tab', text }` としてポップアップに表示
- [ ] popup.html のタブ音声エリア（コメントアウト中）を有効化
- [ ] trial / pro プランでのみ有効化

---

## フェーズ 6: UX 整備

- [ ] トライアル残日数・残り利用分数の表示
- [ ] アップグレードモーダル（上限到達 / 有償機能タップ時）
- [ ] エラーメッセージの日本語化・ユーザーフレンドリー化
- [ ] Chrome Web Store 公開審査対応

---

## 保留・検討事項

- トライアル期間の長さ（14日？30日？）
- タブ音声チャンク長とコスト試算（OpenAI: $0.006/分）
- プライバシーポリシー・利用規約の整備（音声データ外部送信あり）
