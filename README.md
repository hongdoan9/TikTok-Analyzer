# Tiện ích mở rộng: Theo dõi tổng quan TikTok

> **Phiên bản:** 1.0.0 (Manifest V3)  
> **Kiến trúc:** 100% Serverless • Chạy trực tiếp trên trình duyệt Google Chrome • Tự động đồng bộ Google Sheets.

---

## 📁 Cấu trúc thư mục dự án

```text
tiktok-analytics-extension/
├── manifest.json              # Cấu hình chính thức của Chrome Extension (Manifest V3)
├── background.js              # Service Worker điều phối tab và webhook Google Sheets
├── content_script.js          # Bộ cào dữ liệu DOM TikTok & tự động cuộn trang (Auto-scroll)
├── popup.html                 # Giao diện Popup mở nhanh trên thanh công cụ Chrome
├── popup.css                  # Style giao diện Popup
├── popup.js                   # Logic điều khiển Popup
├── dashboard.html             # Bảng điều khiển phân tích chuyên sâu (Toàn màn hình)
├── dashboard.css              # Style Dark Glassmorphism cao cấp cho Dashboard
├── dashboard.js               # Logic vẽ biểu đồ Canvas, Bảng vàng Top 10 & Đồng bộ Sheet
├── google_apps_script.js      # Mã nguồn Apps Script để dán vào Google Sheet có sẵn
├── icons/                     # Bộ icon 16x16, 48x48, 128x128 chuẩn Chrome Extension
├── DOC_MO_TA_CHI_TIET.md      # Tài liệu đặc tả kỹ thuật và mô tả chi tiết dự án
└── README.md                  # Hướng dẫn nhanh
```

---

## 🚀 Hướng dẫn nạp Extension vào Google Chrome (Dùng ngay trong 30 giây)

1. Mở trình duyệt Google Chrome, truy cập vào đường dẫn:  
   `chrome://extensions/`
2. Bật công tắc **"Chế độ dành cho nhà phát triển" (Developer mode)** ở góc trên bên phải.
3. Bấm nút **"Tải tiện ích đã giải nén" (Load unpacked)** ở góc trên bên trái.
4. Chọn đường dẫn thư mục:  
   `C:\Users\Admin\.gemini\antigravity-ide\scratch\tiktok-analytics-extension`
5. Tiện ích **"Theo dõi tổng quan TikTok"** sẽ xuất hiện ngay trên thanh công cụ của bạn!

---

## 📊 Hướng dẫn kết nối Google Sheet có sẵn (Append Rows)

1. Mở file Google Sheet có sẵn của bạn.
2. Chọn menu **Tiện ích mở rộng (Extensions)** -> **Apps Script**.
3. Copy toàn bộ nội dung trong file [google_apps_script.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/tiktok-analytics-extension/google_apps_script.js) và dán vào.
4. Bấm **Triển khai (Deploy)** -> **Tùy chọn triển khai mới (New deployment)**.
5. Loại chọn **Ứng dụng web (Web app)**. Mục "Ai có quyền truy cập" chọn **Bất kỳ ai (Anyone)**.
6. Bấm **Triển khai** và sao chép đường link **Web App URL**.
7. Mở Dashboard hoặc Popup của Extension -> Vào **Cài đặt Sheet** -> Dán link Web App URL này vào và bấm **Lưu**.

---

Xem tài liệu mô tả chi tiết tại: [DOC_MO_TA_CHI_TIET.md](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/tiktok-analytics-extension/DOC_MO_TA_CHI_TIET.md)
