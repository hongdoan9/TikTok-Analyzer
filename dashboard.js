/**
 * Dashboard Logic - Theo dõi tổng quan TikTok
 * Quản lý vẽ biểu đồ tương tác, Bảng vàng Top 10, phân tích tiêu đề và đồng bộ Google Sheet
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Global App State
  let currentDataset = null;
  let chartFilter = '30'; // '30', '60', 'all', 'viral'
  let chartZoomPercent = 100;
  let currentLeaderboardTab = 'views'; // Mặc định hiển thị Top 10 Lượt Xem
  let hoveredPoint = null;

  // Trạng thái bộ lọc ngày
  let dateFilterPreset = 'all'; // 'all', '7d', '30d', '90d', 'this-month'
  let dateFilterFrom = '';
  let dateFilterTo = '';

  // DOM Elements
  const channelAvatar = document.getElementById('channel-avatar');
  const channelName = document.getElementById('channel-name');
  const channelBio = document.getElementById('channel-bio');
  const scanTimestamp = document.getElementById('scan-timestamp');
  const metricFollowers = document.getElementById('metric-followers');
  const metricTotalLikes = document.getElementById('metric-total-likes');

  // Stats cards
  const statTotalVideos = document.getElementById('stat-total-videos');
  const statTotalViews = document.getElementById('stat-total-views');
  const statAvgViews = document.getElementById('stat-avg-views');
  const statAvgEr = document.getElementById('stat-avg-er');
  const statViralCount = document.getElementById('stat-viral-count');
  const statTrendingSub = document.getElementById('stat-trending-sub');

  // Chart elements
  const canvas = document.getElementById('fluctuation-chart');
  const ctx = canvas.getContext('2d');
  const chartTooltip = document.getElementById('chart-tooltip');
  const timelineSlider = document.getElementById('timeline-slider');
  const sliderRangeText = document.getElementById('slider-range-text');

  // Leaderboard & Tables
  const leaderboardGrid = document.getElementById('leaderboard-grid');
  const searchQueriesTableBody = document.getElementById('search-queries-table-body');
  const queriesTotalCount = document.getElementById('queries-total-count');
  const fullVideosTableBody = document.getElementById('full-videos-table-body');
  const tableSearchInput = document.getElementById('table-search-input');

  // Date Filter Elements
  const filteredVideosCount = document.getElementById('filtered-videos-count');
  const totalVideosCount = document.getElementById('total-videos-count');
  const activeFilterBadge = document.getElementById('active-filter-badge');
  const dateFromInput = document.getElementById('date-from');
  const dateToInput = document.getElementById('date-to');
  const btnClearDate = document.getElementById('btn-clear-date');

  // Modals & Buttons
  const btnSyncSheets = document.getElementById('btn-sync-sheets');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnTestConnection = document.getElementById('btn-test-connection');
  const inputWebhookUrl = document.getElementById('input-webhook-url');
  const inputSheetUrl = document.getElementById('input-sheet-url');

  // 1. Tải dữ liệu từ Storage
  await loadDataFromStorage();

  // Kiểm tra nếu có query params tab=settings
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('tab') === 'settings') {
    openSettingsModal();
  }

  // 2. Load dữ liệu từ storage (Hỗ trợ cả chrome.storage và localStorage fallback)
  async function loadDataFromStorage() {
    let data = {};
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        data = await chrome.storage.local.get(['lastScanData', 'lastScanTime', 'googleWebhookUrl', 'googleSheetUrl']);
      } else {
        data = {
          googleWebhookUrl: localStorage.getItem('tt_webhook') || '',
          googleSheetUrl: localStorage.getItem('tt_sheet') || ''
        };
      }
    } catch (e) {
      console.warn('Fallback storage:', e);
    }

    if (data.googleWebhookUrl) inputWebhookUrl.value = data.googleWebhookUrl;
    if (data.googleSheetUrl) inputSheetUrl.value = data.googleSheetUrl;

    if (data.lastScanData && data.lastScanData.videos && data.lastScanData.videos.length > 0) {
      currentDataset = data.lastScanData;
    } else {
      // Dữ liệu mẫu Demo trực quan nếu chưa quét kênh nào
      currentDataset = generateSampleDataset();
    }

    renderAllDashboard(currentDataset);
  }

  // 3. Render toàn bộ giao diện
  function renderAllDashboard(dataset) {
    if (!dataset) return;

    const channel = dataset.channel || {};
    const summary = dataset.summary || {};
    const videos = dataset.videos || [];

    // Header info
    channelName.textContent = channel.username || '@tiktok_channel';
    channelBio.textContent = channel.bio || 'Kênh TikTok được phân tích chuyên sâu.';
    scanTimestamp.textContent = formatDateDisplay(channel.scannedAt || new Date().toISOString());
    metricFollowers.textContent = formatNumber(channel.followers || 0);
    metricTotalLikes.textContent = formatNumber(channel.totalLikes || summary.totalLikes || 0);

    if (channel.avatarUrl) {
      channelAvatar.src = channel.avatarUrl;
    } else {
      channelAvatar.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="%23FE2C55"><circle cx="12" cy="12" r="10" fill="%231e293b"/><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="%23fff"/></svg>';
    }

    // 5 Thẻ tóm tắt
    statTotalVideos.textContent = formatNumber(summary.totalVideos || videos.length);
    const subVideoEl = statTotalVideos.parentElement?.querySelector('.stat-sub');
    if (subVideoEl) {
      if (summary.totalPhotos !== undefined && summary.totalPhotos > 0) {
        subVideoEl.textContent = `${summary.totalVideosOnly || 0} video • ${summary.totalPhotos} bài ảnh`;
      } else {
        subVideoEl.textContent = '100% bài viết trên kênh';
      }
    }
    statTotalViews.textContent = formatNumber(summary.totalViews || 0);
    statAvgViews.textContent = formatNumber(summary.avgViews || 0);
    statAvgEr.textContent = `${summary.avgEr || 0}%`;
    statViralCount.textContent = `${summary.superViralCount || 0} bài`;
    statTrendingSub.textContent = `+${summary.trendingCount || 0} bài đang xu hướng`;

    // Biểu đồ
    renderFluctuationChart();

    // Bảng vàng Top 10 (Mặc định tab views)
    renderLeaderboard(currentLeaderboardTab);

    // Bảng tổng hợp từ khóa tìm kiếm & xu hướng SEO
    renderSearchQueriesTable(videos);

    // Bảng danh sách chi tiết (kèm bộ lọc ngày và tìm kiếm)
    applyTableFilters();
  }

  // 4. BIỂU ĐỒ BIẾN ĐỘNG (INTERACTIVE CANVAS ENGINE)
  function getFilteredChartVideos() {
    if (!currentDataset || !currentDataset.videos) return [];
    let list = [...currentDataset.videos];

    if (chartFilter === '30') {
      list = list.slice(-30);
    } else if (chartFilter === '60') {
      list = list.slice(-60);
    } else if (chartFilter === 'viral') {
      list = list.filter(v => v.viralClass === 'super-viral' || v.viralClass === 'trending');
      if (list.length === 0) list = currentDataset.videos.slice(-20);
    }

    // Áp dụng zoom slider
    if (chartZoomPercent < 100 && list.length > 10) {
      const takeCount = Math.max(10, Math.round((list.length * chartZoomPercent) / 100));
      list = list.slice(-takeCount);
    }

    return list;
  }

  function renderFluctuationChart() {
    const videos = getFilteredChartVideos();
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    if (videos.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Chưa có dữ liệu video để vẽ biểu đồ.', w / 2, h / 2);
      return;
    }

    const padding = { top: 48, right: 30, bottom: 45, left: 65 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Tìm max views
    let maxViews = Math.max(...videos.map(v => v.views), 1000);
    const avgViews = currentDataset.summary ? currentDataset.summary.avgViews : 5000;
    maxViews = Math.max(maxViews, avgViews * 1.2);

    // Vẽ lưới tọa độ ngang (Grid lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';

    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const yVal = Math.round((maxViews / gridSteps) * i);
      const yPos = padding.top + chartH - (i / gridSteps) * chartH;

      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(w - padding.right, yPos);
      ctx.stroke();

      ctx.fillText(formatCompactNumber(yVal), padding.left - 8, yPos + 3);
    }

    // Vẽ ĐƯỜNG MỐC TRUNG BÌNH KÊNH (Dashed Benchmark Line)
    const avgY = padding.top + chartH - (avgViews / maxViews) * chartH;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, avgY);
    ctx.lineTo(w - padding.right, avgY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Nhãn Mốc trung bình
    ctx.fillStyle = '#f59e0b';
    ctx.textAlign = 'left';
    ctx.fillText(`TB Kênh: ${formatCompactNumber(avgViews)}`, w - padding.right - 95, avgY - 6);

    // Tính tọa độ các điểm video
    const points = [];
    const stepX = chartW / Math.max(1, videos.length - 1);

    videos.forEach((v, index) => {
      const x = padding.left + index * stepX;
      const y = padding.top + chartH - (v.views / maxViews) * chartH;
      points.push({ x, y, video: v });
    });

    // Vẽ Vùng Gradient dưới đường biểu diễn (Area fill)
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, 'rgba(37, 244, 238, 0.25)');
    gradient.addColorStop(1, 'rgba(37, 244, 238, 0.0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(points[0].x, padding.top + chartH);
    points.forEach((p, i) => {
      if (i === 0) ctx.lineTo(p.x, p.y);
      else {
        // Bézier curve mượt mà
        const prev = points[i - 1];
        const cx = (prev.x + p.x) / 2;
        ctx.bezierCurveTo(cx, prev.y, cx, p.y, p.x, p.y);
      }
    });
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
    ctx.closePath();
    ctx.fill();

    // Vẽ Đường Line Views chính
    ctx.strokeStyle = '#25F4EE';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else {
        const prev = points[i - 1];
        const cx = (prev.x + p.x) / 2;
        ctx.bezierCurveTo(cx, prev.y, cx, p.y, p.x, p.y);
      }
    });
    ctx.stroke();

    // Vẽ các điểm (Data Points)
    points.forEach((p) => {
      const isSuperViral = p.video.viralClass === 'super-viral';
      const isTrending = p.video.viralClass === 'trending';

      if (isSuperViral) {
        // Điểm Siêu Viral màu đỏ hồng nổi bật
        ctx.fillStyle = '#FE2C55';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isTrending) {
        // Điểm Trending màu cam vàng
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (videos.length <= 40) {
        // Điểm bình thường khi ít bài
        ctx.fillStyle = '#25F4EE';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Vẽ nhãn trục hoành X (Thời gian / Thứ tự)
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    const labelInterval = Math.max(1, Math.floor(videos.length / 6));
    videos.forEach((v, idx) => {
      if (idx % labelInterval === 0 || idx === videos.length - 1) {
        const p = points[idx];
        const dateStr = v.publishDate ? v.publishDate.split(' ')[0] : `#${idx + 1}`;
        ctx.fillText(dateStr, p.x, h - padding.bottom + 16);
      }
    });

    // Lưu lại danh sách points phục vụ hover
    canvas.__chartPoints = points;
  }

  // Sự kiện tương tác trên Biểu đồ (Hover Tooltip)
  canvas.addEventListener('mousemove', (e) => {
    const points = canvas.__chartPoints;
    if (!points || points.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Tìm điểm gần chuột nhất
    let nearest = null;
    let minDist = 40; // bán kính phát hiện 40px

    points.forEach(p => {
      const dist = Math.hypot(p.x - mouseX, p.y - mouseY);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    });

    if (nearest) {
      hoveredPoint = nearest;
      showChartTooltip(nearest, rect);
    } else {
      hideChartTooltip();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    hideChartTooltip();
  });

  function showChartTooltip(point, rect) {
    const v = point.video;
    chartTooltip.style.display = 'block';

    // Tự động lật tooltip xuống dưới nếu điểm dữ liệu nằm gần mép trên của biểu đồ (chống lỗi cắt cụt)
    if (point.y < 140) {
      chartTooltip.style.transform = 'translate(-50%, 15px)';
    } else {
      chartTooltip.style.transform = 'translate(-50%, -110%)';
    }

    // Giữ tooltip không bao giờ tràn ra ngoài biên trái/phải
    let posX = point.x;
    const minX = 140;
    const maxX = rect.width - 140;
    if (posX < minX) posX = minX;
    if (posX > maxX) posX = maxX;

    chartTooltip.style.left = `${posX}px`;
    chartTooltip.style.top = `${point.y}px`;

    chartTooltip.innerHTML = `
      <div class="tooltip-title">${escapeHtml(v.title)}</div>
      <div class="tooltip-row">
        <span>👁️ Lượt xem:</span>
        <span class="tooltip-val">${formatNumber(v.views)}</span>
      </div>
      <div class="tooltip-row">
        <span>❤️ Lượt tim:</span>
        <span class="tooltip-val">${formatNumber(v.likes)}</span>
      </div>
      <div class="tooltip-row">
        <span>💬 Bình luận:</span>
        <span class="tooltip-val">${formatNumber(v.comments)}</span>
      </div>
      <div class="tooltip-row">
        <span>🔁 Đăng lại:</span>
        <span class="tooltip-val" style="color: #a855f7">${formatNumber(v.reposts || 0)}</span>
      </div>
      <div class="tooltip-row">
        <span>🔖 Lượt lưu:</span>
        <span class="tooltip-val" style="color: #f59e0b">${formatNumber(v.saves)}</span>
      </div>
      <div class="tooltip-row">
        <span>↗️ Chia sẻ:</span>
        <span class="tooltip-val">${formatNumber(v.shares)}</span>
      </div>
      <div class="tooltip-row">
        <span>🎯 Tương tác (ER):</span>
        <span class="tooltip-val">${v.er}%</span>
      </div>
      <div class="tooltip-row">
        <span>Đánh giá:</span>
        <span style="font-weight: 700; color: ${v.viralClass === 'super-viral' ? '#FE2C55' : (v.viralClass === 'trending' ? '#f59e0b' : '#25F4EE')}">${v.viralLabel}</span>
      </div>
    `;
  }

  function hideChartTooltip() {
    chartTooltip.style.display = 'none';
    hoveredPoint = null;
  }

  // 5. BẢNG VÀNG TOP 10 VIDEO (LEADERBOARD - TỐI ĐA 10 BÀI)
  function renderLeaderboard(tab) {
    if (!currentDataset || !currentDataset.videos) return;
    let list = [...currentDataset.videos];

    // Sắp xếp theo tiêu chí được chọn
    if (tab === 'views') {
      list.sort((a, b) => b.views - a.views);
    } else if (tab === 'saves') {
      list.sort((a, b) => b.saves - a.saves);
    } else if (tab === 'shares') {
      list.sort((a, b) => b.shares - a.shares);
    } else if (tab === 'reposts') {
      list.sort((a, b) => (b.reposts || 0) - (a.reposts || 0));
    } else if (tab === 'comments') {
      list.sort((a, b) => b.comments - a.comments);
    } else if (tab === 'likes') {
      list.sort((a, b) => b.likes - a.likes);
    } else if (tab === 'viral') {
      list.sort((a, b) => b.viralScore - a.viralScore);
    }

    // LẤY TỐI ĐA 10 VIDEO THEO YÊU CẦU
    const top10 = list.slice(0, 10);

    leaderboardGrid.innerHTML = '';
    top10.forEach((v, index) => {
      const rank = index + 1;
      let medal = `#${rank}`;
      let rankClass = 'rank-other';
      if (rank === 1) { medal = '🥇 Top 1'; rankClass = 'rank-1'; }
      else if (rank === 2) { medal = '🥈 Top 2'; rankClass = 'rank-2'; }
      else if (rank === 3) { medal = '🥉 Top 3'; rankClass = 'rank-3'; }

      const isPhoto = v.type === 'photo';
      const typeBadge = isPhoto ? '<span class="type-pill type-photo">📷 Bài ảnh</span>' : '<span class="type-pill type-video">🎬 Video</span>';

      const card = document.createElement('div');
      card.className = 'leader-card';
      card.innerHTML = `
        <div class="leader-top-badge">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="rank-badge ${rankClass}">${medal}</span>
            ${typeBadge}
          </div>
          <span class="viral-tag ${v.viralClass || 'normal'}">${v.viralLabel || 'Bình thường'}</span>
        </div>
        <h4 class="leader-card-title" title="${escapeHtml(v.title)}">${escapeHtml(v.title)}</h4>
        <div class="leader-metrics-grid">
          <div class="metric-cell">
            <span class="metric-cell-label">Lượt xem</span>
            <span class="metric-cell-val" style="color: #25F4EE">${formatNumber(v.views)}</span>
          </div>
          <div class="metric-cell">
            <span class="metric-cell-label">Lượt Tim</span>
            <span class="metric-cell-val" style="color: #FE2C55">${formatNumber(v.likes)}</span>
          </div>
          <div class="metric-cell">
            <span class="metric-cell-label">Bình luận</span>
            <span class="metric-cell-val" style="color: #38bdf8">${formatNumber(v.comments)}</span>
          </div>
          <div class="metric-cell">
            <span class="metric-cell-label">Đăng lại</span>
            <span class="metric-cell-val" style="color: #a855f7">${formatNumber(v.reposts || 0)}</span>
          </div>
          <div class="metric-cell">
            <span class="metric-cell-label">Lượt Lưu</span>
            <span class="metric-cell-val" style="color: #f59e0b">${formatNumber(v.saves)}</span>
          </div>
          <div class="metric-cell">
            <span class="metric-cell-label">Chia sẻ</span>
            <span class="metric-cell-val" style="color: #10b981">${formatNumber(v.shares)}</span>
          </div>
        </div>
        <div class="leader-card-footer">
          <span class="card-date">${v.publishDate ? v.publishDate.split(' ')[0] : 'TikTok'}</span>
          <a href="${v.url}" target="_blank" rel="noopener noreferrer" class="btn-card-link">
            <span>${isPhoto ? 'Xem bài ảnh' : 'Mở video'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
            </svg>
          </a>
        </div>
      `;
      leaderboardGrid.appendChild(card);
    });
  }

  // 6. BẢNG TỔNG HỢP TỪ KHÓA TÌM KIẾM TRÊN CÁC BÀI VIẾT (SEARCH QUERIES & SEO INSIGHTS)
  function renderSearchQueriesTable(videos) {
    if (!searchQueriesTableBody) return;
    searchQueriesTableBody.innerHTML = '';
    const queryMap = new Map();

    const avgChannelViews = currentDataset.summary ? currentDataset.summary.avgViews : 10000;

    videos.forEach(v => {
      const queries = new Set();
      // 1. Thêm từ v.searchQueries đã bóc tách
      if (Array.isArray(v.searchQueries)) {
        v.searchQueries.forEach(q => {
          const cleanQ = String(q).trim();
          if (cleanQ.length >= 2) queries.add(cleanQ);
        });
      }
      // 2. Thêm hashtag từ tiêu đề nếu có
      const titleTags = (v.title || '').match(/#[\p{L}\p{N}_]+/gu) || [];
      titleTags.forEach(t => queries.add(t.trim()));

      // 3. Trích xuất các cụm từ nổi bật trong caption (không phải stopword)
      const stopWords = new Set(['và', 'là', 'của', 'có', 'cho', 'được', 'với', 'trong', 'này', 'các', 'một', 'khi', 'thì', 'ở', 'đã', 'video', 'tiktok', 'trending', 'xuhuong', 'fyp']);
      const words = (v.title || '')
        .toLowerCase()
        .replace(/[#@.,/#!$%^&*;:{}=\-_`~()?"']/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !stopWords.has(w));

      // Gom cụm 2 từ (ví dụ "cách làm", "xây kênh")
      for (let i = 0; i < words.length - 1; i++) {
        const phrase = `${words[i]} ${words[i + 1]}`;
        if (phrase.length >= 6) queries.add(phrase);
      }
      words.forEach(w => {
        if (w.length >= 4) queries.add(w);
      });

      // Gom vào queryMap
      queries.forEach(q => {
        const key = q.toLowerCase();
        if (!queryMap.has(key)) {
          queryMap.set(key, {
            displayQuery: q,
            count: 0,
            totalViews: 0,
            totalEr: 0,
            videoIds: []
          });
        }
        const item = queryMap.get(key);
        item.count += 1;
        item.totalViews += v.views;
        item.totalEr += v.er;
        item.videoIds.push(v.id);
      });
    });

    const list = Array.from(queryMap.values())
      .map(item => ({
        query: item.displayQuery,
        count: item.count,
        totalViews: item.totalViews,
        avgViews: Math.round(item.totalViews / item.count),
        avgEr: Number((item.totalEr / item.count).toFixed(2)),
        videoIds: item.videoIds
      }))
      .filter(item => item.count >= 1)
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 15); // Top 15 từ khóa tìm kiếm nổi bật

    if (queriesTotalCount) {
      queriesTotalCount.textContent = `${list.length} từ khóa SEO`;
    }

    if (list.length === 0) {
      searchQueriesTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: #64748b; padding: 24px;">Chưa tìm thấy từ khóa tìm kiếm nào trên các bài viết.</td></tr>`;
      return;
    }

    list.forEach((item, index) => {
      let seoBadge = '<span class="viral-tag normal">📈 Ổn định</span>';
      if (item.totalViews >= 100000 || item.avgViews >= avgChannelViews * 1.8) {
        seoBadge = '<span class="viral-tag super-viral">🚀 Siêu Xu Hướng</span>';
      } else if (item.avgViews >= avgChannelViews * 1.2 || item.count >= 2) {
        seoBadge = '<span class="viral-tag trending">🔥 Tiềm Năng Cao</span>';
      }

      const isHashtag = item.query.startsWith('#');
      const queryDisplay = isHashtag
        ? `<span style="color: #25F4EE; font-weight: 700;">${escapeHtml(item.query)}</span>`
        : `<span style="color: #fff; font-weight: 600;">🔍 ${escapeHtml(item.query)}</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${queryDisplay}</td>
        <td class="text-center"><span class="badge badge-scan" style="font-size: 11px;">${item.count} bài</span></td>
        <td class="text-right" style="color: #25F4EE; font-weight: 700;">${formatNumber(item.totalViews)}</td>
        <td class="text-right" style="font-weight: 600;">${formatNumber(item.avgViews)}</td>
        <td class="text-center" style="font-weight: 700; color: #FE2C55;">${item.avgEr}%</td>
        <td class="text-center">${seoBadge}</td>
        <td class="text-center">
          <button class="btn-filter-query" data-query="${escapeHtml(item.query)}" title="Lọc các bài viết chứa từ khóa này">
            <span>🔍 Xem bài</span>
          </button>
        </td>
      `;
      searchQueriesTableBody.appendChild(tr);
    });

    // Sự kiện bấm "Xem bài" để lọc ngay xuống bảng video
    document.querySelectorAll('.btn-filter-query').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.query;
        tableSearchInput.value = q.replace(/^#/, '');
        applyTableFilters();
        document.querySelector('.datatable-section')?.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  // 7. BỘ LỌC BÀI VIẾT THEO NGÀY & TÌM KIẾM
  function getFilteredVideos() {
    if (!currentDataset || !currentDataset.videos) return [];
    const query = (tableSearchInput.value || '').toLowerCase().trim();
    const now = new Date();

    return currentDataset.videos.filter(v => {
      // 1. Lọc theo search text (tiêu đề, ID, searchQueries)
      if (query) {
        const matchTitle = v.title && v.title.toLowerCase().includes(query);
        const matchId = v.id && v.id.includes(query);
        const matchTags = Array.isArray(v.searchQueries) && v.searchQueries.some(q => q.toLowerCase().includes(query));
        if (!matchTitle && !matchId && !matchTags) return false;
      }

      // 2. Lọc theo ngày
      const vTime = v.timestamp ? new Date(v.timestamp) : (v.publishDate ? new Date(v.publishDate.replace(/-/g, '/')) : null);
      if (!vTime || isNaN(vTime.getTime())) return true;

      if (dateFilterPreset === '7d') {
        const cutoff = new Date(now.getTime() - 7 * 86400000);
        if (vTime < cutoff) return false;
      } else if (dateFilterPreset === '30d') {
        const cutoff = new Date(now.getTime() - 30 * 86400000);
        if (vTime < cutoff) return false;
      } else if (dateFilterPreset === '90d') {
        const cutoff = new Date(now.getTime() - 90 * 86400000);
        if (vTime < cutoff) return false;
      } else if (dateFilterPreset === 'this-month') {
        if (vTime.getMonth() !== now.getMonth() || vTime.getFullYear() !== now.getFullYear()) return false;
      }

      // Custom range từ ô chọn ngày
      if (dateFilterFrom) {
        const fromDate = new Date(dateFilterFrom + 'T00:00:00');
        if (vTime < fromDate) return false;
      }
      if (dateFilterTo) {
        const toDate = new Date(dateFilterTo + 'T23:59:59');
        if (vTime > toDate) return false;
      }

      return true;
    });
  }

  function applyTableFilters() {
    const filtered = getFilteredVideos();
    const totalCount = currentDataset && currentDataset.videos ? currentDataset.videos.length : 0;

    if (filteredVideosCount) filteredVideosCount.textContent = formatNumber(filtered.length);
    if (totalVideosCount) totalVideosCount.textContent = formatNumber(totalCount);

    const isFiltered = (dateFilterPreset !== 'all' || dateFilterFrom || dateFilterTo || (tableSearchInput.value || '').trim() !== '');
    if (activeFilterBadge) {
      activeFilterBadge.style.display = isFiltered ? 'inline-block' : 'none';
    }

    renderFullTable(filtered);
  }

  // BẢNG DANH SÁCH CHI TIẾT TOÀN BỘ BÀI VIẾT
  function renderFullTable(filteredList) {
    fullVideosTableBody.innerHTML = '';
    const list = filteredList || [];

    if (list.length === 0) {
      fullVideosTableBody.innerHTML = `<tr><td colspan="12" style="text-align:center; color: #64748b; padding: 24px;">Không tìm thấy bài viết nào phù hợp với bộ lọc ngày hoặc từ khóa tìm kiếm.</td></tr>`;
      return;
    }

    list.forEach((v, idx) => {
      const isPhoto = v.type === 'photo';
      const typeBadge = isPhoto ? '<span class="type-mini-pill photo">📷 Ảnh</span>' : '<span class="type-mini-pill video">🎬 Video</span>';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td style="max-width: 300px; font-weight: 500; color: #fff;">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${typeBadge}
            <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px;" title="${escapeHtml(v.title)}">
              ${escapeHtml(v.title)}
            </div>
          </div>
        </td>
        <td>${v.publishDate || '--'}</td>
        <td class="text-right" style="color: #25F4EE; font-weight: 700;">${formatNumber(v.views)}</td>
        <td class="text-right" style="color: #FE2C55;">${formatNumber(v.likes)}</td>
        <td class="text-right">${formatNumber(v.comments)}</td>
        <td class="text-right" style="color: #a855f7;">${formatNumber(v.reposts || 0)}</td>
        <td class="text-right">${formatNumber(v.shares)}</td>
        <td class="text-right" style="color: #f59e0b;">${formatNumber(v.saves)}</td>
        <td class="text-center" style="font-weight: 700;">${v.er}%</td>
        <td class="text-center"><span class="viral-tag ${v.viralClass}">${v.viralLabel}</span></td>
        <td class="text-center">
          <a href="${v.url}" target="_blank" rel="noopener noreferrer" style="color: #25F4EE; text-decoration: none; font-weight: 600;">Xem ↗</a>
        </td>
      `;
      fullVideosTableBody.appendChild(tr);
    });
  }

  // 8. ĐỒNG BỘ LÊN GOOGLE SHEET (1-CLICK SYNC - HỖ TRỢ XUẤT DỮ LIỆU ĐÃ LỌC)
  btnSyncSheets.addEventListener('click', async () => {
    let webhookUrl = '';
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const storage = await chrome.storage.local.get(['googleWebhookUrl']);
        webhookUrl = storage.googleWebhookUrl || '';
      } else {
        webhookUrl = localStorage.getItem('tt_webhook') || '';
      }
    } catch (e) {
      webhookUrl = localStorage.getItem('tt_webhook') || '';
    }

    if (!webhookUrl) {
      webhookUrl = inputWebhookUrl.value.trim();
    }

    if (!webhookUrl) {
      openSettingsModal();
      showToast('⚠️ Vui lòng dán Webhook URL của Google Sheet trước khi đồng bộ!', 'warning');
      return;
    }

    const videosToSync = getFilteredVideos();
    if (!videosToSync || videosToSync.length === 0) {
      showToast('⚠️ Không có bài viết nào trong bộ lọc để đồng bộ!', 'warning');
      return;
    }

    btnSyncSheets.disabled = true;
    btnSyncSheets.innerHTML = '<span class="btn-icon">⏳</span><span>Đang đồng bộ...</span>';

    // Đóng gói mảng 16 cột chuẩn (Bao gồm cả Lượt đăng lại)
    const scanTimeFormatted = formatDateDisplay(currentDataset.channel.scannedAt || new Date().toISOString());
    const channelUsername = currentDataset.channel.username || '@tiktok';
    const channelFollowers = currentDataset.channel.followers || 0;

    const rows = videosToSync.map(v => [
      scanTimeFormatted,                       // 1. Thời điểm quét
      channelUsername,                         // 2. Kênh TikTok
      channelFollowers,                        // 3. Tổng Follower
      v.id,                                    // 4. ID Bài viết
      v.title,                                 // 5. Tiêu đề bài viết
      v.publishDate,                           // 6. Ngày đăng
      v.views,                                 // 7. Lượt xem
      v.likes,                                 // 8. Lượt tim
      v.comments,                              // 9. Lượt bình luận
      v.reposts || 0,                          // 10. Lượt đăng lại
      v.shares,                                // 11. Lượt chia sẻ
      v.saves,                                 // 12. Lượt lưu
      `${v.er}%`,                              // 13. Tỷ lệ tương tác ER%
      `${v.reachRatio}%`,                      // 14. Tỷ lệ View/Follower%
      v.viralLabel,                            // 15. Đánh giá Viral
      v.url                                    // 16. Link Video
    ]);

    const payload = {
      channel: channelUsername,
      scanTime: scanTimeFormatted,
      rows: rows
    };

    const onComplete = (success, msg) => {
      btnSyncSheets.disabled = false;
      btnSyncSheets.innerHTML = '<span class="btn-icon">📊</span><span>Đồng bộ lên Google Sheet</span>';
      if (success) {
        showToast(`✅ Đã đồng bộ thành công ${rows.length} bài lên Google Sheet!`, 'success');
      } else {
        showToast(`❌ Lỗi kết nối Google Sheet: ${msg || 'Kiểm tra lại Webhook'}`, 'danger');
      }
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'SYNC_TO_GOOGLE_SHEETS',
          webhookUrl: webhookUrl,
          payload: payload
        }, (response) => {
          if (response && response.success) {
            onComplete(true);
          } else {
            onComplete(false, response?.error);
          }
        });
      } else {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({ status: 'success' }));
        onComplete(true);
      }
    } catch (err) {
      onComplete(false, err.message);
    }
  });

  // 9. XUẤT CSV CHO EXCEL (HỖ TRỢ XUẤT DỮ LIỆU ĐÃ LỌC)
  btnExportCsv.addEventListener('click', () => {
    const videosToExport = getFilteredVideos();
    if (!videosToExport || videosToExport.length === 0) {
      showToast('⚠️ Không có bài viết nào trong bộ lọc để xuất!', 'warning');
      return;
    }

    const headers = [
      "Thời điểm quét", "Kênh TikTok", "Tổng Follower", "ID Bài viết", "Tiêu đề bài viết",
      "Ngày đăng", "Lượt xem", "Lượt tim", "Lượt bình luận", "Lượt đăng lại", "Lượt chia sẻ", "Lượt lưu",
      "Tỷ lệ tương tác (%)", "Tỷ lệ View/Follower (%)", "Đánh giá Viral", "Link Video"
    ];

    const scanTimeFormatted = formatDateDisplay(currentDataset.channel.scannedAt || new Date().toISOString());
    const channelUsername = currentDataset.channel.username || '@tiktok';
    const channelFollowers = currentDataset.channel.followers || 0;

    let csvContent = '\uFEFF'; // BOM UTF-8
    csvContent += headers.map(h => `"${h}"`).join(',') + '\n';

    videosToExport.forEach(v => {
      const row = [
        scanTimeFormatted,
        channelUsername,
        channelFollowers,
        v.id,
        `"${(v.title || '').replace(/"/g, '""')}"`,
        v.publishDate,
        v.views,
        v.likes,
        v.comments,
        v.reposts || 0,
        v.shares,
        v.saves,
        `${v.er}%`,
        `${v.reachRatio}%`,
        v.viralLabel,
        v.url
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiktok_analytics_${channelUsername.replace('@', '')}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`💾 Đã xuất ${videosToExport.length} bài viết ra file CSV!`, 'success');
  });

  // 10. GÁN CÁC SỰ KIỆN ĐIỀU KHIỂN & BỘ LỌC
  // Lọc biểu đồ
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chartFilter = btn.dataset.filter;
      renderFluctuationChart();
    });
  });

  // Slider Zoom
  timelineSlider.addEventListener('input', (e) => {
    chartZoomPercent = parseInt(e.target.value, 10);
    sliderRangeText.textContent = `Hiển thị ${chartZoomPercent}%`;
    renderFluctuationChart();
  });

  // Tab Bảng vàng Top 10
  document.querySelectorAll('.tab-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLeaderboardTab = btn.dataset.tab;
      renderLeaderboard(currentLeaderboardTab);
    });
  });

  // Ô tìm kiếm bảng
  tableSearchInput.addEventListener('input', () => {
    applyTableFilters();
  });

  // Sự kiện các nút lọc ngày nhanh (7d, 30d, 90d, this-month, all)
  document.querySelectorAll('.date-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.date-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      dateFilterPreset = btn.dataset.range;
      // Reset custom inputs khi chọn preset
      if (dateFromInput) dateFromInput.value = '';
      if (dateToInput) dateToInput.value = '';
      dateFilterFrom = '';
      dateFilterTo = '';
      applyTableFilters();
    });
  });

  // Sự kiện chọn ngày tùy chỉnh
  if (dateFromInput) {
    dateFromInput.addEventListener('change', (e) => {
      dateFilterFrom = e.target.value;
      document.querySelectorAll('.date-preset-btn').forEach(b => b.classList.remove('active'));
      dateFilterPreset = 'custom';
      applyTableFilters();
    });
  }

  if (dateToInput) {
    dateToInput.addEventListener('change', (e) => {
      dateFilterTo = e.target.value;
      document.querySelectorAll('.date-preset-btn').forEach(b => b.classList.remove('active'));
      dateFilterPreset = 'custom';
      applyTableFilters();
    });
  }

  // Sự kiện xóa bộ lọc ngày
  if (btnClearDate) {
    btnClearDate.addEventListener('click', () => {
      document.querySelectorAll('.date-preset-btn').forEach(b => b.classList.remove('active'));
      const allBtn = document.querySelector('.date-preset-btn[data-range="all"]');
      if (allBtn) allBtn.classList.add('active');
      dateFilterPreset = 'all';
      if (dateFromInput) dateFromInput.value = '';
      if (dateToInput) dateToInput.value = '';
      dateFilterFrom = '';
      dateFilterTo = '';
      tableSearchInput.value = '';
      applyTableFilters();
    });
  }

  // Modal Settings
  btnOpenSettings.addEventListener('click', openSettingsModal);
  btnCloseModal.addEventListener('click', closeSettingsModal);

  btnSaveSettings.addEventListener('click', async () => {
    const webhookUrl = inputWebhookUrl.value.trim();
    const sheetUrl = inputSheetUrl.value.trim();

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          googleWebhookUrl: webhookUrl,
          googleSheetUrl: sheetUrl
        });
      } else {
        localStorage.setItem('tt_webhook', webhookUrl);
        localStorage.setItem('tt_sheet', sheetUrl);
      }
    } catch (e) {
      localStorage.setItem('tt_webhook', webhookUrl);
      localStorage.setItem('tt_sheet', sheetUrl);
    }

    closeSettingsModal();
    showToast('💾 Đã lưu cấu hình Google Sheet!', 'success');
  });

  btnTestConnection.addEventListener('click', async () => {
    const webhookUrl = inputWebhookUrl.value.trim();
    if (!webhookUrl) {
      alert('Vui lòng dán Webhook URL trước khi kiểm tra!');
      return;
    }

    btnTestConnection.textContent = '⏳ Đang kiểm tra...';
    try {
      const res = await fetch(webhookUrl);
      const data = await res.json().catch(() => ({}));
      btnTestConnection.textContent = '⚡ Kiểm tra kết nối';
      if (data.status === 'online' || res.ok) {
        alert('🎉 Kết nối thành công! Webhook Google Sheet đã sẵn sàng hoạt động.');
      } else {
        alert('Kết nối được gửi, nhưng hãy đảm bảo bạn đã chọn quyền truy cập là "Bất kỳ ai (Anyone)".');
      }
    } catch (err) {
      btnTestConnection.textContent = '⚡ Kiểm tra kết nối';
      alert('⚠️ Không thể kết nối tới URL Webhook: ' + err.message);
    }
  });

  function openSettingsModal() {
    settingsModal.style.display = 'flex';
  }

  function closeSettingsModal() {
    settingsModal.style.display = 'none';
  }

  // Toast thông báo
  function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.display = 'block';
    if (type === 'danger') toast.style.background = 'rgba(239, 68, 68, 0.95)';
    else if (type === 'warning') toast.style.background = 'rgba(245, 158, 11, 0.95)';
    else toast.style.background = 'rgba(16, 185, 129, 0.95)';

    setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
  }

  // Format Helper
  function formatNumber(num) {
    return new Intl.NumberFormat('vi-VN').format(num || 0);
  }

  function formatCompactNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  function formatDateDisplay(iso) {
    if (!iso) return '--';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Dữ liệu mẫu Demo trực quan khi mở lần đầu
  function generateSampleDataset() {
    const sampleVideos = [];
    const titles = [
      'Bí quyết tạo video triệu view trên TikTok cho người mới bắt đầu',
      'Cách tối ưu hồ sơ kênh hút follow nhanh nhất 2026',
      'Top 5 mẹo chỉnh sửa video giật gân giữ chân người xem',
      'Hướng dẫn xây kênh từ con số 0 lên 100K follower',
      'Sai lầm chết người khi đăng video khiến kênh bị flop',
      'Khung giờ vàng đăng video TikTok hiệu quả nhất tuần này',
      'Cách bắt trend âm thanh và tiêu đề video hút tương tác',
      'Quy trình viết kịch bản 15 giây giữ chân người xem đến cuối',
      'Tại sao video của bạn không lên xu hướng? Phân tích thuật toán',
      'Chia sẻ tài liệu bí kíp viral TikTok miễn phí cho anh em',
      'Chiến lược tăng tương tác tự nhiên không cần quảng cáo',
      'Phân tích ca thực tế: Kênh mới đạt 500K view sau 3 ngày'
    ];

    const baseViews = 15000;
    for (let i = 0; i < 24; i++) {
      const isViral = i === 11 || i === 19 || i === 5;
      const isTrending = i === 8 || i === 15 || i === 22;
      const factor = isViral ? (4.2 + Math.random() * 2) : isTrending ? (1.8 + Math.random()) : (0.4 + Math.random() * 0.9);
      const views = Math.round(baseViews * factor);
      const likes = Math.round(views * (0.05 + Math.random() * 0.03));
      const comments = Math.round(views * (0.008 + Math.random() * 0.005));
      const shares = Math.round(views * (0.01 + Math.random() * 0.01));
      const saves = Math.round(views * (0.02 + Math.random() * 0.015));
      const reposts = Math.round(views * (0.005 + Math.random() * 0.004));
      const er = Number((((likes + comments + shares + saves + reposts) / views) * 100).toFixed(2));
      const title = titles[i % titles.length] + (i > 11 ? ` (Phần ${Math.floor(i/12) + 1})` : '');

      let viralLabel = '📊 Bình thường';
      let viralClass = 'normal';
      if (views >= 100000 || isViral) { viralLabel = '🔥 Siêu Viral'; viralClass = 'super-viral'; }
      else if (views >= 30000 || isTrending) { viralLabel = '🚀 Đang Xu hướng'; viralClass = 'trending'; }
      else if (er > 8) { viralLabel = '⭐ Tương tác cao'; viralClass = 'high-engagement'; }

      sampleVideos.push({
        id: `72958392019485${100 + i}`,
        url: 'https://www.tiktok.com',
        title: title,
        views: views,
        likes: likes,
        comments: comments,
        shares: shares,
        saves: saves,
        reposts: reposts,
        searchQueries: ['#xuhuong', '#tiktokviral', '#xaykenhtiktok', title.split(' ').slice(0, 3).join(' ')],
        er: er,
        reachRatio: Number(((views / 85000) * 100).toFixed(1)),
        viralScore: Number((factor * (1 + er/100)).toFixed(2)),
        viralLabel: viralLabel,
        viralClass: viralClass,
        publishDate: `2026-10-${String((i % 12) + 1).padStart(2, '0')} 19:30`,
        timestamp: Date.now() - (24 - i) * 86400000
      });
    }

    return {
      channel: {
        username: '@demo_channel_tiktok',
        followers: 85200,
        totalLikes: 685000,
        bio: 'Kênh chia sẻ mẹo, chiến lược xây kênh và nội dung viral TikTok thực chiến.',
        scannedAt: new Date().toISOString()
      },
      summary: {
        totalVideos: sampleVideos.length,
        totalViews: sampleVideos.reduce((sum, v) => sum + v.views, 0),
        totalLikes: sampleVideos.reduce((sum, v) => sum + v.likes, 0),
        avgViews: Math.round(sampleVideos.reduce((sum, v) => sum + v.views, 0) / sampleVideos.length),
        avgEr: 6.84,
        superViralCount: sampleVideos.filter(v => v.viralClass === 'super-viral').length,
        trendingCount: sampleVideos.filter(v => v.viralClass === 'trending').length
      },
      videos: sampleVideos
    };
  }

  // Tự động resize canvas khi thay đổi kích thước cửa sổ
  window.addEventListener('resize', () => {
    renderFluctuationChart();
  });
});
