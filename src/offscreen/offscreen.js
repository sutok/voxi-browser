/**
 * Offscreen Document
 * Web Speech API (webkitSpeechRecognition) でマイク音声をリアルタイム文字起こし。
 */

let recognition = null;

function send(msg) {
  chrome.runtime.sendMessage({ target: 'service-worker', ...msg });
}

function startRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    send({ type: 'error', error: 'このブラウザは SpeechRecognition に対応していません' });
    return;
  }

  recognition = new SR();
  recognition.lang = 'ja-JP';
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onstart = () => {
    send({ type: 'mic-started' });
    send({ type: 'ready' });
  };

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        const text = event.results[i][0].transcript.trim();
        if (text) {
          send({ type: 'transcription', text, source: 'mic', timestamp: Date.now() });
        }
      }
    }
  };

  recognition.onerror = (event) => {
    // network エラーは一時的なものなので再起動で対処
    if (event.error === 'network' || event.error === 'no-speech') return;
    send({ type: 'error', error: `音声認識エラー: ${event.error}` });
  };

  recognition.onend = () => {
    // 停止していなければ自動再起動（途切れ対策）
    if (recognition) recognition.start();
  };

  recognition.start();
}

function stopRecognition() {
  if (recognition) {
    recognition.onend = null; // 自動再起動を無効化
    recognition.stop();
    recognition = null;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== 'offscreen') return;
  if (message.type === 'start') startRecognition();
  if (message.type === 'stop') stopRecognition();
});
