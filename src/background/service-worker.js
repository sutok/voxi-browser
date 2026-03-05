/**
 * Background Service Worker
 * - Offscreen Document の作成・管理
 * - tabCapture の開始
 * - Popup と Offscreen 間のメッセージルーティング
 */

let isRecording = false;

/**
 * Offscreen Document を作成（既存なら何もしない）
 */
async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
    justification: '音声キャプチャと文字起こし処理のため',
  });
}

/**
 * 文字起こしを開始
 */
async function startTranscription(tab) {
  if (isRecording) return;
  isRecording = true;

  await ensureOffscreenDocument();

  // tabCapture でアクティブタブの音声を取得
  let streamId = null;
  try {
    streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id,
    });
  } catch (error) {
    console.error('tabCapture 失敗:', error);
  }

  // Offscreen Document に開始指示を送信
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'start',
    streamId,
  });
}

/**
 * 文字起こしを停止
 */
async function stopTranscription() {
  if (!isRecording) return;
  isRecording = false;

  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'stop',
  });
}

// メッセージハンドラ
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Popup からの制御メッセージ
  if (message.target === 'service-worker') {
    switch (message.type) {
      case 'start':
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            startTranscription(tabs[0]);
          }
        });
        break;
      case 'stop':
        stopTranscription();
        break;
      case 'get-status':
        sendResponse({ isRecording });
        return true;
    }
  }

  // Offscreen からの結果をすべてのコンテキストにブロードキャスト
  // （Popup が受信する）
  if (
    message.type === 'transcription' ||
    message.type === 'loading' ||
    message.type === 'ready' ||
    message.type === 'error' ||
    message.type === 'mic-started' ||
    message.type === 'tab-started'
  ) {
    // Popup 向けに転送
    message.target = 'popup';
  }
});
