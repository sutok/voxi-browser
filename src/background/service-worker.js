/**
 * Background Service Worker
 * - コンテンツスクリプトの注入・停止
 * - Popup へのメッセージ転送
 */

let isRecording = false;
let activeTabId = null;
let injectedTabIds = new Set();
let popupWindowId = null;
let targetTabId = null; // ポップアップを開く前のアクティブタブを記憶

// 拡張アイコンクリックでパネルウィンドウを開く（既に開いていればフォーカス）
chrome.action.onClicked.addListener(async (tab) => {
  // クリック時のタブを記憶（ポップアップウィンドウ内のタブと混同しないよう先に取得）
  targetTabId = tab.id;

  if (popupWindowId != null) {
    try {
      await chrome.windows.update(popupWindowId, { focused: true });
      return;
    } catch {
      popupWindowId = null;
    }
  }
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('src/popup/popup.html'),
    type: 'popup',
    width: 420,
    height: 560,
  });
  popupWindowId = win.id;
});

// ウィンドウが閉じられたら ID をリセット
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) popupWindowId = null;
});

async function startTranscription(tab, language = '') {
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
    }
    // 注入済み・新規いずれも start メッセージで言語を渡す
    chrome.tabs.sendMessage(tab.id, { target: 'content', type: 'start', language });
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
        if (targetTabId != null) {
          chrome.tabs.get(targetTabId, (tab) => {
            if (tab) startTranscription(tab, message.language ?? '');
          });
        }
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
