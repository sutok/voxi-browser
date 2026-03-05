# voxi-browser Project Memory

## Project Overview
Chrome拡張機能：リアルタイム音声文字起こし（オフライン、日本語メイン）
- マイク + タブ音声（YouTube等）の両方をキャプチャ
- Transformers.js v3 (@huggingface/transformers, onnx-community/whisper-base) でブラウザ内推論
- Manifest V3、Offscreen Document 使用

## Claude Instructions
- 対話は必ず日本語
- Python 環境は uv を使用（pip 直接使用禁止）
- 仮想環境: uv init + uv venv で初期化済み

## Key Decisions
- Model: `onnx-community/whisper-base` + `language: 'japanese'`（Transformers.js v3）
- UI: ポップアップのみ（フローティングオーバーレイなし）
- 話者区別: 「自分:」(マイク) / 「タブ:」(タブ音声)
- エクスポート: クリップボード + .txt ダウンロード
- Bundler: Vite
- CSS: Tailwind CSS
- VAD: @ricky0123/vad-web（Silero VAD ベース）
- テスト: Vitest（新機能には必ずテスト追加）
- マイク+タブ音声は常に両方同時キャプチャ

## Critical Technical Constraints
- Service Worker では AudioContext 不可 → Offscreen Document 必須
- tabCapture はアクティブタブのみ
- Whisper はストリーミング非対応 → 5秒チャンク + VAD で擬似リアルタイム
- 初回モデルDL約145MB（進捗表示が必要）

## File Structure
CLAUDE.md に記載済み。src/background, offscreen, worker, audio, popup の5モジュール構成。
