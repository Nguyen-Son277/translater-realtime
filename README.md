# Song Ngữ

Ứng dụng web dịch hội thoại hai chiều, dành cho hai người dùng chung một điện thoại hoặc mỗi người một điện thoại. Giao diện tiếng Việt, hiển thị đồng thời nguyên văn và bản dịch.

**Frontend:** ReactJS, JavaScript, Vite, Tailwind CSS. **Backend:** FastAPI, Python 3.12, WebSocket. **Dữ liệu:** SQLite, SQLAlchemy, Alembic. **Giọng nói:** faster-whisper local. **Dịch:** model riêng qua API tương thích OpenAI.

## Chạy bằng Docker

Cần Docker Engine và Compose từ 2.24 trở lên. Mặc định nhận dạng dùng model multilingual `base`, CPU với 4 luồng để cân bằng tốc độ và độ chính xác; nên có ít nhất 2 GB RAM còn trống. Lần đầu cần Internet để tải model `base` khoảng 145 MB; model được giữ trong volume cho các lần sau.

```bash
cp .env.example .env
```

API dịch được cấu hình riêng cho từng tài khoản trên giao diện, không cần đặt API key trong `.env`. Sau khi đăng nhập, mở **Cài đặt dịch thuật**, nhập **Base URL**, **Tên model**, **API key**, rồi bấm **Lưu** và **Kiểm tra kết nối**.

Chủ phòng trả phí dịch cho cả hai chiều bằng tài khoản API của mình. Người tham gia không cần nhập key để dùng phòng của người khác. Nhà cung cấp API tính phí trực tiếp; Song Ngữ không thu tiền hoặc quản lý số dư. Kiểm tra kết nối gửi một câu Việt–Trung ngắn và có thể phát sinh phí. Lưu thay đổi không tự gửi lại câu lỗi; quay về phòng và bấm **Thử lại** cho câu cần dịch.

Chọn model hỗ trợ ngôn ngữ cần dùng, ví dụ Việt–Trung. Dịch vụ cần chấp nhận `POST /v1/chat/completions` với `model`, `messages`, `temperature: 0`, `stream: false`, và trả về `choices[0].message.content` dạng chuỗi. Base URL có thể chứa hoặc không chứa `/v1`; không thêm `/chat/completions`, thông tin đăng nhập, query hoặc fragment. Mặc định chỉ cho HTTPS công khai, kiểm tra IP DNS và kết nối tới IP đã kiểm tra; không theo redirect và không sử dụng proxy từ biến môi trường.

Để dùng model local trên một triển khai tin cậy, quản trị viên đặt `TRANSLATION_ALLOW_LOCAL=true` trong `.env` và tạo lại container backend. Tùy chọn này cho phép người dùng gửi yêu cầu tới HTTP và địa chỉ mạng nội bộ, nên chỉ bật khi tin cậy các tài khoản sử dụng ứng dụng. Nếu model chạy trên cùng máy host, dùng Base URL `http://host.docker.internal:1234/v1` trong giao diện Docker; dịch vụ model phải bind địa chỉ Docker truy cập được, ví dụ `0.0.0.0:1234`. API không cần xác thực có thể để trống khóa khi tạo cấu hình.

API key được mã hóa bằng Fernet trước khi lưu vào SQLite. Khóa mã hóa được tạo một lần với quyền `0600` khi lưu API key đầu tiên; mặc định dev ở `backend/data/translation.key`, Docker ở `/data/translation.key` trong volume `database`. Sao lưu **cả SQLite và file khóa mã hóa**, giữ khóa ở nơi an toàn, không đưa vào Git. Mất hoặc đổi file khóa sẽ làm key cũ không đọc được; người dùng cần lưu lại API key. Khi mở lại cài đặt, API chỉ trả trạng thái có khóa; ô khóa trống giữ nguyên khóa cũ. Muốn loại bỏ khóa, xóa cấu hình rồi tạo lại. Xóa cấu hình không xóa lịch sử.

Các biến cũ `TRANSLATION_BASE_URL`, `TRANSLATION_MODEL`, `TRANSLATION_API_KEY` không còn được dùng làm cấu hình dịch chung hoặc trả phí thay người dùng. Tài khoản đã có cần thiết lập lại API trên giao diện sau khi nâng cấp; migration giữ nguyên tài khoản và hội thoại. Các lượt dịch đang chạy giữ cấu hình đã lấy, lượt tiếp theo dùng cấu hình mới. Khi khôi phục hoặc chuyển máy, giữ `TRANSLATION_KEY_FILE` trỏ tới file khóa đã sao lưu.

```bash
docker compose up --build -d
docker compose logs -f backend
```

Mở **http://localhost:8080**, tạo tài khoản rồi tạo hội thoại. Có thể nhập chữ trong khi model nhận dạng đang tải. Chưa cấu hình hoặc chưa kết nối được dịch vụ dịch thì ứng dụng giữ nguyên văn và hiển thị lỗi có nút thử lại; không tự sinh bản dịch giả.

```bash
docker compose ps
docker compose exec backend python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health/ready').read().decode())"
docker compose down
```

`/health/live` kiểm tra ứng dụng đang chạy; `/health/ready` trả 503 trong khi tải model nhận dạng. Trạng thái sẵn sàng này không kiểm tra kết nối tới model dịch. Frontend khởi động khi backend phục vụ HTTP được, để đăng nhập và nhập chữ ngay trong lúc tải model.

Volume `database` lưu SQLite; volume `speech_models` lưu model. `docker compose down` giữ dữ liệu. Thay đổi `.env` cần chạy lại `docker compose up -d --force-recreate` để backend nhận cấu hình mới và Nginx cập nhật địa chỉ container.

## Thử trên điện thoại bằng HTTPS

Micro cần secure context: HTTPS trên điện thoại hoặc localhost trên máy tính. Có thể dùng [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) sau khi cài `cloudflared`:

```bash
cloudflared tunnel --url http://localhost:8080
```

Mở địa chỉ HTTPS được cấp trên cả hai điện thoại. Tạo và chia sẻ QR từ địa chỉ HTTPS đó để liên kết mời trỏ đúng máy chủ. Khi chỉ sử dụng HTTPS, đặt `COOKIE_SECURE=true` và tạo lại container backend. Tunnel chuyển tiếp lưu lượng tới máy bạn; xử lý nhận dạng và dịch vẫn dùng các model đã cấu hình.

Ứng dụng mặc định chỉ mở cổng trên `127.0.0.1`. Nếu triển khai LAN, cấu hình `APP_BIND=0.0.0.0` và reverse proxy HTTPS với chứng chỉ điện thoại tin cậy. Cho phép cùng origin là mặc định; chỉ cần `ALLOWED_ORIGINS` khi proxy của bạn thay đổi Host. Các origin bổ sung phân cách bằng dấu phẩy.

## Sử dụng

- **Tài khoản:** tên đăng nhập 3–32 ký tự `a-z`, số, `_`, `-`, `.`; mật khẩu 8–128 ký tự. Phiên có hiệu lực 7 ngày. Bản đầu dùng tài khoản nội bộ bằng tên đăng nhập và mật khẩu.
- **Một máy chung:** mỗi phía đều thấy nguyên văn và bản dịch; bấm nút xoay để phía A đọc khi ngồi đối diện. Nhập chữ có thể chọn phía A/B. Micro của tài khoản chủ phòng luôn là A và chỉ nhận dạng bằng ngôn ngữ A đã chọn; không dùng chung tài khoản để tự phân biệt hai giọng nói. Muốn cả hai người nói bằng ngôn ngữ riêng, tạo phòng hai máy với hai tài khoản.
- **Hai máy riêng:** chủ phòng là A, người được mời là B; cả hai cần tài khoản riêng. Liên kết/QR dùng một lần và hết hạn sau 24 giờ. Phòng tối đa hai thành viên; hai máy có thể gửi giọng nói độc lập.
- **Ngôn ngữ:** Việt, Anh, Nhật, Hàn, Trung (bản dịch chữ giản thể), Pháp, Đức, Tây Ban Nha; mặc định Việt–Anh. Cặp ngôn ngữ và chế độ giữ cố định trong phòng.
- **Micro:** nghe liên tục sau khi bấm bắt đầu. Khi chuyển ứng dụng, rời trang hoặc mất kết nối, micro dừng; cần bấm bắt đầu lại. Nhập chữ vẫn dùng được khi không cấp quyền micro.
- **Người nói:** giọng nói luôn gán theo vai tài khoản đã xác thực: chủ phòng A, người tham gia B. Cả phụ đề tạm và câu chốt đều khóa nhận dạng theo ngôn ngữ của vai đó, không tự đoán sang ngôn ngữ khác. Khi micro đang mở, nói đúng ngôn ngữ cạnh nhãn “Bạn là A/B”; câu chốt tự được dịch, không cần chọn người nói. Câu cũ chưa xác định vẫn có thể chọn A/B để dịch; âm thanh không lưu nên câu đã nhận sai cần nói lại. Whisper `base` vẫn có thể nhận sai từ dù đã khóa ngôn ngữ.
- **Câu mới và lịch sử:** câu mới nhất ở trên cùng, phụ đề đang nói nằm trước các câu đã chốt. Khi có phụ đề hoặc câu mới, các khung tự cuộn lên đầu, kể cả lúc đang xem lịch sử. Nút “Xem hội thoại trước” nằm cuối danh sách và tải câu cũ giữ vị trí đang đọc. Bản dịch cập nhật tại chỗ; thử lại câu cũ không thay đổi thứ tự thời gian.
- **Lịch sử:** lưu chữ và bản dịch đến khi chủ phòng xóa toàn bộ hội thoại. Cả hai thành viên xem lại được. Âm thanh chỉ ở bộ nhớ trong quá trình xử lý, không ghi file hoặc lưu SQLite.

## Luồng xử lý và giới hạn

```text
Micro → AudioWorklet → PCM 16-bit / mono / 16 kHz → WebSocket
      → VAD → faster-whisper → xác định chiều dịch
      → API model dịch → WebSocket → hai màn hình + SQLite
```

VAD dùng frame 20 ms; mặc định chốt đoạn sau khoảng 400 ms im lặng hoặc tối đa 4 giây. Trong lúc nói, ứng dụng gửi yêu cầu phụ đề tạm theo nhịp 1 giây nếu CPU còn rảnh. Bản dịch được gửi sau khi đoạn được chốt. Phụ đề tạm không lưu vào lịch sử.

Nhận dạng chạy ngoài event loop, một lượt suy luận tại một thời điểm. Phụ đề tạm bị bỏ qua khi CPU bận, để bản chốt của cả hai micro không phải chờ các phụ đề tạm xếp hàng. Một lượt nhận dạng đã bắt đầu vẫn cần chạy xong trước lượt kế tiếp. Mỗi luồng có tối đa 4 đoạn chờ; quá tải sẽ thông báo và dừng micro để người dùng thử lại. Dịch có tối đa 32 câu chờ, 2 tác vụ song song.

Độ trễ phụ thuộc CPU, độ dài câu và tốc độ model dịch. Với CPU Intel i3-10105F, cùng một đoạn tiếng Anh 6 giây đã đo khoảng 0,5–0,7 giây với `tiny`, 1,2–1,3 giây với `base` và 3,8–3,9 giây với `small` (nhận dạng tự phát hiện ngôn ngữ, không gồm hàng đợi và dịch). Đây là phép đo một mẫu, không bảo đảm chất lượng hoặc độ trễ cho mọi hội thoại. `base` là mặc định; `tiny` nhanh hơn nhưng dễ sai hơn, đặc biệt với tiếng Việt. `small` ưu tiên chất lượng và chậm hơn. Model dịch cần hỗ trợ các ngôn ngữ đã chọn. Các model nhận dạng phải là bản multilingual, không dùng bản `.en` cho hội thoại đa ngôn ngữ. GPU cần image/runtime CUDA phù hợp; Dockerfile mặc định dành cho CPU.

Các biến để điều chỉnh độ trễ (thời gian theo mili giây, bội số của 20):

```dotenv
WHISPER_MODEL=base
SPEECH_SILENCE_MS=400
SPEECH_MAX_SEGMENT_MS=4000
SPEECH_PREVIEW_MS=1000
```

Giảm thời gian im lặng hoặc độ dài tối đa giúp dịch sớm hơn, nhưng dễ cắt giữa câu và làm bản dịch thiếu ngữ cảnh. Tăng khoảng cách phụ đề tạm giúp dành CPU cho câu đã chốt. Whisper nhận dạng từng đoạn, chưa phải model STT streaming; tổng thời gian còn gồm chờ ngắt câu, nhận dạng, hàng đợi và API dịch. Chưa đo độ trễ toàn tuyến với model dịch thật nên chưa cam kết phản hồi dưới một giây. Nếu `.env` cũ còn `WHISPER_MODEL=small`, đổi sang `base` rồi tạo lại container để dùng cấu hình mới.

WebSocket tự kết nối lại và lấy lại các câu đã tải theo ID, số thứ tự và phiên bản. Câu nhập gửi lại với cùng `client_message_id` chỉ được lưu một lần. Câu đang dịch khi backend khởi động lại chuyển thành lỗi có thể thử lại. Heartbeat giữ kết nối khi micro đang mở nhưng không có ai nói.

## Phát triển không dùng Docker

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements-dev.txt
cp .env.example backend/.env
```

Giữ `COOKIE_SECURE=false` trong `backend/.env` khi thử HTTP localhost. Đăng nhập và nhập API tại **Cài đặt dịch thuật**. Nếu dùng model local, đặt `TRANSLATION_ALLOW_LOCAL=true` trong `backend/.env`, khởi động lại backend và dùng URL truy cập từ host, ví dụ `http://127.0.0.1:1234/v1`.

Terminal backend:

```bash
cd backend
../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal frontend:

```bash
cd frontend
npm ci
npm run dev
```

Vite proxy `/api` và `/ws` tới `127.0.0.1:8000`; đặt `VITE_PROXY_TARGET` nếu dùng cổng khác. Truy cập bằng địa chỉ localhost của Vite. SQLite và model của bản phát triển được giữ trong `backend/data` và `backend/models`.

Migration tự chạy khi khởi động. Khi sửa schema, thêm revision Alembic; có thể chạy `../.venv/bin/alembic upgrade head` trong thư mục backend. Backend production dùng **một worker** vì hub WebSocket và hàng đợi nằm trong bộ nhớ tiến trình.

## Kiểm thử

```bash
cd backend
../.venv/bin/pytest -q
../.venv/bin/ruff check app tests migrations scripts
```

```bash
cd frontend
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E tự chạy backend kiểm thử riêng và Vite trên cổng 8009/5179. API dịch và nhận dạng được thay bằng adapter kiểm thử trong `backend/tests/e2e_server.py`, không nằm trong Docker image production. Test dùng SQLite tạm và không gọi model thật. Bao gồm hai tài khoản, lời mời, hội thoại hai chiều, xoay màn hình, micro bị từ chối, kết nối lại, lịch sử và xóa phòng.

Kiểm tra nhận giọng nói bằng model thật với file ghi âm của bạn:

```bash
cd backend
../.venv/bin/python -m scripts.check_speech /duong-dan/ghi-am.wav --language auto --repeat 3
```

Lệnh tải/dùng model local, nhận dạng 6 giây đầu và in nội dung, độ tin cậy, thời gian suy luận của từng lần và trung vị. Có thể dùng `--seconds 4` để đo đoạn ngắn hơn; `--language vi` để đo khi biết trước ngôn ngữ, như chế độ hai máy. Đo lúc máy ít tải để so sánh các model. Kiểm thử chất lượng dịch và độ trễ toàn tuyến cần API model thật; kiểm tra quyền micro, xoay màn hình và chuyển nền cuối cùng cần điện thoại Android/iPhone thật qua HTTPS.

## API chính

- `POST /api/auth/register`, `/login`, `/logout`; `GET /api/auth/me`.
- `GET/POST /api/rooms`; `GET/DELETE /api/rooms/{id}`.
- `POST /api/rooms/{id}/invite`; `POST /api/rooms/join` với `{ "token": "..." }`.
- `GET /api/rooms/{id}/messages?before=...&limit=50` trả lịch sử phân trang.
- `POST /api/rooms/{id}/messages` với `{ "client_message_id": "uuid", "speaker": "A", "text": "Xin chào" }`. Ở phòng hai máy, backend xác định vai từ tài khoản và từ chối giả mạo vai người khác.
- `POST /api/rooms/{id}/messages/{message_id}/retry`; `/speaker` với `{ "speaker": "B" }` cho câu chờ xác định người nói.
- `GET /api/config` trả danh sách ngôn ngữ và trạng thái dịch/nhận dạng; không trả API key hay URL model.
- `GET /api/config?room_id=...` kiểm tra trạng thái cấu hình của chủ phòng, yêu cầu tư cách thành viên; trả `translation_is_owner` để hướng dẫn cấu hình đúng người.
- `GET/PUT/DELETE /api/settings/translation`: đọc/lưu/xóa cấu hình tài khoản đang đăng nhập. PUT nhận `base_url`, `model`, `api_key` tùy chọn; khóa trống giữ khóa cũ. GET/PUT chỉ trả `configured`, `base_url`, `model`, `has_api_key`.
- `POST /api/settings/translation/test`: dịch một câu Việt–Trung bằng cấu hình đã lưu; lỗi trả `detail.code` an toàn, không trả lỗi thô của nhà cung cấp.
- `WS /ws/rooms/{id}?from_sequence=...`: xác thực bằng cookie; gửi JSON `audio.start`, `audio.stop`, `pong`, `text.submit`; âm thanh là gói nhị phân PCM little-endian. Nhận `room.snapshot`, `room.members`, `message.upsert`, `message.ack`, `transcript.partial`, `audio.state`, `ping`, `error`, `room.deleted`.

Mật khẩu được băm Argon2id; cookie HttpOnly, SameSite=Lax; session và token mời chỉ lưu SHA-256 trong SQLite. Backend kiểm tra origin và tư cách thành viên trên HTTP/WebSocket. Liên kết mời dùng fragment để mã mời không xuất hiện trong URL request/access log. API key dịch chỉ được dùng từ backend.
