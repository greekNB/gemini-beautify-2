// background.js — 确保 content script 已注入再通信

chrome.runtime.onInstalled.addListener(() => {
    // 插件安装/更新时，向所有已打开的 Gemini 页面注入脚本
    injectToAllGeminiTabs();
  });
  
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // 页面加载完成时自动注入
    if (
      changeInfo.status === 'complete' &&
      tab.url?.includes('gemini.google.com')
    ) {
      injectToTab(tabId);
    }
  });
  
  async function injectToAllGeminiTabs() {
    const tabs = await chrome.tabs.query({ url: 'https://gemini.google.com/*' });
    tabs.forEach(tab => injectToTab(tab.id));
  }
  
  async function injectToTab(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content.css']
      });
    } catch (e) {
      // 页面可能不允许注入，静默忽略
      console.warn('注入失败:', e.message);
    }
  }
  
  // 转发 popup 的消息到对应 tab
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target === 'tab') {
      chrome.tabs.query({ url: 'https://gemini.google.com/*' }, (tabs) => {
        if (tabs.length === 0) {
          sendResponse({ ok: false, reason: 'no_tab' });
          return;
        }
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, message, (resp) => {
            if (chrome.runtime.lastError) {
              // content script 没准备好，先注入再重试
              injectToTab(tab.id).then(() => {
                setTimeout(() => {
                  chrome.tabs.sendMessage(tab.id, message);
                }, 500);
              });
            }
          });
        });
        sendResponse({ ok: true });
      });
      return true;
    }
  });