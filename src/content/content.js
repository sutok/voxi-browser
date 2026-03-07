/**
 * Content Script — SpeechRecognition でマイク文字起こし
 * タブのコンテキストで動作するため、マイク権限が正常に取得できる。
 */

// 二重注入防止
if (window.__voxiInjected) {
  chrome.runtime.sendMessage({ target: 'content', type: 'start' });
  throw new Error('voxi: already injected');
}
window.__voxiInjected = true;

let recognition = null;

async function startRecognition(language = '') {
  if (recognition) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    chrome.runtime.sendMessage({
      target: 'service-worker',
      type: 'error',
      error: 'SpeechRecognition 非対応ブラウザです',
    });
    return;
  }

  // getUserMedia でマイク許可プロンプトを明示的に出す
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop()); // 許可取得のみで実際には使わない
  } catch (err) {
    chrome.runtime.sendMessage({
      target: 'service-worker',
      type: 'error',
      error: `マイク許可が必要です: ${err.message}`,
    });
    return;
  }

  recognition = new SR();
  recognition.lang = language; // '' のとき Web Speech API がブラウザ言語で自動認識
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onstart = () => {
    chrome.runtime.sendMessage({ target: 'service-worker', type: 'mic-started' });
  };

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        const text = event.results[i][0].transcript.trim();
        if (text) {
          chrome.runtime.sendMessage({
            target: 'service-worker',
            type: 'transcription',
            text,
            source: 'mic',
            timestamp: Date.now(),
          });
        }
      }
    }
  };

  recognition.onerror = (event) => {
    if (event.error === 'no-speech' || event.error === 'network') return;
    chrome.runtime.sendMessage({
      target: 'service-worker',
      type: 'error',
      error: `音声認識エラー: ${event.error}`,
    });
  };

  recognition.onend = () => {
    // 停止指示がなければ自動再起動
    if (recognition) recognition.start();
  };

  recognition.start();
}

function stopRecognition() {
  if (recognition) {
    recognition.onend = null;
    recognition.stop();
    recognition = null;
  }
}

// Service Worker からの制御メッセージ
chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== 'content') return;
  if (message.type === 'start') startRecognition(message.language ?? '');
  if (message.type === 'stop') stopRecognition();
});
