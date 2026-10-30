# Song Ngữ

Ứng dụng web dịch hội thoại hai chiều, dành cho hai người dùng chung một điện thoại hoặc mỗi người một điện thoại. Giao diện tiếng Việt, hiển thị đồng thời nguyên văn và bản dịch.

**Frontend:** ReactJS, JavaScript, Vite, Tailwind CSS. **Backend:** FastAPI, Python 3.12, WebSocket. **Dữ liệu:** SQLite, SQLAlchemy, Alembic. **Giọng nói:** NVIDIA Nemotron 3.5 ASR local qua Transformers. **Dịch:** model riêng qua API tương thích OpenAI.

## Chạy bằng Docker

Cần Docker Engine và Compose từ 2.24 trở lên. Mặc định nhận dạng dùng [nvidia/nemotron-3.5-asr-streaming-0.6b](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b), chạy CPU với 4 luồng. Model 600M tham số cần nhiều RAM và dung lượng hơn Whisper `base`; dành vài GB RAM trống và dung lượng cho PyTorch cùng model. Lần đầu cần Internet tải trọng số; cache được giữ trong volume cho các lần sau. Dockerfile cài bản PyTorch CPU; dùng CUDA cần PyTorch, driver và cấu hình GPU container phù hợp.

```bash
cp .env.example .env
```

Sửa ba biến sau trong `.env` theo máy chủ model của bạn:

```dotenv
TRANSLATION_BASE_URL=http://host.docker.internal:1234/v1
TRANSLATION_MODEL=ten-model-cua-ban
TRANSLATION_API_KEY=khoa-cua-ban
```

`TRANSLATION_API_KEY` có thể để trống nếu máy chủ model không yêu cầu xác thực. Dịch vụ cần chấp nhận `POST /v1/chat/completions` với `model`, `messages`, `temperature: 0`, `stream: false`, và trả về `choices[0].message.content` dạng chuỗi. Base URL có thể chứa hoặc không chứa `/v1`; không thêm `/chat/completions`.

Nếu model chạy trên cùng máy host, `host.docker.internal` đã được cấu hình cho Docker trên Linux. Dịch vụ model phải lắng nghe trên địa chỉ Docker truy cập được, ví dụ `0.0.0.0:1234`; dịch vụ chỉ bind `127.0.0.1` của host sẽ không nhận kết nối qua Docker gateway. Nếu model ở máy khác, dùng IP hoặc tên miền của máy đó.

```bash
docker compose up --build -d
docker compose logs -f backend
```

Mở **http://localhost:8080**, tạo tài khoản rồi tạo hội thoại. Chờ model nhận dạng sẵn sàng, bấm **Bắt đầu nghe** rồi nói tự nhiên; giao diện hội thoại chỉ dùng giọng nói. Chưa cấu hình hoặc chưa kết nối được dịch vụ dịch thì ứng dụng giữ nguyên văn và hiển thị lỗi có nút thử lại; không tự sinh bản dịch giả.

```bash
docker compose ps
docker compose exec backend python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health/ready').read().decode())"
docker compose down
```

`/health/live` kiểm tra ứng dụng đang chạy; `/health/ready` trả 503 trong khi tải model nhận dạng. Trạng thái sẵn sàng này không kiểm tra kết nối tới model dịch. Frontend khởi động khi backend phục vụ HTTP được, để đăng nhập, tạo phòng và xem lịch sử ngay trong lúc tải model; micro chỉ bật khi nhận dạng đã sẵn sàng.

Volume `database` lưu SQLite; volume `speech_models` lưu model. `docker compose down` giữ dữ liệu. Thay đổi `.env` cần chạy lại `docker compose up -d --force-recreate` để backend nhận cấu hình mới và Nginx cập nhật địa chỉ container.

## Thử trên điện thoại bằng HTTPS

Micro cần secure context: HTTPS trên điện thoại hoặc localhost trên máy tính. Có thể dùng [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) sau khi cài `cloudflared`:

```bash
cloudflared tunnel --url http://localhost:8080
```

Mở địa chỉ HTTPS được cấp trên cả hai điện thoại. Tạo và chia sẻ QR từ địa chỉ HTTPS đó để liên kết mời trỏ đúng máy chủ. Khi chỉ sử dụng HTTPS, đặt `COOKIE_SECURE=true` và tạo lại container backend. Tunnel chuyển tiếp lưu lượng tới máy bạn; xử lý nhận dạng và dịch vẫn dùng các model đã cấu hình.

Ứng dụng mặc định chỉ mở cổng trên `127.0.0.1`. Nếu triển khai LAN, cấu hình `APP_BIND=0.0.0.0` và reverse proxy HTTPS với chứng chỉ điện thoại tin cậy. Cho phép cùng origin là mặc định; chỉ cần `ALLOWED_ORIGINS` khi proxy của bạn thay đổi Host. Các origin bổ sung phân cách bằng dấu phẩy.

## Sử dụng

- **Tài khoản:** đăng ký bằng tên đăng nhập 3–32 ký tự `a-z`, số, `_`, `-`, `.`, họ tên, email và mật khẩu 8–128 ký tự nhập hai lần. Tên đăng nhập và email không được trùng tài khoản khác. Đăng nhập vẫn dùng tên đăng nhập và mật khẩu; phiên có hiệu lực 7 ngày. Bấm biểu tượng **Cài đặt tài khoản** trên thanh đầu trang để sửa email. Email chỉ hiển thị với chính bạn và chưa được xác minh qua thư.
- **Tài khoản cũ:** migration tự dùng tên đăng nhập làm tên hiển thị, để email trống (**Chưa cập nhật**) và giữ nguyên mật khẩu, phiên đăng nhập, hội thoại. Có thể bổ sung email trong cài đặt sau khi đăng nhập.
- **Một máy chung:** hai người cùng xem một khung hội thoại chứa nguyên văn và bản dịch. Bấm **Bắt đầu nghe** và nói lần lượt; không có ô nhập A/B hay nút xoay màn hình.
- **Hai máy riêng:** chủ phòng là A, người được mời là B; cả hai cần tài khoản riêng. Liên kết/QR dùng một lần và hết hạn sau 24 giờ. Phòng tối đa hai thành viên; hai máy có thể gửi giọng nói độc lập.
- **Ngôn ngữ:** Việt, Anh, Nhật, Hàn, Trung (bản dịch chữ giản thể), Pháp, Đức, Tây Ban Nha; mặc định Việt–Anh. Cặp ngôn ngữ và chế độ giữ cố định trong phòng.
- **Micro:** nghe liên tục sau khi bấm bắt đầu. Khi chuyển ứng dụng, rời trang hoặc mất kết nối, micro dừng; cần bấm bắt đầu lại. Ở chế độ một máy chung, Nemotron tự nhận diện ngôn ngữ; chỉ gán A/B nếu tag ngôn ngữ nằm trong cặp ngôn ngữ của phòng. Nếu thiếu tag (thường ở câu bị cắt giữa chừng) hoặc nhận ra ngôn ngữ khác, ứng dụng sẽ yêu cầu chọn người nói A/B trước khi dịch câu đó. Ở chế độ hai máy, mỗi micro dùng prompt ngôn ngữ của phía đó. Nếu chưa cấp quyền hoặc không tìm thấy micro, hãy cấp quyền/kết nối micro rồi bấm bắt đầu lại. Không có ô nhập tin nhắn trong cả hai chế độ.
- **Dễ đọc:** chữ giao diện chính từ 18px, chữ phụ từ 16px; nguyên văn 24px và bản dịch 32px trên máy tính (22px/28px trên điện thoại). Nút bấm tối thiểu cao 48px, nút micro 56px. Cỡ chữ dùng `rem` để theo thiết lập chữ của trình duyệt.
- **Người nói:** dùng chung máy sẽ gán A/B theo ngôn ngữ, không nhận diện danh tính giọng nói. Câu thiếu độ tin cậy sẽ chờ chọn A/B trước khi dịch. Hai người cần nói lần lượt, tránh nói chồng trong cùng một micro.
- **Lịch sử:** lưu chữ và bản dịch đến khi chủ phòng xóa toàn bộ hội thoại. Cả hai thành viên xem lại được. Âm thanh chỉ ở bộ nhớ trong quá trình xử lý, không ghi file hoặc lưu SQLite.

## Luồng xử lý và giới hạn

```text
Micro → AudioWorklet → PCM 16-bit / mono / 16 kHz → WebSocket
      → VAD → Nemotron 3.5 ASR → xác định chiều dịch
      → API model dịch → WebSocket → khung hội thoại + SQLite
```

VAD dùng frame 20 ms; mặc định chốt đoạn sau khoảng 400 ms im lặng hoặc tối đa 4 giây. Trong lúc nói, ứng dụng gửi yêu cầu phụ đề tạm theo nhịp 1 giây nếu CPU còn rảnh. Bản dịch được gửi sau khi đoạn được chốt. Phụ đề tạm không lưu vào lịch sử.

Nhận dạng chạy ngoài event loop, một lượt suy luận tại một thời điểm. Phụ đề tạm bị bỏ qua khi CPU bận, để bản chốt của cả hai micro không phải chờ các phụ đề tạm xếp hàng. Một lượt nhận dạng đã bắt đầu vẫn cần chạy xong trước lượt kế tiếp. Mỗi luồng có tối đa 4 đoạn chờ; quá tải sẽ thông báo và dừng micro để người dùng thử lại. Dịch có tối đa 32 câu chờ, 2 tác vụ song song.

Độ trễ phụ thuộc CPU/GPU, độ dài câu và tốc độ model dịch; chưa cam kết phản hồi dưới một giây. Nemotron hỗ trợ tám ngôn ngữ của ứng dụng, bao gồm tiếng Việt. Adapter dùng `AutoProcessor` và `AutoModelForRNNT` (Transformers >= 5.13), PCM mono 16 kHz, prompt locale như `vi-VN`/`en-US` hoặc `auto`. Tag ngôn ngữ được bỏ khỏi nội dung hiển thị. Trường `confidence` của Nemotron là tín hiệu định tuyến 0/1 (có tag hợp lệ hay không), **không phải xác suất ngôn ngữ** như Whisper.

Cấu hình mặc định:

```dotenv
SPEECH_BACKEND=nemotron
SPEECH_MODEL=nvidia/nemotron-3.5-asr-streaming-0.6b
SPEECH_DEVICE=cpu
SPEECH_CPU_THREADS=4
SPEECH_DOWNLOAD_ROOT=./models
SPEECH_SILENCE_MS=400
SPEECH_MAX_SEGMENT_MS=4000
SPEECH_PREVIEW_MS=1000
```

Giảm thời gian im lặng hoặc độ dài tối đa giúp dịch sớm hơn, nhưng dễ cắt giữa câu và làm bản dịch thiếu ngữ cảnh. Tăng khoảng cách phụ đề tạm giúp dành CPU cho câu đã chốt. **Model có khả năng streaming, nhưng adapter hiện nhận dạng từng đoạn VAD/phụ đề tạm độc lập, chưa dùng cache-aware streaming liên tục.** Không chia sẻ cache âm thanh giữa các phòng. Tổng độ trễ còn gồm chờ ngắt câu, nhận dạng, hàng đợi và API dịch.

`WHISPER_*` chỉ còn áp dụng khi đặt `SPEECH_BACKEND=whisper` để quay lại backend cũ; mặc định không tự fallback nếu Nemotron lỗi. `SPEECH_ENABLED=false` tắt tải model. Khi thay model/config, khởi động lại backend; Docker cần rebuild nếu đổi dependency/code.

WebSocket tự kết nối lại và lấy lại các câu đã tải theo ID, số thứ tự và phiên bản. Câu nhập gửi lại với cùng `client_message_id` chỉ được lưu một lần. Câu đang dịch khi backend khởi động lại chuyển thành lỗi có thể thử lại. Heartbeat giữ kết nối khi micro đang mở nhưng không có ai nói.

## Phát triển không dùng Docker

```bash
python3 -m venv .venv
# CPU: cài PyTorch từ index CPU trước để tránh tải CUDA không cần thiết.
.venv/bin/pip install --index-url https://download.pytorch.org/whl/cpu torch==2.15.0
.venv/bin/pip install -r backend/requirements.lock
.venv/bin/pip install -r backend/requirements-dev.txt
cp .env.example backend/.env
```

Sửa `backend/.env`: dùng URL model truy cập từ host, ví dụ `http://127.0.0.1:1234/v1`, và giữ `COOKIE_SECURE=false` khi thử HTTP localhost.

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

E2E tự chạy backend kiểm thử riêng và Vite trên cổng 8009/5179. API dịch và nhận dạng được thay bằng adapter kiểm thử trong `backend/tests/e2e_server.py`, không nằm trong Docker image production. Test dùng SQLite tạm và không gọi model thật. Bao gồm hai tài khoản, lời mời, hội thoại hai chiều, giao diện chỉ dùng giọng nói, micro bị từ chối, kết nối lại, lịch sử và xóa phòng.

Kiểm tra nhận giọng nói bằng model thật với file ghi âm của bạn:

```bash
cd backend
../.venv/bin/python -m scripts.check_speech /duong-dan/ghi-am.wav --language auto --repeat 3
```

Lệnh tải/dùng model local, nhận dạng 6 giây đầu và in nội dung, độ tin cậy, thời gian suy luận của từng lần và trung vị. Có thể dùng `--seconds 4` để đo đoạn ngắn hơn; `--language vi` để đo khi biết trước ngôn ngữ, như chế độ hai máy. Đo lúc máy ít tải để so sánh các model. Kiểm thử chất lượng dịch và độ trễ toàn tuyến cần API model thật; kiểm tra quyền micro, chữ lớn và chuyển nền cuối cùng cần điện thoại Android/iPhone thật qua HTTPS.

## API chính

- `POST /api/auth/register`: `username`, `name`, `email`, `password`, `password_confirmation`; `POST /api/auth/login`: `username`, `password`; `POST /api/auth/logout`.
- `GET /api/auth/me`: `id`, `username`, `name`, `email`; `PATCH /api/auth/me` với `email` để cập nhật email tài khoản đang đăng nhập.
- `GET/POST /api/rooms`; `GET/DELETE /api/rooms/{id}`.
- `POST /api/rooms/{id}/invite`; `POST /api/rooms/join` với `{ "token": "..." }`.
- `GET /api/rooms/{id}/messages?before=...&limit=50` trả lịch sử phân trang.
- `POST /api/rooms/{id}/messages` với `{ "client_message_id": "uuid", "speaker": "A", "text": "Xin chào" }`. Ở phòng hai máy, backend xác định vai từ tài khoản và từ chối giả mạo vai người khác.
- `POST /api/rooms/{id}/messages/{message_id}/retry`; `/speaker` với `{ "speaker": "B" }` cho câu chờ xác định người nói.
- `GET /api/config` trả danh sách ngôn ngữ và trạng thái dịch/nhận dạng; không trả API key hay URL model.
- `WS /ws/rooms/{id}?from_sequence=...`: xác thực bằng cookie; gửi JSON `audio.start`, `audio.stop`, `pong`, `text.submit`; âm thanh là gói nhị phân PCM little-endian. Nhận `room.snapshot`, `room.members`, `message.upsert`, `message.ack`, `transcript.partial`, `audio.state`, `ping`, `error`, `room.deleted`.

Mật khẩu được băm Argon2id; cookie HttpOnly, SameSite=Lax; session và token mời chỉ lưu SHA-256 trong SQLite. Backend kiểm tra origin và tư cách thành viên trên HTTP/WebSocket. Liên kết mời dùng fragment để mã mời không xuất hiện trong URL request/access log. API key dịch chỉ được dùng từ backend.
