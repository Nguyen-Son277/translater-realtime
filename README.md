# Song Ngữ

Ứng dụng web dịch hội thoại hai chiều, dành cho hai người dùng chung một điện thoại hoặc mỗi người một điện thoại. Giao diện tiếng Việt, hiển thị đồng thời nguyên văn và bản dịch.

**Frontend:** ReactJS, JavaScript, Vite, Tailwind CSS. **Backend:** FastAPI, Python 3.12, WebSocket. **Dữ liệu:** SQLite, SQLAlchemy, Alembic. **Giọng nói:** NVIDIA Nemotron 3.5 ASR local qua Transformers. **Dịch:** model riêng qua API tương thích OpenAI.

## Cấu hình dịch đang sử dụng

Dùng gateway tương thích OpenAI với model `cx/gpt-6-luna`, `TRANSLATION_BACKEND=openai`, timeout 45 giây và 2 tác vụ dịch song song. Backend native dùng `http://localhost:20128/v1`; backend Docker dùng `http://host.docker.internal:20128/v1`. API key chỉ đặt trong môi trường backend, không đưa lên frontend hoặc Git.

TranslateGemma đã được tắt vì không đạt tốc độ mong muốn trên máy này. Mã thử nghiệm và model tải về được giữ để tham khảo nhưng không tự chạy. **Không thêm các overlay `compose.translation*.yaml` khi dùng gateway** vì chúng ghi đè cấu hình dịch sang local.

## Chạy bằng Docker

Cần Docker Engine và Compose từ 2.24 trở lên. Mặc định nhận dạng dùng [nvidia/nemotron-3.5-asr-streaming-0.6b](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b), chạy CPU với 4 luồng. Model 600M tham số cần nhiều RAM và dung lượng hơn Whisper `base`; dành vài GB RAM trống và dung lượng cho PyTorch cùng model. Lần đầu cần Internet tải trọng số; cache được giữ trong volume cho các lần sau. Dockerfile cài bản PyTorch CPU. Với VPS NVIDIA, dùng overlay GPU ở phần dưới; overlay cài PyTorch CUDA và chạy Nemotron trên GPU, còn dịch văn bản vẫn qua gateway OpenAI hiện tại.

```bash
cp .env.example .env
```

Sửa ba biến sau trong `.env` theo máy chủ model của bạn:

```dotenv
TRANSLATION_BACKEND=openai
TRANSLATION_BASE_URL=http://host.docker.internal:20128/v1
TRANSLATION_MODEL=cx/gpt-6-luna
TRANSLATION_API_KEY=khoa-gateway-cua-ban
```

`TRANSLATION_API_KEY` có thể để trống nếu máy chủ model không yêu cầu xác thực. Dịch vụ cần chấp nhận `POST /v1/chat/completions` với `model`, `messages`, `temperature: 0`, `stream: false`, và trả về `choices[0].message.content` dạng chuỗi. Base URL có thể chứa hoặc không chứa `/v1`; không thêm `/chat/completions`.

Nếu model chạy trên cùng máy host, `host.docker.internal` đã được cấu hình cho Docker trên Linux. Dịch vụ model phải lắng nghe trên địa chỉ Docker truy cập được, ví dụ `0.0.0.0:1234`; dịch vụ chỉ bind `127.0.0.1` của host sẽ không nhận kết nối qua Docker gateway. Nếu model ở máy khác, dùng IP hoặc tên miền của máy đó.

```bash
docker compose up --build -d
docker compose logs -f backend
```

### VPS NVIDIA (RTX 3060): nhận dạng bằng GPU

Cấu hình này chạy **Nemotron ASR trên CUDA**. Phần dịch vẫn dùng `TRANSLATION_BACKEND=openai` và gateway bạn cấu hình trong [môi trường backend](<.env>); không thêm các overlay dịch local vì đó là local TranslateGemma, không cần thiết cho lựa chọn này. RTX 3060 có nhiều biến thể VRAM, nên hãy kiểm tra thực tế bằng `nvidia-smi` trước khi triển khai.

Trên VPS cần cài NVIDIA driver tương thích với CUDA runtime của PyTorch, Docker Engine/Compose và [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html). Driver và toolkit cài trên **host**, không cài trong Dockerfile. [Dockerfile GPU](<backend/Dockerfile.gpu>) cài `torch==2.15.0` theo [dependency lock](<backend/requirements.lock>); wheel Linux trên PyPI hiện kéo CUDA **13.2**. Cần driver hỗ trợ runtime đó; nếu driver cũ, nâng driver trước khi chạy. Không cần cài CUDA Toolkit đầy đủ trên host. Bản CUDA 12.8 trong lệnh thử bên dưới chỉ kiểm tra GPU passthrough, **không chứng minh tương thích với CUDA 13.2 của ứng dụng**.

Sau khi cài NVIDIA Container Toolkit theo tài liệu cho hệ điều hành của VPS, cấu hình runtime rồi restart Docker (restart có thể ảnh hưởng container đang chạy):

```bash
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

Kiểm tra host và quyền truy cập GPU từ container:

```bash
nvidia-smi
# Kiểm tra container runtime trước khi build ứng dụng:
docker run --rm --gpus all nvidia/cuda:12.8.1-base-ubuntu24.04 nvidia-smi
```

Nếu lệnh thứ hai thất bại, sửa driver/toolkit trước. Sau đó:

```bash
# Không ghi đè .env nếu bạn đã cấu hình trước đó:
test -f .env || cp .env.example .env
# Trên VPS, đặt TRANSLATION_BASE_URL tới gateway thật có thể truy cập từ container.
# Nếu gateway chạy cùng host, nó phải listen trên địa chỉ Docker truy cập được.
editor .env

docker compose -f compose.yaml -f compose.gpu.yaml config
docker compose -f compose.yaml -f compose.gpu.yaml up -d --build
docker compose -f compose.yaml -f compose.gpu.yaml logs -f backend
```

Xác minh PyTorch nhìn thấy RTX 3060 và backend đã warm-up model:

```bash
docker compose -f compose.yaml -f compose.gpu.yaml exec backend \
  python -c "import torch; print(torch.__version__, torch.version.cuda); print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'GPU unavailable')"
docker compose -f compose.yaml -f compose.gpu.yaml exec backend \
  python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health/ready').read().decode())"
```

Nếu thiếu driver, GPU reservation hoặc VRAM, container sẽ báo lỗi thay vì âm thầm chuyển sang CPU. Lần đầu cần mạng để tải model Nemotron; volume `speech_models` giữ cache. Có thể theo dõi VRAM bằng `watch -n 1 nvidia-smi`. Không dùng `--gpus` trên lệnh `docker compose`; reservation trong [Compose GPU](<compose.gpu.yaml>) đã cấp đúng một GPU. Image này dành cho Nemotron/PyTorch; không đảm bảo runtime CUDA cho Whisper/CTranslate2 nếu tự đổi backend.

**Công khai ứng dụng:** giữ `APP_BIND=127.0.0.1`, đặt reverse proxy HTTPS trên host hoặc tunnel tới `http://127.0.0.1:8080`, chuyển tiếp WebSocket Upgrade và giữ Host công khai. Micro trên điện thoại cần HTTPS; khi chỉ dùng HTTPS, đặt `COOKIE_SECURE=true` rồi tạo lại container. Không công khai cổng backend hoặc gateway dịch. Đăng ký tài khoản admin bằng mật khẩu mạnh trước khi mở truy cập Internet, hoặc đặt `ADMIN_USERNAMES=` để vô hiệu hóa quyền admin. `host.docker.internal` trên VPS trỏ tới **VPS**, không phải máy phát triển.

Luôn dùng cả hai file Compose khi cập nhật hoặc tạo lại container GPU:

```bash
docker compose -f compose.yaml -f compose.gpu.yaml up -d --build --force-recreate
docker compose -f compose.yaml -f compose.gpu.yaml down
# down giữ volumes; không thêm -v nếu muốn giữ database và model cache.
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

- **Tài khoản:** đăng ký bằng tên đăng nhập 3–32 ký tự `a-z`, số, `_`, `-`, `.`, họ tên, email và mật khẩu 8–128 ký tự nhập hai lần. Tên đăng nhập và email không được trùng tài khoản khác. Đăng nhập vẫn dùng tên đăng nhập và mật khẩu; phiên có hiệu lực 7 ngày. Bấm biểu tượng **Cài đặt tài khoản** trên thanh đầu trang để sửa email. Email hiển thị với chính bạn và quản trị viên trong trang quản lý tài khoản; chưa được xác minh qua thư.
- **Tài khoản cũ:** migration tự dùng tên đăng nhập làm tên hiển thị, để email trống (**Chưa cập nhật**) và giữ nguyên mật khẩu, phiên đăng nhập, hội thoại. Có thể bổ sung email trong cài đặt sau khi đăng nhập.
- **Một máy chung:** hai người cùng xem một khung hội thoại chứa nguyên văn và bản dịch. Bấm **Bắt đầu nghe** và nói lần lượt; không có ô nhập A/B hay nút xoay màn hình.
- **Hai máy từ xa:** chủ phòng là A và cần đăng nhập; người được mời là B, mở link/QR rồi bấm **Vào phòng**, không cần đăng ký hoặc đăng nhập. Nếu B đã đăng nhập thì dùng tài khoản hiện tại; nếu chưa, hệ thống cấp phiên khách bằng cookie HttpOnly. Hai người có thể ở hai mạng Internet khác nhau, cùng mở URL HTTPS của ứng dụng. Liên kết/QR dùng một lần và hết hạn sau 24 giờ. Phòng tối đa hai thành viên; hai máy gửi giọng nói độc lập và cùng xem chữ/bản dịch. **Chưa có gọi thoại hoặc đọc bản dịch qua loa.** Hiển thị riêng trạng thái đối phương trực tuyến/ngoại tuyến/micro đang bật; micro đang bật không có nghĩa là đang nói.
- **Phiên khách:** có hiệu lực theo cấu hình phiên (mặc định 7 ngày); tải lại trang hoặc mở lại phòng từ lịch sử trên cùng trình duyệt vẫn dùng được. Khách chỉ xem và sử dụng các phòng mình đã được mời, không được tạo/xóa phòng, tạo lời mời hoặc sửa tài khoản. Đăng xuất, đăng nhập tài khoản khác, xóa cookie hoặc hết hạn phiên sẽ mất quyền truy cập bằng phiên khách; link đã dùng không khôi phục được phiên. Chưa hỗ trợ chuyển thiết bị hay thay khách trong phòng; chủ phòng cần tạo phòng/lời mời mới nếu khách mất phiên. Micro chỉ bật khi người dùng chủ động bấm và cấp quyền.
- **Ngôn ngữ:** Việt, Anh, Nhật, Hàn, Trung (bản dịch chữ giản thể), Pháp, Đức, Tây Ban Nha; mặc định Việt–Anh. Cặp ngôn ngữ và chế độ giữ cố định trong phòng.
- **Micro:** nghe liên tục sau khi bấm bắt đầu. Khi chuyển ứng dụng, rời trang hoặc mất kết nối, micro dừng; cần bấm bắt đầu lại. Ở chế độ một máy chung, Nemotron tự nhận diện ngôn ngữ; chỉ gán A/B nếu tag ngôn ngữ nằm trong cặp ngôn ngữ của phòng. Nếu thiếu tag (thường ở câu bị cắt giữa chừng) hoặc nhận ra ngôn ngữ khác, ứng dụng sẽ yêu cầu chọn người nói A/B trước khi dịch câu đó. Ở chế độ hai máy, mỗi micro dùng prompt ngôn ngữ của phía đó. Nếu chưa cấp quyền hoặc không tìm thấy micro, hãy cấp quyền/kết nối micro rồi bấm bắt đầu lại. Không có ô nhập tin nhắn trong cả hai chế độ.
- **Dễ đọc:** chữ giao diện chính từ 18px, chữ phụ từ 16px; nguyên văn và bản dịch cùng cỡ 24px trên máy tính, 22px trên điện thoại. Cỡ chữ dùng `rem` để theo thiết lập chữ của trình duyệt.
- **Người nói:** dùng chung máy sẽ gán A/B theo ngôn ngữ, không nhận diện danh tính giọng nói. Câu thiếu độ tin cậy sẽ chờ chọn A/B trước khi dịch. Hai người cần nói lần lượt, tránh nói chồng trong cùng một micro.
- **Lịch sử:** lưu chữ và bản dịch đến khi chủ phòng xóa toàn bộ hội thoại. Cả hai thành viên xem lại được. Âm thanh chỉ ở bộ nhớ trong quá trình xử lý, không ghi file hoặc lưu SQLite.
- **Hướng dẫn tại chỗ:** mở `/guide` (hoặc nút **Hướng dẫn sử dụng** trên thanh đầu trang), không cần đăng nhập. Trang này chỉ là mục lục: mỗi hướng dẫn nằm ở một trang riêng `/guide/<slug>` và có nút Trước/Sau để đi tiếp giữa 18 hướng dẫn. Toàn bộ nội dung hướng dẫn được dịch đủ ba ngôn ngữ giao diện (Tiếng Việt, English, 简体中文) và đổi ngay theo ô chọn ngôn ngữ. Nội dung bài nằm trong `frontend/src/guide/articles/*.js` (mỗi tệp một bài, gồm cả ba ngôn ngữ); thêm hoặc sửa hướng dẫn chỉ cần đổi tệp đó và danh sách trong `frontend/src/guide/index.js`.

## Quản trị tài khoản và đổi mật khẩu

- Mở `/admin` hoặc biểu tượng **Quản trị** trên thanh đầu trang khi đăng nhập bằng tài khoản admin. Trang hỗ trợ tìm theo tên/tên đăng nhập/email, lọc vai trò và trạng thái, phân trang, khóa/mở khóa, đặt lại mật khẩu và xóa tài khoản. Giao diện hỗ trợ Việt/Anh/Trung và điện thoại.
- Quyền admin được xác định bởi `ADMIN_USERNAMES`, danh sách tên đăng nhập cách nhau bằng dấu phẩy, không phân biệt hoa thường. Mặc định là `admin` theo lựa chọn triển khai. **Ai đăng ký tên `admin` trước sẽ có quyền quản trị**: phải đăng ký tài khoản này bằng mật khẩu mạnh trước khi công khai ứng dụng, hoặc cấu hình tên tài khoản tin cậy khác. Không có mật khẩu mặc định. Đặt `ADMIN_USERNAMES=` để tắt quyền admin; thay đổi cấu hình cần khởi động lại backend (Docker: `docker compose up -d --force-recreate backend`).
- Khóa tài khoản thu hồi phiên đăng nhập, đóng kết nối trực tiếp và chặn đăng nhập mới; mở khóa không khôi phục phiên cũ. Không cho admin khóa/xóa/đặt lại mật khẩu tài khoản admin (kể cả chính mình).
- Xóa là vĩnh viễn: xóa tài khoản, phiên, phòng do tài khoản sở hữu và tin nhắn liên quan theo quan hệ dữ liệu. Có hộp xác nhận trước khi xóa. Phòng do người khác sở hữu vẫn tồn tại.
- User và admin đều tự đổi mật khẩu tại **Cài đặt tài khoản → Đổi mật khẩu** hoặc `/change-password`. Phải nhập mật khẩu hiện tại, mật khẩu mới 8–128 ký tự và xác nhận; mật khẩu mới phải khác mật khẩu cũ. Giữ phiên hiện tại và thu hồi các phiên khác.
- Khi admin đặt lại mật khẩu người dùng, tất cả phiên cũ bị thu hồi. Lần đăng nhập sau giao diện yêu cầu đổi mật khẩu trước khi vào trang được bảo vệ. Cờ này là điều hướng giao diện, không phải hạn chế độc lập trên mọi API. Khách không có mật khẩu để đổi/đặt lại.
- Migration `0004` tự chạy khi backend khởi động, thêm trạng thái hoạt động và cờ yêu cầu đổi mật khẩu, không thay đổi mật khẩu/hội thoại sẵn có.

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

WebSocket tự kết nối lại với backoff tối đa 10 giây và lấy lại các câu đã tải theo ID, số thứ tự và phiên bản. Câu nhập gửi lại với cùng `client_message_id` chỉ được lưu một lần; không loại bỏ các câu khác ID chỉ vì có nội dung giống nhau. Câu đang dịch khi backend khởi động lại chuyển thành lỗi có thể thử lại. Mặc định server ping mỗi 10 giây, quá 30 giây không nhận pong sẽ đóng kết nối và giải phóng micro; gói âm thanh không thay thế cho pong. Frontend cũng phát hiện thiếu heartbeat sau 30 giây và yêu cầu bật lại micro sau reconnect.

Dừng micro được xác nhận ngay, không chờ ASR xong. Mỗi phía chỉ có tối đa hai phiên đã dừng còn đang xử lý; mở lại quá nhanh khi chúng chưa xong sẽ báo chờ. Sau 15 giây xử lý nốt, hệ thống yêu cầu hủy và báo phần lời nói có thể bị thiếu. Suy luận native đang chạy không thể bị ngắt an toàn ngay lập tức: giữ slot cho đến khi nó thực sự kết thúc, không mở thêm suy luận chồng lên. Gửi WebSocket xuống một máy bị treo cũng có timeout để không giữ khóa micro hoặc chặn cập nhật cho phía còn lại mãi.

## Checklist triển khai và nghiệm thu hai máy từ xa

1. Chạy **một backend worker/replica**. Hub, presence, khóa micro và hàng đợi ở bộ nhớ; không tăng worker để tăng tốc. Mở rộng nhiều process cần kho khóa/pub-sub dùng chung trước.
2. Đặt reverse proxy HTTPS/WSS trước frontend hoặc dùng tunnel. Giữ `/api` và `/ws` cùng origin; chuyển tiếp WebSocket Upgrade, giữ Host công khai. Timeout proxy tối thiểu 60 giây. Không cần TURN/STUN vì chưa truyền cuộc gọi giữa hai máy.
3. Trên HTTPS đặt `COOKIE_SECURE=true`, tạo lại backend và đăng nhập lại. Nếu cấu hình `ALLOWED_ORIGINS`, chỉ liệt kê origin HTTPS thực sự dùng (không wildcard). Không công khai cổng backend, database, model dịch hoặc API key.
4. Mở đúng URL HTTPS công khai trên máy A **trước khi tạo lời mời**. `localhost`, IP LAN hoặc link HTTP không phải địa chỉ dùng từ mọi nơi. Cảnh báo trên giao diện chỉ nhận biết các địa chỉ nội bộ phổ biến, không kiểm chứng DNS/firewall/chứng chỉ. Quick Tunnel thay URL sau khi chạy lại; production nên dùng domain/tunnel cố định.
5. Máy B mở link trên mạng khác và bấm **Vào phòng**, không cần đăng nhập/đăng ký. Sau khi đã tham gia, mở lại phòng từ danh sách lịch sử trên cùng trình duyệt còn phiên thay vì dùng lại token một lần.
6. Mỗi người nói đúng ngôn ngữ được ghi trên máy mình; A/B có thể bật micro cùng lúc. Mở thêm tab cùng tài khoản không được giành micro từ tab đang thu. Không dùng cách lọc câu giống nhau để loại trùng: người dùng có thể cố ý lặp lại câu.
7. Mất mạng, mạng gửi quá chậm, chuyển ứng dụng hoặc khóa màn hình sẽ dừng micro; **không tự ghi âm lại**. Khi trở lại hãy bấm bắt đầu và nói lại phần chưa gửi. Âm thanh chưa được server nhận không được lưu/phát lại; bản chốt đã nhận vẫn có thể hoàn tất sau khi micro tắt.
8. Thử trên hai điện thoại thật (Wi-Fi và 4G/5G): cả hai chiều dịch, cùng bật micro, tắt một bên không tắt bên kia, mất mạng và reconnect, chuyển nền, từ chối/cấp lại quyền micro, hết hạn lời mời, lỗi dịch và thử lại. Đối chiếu ID/số câu trong lịch sử, không chỉ nhìn phụ đề tạm.
9. Ghi nhận thời gian từ lúc nói xong đến nguyên văn và bản dịch, kiểm tra chữ đúng ngôn ngữ; đo khi cả hai micro hoạt động. Test tự động dùng ASR/dịch giả lập không chứng minh độ chính xác model thật hoặc độ trễ Internet. Không cam kết dưới một giây.

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

E2E tự chạy backend kiểm thử riêng và Vite trên cổng 8009/5179. API dịch và nhận dạng được thay bằng adapter kiểm thử trong `backend/tests/e2e_server.py`, không nằm trong Docker image production. Test dùng SQLite tạm và không gọi model thật. Bao gồm chủ phòng và khách không tài khoản, hai thành viên đã đăng nhập, lời mời một lần, phục hồi khi tải phiên lỗi, hội thoại hai chiều, giao diện chỉ dùng giọng nói, micro bị từ chối, kết nối lại, lịch sử và xóa phòng.

Kiểm tra nhận giọng nói bằng model thật với file ghi âm của bạn:

```bash
cd backend
../.venv/bin/python -m scripts.check_speech /duong-dan/ghi-am.wav --language auto --repeat 3
```

Lệnh tải/dùng model local, nhận dạng 6 giây đầu và in nội dung, độ tin cậy, thời gian suy luận của từng lần và trung vị. Có thể dùng `--seconds 4` để đo đoạn ngắn hơn; `--language vi` để đo khi biết trước ngôn ngữ, như chế độ hai máy. Đo lúc máy ít tải để so sánh các model. Kiểm thử chất lượng dịch và độ trễ toàn tuyến cần API model thật; kiểm tra quyền micro, chữ lớn và chuyển nền cuối cùng cần điện thoại Android/iPhone thật qua HTTPS.

## API chính

- `POST /api/auth/register`: `username`, `name`, `email`, `password`, `password_confirmation`; `POST /api/auth/login`: `username`, `password`; `POST /api/auth/logout`.
- `POST /api/auth/password`: `current_password`, `new_password`, `new_password_confirmation`; trả hồ sơ mới, thu hồi phiên khác.
- `GET /api/admin/accounts`: bộ lọc `query`, `role=all|admin|user|guest`, `status=all|active|locked`, `page`, `page_size` (1–100); trả `{items,total,page,page_size}`. Chỉ admin.
- `PATCH /api/admin/accounts/{id}` với `{is_active}`; `POST /api/admin/accounts/{id}/password` với `{new_password,new_password_confirmation}`; `DELETE /api/admin/accounts/{id}`. Không áp dụng thao tác lên admin.
- `GET /api/auth/me`: `id`, `username`, `name`, `email`, `is_guest`, `is_admin`, `must_change_password`; `PATCH /api/auth/me` với `email` để cập nhật email tài khoản đang đăng nhập (không áp dụng cho khách).
- `GET/POST /api/rooms`; `GET/DELETE /api/rooms/{id}`. Khách chỉ được đọc các phòng đã tham gia, không được tạo/xóa phòng.
- `POST /api/rooms/{id}/invite` chỉ dành cho chủ phòng; `POST /api/rooms/join` với `{ "token": "..." }` không bắt buộc đăng nhập, trả dữ liệu phòng như trước và cấp cookie phiên khách nếu chưa có phiên hợp lệ. Lời mời lỗi không tạo định danh/phiên khách.
- `GET /api/rooms/{id}/messages?before=...&limit=50` trả lịch sử phân trang.
- `POST /api/rooms/{id}/messages` với `{ "client_message_id": "uuid", "speaker": "A", "text": "Xin chào" }`. Ở phòng hai máy, backend xác định vai từ tài khoản và từ chối giả mạo vai người khác.
- `POST /api/rooms/{id}/messages/{message_id}/retry`; `/speaker` với `{ "speaker": "B" }` cho câu chờ xác định người nói.
- `GET /api/config` trả danh sách ngôn ngữ và trạng thái dịch/nhận dạng; không trả API key hay URL model.
- `WS /ws/rooms/{id}?from_sequence=...`: xác thực bằng cookie; gửi JSON `audio.start`, `audio.stop`, `pong`, `text.submit`; âm thanh là gói nhị phân PCM little-endian. Nhận `room.snapshot`, `room.members`, `room.presence`, `message.upsert`, `message.ack`, `transcript.partial`, `audio.state`, `ping`, `error`, `room.deleted`.
- `room.snapshot.presence` và `room.presence.members` chứa mảng `{side, online, recording}` cho A/B. Đây là trạng thái tạm trong bộ nhớ, không phải số thành viên đã đăng ký vào phòng. Socket thực hiện thao tác nhận `audio.state`; các socket còn lại nhận cập nhật presence.
- Client mới gửi `capture_id` (chuỗi 1–128 ký tự) với `audio.start` / `audio.stop`. Server echo mã trong `audio.state` và lỗi phiên thu; lệnh dừng sai mã bị bỏ qua, lệnh mở khác mã khi đang thu trả `capture_busy`. Client cũ vẫn được dùng toàn bộ phiên không có mã. PCM không chứa mã và chỉ thuộc phiên đang hoạt động của chính socket đó. Khi `audio.stop` đã được xác nhận, không gửi thêm PCM của phiên cũ.

Mật khẩu được băm Argon2id; cookie HttpOnly, SameSite=Lax; session và token mời chỉ lưu SHA-256 trong SQLite. Backend kiểm tra origin và tư cách thành viên trên HTTP/WebSocket. Liên kết mời dùng fragment để mã mời không xuất hiện trong URL request/access log. API key dịch chỉ được dùng từ backend.
