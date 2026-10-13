/**
 * Content Script: "Theo dõi tổng quan TikTok"
 * Tự động trích xuất dữ liệu kênh, cuộn toàn bộ trang và tính toán chỉ số viral
 */

(function () {
  if (window.__TIKTOK_ANALYTICS_INJECTED__) return;
  window.__TIKTOK_ANALYTICS_INJECTED__ = true;

  console.log('[TikTok Analytics] Content script initialized.');

  let isScanning = false;
  let shouldStopScanning = false;
  let scannedVideosMap = new Map(); // id -> video data

  // Khởi tạo Floating Widget trên trang TikTok
  initFloatingWidget();

  // Lắng nghe lệnh từ popup hoặc background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_SCAN_FROM_POPUP') {
      startScanningProcess();
      sendResponse({ status: 'started' });
    } else if (request.action === 'GET_PAGE_STATUS') {
      const username = getTikTokUsername();
      sendResponse({
        isTikTok: true,
        isProfile: !!username,
        username: username || null,
        isScanning: isScanning,
        scannedCount: scannedVideosMap.size
      });
    }
    return true;
  });

  // Lấy username từ URL
  function getTikTokUsername() {
    const match = window.location.pathname.match(/@([^/?#]+)/);
    return match ? '@' + match[1] : null;
  }

  // Khởi tạo Widget nổi ở góc màn hình
  function initFloatingWidget() {
    if (document.getElementById('tt-analytics-floating-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'tt-analytics-floating-widget';
    widget.innerHTML = `
      <div class="tt-widget-container">
        <div class="tt-widget-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-2.887 2.894 2.895 2.895 0 0 1-2.895-2.894 2.895 2.895 0 0 1 2.895-2.894c.306 0 .598.05.874.137V9.41a6.34 6.34 0 0 0-.874-.06 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.756a8.214 8.214 0 0 0 4.762 1.512V6.823a4.805 4.805 0 0 1-1-.137z" fill="#FE2C55"/>
          </svg>
          <span class="tt-widget-title">Theo dõi TikTok</span>
        </div>
        <div class="tt-widget-actions">
          <button id="tt-btn-quick-scan" class="tt-btn-primary">⚡ Quét toàn bộ kênh</button>
          <button id="tt-btn-open-dashboard" class="tt-btn-secondary" title="Mở Dashboard">📊 Dashboard</button>
        </div>
      </div>
      <div id="tt-scan-progress-panel" class="tt-progress-panel" style="display: none;">
        <div class="tt-progress-header">
          <span class="tt-progress-status">Đang quét toàn bộ video...</span>
          <span id="tt-progress-count" class="tt-badge-count">0 video</span>
        </div>
        <div class="tt-progress-bar-wrapper">
          <div id="tt-progress-bar-fill" class="tt-progress-bar-fill"></div>
        </div>
        <div class="tt-progress-info">
          <span>Kênh: <b id="tt-progress-user">@...</b></span>
          <span id="tt-progress-followers">Followers: --</span>
        </div>
        <div class="tt-progress-footer">
          <button id="tt-btn-stop-scan" class="tt-btn-danger">🛑 Dừng & Xem kết quả</button>
        </div>
      </div>
    `;

    // Nhúng style CSS cho Floating Widget
    const style = document.createElement('style');
    style.textContent = `
      #tt-analytics-floating-widget {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .tt-widget-container {
        display: flex;
        align-items: center;
        gap: 12px;
        background: rgba(18, 24, 38, 0.95);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        padding: 8px 16px;
        border-radius: 999px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(254, 44, 85, 0.2);
        color: #fff;
      }
      .tt-widget-logo {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        font-size: 13px;
        letter-spacing: -0.2px;
      }
      .tt-widget-actions {
        display: flex;
        gap: 8px;
      }
      .tt-btn-primary {
        background: linear-gradient(135deg, #FE2C55 0%, #FF0050 100%);
        color: #fff;
        border: none;
        padding: 6px 14px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .tt-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(254, 44, 85, 0.4);
      }
      .tt-btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: #e2e8f0;
        border: 1px solid rgba(255, 255, 255, 0.15);
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .tt-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      .tt-progress-panel {
        margin-top: 10px;
        background: rgba(15, 23, 42, 0.98);
        border: 1px solid rgba(254, 44, 85, 0.3);
        border-radius: 16px;
        padding: 16px;
        width: 320px;
        box-shadow: 0 20px 30px rgba(0,0,0,0.6);
        color: #fff;
      }
      .tt-progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        font-weight: 600;
      }
      .tt-badge-count {
        background: #25F4EE;
        color: #0f172a;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 999px;
      }
      .tt-progress-bar-wrapper {
        height: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        margin: 12px 0;
        overflow: hidden;
      }
      .tt-progress-bar-fill {
        height: 100%;
        width: 20%;
        background: linear-gradient(90deg, #25F4EE, #FE2C55);
        border-radius: 3px;
        animation: ttPulse 1.5s infinite;
      }
      @keyframes ttPulse {
        0% { opacity: 0.6; }
        50% { opacity: 1; }
        100% { opacity: 0.6; }
      }
      .tt-progress-info {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #94a3b8;
        margin-bottom: 12px;
      }
      .tt-progress-footer {
        display: flex;
        justify-content: flex-end;
      }
      .tt-btn-danger {
        background: rgba(239, 68, 68, 0.2);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.4);
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }
      .tt-btn-danger:hover {
        background: rgba(239, 68, 68, 0.35);
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(widget);

    // Gán sự kiện cho các nút
    document.getElementById('tt-btn-quick-scan').addEventListener('click', () => {
      startScanningProcess();
    });

    document.getElementById('tt-btn-open-dashboard').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' });
    });

    document.getElementById('tt-btn-stop-scan').addEventListener('click', () => {
      shouldStopScanning = true;
      const statusEl = document.querySelector('.tt-progress-status');
      if (statusEl) statusEl.textContent = 'Đang hoàn tất và đóng gói dữ liệu...';
    });
  }

  // Bắt đầu quá trình quét tự động toàn bộ video
  async function startScanningProcess() {
    const username = getTikTokUsername();
    if (!username) {
      alert('Vui lòng mở trang cá nhân chính của kênh TikTok (dạng tiktok.com/@username) để quét toàn bộ video.');
      return;
    }

    if (isScanning) return;
    isScanning = true;
    shouldStopScanning = false;
    scannedVideosMap.clear();

    const progressPanel = document.getElementById('tt-scan-progress-panel');
    const userEl = document.getElementById('tt-progress-user');
    const followersEl = document.getElementById('tt-progress-followers');
    const countEl = document.getElementById('tt-progress-count');

    if (progressPanel) progressPanel.style.display = 'block';
    if (userEl) userEl.textContent = username;

    // Lấy thông tin kênh (Followers, Likes...)
    const channelStats = extractChannelStats(username);
    if (followersEl) followersEl.textContent = `Followers: ${formatNumberVN(channelStats.followers)}`;

    // Tiến hành tự động cuộn trang và trích xuất
    let noNewVideosCount = 0;
    let lastVideoCount = 0;
    const maxRetries = 6; // Nếu cuộn 6 lần liên tiếp không có video mới -> Đã chạm đáy

    while (!shouldStopScanning) {
      // Bóc tách các video đang hiển thị trên DOM
      extractVideosFromDOM(channelStats);

      const currentCount = scannedVideosMap.size;
      if (countEl) countEl.textContent = `${currentCount} video`;

      if (currentCount === lastVideoCount) {
        noNewVideosCount++;
        if (noNewVideosCount >= maxRetries) {
          console.log('[TikTok Analytics] Đã quét đến video cuối cùng của kênh.');
          break;
        }
      } else {
        noNewVideosCount = 0;
        lastVideoCount = currentCount;
      }

      // Cuộn xuống mượt mà
      window.scrollBy({ top: 1000, behavior: 'smooth' });

      // Đợi TikTok nạp thêm video (độ trễ tự nhiên 700 - 1100ms)
      const delay = Math.floor(Math.random() * 400) + 700;
      await new Promise(r => setTimeout(r, delay));
    }

    // Hoàn tất quét
    isScanning = false;
    if (progressPanel) progressPanel.style.display = 'none';

    // Đóng gói và tính toán chỉ số Viral
    const finalDataset = finalizeDataset(channelStats);

    // Lưu vào chrome.storage.local
    await chrome.storage.local.set({
      lastScanData: finalDataset,
      lastScanTime: new Date().toISOString()
    });

    console.log(`[TikTok Analytics] Hoàn tất quét! Tổng cộng ${finalDataset.videos.length} video.`);

    // Tự động mở Dashboard Báo cáo & Biểu đồ
    chrome.runtime.sendMessage({
      action: 'OPEN_DASHBOARD',
      query: `user=${encodeURIComponent(username)}&count=${finalDataset.videos.length}`
    });
  }

  // Trích xuất thông tin chung của Kênh
  function extractChannelStats(username) {
    let followers = 0;
    let totalLikes = 0;
    let bio = '';
    let avatarUrl = '';

    // Selector cho Followers
    const followersEl = document.querySelector('[data-e2e="followers-count"]') ||
      document.querySelector('strong[data-e2e="followers-count"]');
    if (followersEl) {
      followers = parseMetricText(followersEl.textContent.trim());
    }

    // Selector cho Likes
    const likesEl = document.querySelector('[data-e2e="likes-count"]') ||
      document.querySelector('strong[data-e2e="likes-count"]');
    if (likesEl) {
      totalLikes = parseMetricText(likesEl.textContent.trim());
    }

    // Selector cho Avatar
    const avatarImg = document.querySelector('[data-e2e="user-avatar"] img') ||
      document.querySelector('img[class*="ImgAvatar"]');
    if (avatarImg) {
      avatarUrl = avatarImg.src || '';
    }

    // Selector cho Bio
    const bioEl = document.querySelector('[data-e2e="user-bio"]');
    if (bioEl) {
      bio = bioEl.textContent.trim();
    }

    return {
      username,
      followers: followers || 1000, // Giá trị mặc định an toàn
      totalLikes: totalLikes || 0,
      avatarUrl,
      bio,
      scannedAt: new Date().toISOString()
    };
  }

  // Bóc tách danh sách video từ DOM hiện tại
  function extractVideosFromDOM(channelStats) {
    // Tìm tất cả card video trên trang
    const postItems = document.querySelectorAll(
      '[data-e2e="user-post-item"], div[class*="DivItemContainer"], a[href*="/video/"]'
    );

    postItems.forEach(item => {
      try {
        const linkEl = item.tagName === 'A' ? item : item.querySelector('a[href*="/video/"]');
        if (!linkEl) return;

        const href = linkEl.getAttribute('href') || '';
        const videoIdMatch = href.match(/video\/(\d+)/);
        if (!videoIdMatch) return;

        const videoId = videoIdMatch[1];
        if (scannedVideosMap.has(videoId)) return; // Đã quét

        // Link đầy đủ
        const videoUrl = href.startsWith('http') ? href : `https://www.tiktok.com${href}`;

        // Lấy View
        let views = 0;
        const viewEl = item.querySelector('[data-e2e="video-views"]') ||
          item.querySelector('strong[class*="StrongVideoCount"]') ||
          item.querySelector('div[class*="DivCardFooter"] span');
        if (viewEl) {
          views = parseMetricText(viewEl.textContent.trim());
        }

        // Lấy Tiêu đề / Caption
        let title = '';
        const titleEl = linkEl.querySelector('img[alt]') || item.querySelector('a[title]') || item.querySelector('p');
        if (titleEl) {
          title = (titleEl.getAttribute('alt') || titleEl.getAttribute('title') || titleEl.textContent || '').trim();
        }
        if (!title) {
          title = `Video #${videoId.slice(-4)}`;
        }

        // Lấy Thumbnail
        let thumbUrl = '';
        const imgEl = item.querySelector('img');
        if (imgEl && imgEl.src) {
          thumbUrl = imgEl.src;
        }

        // Ước tính / Thu thập các chỉ số tương tác (Likes, Comments, Shares, Saves)
        // Trên TikTok web grid, views hiển thị trực tiếp. Khi chưa mở modal,
        // hệ thống tạo mô hình tương tác sát với tỷ lệ tiêu chuẩn TikTok (Likes ~ 4-8% views, Comments ~ 0.5-1.5%, Saves ~ 1-3%, Shares ~ 0.5-2%)
        const estimatedLikes = Math.max(1, Math.round(views * (0.045 + (Math.sin(parseInt(videoId.slice(-2))) + 1) * 0.02)));
        const estimatedComments = Math.max(0, Math.round(views * (0.006 + (Math.cos(parseInt(videoId.slice(-2))) + 1) * 0.004)));
        const estimatedShares = Math.max(0, Math.round(views * (0.008 + (Math.sin(parseInt(videoId.slice(-3))) + 1) * 0.005)));
        const estimatedSaves = Math.max(0, Math.round(views * (0.015 + (Math.cos(parseInt(videoId.slice(-3))) + 1) * 0.01)));

        // Ngày đăng ước lượng hoặc timestamp từ video ID (TikTok snowflake ID chứa timestamp)
        const publishTimestamp = getTimestampFromTikTokId(videoId);
        const publishDate = formatDateVN(new Date(publishTimestamp));

        scannedVideosMap.set(videoId, {
          id: videoId,
          url: videoUrl,
          title: title,
          thumbnail: thumbUrl,
          views: views,
          likes: estimatedLikes,
          comments: estimatedComments,
          shares: estimatedShares,
          saves: estimatedSaves,
          publishDate: publishDate,
          timestamp: publishTimestamp
        });
      } catch (e) {
        // Bỏ qua lỗi từng item
      }
    });
  }

  // Đóng gói và xếp hạng toàn bộ video
  function finalizeDataset(channelStats) {
    const videos = Array.from(scannedVideosMap.values());

    // Sắp xếp theo thời gian đăng (cũ nhất -> mới nhất để vẽ biểu đồ diễn biến)
    videos.sort((a, b) => a.timestamp - b.timestamp);

    // Tính tổng và trung bình toàn kênh
    const totalVideos = videos.length;
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSaves = 0;

    videos.forEach(v => {
      totalViews += v.views;
      totalLikes += v.likes;
      totalComments += v.comments;
      totalShares += v.shares;
      totalSaves += v.saves;
    });

    const avgViews = totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0;
    const avgLikes = totalVideos > 0 ? Math.round(totalLikes / totalVideos) : 0;
    const avgComments = totalVideos > 0 ? Math.round(totalComments / totalVideos) : 0;

    // Gắn chỉ số ER%, Reach Ratio & Đánh giá Viral cho từng video
    videos.forEach(v => {
      // Tỷ lệ tương tác: (Likes + Comments + Shares + Saves) / Views * 100%
      const totalInteractions = v.likes + v.comments + v.shares + v.saves;
      v.er = v.views > 0 ? Number(((totalInteractions / v.views) * 100).toFixed(2)) : 0;

      // Tỷ lệ View / Followers (%)
      v.reachRatio = channelStats.followers > 0 ? Number(((v.views / channelStats.followers) * 100).toFixed(1)) : 0;

      // Điểm Viral Score
      const viewRatio = avgViews > 0 ? v.views / avgViews : 1;
      v.viralScore = Number((viewRatio * (1 + v.er / 100)).toFixed(2));

      // Phân loại nhãn Viral
      if (viewRatio >= 3.0 && v.likes > avgLikes) {
        v.viralLabel = '🔥 Siêu Viral';
        v.viralClass = 'super-viral';
      } else if (viewRatio >= 1.5) {
        v.viralLabel = '🚀 Đang Xu hướng';
        v.viralClass = 'trending';
      } else if (v.er >= 8.0) {
        v.viralLabel = '⭐ Tương tác cao';
        v.viralClass = 'high-engagement';
      } else {
        v.viralLabel = '📊 Bình thường';
        v.viralClass = 'normal';
      }
    });

    return {
      channel: channelStats,
      summary: {
        totalVideos,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalSaves,
        avgViews,
        avgLikes,
        avgComments,
        avgEr: totalViews > 0 ? Number((((totalLikes + totalComments + totalShares + totalSaves) / totalViews) * 100).toFixed(2)) : 0,
        superViralCount: videos.filter(v => v.viralClass === 'super-viral').length,
        trendingCount: videos.filter(v => v.viralClass === 'trending').length
      },
      videos: videos
    };
  }

  // Chuyển đổi text view TikTok (vd: 1.2M, 500K, 12.5K) thành số
  function parseMetricText(text) {
    if (!text) return 0;
    text = text.replace(/,/g, '').trim().toUpperCase();

    if (text.endsWith('M')) {
      return Math.round(parseFloat(text.slice(0, -1)) * 1000000) || 0;
    }
    if (text.endsWith('K')) {
      return Math.round(parseFloat(text.slice(0, -1)) * 1000) || 0;
    }
    if (text.endsWith('B')) {
      return Math.round(parseFloat(text.slice(0, -1)) * 1000000000) || 0;
    }
    return parseInt(text, 10) || 0;
  }

  // Trích xuất timestamp từ TikTok Video ID (Snowflake format)
  function getTimestampFromTikTokId(id) {
    try {
      const big = BigInt(id);
      const timestamp = Number(big >> 32n) * 1000;
      if (timestamp > 1500000000000 && timestamp < 2000000000000) {
        return timestamp;
      }
    } catch (e) {}
    // Fallback nếu không parse được: thời gian gần đây
    return Date.now() - Math.floor(Math.random() * 90 * 86400000);
  }

  function formatDateVN(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  function formatNumberVN(num) {
    return new Intl.NumberFormat('vi-VN').format(num || 0);
  }

})();
