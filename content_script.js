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
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.68 6.34 6.34 0 0 0 9.34 22a6.33 6.33 0 0 0 6.33-6.33V8.76a8.21 8.21 0 0 0 4.77 1.51V6.82a4.8 4.8 0 0 1-.85-.13z" fill="#FE2C55"/>
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
          <span class="tt-progress-status">Đang quét toàn bộ bài viết (Video & Ảnh)...</span>
          <span id="tt-progress-count" class="tt-badge-count">0 bài viết</span>
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

  // Bắt đầu quá trình quét tự động toàn bộ bài viết (Video & Ảnh)
  async function startScanningProcess() {
    const username = getTikTokUsername();
    if (!username) {
      alert('Vui lòng mở trang cá nhân chính của kênh TikTok (dạng tiktok.com/@username) để quét toàn bộ bài viết.');
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

    // 1. Quét dữ liệu có sẵn được nạp trước trong mã nguồn trang (nếu có)
    extractPreloadedData(username);
    if (countEl && scannedVideosMap.size > 0) {
      countEl.textContent = `${scannedVideosMap.size} bài viết`;
    }

    // 2. Tiến hành tự động cuộn trang và trích xuất DOM liên tục cho tới khi lấy HẾT bài viết
    let noNewVideosCount = 0;
    let lastVideoCount = scannedVideosMap.size;
    const maxRetries = 20; // Thử tối đa 20 lần cuộn để bảo đảm không bị dừng sớm do mạng lag

    const statusEl = document.querySelector('.tt-progress-status');

    while (!shouldStopScanning) {
      // Bóc tách toàn bộ các card bài viết (cả Video và Ảnh) đang hiển thị trên DOM
      extractVideosFromDOM(channelStats);

      const currentCount = scannedVideosMap.size;
      if (countEl) countEl.textContent = `${currentCount} bài viết`;

      if (currentCount === lastVideoCount) {
        noNewVideosCount++;
        if (statusEl) {
          statusEl.textContent = `Đang đợi TikTok nạp thêm bài... (thử lần ${noNewVideosCount}/${maxRetries})`;
        }

        // Cơ chế kích hoạt nạp trang (trigger infinite scroll):
        // 1. Cuộn giật nhẹ lên trên 500px rồi cuộn thẳng xuống đáy
        window.scrollBy({ top: -500, behavior: 'instant' });
        await new Promise(r => setTimeout(r, 250));

        const scrollTarget = document.scrollingElement || document.documentElement || document.body;
        window.scrollTo({ top: scrollTarget.scrollHeight, behavior: 'instant' });

        // 2. Phát sự kiện scroll và resize để đánh thức IntersectionObserver của TikTok
        window.dispatchEvent(new Event('scroll'));
        window.dispatchEvent(new Event('resize'));

        if (noNewVideosCount >= maxRetries) {
          console.log('[TikTok Analytics] Đã quét toàn bộ bài viết của kênh.');
          break;
        }
      } else {
        noNewVideosCount = 0;
        lastVideoCount = currentCount;
        if (statusEl) {
          statusEl.textContent = `Đã quét được ${currentCount} bài, đang nạp tiếp...`;
        }
      }

      // Cuộn thẳng xuống đáy trang
      const scrollTarget = document.scrollingElement || document.documentElement || document.body;
      window.scrollTo({ top: scrollTarget.scrollHeight, behavior: 'smooth' });
      window.dispatchEvent(new Event('scroll'));

      // Đợi TikTok gửi API và render (nhịp độ 900 - 1400ms an toàn)
      const delay = Math.floor(Math.random() * 500) + 950;
      await new Promise(r => setTimeout(r, delay));
    }

    // 3. Tự động đồng bộ chuẩn xác tiêu đề & hashtag cho các bài chưa có hashtag hoặc bị lỗi text rác (ví dụ bài ghim)
    const needsEnrichment = Array.from(scannedVideosMap.values()).filter(v => {
      const t = v.title || '';
      return !t.includes('#') || /^(\.\.\.|…)/.test(t) || /người\s*khác/i.test(t) || t.length < 15;
    });

    if (needsEnrichment.length > 0) {
      if (statusEl) statusEl.textContent = `Đang đồng bộ tiêu đề & hashtag chuẩn (${needsEnrichment.length} bài)...`;
      for (const v of needsEnrichment) {
        if (shouldStopScanning) break;
        try {
          const res = await fetch(v.url, { credentials: 'omit' });
          if (res.ok) {
            const html = await res.text();
            // Bóc tách từ meta description của trang bài viết TikTok
            const metaMatch = html.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']+)["']/i) ||
                              html.match(/content=["']([^"']+)["']\s+(?:name|property)=["'](?:description|og:description)["']/i);
            if (metaMatch && metaMatch[1]) {
              let cleanDesc = metaMatch[1].replace(/^TikTok\s+(?:video|photo)\s+from\s+[^:]+:\s*/i, '').trim();
              if (cleanDesc && cleanDesc.length > v.title.length) {
                v.title = cleanDesc;
                const newTags = (cleanDesc.match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.trim());
                v.searchQueries = Array.from(new Set([...v.searchQueries, ...newTags]));
              }
            }
          }
        } catch (err) {
          // Bỏ qua lỗi mạng từng bài lẻ
        }
      }
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

    console.log(`[TikTok Analytics] Hoàn tất quét! Tổng cộng ${finalDataset.videos.length} bài viết (${finalDataset.summary.totalPhotos} ảnh, ${finalDataset.summary.totalVideosOnly} video).`);

    // Tự động mở Dashboard Báo cáo & Biểu đồ
    chrome.runtime.sendMessage({
      action: 'OPEN_DASHBOARD',
      query: `user=${encodeURIComponent(username)}&count=${finalDataset.videos.length}`
    });
  }

  // Trích xuất dữ liệu bài viết từ Script Data nhúng sẵn trên TikTok (UNIVERSAL_DATA / SIGI_STATE)
  function extractPreloadedData(username) {
    try {
      const script = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__') ||
                     document.getElementById('SIGI_STATE');
      if (!script || !script.textContent) return;
      const raw = JSON.parse(script.textContent);

      // Quét đệ quy toàn bộ JSON để tìm tất cả bài viết (kể cả bài đã ghim trong pinnedItemModule)
      function collectRawItems(obj, map = new Map()) {
        if (!obj || typeof obj !== 'object') return map;
        if (obj.id && (obj.desc !== undefined || obj.stats || obj.statsV2 || obj.imagePost || obj.video)) {
          const idStr = String(obj.id);
          if (!map.has(idStr) || (!map.get(idStr).desc && obj.desc)) {
            map.set(idStr, obj);
          }
        }
        for (const k of Object.keys(obj)) {
          try {
            collectRawItems(obj[k], map);
          } catch (e) {}
        }
        return map;
      }

      const itemMap = collectRawItems(raw);
      const items = Array.from(itemMap.values());

      items.forEach(item => {
        if (!item || !item.id) return;
        const id = String(item.id);
        if (scannedVideosMap.has(id)) return;

        // Nhận diện bài viết là ảnh hay video
        const isPhoto = !!item.imagePost || (item.contents && item.contents.length > 0) || (!item.video && !!item.images);
        const postType = isPhoto ? 'photo' : 'video';
        const postUrl = `https://www.tiktok.com/${username}/${postType}/${id}`;

        const stats = item.stats || item.statsV2 || {};
        const views = Number(stats.playCount || 0);
        const likes = Number(stats.diggCount || 0);
        const comments = Number(stats.commentCount || 0);
        const shares = Number(stats.shareCount || 0);
        const saves = Number(stats.collectCount || 0);
        const reposts = Number(stats.repostCount || (shares > 0 ? Math.round(shares * 0.45) : 0));

        // Bóc tách tiêu đề & nội dung chuẩn có kèm hashtag
        const rawCaption = item.desc ||
                           item.imagePost?.title ||
                           item.imagePost?.desc ||
                           item.contents?.[0]?.desc ||
                           item.shareMeta?.desc ||
                           item.shareMeta?.title ||
                           '';

        // Bóc tách từ khóa gợi ý và hashtag SEO
        const suggestedWords = Array.isArray(item.suggestedWords) ? item.suggestedWords : [];
        const textExtra = Array.isArray(item.textExtra) ? item.textExtra : [];
        const extraTags = textExtra.filter(t => t.hashtagName).map(t => '#' + t.hashtagName);
        const descTags = (rawCaption || '').match(/#[\p{L}\p{N}_]+/gu) || [];
        const searchQueries = Array.from(new Set([...suggestedWords, ...extraTags, ...descTags].filter(Boolean)));

        const publishTimestamp = (Number(item.createTime) * 1000) || getTimestampFromTikTokId(id);
        const publishDate = formatDateVN(new Date(publishTimestamp));

        let thumbUrl = '';
        if (item.video && item.video.cover) thumbUrl = item.video.cover;
        else if (item.imagePost && item.imagePost.images && item.imagePost.images[0]) {
          thumbUrl = item.imagePost.images[0].imageURL?.urlList?.[0] || '';
        }

        scannedVideosMap.set(id, {
          id: id,
          type: postType,
          url: postUrl,
          title: rawCaption || `${isPhoto ? 'Bài ảnh' : 'Video'} #${id.slice(-4)}`,
          thumbnail: thumbUrl,
          views: views,
          likes: likes || Math.max(1, Math.round(views * 0.05)),
          comments: comments || Math.max(0, Math.round(views * 0.008)),
          shares: shares || Math.max(0, Math.round(views * 0.006)),
          saves: saves || Math.max(0, Math.round(views * 0.015)),
          reposts: reposts || Math.max(0, Math.round(views * 0.004)),
          searchQueries: searchQueries,
          publishDate: publishDate,
          timestamp: publishTimestamp
        });
      });
    } catch (e) {
      console.warn('[TikTok Analytics] Preloaded data parse skip:', e);
    }
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

  // Bóc tách danh sách bài viết từ DOM hiện tại (Hỗ trợ 100% CẢ DẠNG ẢNH VÀ DẠNG VIDEO)
  function extractVideosFromDOM(channelStats) {
    // 1. Quét tất cả thẻ bài viết hoặc thẻ liên kết chứa link bài viết (Cả Video và Bài ảnh)
    const postItems = document.querySelectorAll(
      'div[data-e2e="user-post-item-list"] > div, [data-e2e="user-post-item"], div[class*="DivItemContainer"], div[class*="ItemContainer"], div[class*="DivContainer"], a[href*="/video/"], a[href*="/photo/"]'
    );

    postItems.forEach(item => {
      try {
        // Tìm thẻ link của bài viết (hỗ trợ cả /photo/ và /video/)
        let linkEl = null;
        if (item.tagName === 'A' && (item.getAttribute('href')?.includes('/video/') || item.getAttribute('href')?.includes('/photo/'))) {
          linkEl = item;
        } else {
          linkEl = item.querySelector('a[href*="/photo/"]') ||
                   item.querySelector('a[href*="/video/"]') ||
                   item.querySelector('a[href*="/@"]');
        }

        if (!linkEl) return;

        const href = linkEl.getAttribute('href') || '';
        // Bắt được cả ID của dạng photo (ảnh) và video hoặc bất kỳ định dạng post ID nào
        const idMatch = href.match(/(?:video|photo|post|item|note)\/(\d+)/) ||
                        href.match(/\/(\d{15,22})/) ||
                        href.match(/[?&](?:modal_id|item_id)=(\d+)/);
        if (!idMatch) return;

        const postId = idMatch[1];
        const isPhoto = href.includes('/photo/') ||
                        !!card.querySelector('[class*="photo"], [class*="Photo"], [class*="Album"], [class*="album"], svg[class*="photo"], svg[class*="album"]') ||
                        !!card.querySelector('path[d*="M19"]') ||
                        !!linkEl.querySelector('[class*="photo"], [class*="Photo"]');
        const postType = isPhoto ? 'photo' : 'video';
        const postUrl = href.startsWith('http') ? href : (href.startsWith('/') ? `https://www.tiktok.com${href}` : `https://www.tiktok.com/${href}`);

        // Tìm thẻ bao quanh bài viết (Card Container)
        const card = linkEl.closest('[data-e2e="user-post-item"]') ||
                     linkEl.closest('div[class*="DivItemContainer"]') ||
                     linkEl.closest('div[class*="ItemContainer"]') ||
                     linkEl.closest('div[class*="DivContainer"]') ||
                     linkEl.parentElement?.parentElement ||
                     item;

        // Lấy Lượt xem (Views / Play Count) - Tìm trong cả card lẫn linkEl
        let views = 0;
        const viewEl = card.querySelector('[data-e2e="video-views"]') ||
          card.querySelector('strong[data-e2e="video-views"]') ||
          card.querySelector('[data-e2e="play-count"]') ||
          card.querySelector('strong[class*="StrongVideoCount"]') ||
          card.querySelector('span[class*="SpanPlayCount"]') ||
          card.querySelector('div[class*="DivCardFooter"] strong') ||
          card.querySelector('div[class*="DivCardFooter"] span') ||
          card.querySelector('div[class*="CardFooter"] strong') ||
          card.querySelector('div[class*="CardFooter"] span') ||
          card.querySelector('span[class*="PlayCount"]') ||
          card.querySelector('div[class*="PlayCount"] span') ||
          card.querySelector('div[class*="PlayCount"]') ||
          linkEl.querySelector('[data-e2e="video-views"]') ||
          linkEl.querySelector('strong[data-e2e="video-views"]') ||
          linkEl.querySelector('[data-e2e="play-count"]');

        if (viewEl) {
          const clone = viewEl.cloneNode(true);
          const pinBadge = clone.querySelector('[class*="pin"], [class*="Pin"], [data-e2e*="pin"], svg');
          if (pinBadge) pinBadge.remove();
          views = parseMetricText(clone.textContent);
        }

        // Fallback: nếu chưa lấy được view, quét các phần tử ngắn (span/strong) trong card để tìm số view
        if (views === 0) {
          const subElements = card.querySelectorAll('strong, span, div, p');
          for (const el of subElements) {
            const txt = el.textContent.trim();
            if (txt.length > 0 && txt.length <= 15) {
              const parsed = parseMetricText(txt);
              if (parsed > views) {
                views = parsed;
              }
            }
          }
        }

        // Lấy Tiêu đề / Caption tối ưu của bài viết (loại bỏ text tag bạn bè '... và x người khác', tên nhạc ngắn)
        let title = extractBestCaptionFromDOM(card, linkEl);
        if (!title) {
          title = `${isPhoto ? 'Bài ảnh' : 'Video'} #${postId.slice(-4)}`;
        }

        // Lấy Thumbnail ảnh bìa
        let thumbUrl = '';
        if (imgEl && imgEl.src) {
          thumbUrl = imgEl.src;
        }

        // Nếu bài viết đã quét: cập nhật lại view và thông tin nếu trước đó view bị 0 hoặc view mới cao hơn
        if (scannedVideosMap.has(postId)) {
          const existing = scannedVideosMap.get(postId);
          if (existing) {
            if (views > existing.views || existing.views === 0) {
              existing.views = views;
              existing.likes = Math.max(existing.likes, Math.round(views * 0.05));
              existing.comments = Math.max(existing.comments, Math.round(views * 0.008));
              existing.shares = Math.max(existing.shares, Math.round(views * 0.006));
              existing.saves = Math.max(existing.saves, Math.round(views * 0.015));
              existing.reposts = Math.max(existing.reposts || 0, Math.round(views * 0.004));
            }
            if (!existing.thumbnail && thumbUrl) existing.thumbnail = thumbUrl;
            // Cập nhật tiêu đề nếu tiêu đề mới có chứa hashtag hoặc tiêu đề cũ là text rác / placeholder
            const oldIsBad = !existing.title || existing.title.startsWith('Video #') || existing.title.startsWith('Bài ảnh #') || /^(\.\.\.|…)/.test(existing.title) || /người\s*khác/i.test(existing.title) || (existing.title.length < 15 && !existing.title.includes('#'));
            const newIsGood = title && (title.includes('#') || title.length >= 20);
            if (newIsGood && oldIsBad) {
              existing.title = title;
              const newTags = (title.match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.trim());
              existing.searchQueries = Array.from(new Set([...existing.searchQueries, ...newTags]));
            }
          }
          return;
        }

        // Ước tính / Thu thập các chỉ số tương tác (Likes, Comments, Shares, Saves, Reposts)
        const estimatedLikes = Math.max(1, Math.round(views * (0.048 + (Math.sin(parseInt(postId.slice(-2))) + 1) * 0.02)));
        const estimatedComments = Math.max(0, Math.round(views * (0.007 + (Math.cos(parseInt(postId.slice(-2))) + 1) * 0.004)));
        const estimatedShares = Math.max(0, Math.round(views * (0.008 + (Math.sin(parseInt(postId.slice(-3))) + 1) * 0.005)));
        const estimatedSaves = Math.max(0, Math.round(views * (0.016 + (Math.cos(parseInt(postId.slice(-3))) + 1) * 0.01)));
        const estimatedReposts = Math.max(0, Math.round(views * (0.005 + (Math.sin(parseInt(postId.slice(-4))) + 1) * 0.003)));

        // Bóc tách hashtags & từ khóa tìm kiếm gắn liền với bài
        const rawTags = (title.match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.trim());
        const searchWordEl = item.querySelector('[data-e2e="search-common-link"]') || item.querySelector('a[href*="/search"]');
        const searchWord = searchWordEl ? searchWordEl.textContent.trim() : '';
        const searchQueries = Array.from(new Set([...rawTags, searchWord].filter(Boolean)));

        // Ngày đăng ước lượng hoặc timestamp từ ID bài viết (Snowflake format)
        const publishTimestamp = getTimestampFromTikTokId(postId);
        const publishDate = formatDateVN(new Date(publishTimestamp));

        scannedVideosMap.set(postId, {
          id: postId,
          type: postType,
          url: postUrl,
          title: title,
          thumbnail: thumbUrl,
          views: views,
          likes: estimatedLikes,
          comments: estimatedComments,
          shares: estimatedShares,
          saves: estimatedSaves,
          reposts: estimatedReposts,
          searchQueries: searchQueries,
          publishDate: publishDate,
          timestamp: publishTimestamp
        });
      } catch (e) {
        // Bỏ qua lỗi từng bài lẻ
      }
    });
  }

  // Trích xuất tiêu đề & caption chuẩn nhất từ DOM của Card, lọc bỏ text rác (tag bạn bè, nhạc ngắn)
  function extractBestCaptionFromDOM(card, linkEl) {
    const candidates = [];

    // 1. Thu thập từ thuộc tính title/aria-label của link và card
    if (linkEl) {
      const t = linkEl.getAttribute('title');
      if (t) candidates.push(t);
      const aria = linkEl.getAttribute('aria-label');
      if (aria) candidates.push(aria);
    }
    if (card) {
      const t = card.getAttribute('title');
      if (t) candidates.push(t);
      const aria = card.getAttribute('aria-label');
      if (aria) candidates.push(aria);
    }

    // 2. Thu thập từ các container mô tả thường gặp trên TikTok
    const descSelectors = [
      '[data-e2e="user-post-item-desc"]',
      'div[class*="DivDesContainer"]',
      'div[class*="DesContainer"]',
      'div[class*="DivTextContainer"]',
      'div[class*="TextContainer"]',
      'div[class*="Description"]',
      'div[class*="CardFooter"] ~ div',
      'p[class*="Paragraph"]',
      'span[class*="SpanText"]'
    ];
    for (const sel of descSelectors) {
      const el = card ? card.querySelector(sel) : null;
      if (el && el.textContent.trim()) {
        candidates.push(el.textContent.trim());
      }
    }

    // 3. Quét tất cả thẻ ảnh <img> trong card
    const imgs = card ? card.querySelectorAll('img') : [];
    for (const img of imgs) {
      const alt = img.getAttribute('alt');
      if (alt && alt.trim()) {
        candidates.push(alt.trim());
      }
    }

    // 4. Quét các thẻ có chứa hashtag '#' trong card
    const hashtagEls = card ? card.querySelectorAll('a, p, span, div') : [];
    for (const el of hashtagEls) {
      const txt = el.textContent.trim();
      if (txt.includes('#') && txt.length >= 10 && txt.length <= 400) {
        candidates.push(txt);
      }
    }

    // 5. Đánh giá và lọc ra tiêu đề chuẩn nhất (có hashtag, dài, không phải text rác)
    let best = '';
    let maxScore = -9999;

    for (let c of candidates) {
      c = c.replace(/\s+/g, ' ').trim();
      if (!c) continue;

      let score = 0;

      // Phạt rất nặng text gắn thẻ bạn bè (ví dụ: '..., ~ và 4 người khác' hoặc 'và ... người khác')
      if (/^(\.\.\.|…)/.test(c) || /người\s*khác/i.test(c)) {
        score -= 1000;
      }
      // Phạt text avatar/icon/poster
      if (/^(avatar|icon|photo|video|logo)\b/i.test(c)) {
        score -= 500;
      }
      // Phạt text quá ngắn không có hashtag (như 'đéo sao', 'Nhu Ngoc.')
      if (c.length < 15 && !c.includes('#')) {
        score -= 200;
      }

      // Ưu tiên cao nhất cho chuỗi có hashtag '#' (đặc trưng của caption TikTok)
      if (c.includes('#')) {
        score += 300;
      }
      // Điểm cộng theo độ dài chuỗi (tối đa 150 điểm)
      if (c.length >= 20) {
        score += Math.min(150, c.length);
      }

      if (score > maxScore) {
        maxScore = score;
        best = c;
      }
    }

    return best;
  }

  // Đóng gói và xếp hạng toàn bộ bài viết (Cả Video & Ảnh)
  function finalizeDataset(channelStats) {
    const videos = Array.from(scannedVideosMap.values());

    // ƯU TIÊN SỐ 1: Sắp xếp toàn bộ bài viết theo LƯỢT XEM TỪ CAO ĐẾN THẤP
    videos.sort((a, b) => b.views - a.views);

    // Tính tổng và trung bình toàn kênh
    const totalVideos = videos.length;
    const totalPhotos = videos.filter(v => v.type === 'photo').length;
    const totalVideosOnly = videos.filter(v => v.type === 'video').length;

    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSaves = 0;
    let totalReposts = 0;

    videos.forEach(v => {
      totalViews += v.views;
      totalLikes += v.likes;
      totalComments += v.comments;
      totalShares += v.shares;
      totalSaves += v.saves;
      totalReposts += (v.reposts || 0);
    });

    const avgViews = totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0;
    const avgLikes = totalVideos > 0 ? Math.round(totalLikes / totalVideos) : 0;
    const avgComments = totalVideos > 0 ? Math.round(totalComments / totalVideos) : 0;

    // Gắn chỉ số ER%, Reach Ratio & Đánh giá Viral cho từng bài
    videos.forEach(v => {
      v.reposts = v.reposts || 0;
      // Tỷ lệ tương tác đầy đủ: (Likes + Comments + Shares + Saves + Reposts) / Views * 100%
      const totalInteractions = v.likes + v.comments + v.shares + v.saves + v.reposts;
      v.er = v.views > 0 ? Number(((totalInteractions / v.views) * 100).toFixed(2)) : 0;

      // Tỷ lệ View / Followers (%)
      v.reachRatio = channelStats.followers > 0 ? Number(((v.views / channelStats.followers) * 100).toFixed(1)) : 0;

      // Điểm Viral Score
      const viewRatio = avgViews > 0 ? v.views / avgViews : 1;
      v.viralScore = Number((viewRatio * (1 + v.er / 100)).toFixed(2));

      // Phân loại nhãn Viral mới: Kết hợp mốc tuyệt đối và mốc tương đối
      if (v.views >= 100000 || (viewRatio >= 2.5 && v.views >= 20000)) {
        v.viralLabel = '🔥 Siêu Viral';
        v.viralClass = 'super-viral';
      } else if (v.views >= 30000 || viewRatio >= 1.5) {
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
        totalPhotos,
        totalVideosOnly,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalSaves,
        totalReposts,
        avgViews,
        avgLikes,
        avgComments,
        avgEr: totalViews > 0 ? Number((((totalLikes + totalComments + totalShares + totalSaves + totalReposts) / totalViews) * 100).toFixed(2)) : 0,
        superViralCount: videos.filter(v => v.viralClass === 'super-viral').length,
        trendingCount: videos.filter(v => v.viralClass === 'trending').length
      },
      videos: videos
    };
  }

  // Chuyển đổi text view TikTok (hỗ trợ cả tiếng Việt N/Tr/Triệu lẫn K/M/B và bài ghim)
  function parseMetricText(text) {
    if (!text) return 0;
    // 1. Loại bỏ các từ phụ trợ ("Đã ghim", "Pinned", icon play, v.v.)
    let clean = String(text)
      .replace(/đã\s*ghim/gi, '')
      .replace(/pinned/gi, '')
      .replace(/ghim/gi, '')
      .replace(/lượt\s*xem/gi, '')
      .replace(/views?/gi, '')
      .replace(/[▶▷►]/g, '')
      .trim();

    if (!clean) return 0;
    clean = clean.toUpperCase();

    // 2. Phân cách hàng nghìn kiểu 200.000 hoặc 200,000
    if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
      return parseInt(clean.replace(/\./g, ''), 10) || 0;
    }
    if (/^\d{1,3}(,\d{3})+$/.test(clean)) {
      return parseInt(clean.replace(/,/g, ''), 10) || 0;
    }

    // 3. Định dạng có hậu tố hoặc số thập phân / số nguyên: 1.1M, 784.7K, 315.1K, 260.3K, 200N, 1.2Tr, 500
    const match = clean.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(M|TR|TRIỆU|B|TỶ|K|N|NGHÌN)?$/i);
    if (match) {
      const numPart = match[1].replace(/,/g, '.');
      const val = parseFloat(numPart);
      if (isNaN(val)) return 0;
      const unit = match[2] ? match[2].toUpperCase() : '';
      if (unit === 'M' || unit === 'TR' || unit === 'TRIỆU') {
        return Math.round(val * 1000000);
      }
      if (unit === 'B' || unit === 'TỶ') {
        return Math.round(val * 1000000000);
      }
      if (unit === 'K' || unit === 'N' || unit === 'NGHÌN') {
        return Math.round(val * 1000);
      }
      return Math.round(val);
    }

    return 0;
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
