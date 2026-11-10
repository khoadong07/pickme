# Chọn ảnh — công cụ cho khách chọn ảnh từ Google Drive

```bash
npm start            # http://localhost:3456/admin
```

Mật khẩu trang quản lý: biến `ADMIN_PASSWORD`, hoặc file `data/admin-password.txt` (tự tạo lần đầu).

> **Cài trên Windows:** xem [HUONG-DAN-WINDOWS.md](HUONG-DAN-WINDOWS.md).

## Cấu hình
Đặt trong file `.env` cạnh `server.js` (copy từ `.env.example`), hoặc dùng biến môi trường. Biến môi trường được ưu tiên hơn `.env`.

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `ADMIN_PASSWORD` | không | Mật khẩu trang quản lý |
| `PUBLIC_URL` | khi deploy | Địa chỉ public, vd `https://chonanh.studio.vn` (dùng để tạo link gửi khách) |
| `GOOGLE_API_KEY` | không | Đọc thư mục qua Drive API thay vì trang công khai (ổn định hơn với thư mục lớn) |

## Tải ZIP ảnh khách đã chọn

Trang quản lý → nút **⬇ Tải ZIP** trên mỗi link (hoặc trong mục "Xem ảnh đã chọn").

- ZIP chứa **file gốc** của **bản khách gửi gần nhất** (khách chưa gửi thì lấy bản nháp). Khách đang sửa dở thì có thêm nút **Tải ZIP bản đang sửa**.
- Kèm theo `_danh-sach-anh.txt`: tên khách, thời điểm gửi, ghi chú của khách, danh sách tên để dán vào Lightroom.
- Server tải ảnh gốc từ Drive công khai rồi nén và gửi ngay về trình duyệt (không lưu lại trên server), nên không cần đăng nhập Google. ZIP không nén lại ảnh (JPG/RAW vốn đã nén) và hỗ trợ file lớn hơn 4GB.
- Nếu thư mục bật "Người xem không được tải xuống", app lấy bản xem trước độ phân giải cao nhất có thể. File nào không tải được sẽ được ghi rõ trong `_danh-sach-anh.txt`.
- Trình duyệt không biết trước dung lượng nên không hiện % tiến độ. Album lớn thì đợi một lúc, vì tốc độ phụ thuộc vào việc tải từ Drive.

## Dữ liệu
Toàn bộ nằm trong `data/` (`db.json`, mật khẩu). Đừng commit hay chia sẻ thư mục này.
