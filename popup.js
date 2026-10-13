// Popup Script for "Theo dõi tổng quan TikTok"

document.addEventListener('DOMContentLoaded', async () => {
  const currentChannelEl = document.getElementById('current-channel');
  const statusCard = document.getElementById('status-card');
  const btnStartScan = document.getElementById('btn-start-scan');
  const btnOpenDashboard = document.getElementById('btn-open-dashboard');
  const btnSettingsIcon = document.getElementById('btn-settings-icon');
  const lastScanTimeEl = document.getElementById('last-scan-time');
  const savedChannelEl = document.getElementById('saved-channel');
  const sheetsStatusEl = document.getElementById('sheets-status');

  // 1. Kiểm tra cấu hình Google Sheets từ storage
  let storage = {};
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      storage = await chrome.storage.local.get(['googleWebhookUrl', 'lastScanData', 'lastScanTime']);
    } else {
      storage = {
        googleWebhookUrl: localStorage.getItem('tt_webhook') || '',
        lastScanData: null
      };
    }
  } catch (e) {
    console.warn('Storage fallback:', e);
  }

  if (storage.googleWebhookUrl) {
    sheetsStatusEl.textContent = 'Đã kết nối';
    sheetsStatusEl.className = 'sheets-badge configured';
  } else {
    sheetsStatusEl.textContent = 'Chưa cài Webhook';
    sheetsStatusEl.className = 'sheets-badge unconfigured';
  }

  // 2. Hiển thị thông tin lần quét gần nhất
  if (storage.lastScanData) {
    const data = storage.lastScanData;
    savedChannelEl.textContent = (data.channel && data.channel.username) || 'Đã có';
    if (storage.lastScanTime) {
      const dt = new Date(storage.lastScanTime);
      lastScanTimeEl.textContent = `${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')} - ${dt.getDate()}/${dt.getMonth() + 1}`;
    }
  }

  // 3. Kiểm tra Tab hiện tại có phải TikTok Profile không
  let activeTab = null;
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0];
  }

  if (activeTab && activeTab.url && activeTab.url.includes('tiktok.com')) {
    const match = activeTab.url.match(/tiktok\.com\/@([^/?#]+)/);
    if (match) {
      const username = '@' + match[1];
      currentChannelEl.textContent = username;
      statusCard.className = 'status-card ready';
      btnStartScan.disabled = false;
      btnStartScan.title = `Quét toàn bộ video của ${username}`;
    } else {
      currentChannelEl.textContent = 'Trang TikTok (Chưa vào kênh @)';
      statusCard.className = 'status-card not-tiktok';
      btnStartScan.disabled = true;
    }
  } else {
    currentChannelEl.textContent = 'Chưa mở trang TikTok';
    statusCard.className = 'status-card not-tiktok';
    btnStartScan.disabled = true;
  }

  // 4. Sự kiện Bắt đầu quét
  btnStartScan.addEventListener('click', async () => {
    btnStartScan.disabled = true;
    btnStartScan.innerHTML = '<span class="btn-icon">⏳</span><span>Đang kích hoạt...</span>';

    try {
      await chrome.tabs.sendMessage(activeTab.id, { action: 'START_SCAN_FROM_POPUP' });
      window.close(); // Đóng popup để người dùng theo dõi thanh tiến trình nổi trên TikTok
    } catch (err) {
      // Nếu content script chưa nạp kịp, reload tab hoặc thông báo
      alert('Vui lòng tải lại (F5) trang TikTok của kênh rồi thử lại nhé!');
      btnStartScan.disabled = false;
      btnStartScan.innerHTML = '<span class="btn-icon">⚡</span><span>Bắt đầu quét kênh</span>';
    }
  });

  // 5. Sự kiện Mở Dashboard
  btnOpenDashboard.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' });
    } else {
      window.open('dashboard.html', '_blank');
    }
    window.close();
  });

  // 6. Sự kiện Cài đặt
  btnSettingsIcon.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD', query: 'tab=settings' });
    } else {
      window.open('dashboard.html?tab=settings', '_blank');
    }
    window.close();
  });
});
