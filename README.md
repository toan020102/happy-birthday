# Phòng sinh nhật 2D

Website một phòng duy nhất, không cần đăng nhập. Mỗi khách nhập tên và chọn một trong 20 sprite nhân vật; hồ sơ được lưu bằng token trong `localStorage`. Avatar đã có người chọn sẽ tự khóa. Người vào phòng sớm nhất tự động trở thành chủ phòng, có thể nhập thông tin buổi tiệc và chọn nhạc. Nếu chủ phòng rời đi, quyền điều khiển chuyển cho người tiếp theo.

Không có điều khiển di chuyển. Khách bấm các nút trên màn hình để vẫy chào, nhảy, vỗ tay, cúi chào, xoay vòng, tung hoa, gửi lời chúc hoặc bật chế độ nhảy liên tục với điệu ngẫu nhiên theo nhạc. Nhân vật được xếp vào 20 vị trí riêng để không chồng lên nhau. Các trình duyệt đồng bộ trực tiếp qua Trystero/WebRTC.

## Cấu hình

Sao chép `.env.example` thành `.env` rồi sửa:

- `NEXT_PUBLIC_BIRTHDAY_NAME`: tên người được chúc mừng.
- `NEXT_PUBLIC_ROOM_TITLE`: tiêu đề trên đầu trang.
- `NEXT_PUBLIC_ROOM_MESSAGE`: lời nhắn mở đầu.
- `NEXT_PUBLIC_APP_ID`: chuỗi riêng cho website này.
- `NEXT_PUBLIC_ROOM_ID`: mã phòng duy nhất; mọi người phải dùng cùng mã này.
- `NEXT_PUBLIC_MUSIC_MANIFEST`: danh sách nhạc, mặc định là `/music/playlist.json`.
- `NEXT_PUBLIC_SITE_URL`: URL public sau khi deploy.

Không đặt bí mật trong biến `NEXT_PUBLIC_*` vì chúng được gửi xuống trình duyệt.

## Chạy local

Yêu cầu Node.js 22.13 trở lên.

```bash
npm install
npm run dev
```

Mở `http://127.0.0.1:3000`. Giữ terminal này chạy.

Để chia sẻ ra Internet, cài [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) rồi mở terminal thứ hai:

```bash
npm run share
```

Lệnh này tạo Quick Tunnel tới `http://127.0.0.1:3000` bằng HTTP/2. Copy URL `https://....trycloudflare.com` được in ra. Không dùng `cloudflared tunnel --url http://localhost:3000`: trên Windows địa chỉ đó chỉ mở IPv6, còn tunnel đi bằng IPv4 nên link public trả 404. Giữ cả hai terminal chạy suốt buổi tiệc. Nếu web chạy cổng khác, đặt `PORT` trước khi chạy `npm run share`.

## Thêm nhạc

Chép file nhạc vào `public/music`, sau đó thêm tên bài, nghệ sĩ và đường dẫn vào `public/music/playlist.json`. Chủ phòng sẽ thấy bài hát mới trong bảng **Âm nhạc** sau khi tải lại trang.

## Build

```bash
npm run build
```

Trang có thể publish dưới dạng site tĩnh/edge. Multiplayer P2P không cần database, nhưng lời chúc chỉ được đồng bộ giữa những khách đang online và cache trong trình duyệt; đây là chủ đích để phiên bản một phòng luôn miễn phí và triển khai nhanh.
