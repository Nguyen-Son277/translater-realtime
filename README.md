# Song Ngữ

Ứng dụng web dịch hội thoại hai chiều: dùng chung một điện thoại hoặc mỗi người một điện thoại. React/Vite, FastAPI/WebSocket, SQLite/SQLAlchemy/Alembic. Nhận dạng chạy local bằng [NVIDIA Nemotron 3.5 ASR](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b); dịch văn bản qua gateway tương thích OpenAI. Giao diện hỗ trợ Việt/Anh/Trung.

## Triển khai Docker

Cần Docker Engine và Compose 2.24+; dành vài GB RAM/dung lượng cho PyTorch và model 600M tham số. Lần đầu tải Nemotron cần Internet; model và database được giữ trong các named volume hiện có. Chỉ chạy **một backend worker/replica** vì hub, presence và hàng đợi nằm trong bộ nhớ.

```bash
# Không ghi đè .env đã có.
test -f .env || cp .env.example .env
chmod 600 .env
```

Điền các giá trị sau trong [cấu hình riêng](<.env>) theo [mẫu môi trường](<.env.example>):

```dotenv
APP_BIND=127.0.0.1
APP_PORT=38471
ADMIN_USERNAME=admin
ADMIN_PASSWORD=mat-khau-manh-tu-8-den-128-ky-tu
SETTINGS_ENCRYPTION_KEY=khoa-Fernet-duoc-tao-ben-duoi
COOKIE_SECURE=false
```

Tạo khoá Fernet **một lần**, không đổi khoá giữa các lần deploy:

```bash
# Nếu đã có virtualenv và dependency:
.venv/bin/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Hoặc dùng Docker, không cần cài Python trên host:
docker run --rm python:3.12-slim python -c "import base64,os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
```

**Giữ khoá này trong kho bí mật và sao lưu cùng database.** API key gateway được mã hoá bằng khoá này trước khi ghi SQLite. Mất khoá sẽ không đọc được API key đã lưu; ứng dụng báo lỗi thay vì ghi đè dữ liệu. Không commit cấu hình riêng hoặc in `docker compose config` không có `--quiet` vì có thể lộ bí mật.

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

Mở **http://localhost:38471**, đăng nhập bằng admin đã cấu hình; **không cần đăng ký admin trên web**. Mở **Quản trị → Thiết lập dịch** (`/admin/settings`), điền URL, model, API key rồi **Lưu → Kiểm tra kết nối**. Sau đó tạo phòng và sử dụng micro khi ASR sẵn sàng.

- `ADMIN_USERNAME`/`ADMIN_PASSWORD` chỉ bootstrap lần đầu. Sau đó mật khẩu database là chuẩn; đổi tại **Cài đặt tài khoản → Đổi mật khẩu**. Restart hoặc sửa mật khẩu env không đặt lại mật khẩu đã có.
- Khi nâng cấp database cũ, username được chỉ định đã tồn tại sẽ được nâng quyền, **giữ nguyên mật khẩu, ID, email và lịch sử**. Mật khẩu env không thay mật khẩu cũ. Tài khoản guest không được nâng quyền; tài khoản bị khoá không tự mở khoá.
- Quyền admin là cờ bền trong database, không còn cấp quyền dựa trên việc người dùng tự đăng ký tên. Đăng ký công khai chỉ tạo user thường.
- Bản cài mới thiếu thông tin bootstrap/khoá mã hoá sẽ báo lỗi; không có mật khẩu mặc định yếu.
- Cổng `38471` ít phổ biến hơn 8080; vẫn cần kiểm tra xung đột và đổi `APP_PORT` nếu cần. Backend không được publish ra host. Port khác thường không thay thế firewall/xác thực.

## Thiết lập gateway trong admin

Gateway cần nhận `POST /v1/chat/completions` với `model`, `messages`, `temperature: 0`, `stream: false`, trả `choices[0].message.content` dạng chuỗi. URL có hoặc không có hậu tố `/v1`; **không thêm `/chat/completions`**. Chỉ chấp nhận HTTP/HTTPS, không userinfo/query/fragment. Không theo redirect.

Ví dụ URL trong giao diện admin:

- Backend Docker gọi gateway trên host: `http://host.docker.internal:20128/v1`.
- Backend native gọi gateway cùng máy: `http://127.0.0.1:20128/v1`.
- Gateway từ xa: URL HTTPS do nhà cung cấp cấp. Model là tên chính xác gateway hỗ trợ, ví dụ `cx/gpt-6-luna`.

`localhost` **bên trong container** là chính container đó, không phải host. Gateway trên host phải lắng nghe trên địa chỉ Docker truy cập được; listener chỉ bind 127.0.0.1 sẽ không nhận qua host-gateway. Giới hạn bằng firewall/mạng Docker; **không công khai cổng gateway ra Internet** chỉ để container truy cập.

- API key có thể trống nếu gateway không yêu cầu. Key đã lưu không được trả lại trình duyệt, localStorage hoặc API response. Form chỉ hiển thị trạng thái đã có key; để trống giữ key cũ, dùng thao tác xoá tường minh để bỏ key.
- URL/model/key lưu trong database, có hiệu lực cho tác vụ bắt đầu sau lần lưu, **không cần restart**. Tác vụ đang gọi gateway dùng snapshot cũ cho đến khi hoàn tất.
- Hai tab cùng sửa: revision cũ trả 409, cần tải lại thay vì ghi đè cấu hình mới.
- **Kiểm tra kết nối** dùng cấu hình đã lưu, gửi câu dịch ngắn cố định và có thể phát sinh phí gateway. Không lưu câu kiểm tra vào hội thoại. Chưa cấu hình hoặc gateway lỗi: giữ nguyên văn, báo lỗi có thể thử lại, không tạo bản dịch giả.
- `TRANSLATION_TIMEOUT=45`, `TRANSLATION_CONCURRENCY=2`, `TRANSLATION_QUEUE_SIZE=32` vẫn là tham số vận hành trong env.
- Khi nâng cấp, `TRANSLATION_BASE_URL`, `TRANSLATION_MODEL`, `TRANSLATION_API_KEY` cũ được nhập **một lần** nếu chưa có bản ghi thiết lập. Sau khi xác minh nhập thành công, xoá chúng khỏi env; từ đó database/admin là nguồn chuẩn, restart không ghi đè bằng env cũ.

## Cloudflare Named Tunnel HTTPS

Micro trên điện thoại cần HTTPS. Tạo remotely-managed Named Tunnel trong Cloudflare Zero Trust, chọn connector Docker và lấy **tunnel-scoped token**, không dùng Global API Key. Trong Dashboard, cấu hình public hostname HTTPS trỏ service **`http://frontend:80`**; connector và frontend ở cùng mạng Compose.

Điền vào [cấu hình riêng](<.env>):

```dotenv
CLOUDFLARE_TUNNEL_TOKEN=token-cua-tunnel
COOKIE_SECURE=true
```

```bash
docker compose --profile tunnel config --quiet
docker compose --profile tunnel up -d --build
docker compose --profile tunnel logs -f cloudflared
```

Chỉ connector nhận token; backend/frontend không nhận secret Cloudflare. Token không nằm trong đối số command. Image connector được ghim phiên bản trong [Compose](<compose.yaml>). Profile `tunnel` không bật ở chế độ local; bật khi chưa có token thì connector thất bại, không tạo tunnel ẩn danh. Token env vẫn có thể đọc bởi người có quyền Docker; bảo vệ host và file env.

Mở hostname HTTPS trên cả hai điện thoại, đăng nhập lại để có secure cookie, rồi tạo lời mời từ **chính URL công khai đó**. Kiểm tra WebSocket, nhận dạng, dịch hai chiều và reconnect qua hai mạng khác nhau. Tunnel hoạt động outbound-only; không cần publish backend, gateway hay mở port router. Không cần API key cấp tài khoản Cloudflare. Cấu hình DNS/hostname và token do người triển khai cung cấp.

Có thể dùng reverse proxy HTTPS riêng tới `http://127.0.0.1:38471`: giữ Host công khai, `/api` và `/ws` cùng origin, chuyển tiếp WebSocket Upgrade, timeout tối thiểu 60 giây. Chỉ thêm `ALLOWED_ORIGINS` khi thực sự cần, liệt kê origin tin cậy; không mặc định tin cậy mọi hostname tunnel. Không bật `COOKIE_SECURE=true` nếu chỉ thử HTTP localhost.

## GPU NVIDIA

Giữ [overlay GPU](<compose.gpu.yaml>); ASR dùng CUDA, dịch vẫn qua gateway, không tải LLM dịch local. Cần NVIDIA driver tương thích runtime PyTorch và [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) trên host. Không cần host CUDA toolkit đầy đủ. Kiểm tra driver/runtime theo wheel được ghim trong [lockfile](<backend/requirements.lock>); không suy ra tương thích chỉ từ tên GPU.

```bash
nvidia-smi
# Sau khi cài và cấu hình NVIDIA Container Toolkit:
docker compose -f compose.yaml -f compose.gpu.yaml config --quiet
docker compose -f compose.yaml -f compose.gpu.yaml up -d --build
# Thêm --profile tunnel nếu dùng Cloudflare.
docker compose -f compose.yaml -f compose.gpu.yaml exec backend \
  python -c "import torch; print(torch.__version__,torch.version.cuda,torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'GPU unavailable')"
```

Luôn dùng cả hai file Compose khi tạo lại container GPU. Không tự fallback CPU khi driver/VRAM lỗi. [Dockerfile CPU](<backend/Dockerfile>) dùng [lockfile CPU](<backend/requirements.lock>) và cài torch CPU trước; [Dockerfile GPU](<backend/Dockerfile.gpu>) dùng [lockfile CUDA riêng](<backend/requirements.gpu.lock>). Một lượt suy luận tại một thời điểm để tránh chồng model memory.

## Dữ liệu, nâng cấp và model cache

- Volume `database` lưu SQLite; volume `speech_models` lưu Nemotron. `docker compose down` giữ volume; **không thêm `-v`**, không prune diện rộng.
- Migration tự chạy khi backend khởi động, giữ tài khoản, mật khẩu và hội thoại cũ. Sao lưu SQLite bằng SQLite backup API khi đang chạy hoặc sau khi dừng backend; không chỉ copy file database đang ghi WAL.
- Sao lưu `SETTINGS_ENCRYPTION_KEY` cùng database, nhưng cất riêng với quyền truy cập phù hợp. Sao lưu chứa thông tin hội thoại và hash mật khẩu, cần bảo vệ như dữ liệu thật.
- Thay env vận hành cần `docker compose up -d --force-recreate`; chỉnh gateway qua admin không cần restart.
- ASR duy nhất là Nemotron, không còn lựa chọn backend nhận dạng khác. Các biến legacy chọn backend không còn được hỗ trợ. Bộ dịch GGUF/runtime local và các overlay tương ứng đã được bỏ.
- [Công cụ dọn cache legacy](<scripts/clean_legacy_models.py>) chỉ xoá cache model bị bỏ và blob đã chứng minh không được cache giữ lại tham chiếu; không xoá nguyên kho blob dùng chung. Chạy khi không có tiến trình dùng cache. Không áp dụng lên cache ngoài dự án hoặc volume chưa kiểm tra.

```bash
python3 scripts/clean_legacy_models.py models
```

Bản native dùng [dữ liệu backend](<backend/data>) và model theo `SPEECH_DOWNLOAD_ROOT`; Docker dùng volume riêng. Dọn cache host không tự dọn volume Docker. Không xoá database hoặc cache Nemotron khi nâng cấp.

## Sử dụng và giới hạn

- **Admin:** `/admin` quản lý tài khoản: tìm kiếm, lọc, phân trang, khoá/mở khoá, đặt lại mật khẩu, xoá. `/admin/settings` quản lý gateway. User thường và guest không có quyền gọi API quản trị.
- **Tài khoản:** đăng ký user thường bằng username 3–32 ký tự `a-z0-9_.-`, họ tên, email, mật khẩu 8–128 ký tự và xác nhận. Phiên mặc định 7 ngày. Sửa email/đổi mật khẩu tại cài đặt tài khoản; email chưa được xác minh qua thư.
- **Một máy chung:** hai người nói lần lượt; gán A/B theo tag ngôn ngữ trong cặp của phòng, không nhận diện danh tính giọng nói. Tag không đủ tin cậy thì chọn người nói trước khi dịch.
- **Hai máy từ xa:** chủ phòng đăng nhập, tạo link/QR cho người còn lại; người được mời có thể vào bằng phiên khách HttpOnly, không đăng ký. Link dùng một lần, hết hạn 24 giờ; mỗi phòng tối đa hai thành viên.
- **Khách:** chỉ dùng phòng được mời, không tạo/xoá phòng hay sửa tài khoản. Tải lại vẫn dùng phiên còn hạn; mất cookie/đăng xuất/hết hạn thì link đã dùng không khôi phục được, chủ phòng cần tạo lời mời/phòng mới.
- **Ngôn ngữ:** Việt, Anh, Nhật, Hàn, Trung giản thể, Pháp, Đức, Tây Ban Nha. Cặp ngôn ngữ/chế độ cố định trong phòng.
- **Micro:** chỉ bật khi chủ động cấp quyền và bấm bắt đầu; chuyển nền, mất mạng, rời trang sẽ dừng, không tự bật lại. Không có gọi thoại hay đọc bản dịch qua loa. Âm thanh chỉ trong RAM, không ghi file/SQLite; chữ/bản dịch lưu đến khi xoá hội thoại.
- Khóa user thu hồi phiên và đóng socket; mở khoá không hồi sinh phiên cũ. Admin không được khoá/xoá/reset admin khác hoặc chính mình qua trang quản lý. Reset user buộc đổi mật khẩu ở lần đăng nhập sau. Tự đổi mật khẩu giữ phiên hiện tại, thu hồi phiên khác.
- Xoá tài khoản là vĩnh viễn, cascade phòng do tài khoản sở hữu; phòng thuộc người khác vẫn còn. Có hộp xác nhận.
- Hướng dẫn tại `/guide` có 18 bài, đầy đủ ba ngôn ngữ. Nội dung nằm trong các module bài viết dưới frontend.

```text
Micro → AudioWorklet → PCM 16-bit mono 16 kHz → WebSocket
      → VAD → Nemotron 3.5 ASR → chọn chiều dịch
      → gateway Chat Completions → WebSocket + SQLite
```

VAD frame 20 ms; mặc định chốt sau 400 ms im lặng hoặc tối đa 4 giây. Preview mỗi 1 giây khi bộ suy luận rảnh, không lưu preview. **Model có khả năng streaming, nhưng adapter hiện nhận dạng các đoạn VAD/preview độc lập, chưa dùng cache-aware streaming liên tục.** Không chia sẻ cache âm thanh giữa phòng. `confidence` là chỉ báo định tuyến 0/1, không phải xác suất hiệu chuẩn.

Mỗi capture có tối đa 4 đoạn chờ; quá tải dừng micro và báo lỗi. Preview bị bỏ qua khi ASR bận, ưu tiên bản chốt. Dừng micro phản hồi ngay; model native đang chạy vẫn phải hoàn tất trước lượt kế tiếp. Hai phiên đã dừng có thể đang xử lý nốt; sau 15 giây yêu cầu huỷ, không chạy chồng suy luận. Dịch có 32 câu chờ, 2 tác vụ song song mặc định. Độ trễ tuỳ CPU/GPU, đoạn nói và gateway; không cam kết dưới một giây.

WebSocket reconnect backoff tối đa 10 giây, lấy lại câu theo ID/sequence/version. Server ping 10 giây, pong deadline 30 giây; audio không thay pong. Mất kết nối yêu cầu người dùng bật micro lại. Câu đang dịch khi restart chuyển thành lỗi có thể retry. `client_message_id` chống ghi trùng lần gửi lại, không lọc câu giống nội dung nhưng khác ID.

## Phát triển và kiểm thử

```bash
python3 -m venv .venv
.venv/bin/pip install --index-url https://download.pytorch.org/whl/cpu torch==2.15.0
.venv/bin/pip install -r backend/requirements.lock -r backend/requirements-dev.txt
# Native đọc env theo working directory: tạo backend/.env từ mẫu,
# điền ADMIN_*, SETTINGS_ENCRYPTION_KEY, cấu hình cache phù hợp.
(cd backend && ../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload)
(cd frontend && npm ci && npm run dev)
```

Vite proxy `/api` và `/ws` tới 127.0.0.1:8000; có thể đổi `VITE_PROXY_TARGET`. Chỉ dùng HTTP localhost trong phát triển; cấu hình URL gateway native trong admin theo host, không dùng hostname Docker.

```bash
(cd backend && ../.venv/bin/pytest -q)
(cd backend && ../.venv/bin/ruff check app tests migrations scripts)
(cd frontend && npm test && npm run build)
(cd frontend && npx playwright install chromium && npm run test:e2e)
.venv/bin/pip check
```

E2E dùng backend giả lập riêng, cổng 8009/5179 và database tạm. Không gọi ASR/gateway thật nên không chứng minh độ chính xác hay độ trễ thực tế. Cần nghiệm thu hai điện thoại Wi-Fi/4G qua HTTPS: đăng nhập, link một lần, cả hai chiều ngôn ngữ, micro đồng thời, từ chối/cấp quyền, chuyển nền, mất mạng/reconnect, gateway lỗi/retry và lịch sử.

```bash
# Nhận dạng file thật (không phụ thuộc backend nhận dạng cũ):
(cd backend && ../.venv/bin/python -m scripts.check_speech /path/recording.wav --language auto --repeat 3)
# Kiểm tra liveness/readiness trong container:
docker compose exec backend python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health/ready').read().decode())"
```

`/health/live` xác nhận HTTP hoạt động; `/health/ready` phụ thuộc tải/warm-up ASR, **không kiểm tra gateway**. Frontend vẫn cho đăng nhập/quản trị khi model đang tải; micro chờ ready. `SPEECH_ENABLED=false` tắt tải model để phát triển/kiểm thử.

## API quản trị thiết lập

- `GET /api/admin/settings/translation`: `base_url`, `model`, `api_key_configured`, `configured`, `revision`; không trả key.
- `PATCH /api/admin/settings/translation`: URL/model/revision; `api_key` bỏ qua hoặc null giữ nguyên, rỗng xoá, giá trị mới thay key. Conflict trả 409.
- `POST /api/admin/settings/translation/test`: thử cấu hình đã lưu bằng câu ngắn, lỗi được chuẩn hoá không chứa upstream response/header.
- API user/phòng giữ nguyên: `/api/auth/*`, `/api/admin/accounts`, `/api/rooms`, `/api/config`, `/ws/rooms/{id}`. `/api/config` chỉ trả ngôn ngữ/trạng thái, không URL/key gateway.

Mật khẩu Argon2id; cookie HttpOnly/SameSite=Lax, secure khi HTTPS; session/invite token chỉ lưu digest SHA-256. HTTP/WebSocket kiểm tra origin và membership. Invite token nằm trong fragment để tránh access log. Bí mật gateway chỉ dùng ở backend; mã hoá at-rest không chống được host/container đã bị chiếm quyền.
