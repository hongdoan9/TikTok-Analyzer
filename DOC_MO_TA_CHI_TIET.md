# TÀI LIỆU MÔ TẢ CHI TIẾT CÔNG CỤ (SPECIFICATION & USER GUIDE)
# TÊN CÔNG CỤ: THEO DÕI TỔNG QUAN TIKTOK

---

## 1. GIỚI THIỆU TỔNG QUAN (EXECUTIVE SUMMARY)

### 1.1. Mục đích công cụ
**"Theo dõi tổng quan TikTok"** là một tiện ích mở rộng (Google Chrome Extension - Manifest V3) hoạt động hoàn toàn **Serverless (Zero-Backend)**, được thiết kế chuyên biệt để:
* Tự động quét và thu thập toàn bộ dữ liệu video của một kênh TikTok trực tiếp trên trình duyệt.
* Tự động tính toán lượng traffic, tỷ lệ tương tác (ER%), tỷ lệ lan tỏa theo lượng người theo dõi (Followers).
* Nhận diện và phát hiện các bài viết đang **Viral / Xu hướng** dựa trên thuật toán đa chỉ số.
* Cung cấp **Biểu đồ biến động trực quan** (Interactive Charts) kèm đường mốc chuẩn trung bình kênh.
* Xếp hạng **Bảng vàng Top 10 Video** (tối đa 10 video theo từng tiêu chí: Viral, Views, Tim, Lưu, Chia sẻ, Bình luận).
* Phân tích nội dung tiêu đề bài viết.
* **Tự động đồng bộ thêm dòng mới (Append Rows)** vào 1 file **Google Sheet có sẵn** chỉ với 1-Click thông qua Google Apps Script Webhook mà không cần nhập liệu thủ công.

### 1.2. Điểm nổi bật & Ưu điểm
* **Không tốn chi phí máy chủ (Zero Server Cost):** Chạy 100% trên trình duyệt Chrome, không cần thuê VPS hay server backend.
* **Tự động hóa hoàn toàn (No Manual Entry):** Thay thế toàn bộ công việc copy/paste số liệu thủ công vào bảng tính.
* **Bảo vệ an toàn tài khoản:** Quét trực tiếp trên giao diện người dùng chính chủ, mô phỏng hành vi cuộn tự nhiên, không yêu cầu cung cấp cookie nhạy cảm hay mật khẩu tài khoản.
* **Theo dõi biến động theo thời gian (Time-Series Tracking):** Mỗi lần quét sẽ ghi thêm các dòng mới kèm mốc thời gian (`Thời điểm quét`), giúp dễ dàng vẽ biểu đồ tăng trưởng của từng video giữa các ngày quét khác nhau trên Google Sheet.

---

## 2. KIẾN TRÚC KỸ THUẬT (TECHNICAL ARCHITECTURE)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            CHROME EXTENSION (MANIFEST V3)                        │
├─────────────────────────┬────────────────────────────┬───────────────────────────┤
│    content_script.js    │       background.js        │       dashboard.html      │
│  (Quét DOM/Dữ liệu page) │   (Điều phối & Webhook)    │ (Giao diện báo cáo charts)│
└────────────┬────────────┴─────────────┬──────────────┴─────────────┬─────────────┘
             │                          │                            │
             ▼                          ▼                            ▼
  [Trang cá nhân TikTok]         [chrome.storage]          [Google Apps Script]
  - Auto-Scroll Engine           - Lưu trữ cục bộ          - Nhận dữ liệu POST
  - Bóc tách 100% video          - Lịch sử các lần quét    - Tự động ghi dòng mới
  - Live Floating Widget                                     vào Google Sheet có sẵn
```

* **Chuẩn nền tảng:** Google Chrome Extension Manifest V3.
* **Công nghệ giao diện:** HTML5, Modern CSS (Glassmorphism Dark Theme, tối ưu hiển thị máy tính bàn & laptop), Vanilla JavaScript (không phụ thuộc framework nặng nề, khởi động tức thì).
* **Trực quan hóa:** Canvas / Chart Engine tích hợp sẵn tương thích tuyệt đối chính sách bảo mật CSP của Manifest V3.
* **Lưu trữ dữ liệu:** `chrome.storage.local` để lưu trữ dữ liệu các lần quét gần nhất và cấu hình Webhook.

---

## 3. QUY TRÌNH THU THẬP & CHỈ SỐ ĐO LƯỜNG (METRICS & ALGORITHMS)

### 3.1. Cơ chế Quét dữ liệu (Auto-Scroll Scraper Engine)
1. Người dùng mở trang cá nhân TikTok của kênh cần theo dõi: `https://www.tiktok.com/@username`.
2. Mở Extension hoặc bấm nút **"Bắt đầu quét kênh"** trên widget tiện ích.
3. Extension kích hoạt cơ chế tự động cuộn trang (Auto-scroll) với nhịp độ ngẫu nhiên từ `600ms - 1200ms` để nạp toàn bộ danh sách video từ mới nhất đến video đầu tiên.
4. Trên màn hình có thanh tiến trình trực tiếp:
   * *Đang quét dữ liệu: Đã nạp X video...*
   * Nút **"Dừng & Xem kết quả ngay"** (cho phép người dùng ngắt sớm nếu chỉ muốn xem nhóm video vừa nạp).

### 3.2. Danh mục các trường dữ liệu thu thập
Mỗi video được trích xuất đầy đủ 10 trường dữ liệu thô:
1. `ID Video`
2. `Link Video`
3. `Tiêu đề bài viết (Caption / Title)`
4. `Thời gian đăng (Publish Date)`
5. `Lượt xem (Views)`
6. `Lượt tim (Likes)`
7. `Lượt bình luận (Comments)`
8. `Lượt chia sẻ / Đăng lại (Shares & Reposts)`
9. `Lượt lưu / Yêu thích (Saves / Bookmarks)`
10. `Tổng Follower của kênh` tại thời điểm quét.

### 3.3. Công thức tính toán & Thuật toán Đánh giá Viral

#### A. Tỷ lệ tương tác tổng hợp (Engagement Rate - ER%)
$$\text{ER\%} = \frac{\text{Likes} + \text{Comments} + \text{Shares} + \text{Saves}}{\text{Views}} \times 100\%$$
* Chỉ số này đo lường độ gắn kết của khán giả với nội dung, loại bỏ hiện tượng video có view cao nhưng là view trôi (không ai tương tác).

#### B. Tỷ lệ lan tỏa (Reach Ratio - RR%)
$$\text{RR\%} = \frac{\text{Views}}{\text{Followers}} \times 100\%$$
* Đánh giá mức độ nội dung vượt ra khỏi tệp follower có sẵn để lên trang "Dành cho bạn" (FYP).

#### C. Điểm Viral (Viral Score) & Xếp loại tự động
Hệ thống tính toán **Lượng View Trung Bình** ($\overline{V}$) và **Tỷ lệ tương tác trung bình** ($\overline{ER}$) của toàn bộ kênh:
* 🔥 **Siêu Viral (Super Viral):** 
  $$\text{Views} \ge 3 \times \overline{V} \quad \text{VÀ} \quad \text{ER\%} \ge \overline{ER}$$
  *(Bài viết bùng nổ traffic kèm lượng thảo luận và tym vượt trội).*
* 🚀 **Xu hướng (Trending):** 
  $$\text{Views} \ge 1.5 \times \overline{V}$$
  *(Lượt xem cao hơn đáng kể so với trung bình kênh).*
* ⭐ **Tương tác cao (High Engagement):** 
  $$\text{ER\%} \ge 1.5 \times \overline{ER}$$
  *(Dù view vừa phải nhưng tỷ lệ lưu, chia sẻ hoặc bình luận rất cao - nội dung giữ chân tốt).*
* 📊 **Bình thường (Normal):** 
  Các bài viết nằm trong dải phân phối thông thường.

---

## 4. CẤU TRÚC GIAO DIỆN BÁO CÁO (DASHBOARD MODULES)

### 4.1. Thẻ tóm tắt sức khỏe kênh (Channel Overview Cards)
* **Tổng Follower:** Cập nhật số người theo dõi mới nhất.
* **Tổng số Video đã quét:** Số lượng video toàn kênh.
* **Tổng Lượng View:** Toàn bộ traffic kênh tạo ra.
* **View Trung Bình / Video:** Con số mốc để so sánh.
* **Tỷ lệ Tương tác Trung bình (Avg ER%):** Sức khỏe tương tác tổng quan.

### 4.2. Biểu đồ biến động tương tác (Interactive Fluctuation Chart)
* **Trục hoành (X):** Danh sách các video xếp theo thứ tự thời gian (từ bài cũ đến bài mới nhất).
* **Trục tung (Y):** Số lượt xem (Views) và Tương tác.
* **Đường mốc chuẩn (Benchmark Line):** Đường nét đứt màu cam thể hiện mức View trung bình kênh giúp nhận biết các đỉnh sóng viral ngay lập tức.
* **Bộ lọc chế độ xem:**
  * `[30 video gần nhất]` (Mặc định)
  * `[60 video gần nhất]`
  * `[Toàn bộ video kênh]`
  * `[Chỉ hiển thị bài Viral]`
* **Thanh trượt thời gian (Timeline Slider):** Cho phép kéo phóng to (Zoom in/out) vùng dữ liệu khi xem toàn bộ kênh.
* **Tooltip thông minh:** Rê chuột vào bất kỳ điểm nào sẽ hiện bảng chi tiết: Tiêu đề, Ngày đăng, Views, Likes, Comments, Saves, Shares, ER% và nhãn Viral.

### 4.3. Bảng vàng Top 10 Video (Leaderboard - Tối đa 10 video)
Được trang bị thanh chuyển Tab 1-Click, hiển thị dạng thẻ bài viết cao cấp có huy chương 🥇 🥈 🥉:
1. **[🔥 Top 10 Siêu Viral]:** Xếp hạng theo Điểm tổng hợp Viral Score.
2. **[👁️ Top 10 Lượt Xem (Views)]:** 10 video có lượng traffic cao nhất.
3. **[❤️ Top 10 Lượt Tim (Likes)]:** 10 video được yêu thích nhất.
4. **[🔖 Top 10 Lượt Lưu (Saves)]:** 10 video mang lại giá trị cao khiến người xem lưu lại nhiều nhất.
5. **[↗️ Top 10 Chia sẻ & Đăng lại (Shares/Reposts)]:** 10 video có độ lan tỏa cộng đồng mạnh nhất.
6. **[💬 Top 10 Bình luận (Comments)]:** 10 video tạo tranh luận, thảo luận sôi nổi nhất.

> Mỗi thẻ bài viết có sẵn nút **"Mở Video"** để xem trực tiếp trên TikTok nhằm phân tích kịch bản và cách làm.

### 4.4. Phân tích nội dung tiêu đề (Title Analysis)
* Thống kê các từ khóa lặp lại nhiều nhất trong tiêu đề các bài viết nhiều view.
* Phân loại độ dài tiêu đề tối ưu giúp bài viết đạt tỷ lệ giữ chân và kích thích bấm xem tốt hơn.

---

## 5. CƠ CHẾ ĐỒNG BỘ GOOGLE SHEET (APPEND ROWS ENGINE)

### 5.1. Cấu trúc 15 cột tiêu chuẩn trên Google Sheet
Khi bấm nút **"Đồng bộ lên Google Sheet"**, tiện ích sẽ gửi gói dữ liệu JSON tới Webhook của Google Apps Script để ghi thêm các dòng mới vào bảng tính có sẵn:

| Cột | Tiêu đề cột | Định dạng dữ liệu | Mục đích theo dõi |
|:---:|:---|:---|:---|
| **A** | `Thời điểm quét` | `YYYY-MM-DD HH:mm:ss` | Đánh dấu mốc quét để đo lường biến động theo thời gian |
| **B** | `Kênh TikTok` | `@username` | Nhận diện tài khoản |
| **C** | `Tổng Follower` | Số nguyên | Đo lường tăng trưởng follower theo từng đợt |
| **D** | `ID Video` | Chuỗi ký tự | Khóa định danh video |
| **E** | `Tiêu đề bài viết` | Văn bản | Nội dung caption |
| **F** | `Ngày đăng` | `YYYY-MM-DD HH:mm` | Phân tích khung giờ và ngày đăng |
| **G** | `Lượt xem (Views)` | Số nguyên | Traffic video |
| **H** | `Lượt tim (Likes)` | Số nguyên | Độ yêu thích |
| **I** | `Lượt bình luận (Comments)` | Số nguyên | Thảo luận |
| **J** | `Lượt chia sẻ (Shares/Reposts)` | Số nguyên | Lan tỏa |
| **K** | `Lượt lưu (Saves)` | Số nguyên | Giá trị lưu trữ |
| **L** | `Tỷ lệ tương tác (%)` | Phần trăm (ví dụ: `4.85%`) | ER% |
| **M** | `Tỷ lệ View/Follower (%)` | Phần trăm | Độ phủ ngoài kênh |
| **N** | `Đánh giá Viral` | Chữ (Siêu Viral / Đang Trend...) | Phân loại nhanh |
| **O** | `Link Video` | URL | Link bấm xem trực tiếp |

### 5.2. Mã nguồn Google Apps Script (Sẵn sàng triển khai)
Người dùng chỉ cần dán đoạn mã này vào Google Sheet của mình một lần duy nhất:

```javascript
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);
    var rows = payload.rows; // Mảng 2 chiều chứa các dòng dữ liệu mới

    if (!rows || rows.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Không có dữ liệu" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Nếu trang tính còn trống, tự động thêm dòng tiêu đề
    if (sheet.getLastRow() === 0) {
      var headers = [
        "Thời điểm quét", "Kênh TikTok", "Tổng Follower", "ID Video", 
        "Tiêu đề bài viết", "Ngày đăng", "Lượt xem (Views)", "Lượt tim (Likes)", 
        "Lượt bình luận", "Lượt chia sẻ", "Lượt lưu", "Tỷ lệ tương tác (%)", 
        "Tỷ lệ View/Follower (%)", "Đánh giá Viral", "Link Video"
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e6f4ea");
    }

    // Ghi toàn bộ dữ liệu mới vào cuối trang tính (Append Rows)
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);

    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "Đã cập nhật thành công " + rows.length + " dòng dữ liệu mới!",
      totalRows: sheet.getLastRow()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

## 6. HƯỚNG DẪN CÀI ĐẶT & SỬ DỤNG (STEP-BY-STEP)

### Bước 1: Nạp Extension vào trình duyệt Chrome
1. Mở trình duyệt Google Chrome, truy cập đường dẫn: `chrome://extensions/`.
2. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
3. Bấm nút **Tải tiện ích đã giải nén (Load unpacked)**.
4. Chọn thư mục:  
   `C:\Users\Admin\.gemini\antigravity-ide\scratch\tiktok-analytics-extension`
5. Tiện ích **"Theo dõi tổng quan TikTok"** sẽ xuất hiện trên thanh công cụ của Chrome.

### Bước 2: Thiết lập kết nối Google Sheet (Chỉ cần làm 1 lần)
1. Mở file Google Sheet có sẵn của anh/chị.
2. Vào menu **Tiện ích mở rộng (Extensions)** -> Chọn **Apps Script**.
3. Xóa code cũ và dán toàn bộ đoạn mã trong file [google_apps_script.js](file:///C:/Users/Admin/.gemini/antigravity-ide/scratch/tiktok-analytics-extension/google_apps_script.js) vào.
4. Bấm **Triển khai (Deploy)** -> **Tùy chọn triển khai mới (New deployment)**.
5. Mục *Loại* chọn **Ứng dụng web (Web app)**.
6. Mục *Ai có quyền truy cập (Who has access)* chọn **Bất kỳ ai (Anyone)**.
7. Bấm **Triển khai (Deploy)** -> Cấp quyền cho Google Sheet -> Sao chép đường dẫn **URL ứng dụng web (Web App URL)**.
8. Mở Extension -> Vào mục **Cài đặt Google Sheet** -> Dán link Web App URL này vào và bấm **Lưu cấu hình**.

### Bước 3: Vận hành & Quét kênh
1. Vào trang cá nhân TikTok của kênh cần theo dõi (ví dụ: `https://www.tiktok.com/@abc`).
2. Bấm icon Extension -> Chọn **"Bắt đầu quét kênh"**.
3. Extension sẽ tự động cuộn và trích xuất toàn bộ video. Khi quét xong, trang Dashboard phân tích sẽ tự động mở ra.
4. Xem biểu đồ, phân tích Top 10 video viral, và bấm nút **"Đồng bộ lên Google Sheet"** để tự động lưu trữ dữ liệu.
