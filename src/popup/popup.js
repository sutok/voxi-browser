/**
 * Popup UI ロジック
 * - 開始/停止ボタン制御
 * - 文字起こし結果の表示
 * - エクスポート（クリップボード・ダウンロード）
 */

const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnCopy = document.getElementById('btn-copy');
const btnDownload = document.getElementById('btn-download');
const btnClose = document.getElementById('btn-close');
const chkTimestamp = document.getElementById('chk-timestamp');
const statusBadge = document.getElementById('status-badge');
const micTranscript = document.getElementById('mic-transcript');
const tabTranscript = document.getElementById('tab-transcript');
const micIndicator = document.getElementById('mic-indicator');
const tabIndicator = document.getElementById('tab-indicator');

// 文字起こしデータ
const transcripts = {
  mic: [],
  tab: [],
};

/**
 * UI を録音状態に更新
 */
function setRecordingUI(recording) {
  btnStart.classList.toggle('hidden', recording);
  btnStop.classList.toggle('hidden', !recording);
  statusBadge.textContent = recording ? '録音中' : '停止中';
  statusBadge.className = recording
    ? 'text-xs px-2 py-1 rounded-full bg-red-900 text-red-300 animate-pulse'
    : 'text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-400';
}

/**
 * 文字起こしテキストを表示エリアに追加
 */
function formatLine(entry) {
  return chkTimestamp.checked ? `[${entry.time}] ${entry.text}\n` : `${entry.text}\n`;
}

function rerenderTranscript(source) {
  const container = source === 'mic' ? micTranscript : tabTranscript;
  if (!container) return;
  container.value = transcripts[source].map(formatLine).join('');
  container.scrollTop = container.scrollHeight;
}

function appendTranscript(source, text, timestamp) {
  const time = new Date(timestamp).toLocaleTimeString('ja-JP');
  transcripts[source].push({ text, time });
  rerenderTranscript(source);
}

chkTimestamp.addEventListener('change', () => {
  rerenderTranscript('mic');
  rerenderTranscript('tab');
});

/**
 * エクスポート用のテキストを生成
 */
function buildExportText() {
  const lines = [];
  const allEntries = [
    ...transcripts.mic.map((e) => ({ ...e, source: '自分' })),
    ...transcripts.tab.map((e) => ({ ...e, source: 'タブ' })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  for (const entry of allEntries) {
    const prefix = chkTimestamp.checked ? `[${entry.time}] ` : '';
    lines.push(`${prefix}${entry.text}`);
  }

  return lines.join('\n');
}

// 開始ボタン
btnStart.addEventListener('click', () => {
  chrome.runtime.sendMessage({ target: 'service-worker', type: 'start' });
  setRecordingUI(true);
});

// 停止ボタン
btnStop.addEventListener('click', () => {
  chrome.runtime.sendMessage({ target: 'service-worker', type: 'stop' });
  setRecordingUI(false);
});

function stopIfRecording() {
  chrome.runtime.sendMessage({ target: 'service-worker', type: 'get-status' }, (res) => {
    if (res?.isRecording) {
      chrome.runtime.sendMessage({ target: 'service-worker', type: 'stop' });
      setRecordingUI(false);
    }
  });
}

// クリップボードにコピー
btnCopy.addEventListener('click', async () => {
  stopIfRecording();
  const text = buildExportText();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  btnCopy.textContent = 'コピー完了!';
  setTimeout(() => {
    btnCopy.textContent = 'コピー';
  }, 2000);
});

// .txt ダウンロード
btnDownload.addEventListener('click', () => {
  stopIfRecording();
  const text = buildExportText();
  if (!text) return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `voxi-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

// 閉じるボタン
btnClose.addEventListener('click', () => {
  stopIfRecording();
  window.close();
});

// Service Worker / Offscreen からのメッセージ受信
chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== 'popup') return;

  switch (message.type) {
    case 'transcription':
      appendTranscript(message.source, message.text, message.timestamp);
      break;

    case 'mic-started':
      micIndicator.classList.add('animate-pulse');
      break;

    case 'tab-started':
      tabIndicator?.classList.add('animate-pulse');
      break;

    case 'error':
      console.error('Voxi エラー:', message.error);
      break;
  }
});

// 起動時に現在の状態を取得
chrome.runtime.sendMessage(
  { target: 'service-worker', type: 'get-status' },
  (response) => {
    if (response?.isRecording) {
      setRecordingUI(true);
    }
  }
);
