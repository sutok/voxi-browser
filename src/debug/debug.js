/**
 * デバッグページ — Chrome 拡張なしで音声パイプライン + Whisper を動作確認
 * chrome.* API を使わず、直接 getUserMedia / AudioWorklet / Worker を呼ぶ
 */

const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

function log(msg, cls = 'info') {
  const line = document.createElement('div');
  line.className = cls;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

// --- 状態 ---
let micContext = null;
let micStream = null;
let whisperWorker = null;

// --- Whisper Worker ---
function initWhisperWorker() {
  whisperWorker = new Worker(
    new URL('../worker/whisper-worker.js', import.meta.url),
    { type: 'module' }
  );

  whisperWorker.addEventListener('message', (e) => {
    const { type, text, source, error, progress, status } = e.data;
    if (type === 'loading') {
      setStatus(`モデル読み込み中... ${Math.round(progress ?? 0)}% (${status ?? ''})`);
    } else if (type === 'ready') {
      setStatus('準備完了 — 話しかけてください');
      log('Whisper モデル読み込み完了', 'info');
    } else if (type === 'transcription') {
      const label = source === 'mic' ? '自分' : 'タブ';
      const cls = source === 'mic' ? 'mic' : 'tab';
      log(`${label}: ${text}`, cls);
    } else if (type === 'error') {
      log(`Worker エラー: ${error}`, 'err');
    }
  });

  whisperWorker.postMessage({ type: 'load' });
}

// --- Audio パイプライン（chrome API なし版） ---
async function setupAudioPipeline(stream, source) {
  const context = new AudioContext({ sampleRate: 44100 });

  await context.audioWorklet.addModule(
    new URL('../audio/audio-processor.js', import.meta.url)
  );

  if (context.state === 'suspended') await context.resume();

  const sourceNode = context.createMediaStreamSource(stream);
  const workletNode = new AudioWorkletNode(context, 'audio-processor', {
    processorOptions: { bufferSize: 16000 * 5, sampleRate: 16000 },
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

  // サイレント接続（グラフ維持）
  const silentGain = context.createGain();
  silentGain.gain.value = 0;
  workletNode.connect(silentGain);
  silentGain.connect(context.destination);

  sourceNode.connect(workletNode);
  return context;
}

// --- 開始 ---
async function start() {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  setStatus('マイク取得中...');
  log('セッション開始');

  initWhisperWorker();

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micContext = await setupAudioPipeline(micStream, 'mic');
    log('マイクキャプチャ開始', 'info');
  } catch (err) {
    log(`マイク取得失敗: ${err.message}`, 'err');
    setStatus('エラー');
  }
}

// --- 停止 ---
function stop() {
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus('停止');

  if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
  if (micContext) { micContext.close(); micContext = null; }
  if (whisperWorker) { whisperWorker.terminate(); whisperWorker = null; }

  log('セッション停止');
}

startBtn.addEventListener('click', start);
stopBtn.addEventListener('click', stop);
