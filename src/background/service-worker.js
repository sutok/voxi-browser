/**
 * Background Service Worker
 * - コンテンツスクリプトの注入・停止
 * - Popup へのメッセージ転送
 */

let isRecording = false;
let activeTabId = null;
let injectedTabIds = new Set();

async function startTranscription(tab) {
  if (isRecording) return;
  isRecording = true;
  activeTabId = tab.id;

  try {
    if (!injectedTabIds.has(tab.id)) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      injectedTabIds.add(tab.id);
    } else {
      // 既に注入済みなら start メッセージだけ送る
      chrome.tabs.sendMessage(tab.id, { target: 'content', type: 'start' });
    }
  } catch (err) {
    isRecording = false;
    activeTabId = null;
    chrome.runtime.sendMessage({
      target: 'popup',
      type: 'error',
      error: `スクリプト注入失敗（chrome:// や新しいタブでは動作しません）: ${err.message}`,
    }).catch(() => {});
  }
}

async function stopTranscription() {
  if (!isRecording) return;
  isRecording = false;

  if (activeTabId != null) {
    chrome.tabs.sendMessage(activeTabId, { target: 'content', type: 'stop' }).catch(() => {});
    activeTabId = null;
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabIds.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'service-worker') {
    switch (message.type) {
      case 'start':
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) startTranscription(tabs[0]);
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

  // Content Script からの結果を Popup に転送
  if (
    message.target !== 'popup' &&
    (message.type === 'transcription' ||
      message.type === 'error' ||
      message.type === 'mic-started')
  ) {
    chrome.runtime.sendMessage({ ...message, target: 'popup' }).catch(() => {});
  }
});
