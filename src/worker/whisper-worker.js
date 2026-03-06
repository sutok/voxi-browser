/**
 * Whisper 推論 Web Worker
 * Transformers.js v3 で onnx-community/whisper-base を使用。
 * メインスレッドから音声チャンク（Float32Array）を受け取り、
 * 文字起こし結果を返す。
 */

let pipeline = null;
let isLoading = false;

/**
 * モデルをロードして pipeline を初期化
 */
async function loadModel() {
  if (pipeline || isLoading) return;
  isLoading = true;

  try {
    const { pipeline: createPipeline, env } = await import(
      '@huggingface/transformers'
    );

    // ブラウザ環境ではローカルモデルを使わない
    env.allowLocalModels = false;

    // ONNX Runtime WASM ファイルをローカルから読み込む（CSP 対策）
    const wasmBase = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('wasm/')
      : '/node_modules/onnxruntime-web/dist/';
    env.backends.onnx.wasm.wasmPaths = wasmBase;

    // SharedArrayBuffer が使えない環境（拡張機能の Offscreen 等）ではスレッドを無効化
    env.backends.onnx.wasm.numThreads = 1;

    self.postMessage({ type: 'loading', progress: 0 });

    pipeline = await createPipeline(
      'automatic-speech-recognition',
      'onnx-community/whisper-base',
      {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (progress) => {
          self.postMessage({
            type: 'loading',
            progress: progress.progress ?? 0,
            status: progress.status,
            file: progress.file,
          });
        },
      }
    );

    self.postMessage({ type: 'ready' });
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  } finally {
    isLoading = false;
  }
}

/**
 * 音声チャンクを文字起こし
 */
async function transcribe(audio, source) {
  if (!pipeline) {
    self.postMessage({ type: 'error', error: 'モデルが未ロードです' });
    return;
  }

  try {
    const result = await pipeline(audio, {
      language: 'japanese',
      task: 'transcribe',
      chunk_length_s: 5,
    });

    const text = result.text?.trim();
    if (text) {
      self.postMessage({
        type: 'transcription',
        text,
        source,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
}

// メッセージハンドラ
self.addEventListener('message', async (event) => {
  const { type, audio, source } = event.data;

  switch (type) {
    case 'load':
      await loadModel();
      break;
    case 'transcribe':
      await transcribe(audio, source);
      break;
  }
});
