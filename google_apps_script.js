/**
 * =========================================================================
 * GOOGLE APPS SCRIPT CHO TIỆN ÍCH: "THEO DÕI TỔNG QUAN TIKTOK"
 * =========================================================================
 * Hướng dẫn cài đặt:
 * 1. Mở file Google Sheet có sẵn của bạn.
 * 2. Chọn menu "Tiện ích mở rộng" (Extensions) -> "Apps Script".
 * 3. Xóa hết code trong editor và dán toàn bộ đoạn mã bên dưới vào.
 * 4. Bấm nút "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment).
 * 5. Chọn loại "Ứng dụng web" (Web app).
 * 6. Mục "Ai có quyền truy cập" (Who has access) -> Chọn "Bất kỳ ai" (Anyone).
 * 7. Bấm "Triển khai" (Deploy) -> Cấp quyền cho Google Sheet.
 * 8. Copy đường link "URL ứng dụng web" (Web App URL) và dán vào cài đặt Extension!
 */

function doPost(e) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000); // Đợi tối đa 30s để tránh xung đột ghi dữ liệu

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);

    // Kiểm tra cấu trúc payload
    var rows = payload.rows;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Dữ liệu gửi lên không hợp lệ hoặc danh sách rỗng."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 16 Cột dữ liệu tiêu chuẩn theo thiết kế
    var headers = [
      "Thời điểm quét",
      "Kênh TikTok",
      "Tổng Follower",
      "ID Bài viết",
      "Tiêu đề bài viết",
      "Ngày đăng",
      "Lượt xem (Views)",
      "Lượt tim (Likes)",
      "Lượt bình luận",
      "Lượt đăng lại",
      "Lượt chia sẻ",
      "Lượt lưu",
      "Tỷ lệ tương tác (%)",
      "Tỷ lệ View/Follower (%)",
      "Đánh giá Viral",
      "Link Video"
    ];

    // Nếu trang tính còn trống hoặc chưa có tiêu đề, tự động tạo dòng header chuẩn
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1e293b");
      headerRange.setFontColor("#ffffff");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }

    // Ghi toàn bộ dữ liệu mới vào cuối trang tính (Append Rows)
    var startRow = sheet.getLastRow() + 1;
    var numRows = rows.length;
    var numCols = rows[0].length;

    var targetRange = sheet.getRange(startRow, 1, numRows, numCols);
    targetRange.setValues(rows);

    // Căn lề số cho các cột chỉ số (Views, Likes, Comments, Shares, Saves)
    sheet.getRange(startRow, 7, numRows, 5).setNumberFormat("#,##0");

    lock.releaseLock();

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Đã cập nhật thành công " + numRows + " dòng dữ liệu mới!",
      appendedCount: numRows,
      totalRows: sheet.getLastRow(),
      channel: payload.channel || "TikTok",
      scanTime: payload.scanTime || new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Lỗi ghi dữ liệu Google Sheet: " + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "Webhook kết nối Google Sheet cho tiện ích 'Theo dõi tổng quan TikTok' đang hoạt động tốt!"
  })).setMimeType(ContentService.MimeType.JSON);
}
