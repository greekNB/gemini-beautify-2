// popup.js — Gemini Beautify

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOM 元素
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const urlInput      = document.getElementById('urlInput');
const fileInput     = document.getElementById('fileInput');
const applyBtn      = document.getElementById('applyBtn');
const clearBtn      = document.getElementById('clearBtn');
const preview       = document.getElementById('preview');
const status        = document.getElementById('status');
const opacitySlider = document.getElementById('opacitySlider');
const opacityValue  = document.getElementById('opacityValue');
const sidenavSlider = document.getElementById('sidenavSlider');
const sidenavValue  = document.getElementById('sidenavValue');

let currentUrl = '';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 核心：统一发送函数（经由 background 转发）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function sendToGemini(type, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { target: 'tab', type, ...data },
      (resp) => {
        if (chrome.runtime.lastError) {
          console.warn('sendToGemini 失败:', chrome.runtime.lastError.message);
          resolve(false);
        } else {
          resolve(true);
        }
      }
    );
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 节流：用 requestAnimationFrame 限制发送频率
// 与屏幕刷新率同步（60fps），避免消息堆积
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function rafThrottle(fn) {
  let rafId = null;
  let lastArgs = null;

  return function (...args) {
    lastArgs = args;
    if (rafId) return; // 已有帧在等待，只更新参数

    rafId = requestAnimationFrame(() => {
      fn(...lastArgs);
      rafId = null;
      lastArgs = null;
    });
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 本地文件上传
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
fileInput.addEventListener('change', function () {
  if (!this.files || this.files.length === 0) {
    showStatus('未选择文件', '#f87171');
    return;
  }

  const file = this.files[0];

  if (file.size > 3 * 1024 * 1024) {
    showStatus('⚠️ 图片超过 3MB，可能加载慢', '#facc15');
  } else {
    showStatus('读取图片中...', '#60a5fa');
  }

  const reader = new FileReader();

  reader.onload = (ev) => {
    currentUrl = ev.target.result;
    updatePreview(currentUrl);
    urlInput.value = '';
    showStatus('✓ 图片已加载，点击应用', '#4ade80');
  };

  reader.onerror = () => showStatus('✕ 读取失败，请换一张图片', '#f87171');

  reader.onprogress = (ev) => {
    if (ev.lengthComputable) {
      const pct = Math.round((ev.loaded / ev.total) * 100);
      showStatus(`读取中 ${pct}%...`, '#60a5fa');
    }
  };

  reader.readAsDataURL(file);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// URL 输入
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
urlInput.addEventListener('input', () => {
  const val = urlInput.value.trim();
  if (val) {
    currentUrl = val;
    updatePreview(val);
    showStatus('已输入链接', '#60a5fa');
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 应用背景
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
applyBtn.addEventListener('click', async () => {
  const url = currentUrl || urlInput.value.trim();
  if (!url) {
    showStatus('⚠️ 请先选择图片或输入链接！', '#facc15');
    return;
  }

  showStatus('保存中...', '#60a5fa');

  chrome.storage.local.set({ backgroundUrl: url }, async () => {
    if (chrome.runtime.lastError) {
      showStatus('✕ 存储失败', '#f87171');
      return;
    }
    const ok = await sendToGemini('SET_BACKGROUND', { url });
    showStatus(ok ? '✓ 已应用！' : '✓ 已保存！请打开或刷新 Gemini', '#4ade80');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 清除背景
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
clearBtn.addEventListener('click', async () => {
  chrome.storage.local.remove('backgroundUrl', async () => {
    await sendToGemini('CLEAR_BACKGROUND');
    currentUrl = '';
    urlInput.value = '';
    preview.style.backgroundImage = '';
    preview.textContent = '暂无背景';
    showStatus('✓ 已清除背景', '#94a3b8');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 遮罩透明度滑块（rAF 节流，丝滑发送）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const sendOpacity = rafThrottle((alpha) => {
  sendToGemini('SET_OPACITY', { alpha });
});

opacitySlider.addEventListener('input', () => {
  const alpha = (opacitySlider.value / 100).toFixed(2);
  opacityValue.textContent = opacitySlider.value + '%';
  sendOpacity(alpha); // 节流发送，不堆积
});

opacitySlider.addEventListener('change', () => {
  // 松手时强制保存最终值
  const alpha = (opacitySlider.value / 100).toFixed(2);
  chrome.storage.local.set({ overlayOpacity: alpha });
  sendToGemini('SET_OPACITY', { alpha }); // 松手时再发一次确保同步
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 侧栏透明度滑块（rAF 节流，丝滑发送）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const sendSidenav = rafThrottle((alpha) => {
  sendToGemini('SET_SIDENAV_OPACITY', { alpha });
});

sidenavSlider.addEventListener('input', () => {
  const alpha = (sidenavSlider.value / 100).toFixed(2);
  sidenavValue.textContent = sidenavSlider.value + '%';
  sendSidenav(alpha); // 节流发送，不堆积
});

sidenavSlider.addEventListener('change', () => {
  const alpha = (sidenavSlider.value / 100).toFixed(2);
  chrome.storage.local.set({ sidenavOpacity: alpha });
  sendToGemini('SET_SIDENAV_OPACITY', { alpha }); // 松手时再发一次确保同步
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 工具函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function updatePreview(url) {
  preview.style.backgroundImage = `url("${url}")`;
  preview.textContent = '';
}

function showStatus(msg, color) {
  status.textContent = msg;
  status.style.color = color || '#fff';
  if (color === '#4ade80' || color === '#94a3b8') {
    setTimeout(() => { status.textContent = ''; }, 3000);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 初始化：一次性读取所有保存的设置
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
chrome.storage.local.get(['backgroundUrl', 'overlayOpacity', 'sidenavOpacity'], (result) => {
  if (result.backgroundUrl) {
    currentUrl = result.backgroundUrl;
    updatePreview(currentUrl);
    showStatus('已加载上次背景', '#60a5fa');
  }

  if (result.overlayOpacity !== undefined) {
    const val = Math.round(result.overlayOpacity * 100);
    opacitySlider.value = val;
    opacityValue.textContent = val + '%';
  }

  if (result.sidenavOpacity !== undefined) {
    const val = Math.round(result.sidenavOpacity * 100);
    sidenavSlider.value = val;
    sidenavValue.textContent = val + '%';
  }
});