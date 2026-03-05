/**
 * Offscreen Document
 * MV3 では Service Worker で AudioContext が使えないため、
 * ここで音声キャプチャと Whisper Worker への橋渡しを行う。
 *
 * - マイク: getUserMedia()
 * - タブ音声: Service Worker から受け取った streamId で getDisplayMedia()
 */

let micContext = null;
let tabContext = null;
let whisperWorker = null;

/**
 * Whisper Worker を初期化
 */
function initWhisperWorker() {
  whisperWorker = new Worker(
    chrome.runtime.getURL('whisper-worker.js'),
    { type: 'module' }
  );

  whisperWorker.addEventListener('message', (event) => {
    // Worker からの結果を Service Worker にリレー
    chrome.runtime.sendMessage({
      target: 'service-worker',
      ...event.data,
    });
  });

  // モデルのロードを開始
  whisperWorker.postMessage({ type: 'load' });
}

/**
 * AudioContext + AudioWorklet をセットアップし、
 * 音声ストリームから 16kHz チャンクを生成する
 */
async function setupAudioPipeline(stream, source) {
  const context = new AudioContext({ sampleRate: 44100 });

  await context.audioWorklet.addModule(
    chrome.runtime.getURL('audio-processor.js')
  );

  const sourceNode = context.createMediaStreamSource(stream);

  const workletNode = new AudioWorkletNode(context, 'audio-processor', {
    processorOptions: {
      bufferSize: 16000 * 5, // 5秒
      sampleRate: 16000,
    },
  });

  workletNode.port.onmessage = (event) => {
    if (event.data.type === 'audio-chunk' && whisperWorker) {
      whisperWorker.postMessage({
        type: 'transcribe',
        audio: event.data.audio,
        source,
      });
    }
  };

  sourceNode.connect(workletNode);

  // タブ音声の場合、音声をそのまま出力にも接続して聞こえるようにする
  if (source === 'tab') {
    const destination = context.createMediaStreamDestination();
    sourceNode.connect(destination);
    // Audio 要素で再生してミュート問題を回避
    const audio = new Audio();
    audio.srcObject = destination.stream;
    audio.play();
  }

  return context;
}

/**
 * マイクキャプチャを開始
 */
async function startMicCapture() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micContext = await setupAudioPipeline(stream, 'mic');
    chrome.runtime.sendMessage({
      target: 'service-worker',
      type: 'mic-started',
    });
  } catch (error) {
    chrome.runtime.sendMessage({
      target: 'service-worker',
      type: 'error',
      error: `マイクの取得に失敗: ${error.message}`,
    });
  }
}

/**
 * タブ音声キャプチャを開始
 */
async function startTabCapture(streamId) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        },
      },
    });
    tabContext = await setupAudioPipeline(stream, 'tab');
    chrome.runtime.sendMessage({
      target: 'service-worker',
      type: 'tab-started',
    });
  } catch (error) {
    chrome.runtime.sendMessage({
      target: 'service-worker',
      type: 'error',
      error: `タブ音声の取得に失敗: ${error.message}`,
    });
  }
}

/**
 * すべてのキャプチャを停止
 */
function stopAll() {
  if (micContext) {
    micContext.close();
    micContext = null;
  }
  if (tabContext) {
    tabContext.close();
    tabContext = null;
  }
  if (whisperWorker) {
    whisperWorker.terminate();
    whisperWorker = null;
  }
}

// Service Worker からのメッセージを受信
chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== 'offscreen') return;

  switch (message.type) {
    case 'start':
      initWhisperWorker();
      startMicCapture();
      if (message.streamId) {
        startTabCapture(message.streamId);
      }
      break;
    case 'stop':
      stopAll();
      break;
  }
});
