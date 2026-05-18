// popup.js v3 — 修复文件选择无反应的问题

const PRESETS = [
    { name: '星云', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80' },
    { name: '极光', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&q=80' },
    { name: '深海', url: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=1920&q=80' },
    { name: '山脉', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80' },
    { name: '城市', url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&q=80' },
    { name: '森林', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80' }
  ];
  
  // DOM 元素
  const presetsContainer = document.getElementById('presets');
  const urlInput         = document.getElementById('urlInput');
  const fileInput        = document.getElementById('fileInput');
  const applyBtn         = document.getElementById('applyBtn');
  const clearBtn         = document.getElementById('clearBtn');
  const preview          = document.getElementById('preview');
  const status           = document.getElementById('status');
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityValue  = document.getElementById('opacityValue');
  
  let currentUrl = '';
  
  // ── 渲染预设按钮 ──
  PRESETS.forEach((preset) => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.style.backgroundImage = `url("${preset.url}")`;
    btn.innerHTML = `<span>${preset.name}</span>`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentUrl = preset.url;
      urlInput.value = '';
      updatePreview(preset.url);
      showStatus('已选择预设：' + preset.name, '#60a5fa');
    });
    presetsContainer.appendChild(btn);
  });
  
  // ── 关键修复：直接监听 fileInput 的 change 事件 ──
  fileInput.addEventListener('change', function() {
    console.log('文件选择触发', this.files);
  
    // 检查是否真的选了文件
    if (!this.files || this.files.length === 0) {
      showStatus('未选择文件', '#f87171');
      return;
    }
  
    const file = this.files[0];
    console.log('文件名:', file.name, '大小:', file.size);
  
    // 检查文件大小（超过 3MB 提示警告）
    if (file.size > 3 * 1024 * 1024) {
      showStatus('⚠️ 图片超过 3MB，可能加载慢', '#facc15');
    } else {
      showStatus('读取图片中...', '#60a5fa');
    }
  
    const reader = new FileReader();
  
    reader.onload = function(ev) {
      console.log('FileReader 读取成功');
      currentUrl = ev.target.result;
      updatePreview(currentUrl);
      clearPresetSelection();
      urlInput.value = '';
      showStatus('✓ 图片已加载，点击应用', '#4ade80');
    };
  
    reader.onerror = function(err) {
      console.error('FileReader 错误:', err);
      showStatus('✕ 读取失败，请换一张图片', '#f87171');
    };
  
    reader.onprogress = function(ev) {
      if (ev.lengthComputable) {
        const percent = Math.round((ev.loaded / ev.total) * 100);
        showStatus(`读取中 ${percent}%...`, '#60a5fa');
      }
    };
  
    reader.readAsDataURL(file);
  });
  
  // ── URL 输入 ──
  urlInput.addEventListener('input', () => {
    const val = urlInput.value.trim();
    if (val) {
      currentUrl = val;
      updatePreview(val);
      clearPresetSelection();
      showStatus('已输入链接', '#60a5fa');
    }
  });
  
  // ── 应用背景 ──
  applyBtn.addEventListener('click', () => {
    const url = currentUrl || urlInput.value.trim();
    if (!url) {
      showStatus('⚠️ 请先选择图片或输入链接！', '#facc15');
      return;
    }
  
    showStatus('保存中...', '#60a5fa');
  
    // base64 图片存本地，URL 图片存 url
    try {
      chrome.storage.local.set({ backgroundUrl: url }, () => {
        if (chrome.runtime.lastError) {
          console.error('存储失败:', chrome.runtime.lastError);
          showStatus('✕ 存储失败：' + chrome.runtime.lastError.message, '#f87171');
          return;
        }
  
        // 发消息给 Gemini 页面
        chrome.tabs.query({ url: 'https://gemini.google.com/*' }, (tabs) => {
          if (tabs.length === 0) {
            showStatus('✓ 已保存！请打开 Gemini 页面', '#4ade80');
            return;
          }
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { type: 'SET_BACKGROUND', url }, (resp) => {
              if (chrome.runtime.lastError) {
                // content script 还没准备好，刷新页面即可
                console.warn('消息发送失败（刷新Gemini即可）:', chrome.runtime.lastError.message);
              }
            });
          });
          showStatus('✓ 已应用！如没变化请刷新 Gemini', '#4ade80');
        });
      });
    } catch (e) {
      console.error('apply error:', e);
      showStatus('✕ 出错：' + e.message, '#f87171');
    }
  });
  
  // ── 清除背景 ──
  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove('backgroundUrl', () => {
      chrome.tabs.query({ url: 'https://gemini.google.com/*' }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_BACKGROUND', url: null });
        });
      });
      currentUrl = '';
      urlInput.value = '';
      preview.style.backgroundImage = '';
      preview.textContent = '暂无背景';
      clearPresetSelection();
      showStatus('✓ 已清除背景', '#94a3b8');
    });
  });
  
  // ── 工具函数 ──
  function updatePreview(url) {
    preview.style.backgroundImage = `url("${url}")`;
    preview.textContent = '';
  }
  
  function clearPresetSelection() {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  }
  
  function showStatus(msg, color) {
    status.textContent = msg;
    status.style.color = color || '#fff';
    // 成功消息 3 秒后自动消失，错误消息保持
    if (color === '#4ade80' || color === '#94a3b8') {
      setTimeout(() => { status.textContent = ''; }, 3000);
    }
  }
  
  // ── 初始化：加载已保存的背景 ──
  chrome.storage.local.get(['backgroundUrl'], (result) => {
    if (result.backgroundUrl) {
      currentUrl = result.backgroundUrl;
      updatePreview(currentUrl);
      showStatus('已加载上次背景', '#60a5fa');
    }
  });

  // ── 遮罩透明度滑块 ──
opacitySlider.addEventListener('input', () => {
    const val = opacitySlider.value;
    opacityValue.textContent = val + '%';
    const alpha = (val / 100).toFixed(2);
    // 实时预览
    sendOverlayOpacity(alpha);
  });
  
  opacitySlider.addEventListener('change', () => {
    // 松开时保存
    const alpha = (opacitySlider.value / 100).toFixed(2);
    chrome.storage.local.set({ overlayOpacity: alpha });
  });
  
  function sendOverlayOpacity(alpha) {
    chrome.tabs.query({ url: 'https://gemini.google.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'SET_OPACITY', alpha });
      });
    });
  }
  
  // 初始化时读取保存的透明度
  chrome.storage.local.get(['overlayOpacity'], (result) => {
    if (result.overlayOpacity !== undefined) {
      const saved = Math.round(result.overlayOpacity * 100);
      opacitySlider.value = saved;
      opacityValue.textContent = saved + '%';
    }
  });