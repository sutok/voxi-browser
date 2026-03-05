# voxi-browser

リアルタイム音声文字起こし Chrome 拡張機能。マイク入力とタブ音声（YouTube等）の両方をオフラインで文字起こしする。

## 概要

| 項目 | 内容 |
|------|------|
| 対象ブラウザ | Chrome (Manifest V3) |
| 推論方式 | オフライン（Transformers.js） |
| モデル | `Xenova/whisper-base`（`language: 'japanese'`） |
| 音声ソース | マイク + アクティブタブ音声 |
| 表示 | 拡張ポップアップ内 |
| 話者区別 | 「自分:」(マイク) / 「タブ:」(タブ音声) で分けて表示 |
| エクスポート | クリップボードコピー + .txt ダウンロード |

## 技術スタック

- **Transformers.js** (`@xenova/transformers`) - Whisper ブラウザ内推論
- **Chrome Extension APIs** - `tabCapture`, `offscreen`
- **Web Audio API** - `AudioContext`, `AudioWorklet`
- **Web Workers** - Whisper 推論をメインスレッドから分離
- **Vite** - バンドラー（Transformers.js の ESM 対応のため）

## ディレクトリ構成

```
voxi-browser/
├── CLAUDE.md
├── manifest.json               # MV3 マニフェスト
├── package.json
├── vite.config.js
├── src/
│   ├── background/
│   │   └── service-worker.js   # メッセージルーティング・tabCapture 開始
│   ├── offscreen/
│   │   ├── offscreen.html      # MV3 Offscreen Document
│   │   └── offscreen.js        # AudioContext・MediaRecorder・チャンク送信
│   ├── worker/
│   │   └── whisper-worker.js   # Transformers.js 推論（Web Worker）
│   ├── audio/
│   │   └── audio-processor.js  # AudioWorklet プロセッサー（16kHz リサンプリング）
│   └── popup/
│       ├── popup.html          # UI
│       ├── popup.js            # 表示ロジック・エクスポート
│       └── popup.css
└── dist/                       # ビルド成果物（Chrome に読み込む）
```

## アーキテクチャ

```
[マイク]  getUserMedia()      ─┐
                               ├─→ [Offscreen Document]
[タブ音声] tabCapture.capture() ─┘    AudioWorklet (16kHz)
                                      チャンク分割（5秒 + VAD）
                                           ↓
                                    [Whisper Worker]
                                    Transformers.js
                                    Xenova/whisper-base
                                    language: 'japanese'
                                           ↓
                                  { source: 'mic'|'tab', text }
                                           ↓
                                    [Popup UI]
                                    自分: ○○○○○
                                    タブ: ○○○○○
```

## データフロー詳細

1. ポップアップで「開始」→ Service Worker に通知
2. Service Worker が `chrome.offscreen.createDocument()` で Offscreen Document 作成
3. Offscreen Document が以下を並行して起動:
   - `getUserMedia({ audio: true })` でマイクストリーム取得
   - `chrome.tabCapture.capture()` でタブ音声ストリーム取得
4. 各ストリームを `AudioWorklet` で 16kHz にリサンプリング
5. VAD（音声区間検出）で無音をスキップ、発話区間を5秒チャンクに分割
6. チャンクを `Float32Array` として Whisper Worker に `postMessage`
7. Worker が Transformers.js で推論し、`{ source, text, timestamp }` を返す
8. Offscreen → Service Worker → Popup にリレーしてリアルタイム表示

## manifest.json の主要設定

```json
{
  "manifest_version": 3,
  "permissions": [
    "tabCapture",
    "offscreen"
  ],
  "host_permissions": [],
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },
  "action": {
    "default_popup": "src/popup/popup.html"
  }
}
```

※ マイク権限は `getUserMedia()` 呼び出し時にブラウザがランタイムで要求する（manifest 記載不要）

## 実装上の注意点

### MV3 制約
- Service Worker では `AudioContext` が使えない → **Offscreen Document で処理**
- `tabCapture` はアクティブタブのみキャプチャ可能
- Offscreen Document は同時に1つのみ作成可能

### Whisper のリアルタイム化
- Whisper はストリーミング非対応のため、**チャンク分割（5秒）** で擬似リアルタイムを実現
- VAD を挟むことで無音区間の推論をスキップし、遅延を削減
- 推論中の次チャンクはキューイングして取りこぼし防止

### モデルダウンロード
- 初回起動時に `Xenova/whisper-base`（約145MB）をダウンロード
- Transformers.js が自動的にブラウザキャッシュに保存
- ポップアップにダウンロード進捗を表示する

### タブ音声のミュート問題
- `tabCapture` 中はタブ音声が消える場合がある
- `AudioContext.createMediaStreamDestination()` でキャプチャしながら再生を維持する

### 2ストリームの独立処理
- マイクとタブ音声は **別々の AudioContext + AudioWorklet + Worker** で処理
- 推論結果に `source: 'mic' | 'tab'` を付与してポップアップで分けて表示

## 開発環境

### Python 仮想環境（uv）
このプロジェクトは `uv` で仮想環境を管理する。

```bash
uv venv          # 仮想環境の作成（初回のみ）
source .venv/bin/activate  # 仮想環境の有効化
uv pip install   # パッケージインストール
```

- `uv init` / `uv venv` で初期化済み
- Python スクリプト・ツールの実行は必ず仮想環境内で行う

### JS ビルド

```bash
npm install
npm run dev    # Vite dev build（watch モード）
npm run build  # dist/ に本番ビルド
```

Chrome で `dist/` フォルダを「パッケージ化されていない拡張機能」として読み込む。

## Claude への指示

- **対話は必ず日本語で行う**
- Python 環境は `uv` を使用する（`pip` 直接使用禁止）

## 参考実装

- [whisper-web](https://github.com/xenova/whisper-web) - Transformers.js によるブラウザ内 Whisper のリファレンス実装
- [Transformers.js ドキュメント](https://huggingface.co/docs/transformers.js)
- [Chrome tabCapture API](https://developer.chrome.com/docs/extensions/reference/api/tabCapture)
- [Chrome Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
