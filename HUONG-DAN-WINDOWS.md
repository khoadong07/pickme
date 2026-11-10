# Hướng dẫn cài đặt "Chọn ảnh" trên Windows

Áp dụng cho Windows 10 và 11. Làm lần lượt từ trên xuống, mất khoảng 15–20 phút.

| Bước | Việc cần làm | Bắt buộc |
|---|---|---|
| 1 | Cài Node.js | ✅ |
| 2 | Chép source vào máy | ✅ |
| 3 | Cấu hình (file `.env`) | ✅ |
| 4 | Chạy thử | ✅ |
| 5 | Đưa lên internet để khách mở được | ✅ |
| 6 | Tự chạy khi bật máy, chống máy ngủ | nên làm |
| 7 | Sao lưu và cập nhật | nên làm |
| 8 | Xử lý lỗi thường gặp | khi cần |

> **Cách mở cửa sổ lệnh:** bấm phím `Windows`, gõ `cmd`, rồi Enter. Nếu bước nào ghi **"(quyền Admin)"** thì gõ `cmd`, sau đó bấm chuột phải vào **Command Prompt** và chọn **Run as administrator**.
> Mọi lệnh trong hướng dẫn này đều chạy trong **Command Prompt (cmd)**, không phải PowerShell.

---

## 1. Cài Node.js

App chỉ cần Node.js (bản 18 trở lên), không cần cài thư viện nào khác.

**Cách A, dùng winget** (có sẵn trên Windows 10/11 bản mới):
```bat
winget install --id OpenJS.NodeJS.LTS -e
```

**Cách B, cài thủ công:** vào <https://nodejs.org>, tải bản **LTS**, chạy file `.msi` rồi bấm Next đến hết, giữ nguyên các lựa chọn mặc định.

**Kiểm tra:** **đóng cửa sổ cmd rồi mở lại** (bắt buộc), sau đó gõ:
```bat
node -v
```
Nếu thấy dạng `v22.x.x` hoặc `v24.x.x` là được. Nếu báo `'node' is not recognized`, xem mục 8.

---

## 2. Chép source vào máy Windows

### 2.1 Đóng gói trên máy Mac (máy đang chạy)
Mở Terminal trên Mac:
```bash
cd ~/Desktop && zip -r chon-anh.zip img-selector -x "*/node_modules/*" "*/.DS_Store"
```
Bạn sẽ có file `chon-anh.zip` trên Desktop. Chép file này sang máy Windows qua USB, Google Drive, Zalo…

> File zip **đã gồm thư mục `data/`**, tức là các link đã tạo, lựa chọn của khách và mật khẩu. Nhờ vậy khách vẫn dùng tiếp được, chỉ cần gửi lại link mới nếu địa chỉ thay đổi (bước 5).
> Muốn cài mới hoàn toàn thì xoá thư mục `data` sau khi giải nén.

### 2.2 Giải nén trên Windows
1. Chuột phải vào `chon-anh.zip`, chọn **Extract All…**, giải nén vào `C:\`.
2. Đổi tên thư mục vừa giải nén thành `chon-anh`. Kết quả phải là:
```
C:\chon-anh\
├── server.js
├── zip.js
├── package.json
├── start.bat
├── tunnel.bat
├── start-background.bat
├── .env.example
├── public\
└── data\
```

> **Nên để ở `C:\chon-anh`**, đừng để trong `Desktop`, `Documents` hay `OneDrive`. OneDrive đồng bộ có thể khoá file `data\db.json` trong lúc app đang ghi.

---

## 3. Cấu hình

Tạo file `.env` từ file mẫu:
```bat
cd /d C:\chon-anh
copy .env.example .env
notepad .env
```

Sửa các dòng sau trong Notepad rồi lưu lại (Ctrl+S):

```ini
ADMIN_PASSWORD=MatKhauCuaBan123
PORT=3456
PUBLIC_URL=
GOOGLE_API_KEY=
```

| Dòng | Ý nghĩa |
|---|---|
| `ADMIN_PASSWORD` | Mật khẩu vào trang quản lý. Bỏ trống thì app tự tạo và lưu ở `data\admin-password.txt` (nếu bạn mang `data` từ Mac sang thì mật khẩu cũ vẫn dùng được). |
| `PORT` | Cổng chạy server, để nguyên `3456`. |
| `PUBLIC_URL` | Địa chỉ cố định nếu có tên miền (bước 5B). Dùng tunnel tạm thì **để trống**. |
| `GOOGLE_API_KEY` | Không bắt buộc. Chỉ cần khi thư mục Drive rất lớn và load thiếu ảnh. |

> Nếu không thấy file `.env`: trong File Explorer chọn **View → Show → File name extensions** và **Hidden items**. Lưu ý Notepad có thể lưu nhầm thành `.env.txt`. Dùng lệnh `copy` ở trên thì không gặp lỗi này.

---

## 4. Chạy thử

Bấm đúp vào **`C:\chon-anh\start.bat`**. Một cửa sổ đen hiện ra:

```
📷 Photo Picker
   Trang quản lý: http://localhost:3456/admin
   Mật khẩu:      (từ ADMIN_PASSWORD)
   Nguồn ảnh:     trang Drive công khai
```

- Mở trình duyệt, vào **http://localhost:3456/admin** và đăng nhập.
- **Không đóng cửa sổ đen này.** Đóng nó là tắt server.
- Nếu Windows hỏi **"Windows Defender Firewall has blocked some features"**, bấm **Cancel** (không cần cho phép). App chỉ cần chạy trên máy, internet đi qua tunnel ở bước 5.

**Thử tạo link:**
1. Mở thư mục ảnh trên Google Drive, bấm **Share → General access: Anyone with the link → Viewer**, rồi **Copy link**.
2. Trên trang quản lý, dán link, điền tên khách và số ảnh tối đa, rồi bấm **Get link**.
3. Mở link vừa tạo trong một tab ẩn danh để xem thử dưới góc nhìn của khách.

---

## 5. Đưa lên internet để khách mở được

`localhost` chỉ mở được trên chính máy này. Muốn khách mở được thì dùng **Cloudflare Tunnel** (miễn phí, không cần mở port trên modem).

Cài cloudflared:
```bat
winget install --id Cloudflare.cloudflared -e
```
Sau đó **đóng cmd rồi mở lại** và kiểm tra bằng `cloudflared --version`.
(Không có winget thì tải `cloudflared-windows-amd64.msi` tại <https://github.com/cloudflare/cloudflared/releases/latest> rồi cài.)

### 5A. Tunnel tạm: nhanh, không cần tên miền

1. Chạy `start.bat` (server) như bước 4.
2. Bấm đúp **`tunnel.bat`**. Đợi khoảng 10 giây, trong cửa sổ sẽ có dòng:
   ```
   |  https://abc-xyz-123.trycloudflare.com  |
   ```
3. **Mở trang quản lý bằng chính địa chỉ đó:** `https://abc-xyz-123.trycloudflare.com/admin`.
   Link tạo ra và nút Copy link sẽ tự dùng địa chỉ này. Không cần sửa `PUBLIC_URL`.

⚠ **Giới hạn của tunnel tạm:**
- Mỗi lần chạy lại `tunnel.bat` (hoặc khởi động lại máy) sẽ ra **địa chỉ mới**, và link cũ đã gửi khách không mở được nữa. Khi đó vào trang quản lý bằng địa chỉ mới, copy lại link (dữ liệu không mất) rồi gửi lại cho khách.
- Đôi khi Cloudflare tự huỷ tunnel tạm (cửa sổ báo `Tunnel not found`). Lúc đó đóng `tunnel.bat` rồi chạy lại.
- Có thể phải đợi 1–2 phút sau khi tạo thì địa chỉ mới mở được trên máy bạn.

### 5B. Địa chỉ cố định với tên miền riêng (khuyên dùng)

Cần một tên miền đã thêm vào Cloudflare (miễn phí ở Cloudflare, chỉ trả tiền tên miền khoảng 250k/năm). Địa chỉ sẽ cố định, ví dụ `https://chonanh.tenmien.com`, và tunnel tự chạy cùng Windows.

1. Đăng nhập <https://one.dash.cloudflare.com> → **Networks → Tunnels → Create a tunnel** → chọn **Cloudflared** → đặt tên (vd `chon-anh`) → **Save**.
2. Ở màn hình *Install connector*, chọn **Windows** và copy lệnh dạng:
   ```bat
   cloudflared.exe service install eyJhIjoi...rất-dài...
   ```
   Chạy lệnh đó trong **cmd (quyền Admin)**. Lệnh này cài tunnel thành dịch vụ Windows, tự chạy khi bật máy.
3. Bấm **Next**, chuyển sang tab **Public Hostname**:
   - Subdomain: `chonanh`, Domain: `tenmien.com`
   - Service: Type **HTTP**, URL **`localhost:3456`**
   - Bấm **Save**.
4. Sửa `.env`:
   ```ini
   PUBLIC_URL=https://chonanh.tenmien.com
   ```
   rồi tắt và mở lại `start.bat` (hoặc khởi động lại task ở bước 6).
5. Vào `https://chonanh.tenmien.com/admin` để kiểm tra.

Với cách này **không cần chạy `tunnel.bat`** nữa.

---

## 6. Tự chạy khi bật máy và chống máy ngủ

Nếu không làm bước này, mỗi lần bật máy bạn phải tự bấm `start.bat` (và `tunnel.bat` nếu dùng 5A).

### 6.1 Cho server tự chạy cùng Windows
Mở **cmd (quyền Admin)**:
```bat
schtasks /Create /TN "ChonAnh" /TR "\"C:\chon-anh\start-background.bat\"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F
schtasks /Run /TN "ChonAnh"
```
- Server chạy ngầm, không có cửa sổ, kể cả khi chưa đăng nhập Windows.
- Log ghi vào `C:\chon-anh\data\server.log`. Mở file này để xem mật khẩu, địa chỉ và lỗi.
- Kiểm tra: vào <http://localhost:3456/admin>.

> Khi đã dùng task này thì **không bấm `start.bat` nữa**, nếu không sẽ báo trùng cổng 3456.

Các lệnh quản lý task (chạy trong cmd quyền Admin):

| Việc | Lệnh |
|---|---|
| Khởi động | `schtasks /Run /TN "ChonAnh"` |
| Tắt server | `taskkill /F /IM node.exe` (tắt mọi chương trình Node đang chạy) |
| Khởi động lại sau khi sửa `.env` | chạy lệnh tắt, rồi lệnh khởi động |
| Gỡ tự chạy | `schtasks /Delete /TN "ChonAnh" /F` |

Dùng tunnel tạm (5A) thì `tunnel.bat` vẫn phải bấm tay sau mỗi lần bật máy, và địa chỉ sẽ đổi. Đây là lý do nên dùng 5B.

### 6.2 Không cho máy ngủ
Máy ngủ thì khách không vào được. Chạy trong **cmd (quyền Admin)**:
```bat
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```
Lệnh này tắt chế độ ngủ khi đang cắm sạc. Màn hình vẫn tắt bình thường để tiết kiệm điện. Với laptop, nên để luôn cắm sạc và chỉnh *Control Panel → Power Options → Choose what closing the lid does → Do nothing* để gập máy không làm máy ngủ.

---

## 7. Sao lưu và cập nhật

### Sao lưu
Toàn bộ dữ liệu nằm trong **`C:\chon-anh\data\`**:
- `db.json`: các link, thông tin khách, lựa chọn.
- `admin-password.txt`: mật khẩu tự tạo (nếu không đặt trong `.env`).

Định kỳ copy thư mục `data` sang ổ khác hoặc Google Drive. **Không chia sẻ thư mục này cho người khác.**

### Cập nhật source mới
1. Tắt server (đóng cửa sổ `start.bat` hoặc `taskkill /F /IM node.exe`).
2. Chép đè các file mới (`server.js`, `zip.js`, `public\`…). **Giữ nguyên `data\` và `.env`.**
3. Chạy lại server.

### Chuyển sang máy khác
Copy cả thư mục `C:\chon-anh` (gồm `data` và `.env`), rồi làm lại bước 1, 5 và 6 trên máy mới.

---

## 8. Xử lý lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `'node' is not recognized…` | Đóng hết cửa sổ cmd rồi mở lại. Vẫn lỗi thì khởi động lại máy. Vẫn lỗi nữa thì cài lại Node.js (bước 1) và đảm bảo có tick **Add to PATH**. |
| `'cloudflared' is not recognized…` | Đóng cmd rồi mở lại sau khi cài. Vẫn lỗi thì cài bằng file `.msi` (bước 5). |
| `❌ Cổng 3456 đang bị chương trình khác dùng` | Server đã chạy sẵn ở chỗ khác (task ngầm hoặc cửa sổ khác). Xem chương trình nào đang dùng cổng: `netstat -ano \| findstr :3456`, số cuối dòng là PID, tắt bằng `taskkill /PID <số> /F`. Hoặc đổi `PORT` trong `.env` (nhớ sửa cổng trong tunnel). |
| Cửa sổ `start.bat` hiện rồi tắt ngay | Mở cmd, chạy `cd /d C:\chon-anh` rồi `node server.js` để đọc lỗi. |
| Quên mật khẩu admin | Xem `ADMIN_PASSWORD` trong `.env`, hoặc file `data\admin-password.txt`, hoặc log `data\server.log`. |
| Tạo link báo *"Không tìm thấy ảnh nào…"* | Thư mục Drive chưa để **Anyone with the link**, hoặc trong thư mục không có file ảnh. |
| Thư mục rất lớn nhưng load thiếu ảnh | Thêm `GOOGLE_API_KEY` vào `.env` (tạo tại Google Cloud Console → APIs & Services → Credentials → API key, rồi bật **Google Drive API**). |
| Ảnh hiện ô xám, không load | Kiểm tra mạng. Google tạm chặn khi xem quá nhiều ảnh cùng lúc thì đợi vài phút rồi tải lại trang. |
| ZIP có file ghi "đã dùng bản xem trước" | Thư mục Drive đang bật *"Viewers can't download"*. Tắt tuỳ chọn này trong **Share → ⚙** của thư mục để tải được file gốc. |
| Khách báo link không mở được | (1) Server có đang chạy không: mở `http://localhost:3456/admin` trên máy. (2) Tunnel tạm có đổi địa chỉ không (bước 5A), nếu có thì gửi lại link mới. (3) Máy có đang ngủ không (bước 6.2). |
| Link khách mở ra địa chỉ `localhost` | Bạn đang mở trang quản lý bằng `localhost`. Hãy mở bằng địa chỉ tunnel, hoặc đặt `PUBLIC_URL` trong `.env`. |
| Sửa `.env` nhưng không có tác dụng | Phải khởi động lại server. Kiểm tra file tên đúng là `.env`, không phải `.env.txt`. |

---

## Tóm tắt nhanh

```bat
:: Cài một lần
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Cloudflare.cloudflared -e
cd /d C:\chon-anh
copy .env.example .env  &&  notepad .env

:: Hằng ngày (tunnel tạm)
start.bat      -> server
tunnel.bat     -> lấy địa chỉ https://....trycloudflare.com, mở /admin bằng địa chỉ đó
```
