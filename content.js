// content.js v5

const STYLE_ID = 'gb-bg-style';
const OVERLAY_ID = 'gb-overlay';

// ── 创建遮罩 div（只创建一次）──
function ensureOverlay() {
  if (document.getElementById(OVERLAY_ID)) return;
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 0 !important;
    pointer-events: none !important;
  `;
  // 从存储读取透明度，默认 0.50
  chrome.storage.local.get(['overlayOpacity'], (result) => {
    const alpha = result.overlayOpacity !== undefined ? result.overlayOpacity : 0.50;
    overlay.style.setProperty('background', `rgba(0, 0, 0, ${alpha})`, 'important');
  });
  document.body.insertBefore(overlay, document.body.firstChild);
}

// ── 应用背景图 ──
function applyBackground(imageUrl) {
  // 移除旧样式
  const old = document.getElementById(STYLE_ID);
  if (old) old.remove();

  if (!imageUrl) {
    document.documentElement.style.removeProperty('background-image');
    // 移除遮罩
    const ov = document.getElementById(OVERLAY_ID);
    if (ov) ov.remove();
    return;
  }

  // 注入背景样式
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html {
      background-image: url("${imageUrl}") !important;
      background-size: cover !important;
      background-position: center center !important;
      background-attachment: fixed !important;
      background-repeat: no-repeat !important;
    }
    body {
      background: transparent !important;
    }
  `;
  document.head.appendChild(style);

  // 确保遮罩存在
  ensureOverlay();

  // 在 applyBackground 函数末尾加（ensureOverlay() 下方）
chrome.storage.local.get(['sidenavOpacity'], (result) => {
  const alpha = result.sidenavOpacity !== undefined ? result.sidenavOpacity : 0.35;
  document.documentElement.style.setProperty(
    '--gb-sidenav-bg',
    `rgba(0, 0, 0, ${alpha})`
  );
});
}

// ── 初始化 ──
chrome.storage.local.get(['backgroundUrl'], (result) => {
  if (result.backgroundUrl) {
    applyBackground(result.backgroundUrl);
  }
});

// ── 监听 popup 消息 ──
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SET_BACKGROUND') {
    applyBackground(message.url);
  }
  if (message.type === 'CLEAR_BACKGROUND') {
    applyBackground(null);
  }
  // 在已有的 onMessage 监听里加入：
  if (message.type === 'SET_OPACITY') {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.style.background = `rgba(0, 0, 0, ${message.alpha}) !important`;
      // style 直接赋值时 !important 无效，用这个方式：
      overlay.style.setProperty('background', `rgba(0, 0, 0, ${message.alpha})`, 'important');
    }
  }

  if (message.type === 'SET_SIDENAV_OPACITY') {
    // 用 CSS 变量控制侧栏背景色
    document.documentElement.style.setProperty(
      '--gb-sidenav-bg',
      `rgba(0, 0, 0, ${message.alpha})`
    );
  }

});

// ── 监听 SPA 路由切换，重新注入遮罩 ──
const observer = new MutationObserver(() => {
  chrome.storage.local.get(['backgroundUrl'], (result) => {
    if (result.backgroundUrl) {
      ensureOverlay();
    }
  });
});

// 等 body 准备好再观察
if (document.body) {
  observer.observe(document.body, { childList: true, subtree: false });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: false });
  });
}

// ── 保护侧栏响应式行为：不干涉 Gemini 的 transform ──
function protectSidenavTransform() {
  const sidenav = document.querySelector('mat-sidenav, bard-sidenav, .mat-drawer');
  if (!sidenav) return;

  // 用 MutationObserver 监听 style 变化，只保留 transform
  const sidenavObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'style') {
        // 如果 Gemini 设置了 transform（隐藏动作），不要覆盖它
        const transform = sidenav.style.transform;
        if (transform && transform.includes('translateX')) {
          // Gemini 在控制侧栏，让它自己管
          sidenav.style.removeProperty('visibility');
        }
      }
    });
  });

  sidenavObserver.observe(sidenav, { attributes: true, attributeFilter: ['style'] });
}

// 页面加载后执行
if (document.readyState === 'complete') {
  protectSidenavTransform();
} else {
  window.addEventListener('load', protectSidenavTransform);
}