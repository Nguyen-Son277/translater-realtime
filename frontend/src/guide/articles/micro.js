// Bài hướng dẫn: Micro và cách nói — nội dung đầy đủ 3 ngôn ngữ (vi, en, zh-CN).
export default {
  slug: 'micro',
  titles: {
    vi: {
      title: 'Micro và cách nói',
      summary: 'Bật micro, phụ đề tạm, khi micro tự dừng và cách cấp quyền.',
    },
    en: {
      title: 'Microphone and how to speak',
      summary: 'Turning the microphone on, live subtitles, when it stops on its own, and how to grant permission.',
    },
    'zh-CN': {
      title: '麦克风与说话方式',
      summary: '开启麦克风、实时预览字幕、麦克风自动停止的情况，以及如何授予权限。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: '**Bật và tắt micro**' },
      { type: 'list', items: [
        'Nút lớn ở đáy màn hình đổi trạng thái: **Bắt đầu nghe** → *Đang mở micro…* → **Dừng micro**.',
        'Sau khi bật, micro **nghe liên tục**. Bạn không cần bấm gì cho từng câu.',
        'Khi bấm dừng, nút chuyển thành *Đang chốt đoạn nói…* — ứng dụng đang xử lý nốt phần lời cuối cùng.',
        'Không có nút bấm nào cho từng câu: ứng dụng **tự chốt câu** sau khoảng 400 ms im lặng, hoặc tối đa sau 4 giây nói liên tục.',
      ] },
      { type: 'p', text: '**Phụ đề tạm và câu chính thức**' },
      { type: 'list', items: [
        'Trong lúc bạn nói, khung hội thoại có thể hiện dòng **“Đang nghe…”** kèm chữ tạm.',
        'Phụ đề tạm chỉ để bạn theo dõi; **không lưu vào lịch sử** và có thể bị bỏ qua khi máy đang bận.',
        'Khi câu được chốt, ứng dụng tạo một mục hội thoại chính thức (có giờ, có bản dịch) và lưu vào lịch sử.',
      ] },
      { type: 'p', text: '**Khi micro tự dừng**' },
      { type: 'p', text: 'Micro dừng và bạn cần bấm **Bắt đầu nghe** lại khi:' },
      { type: 'list', items: [
        'Bạn **chuyển sang ứng dụng khác**, khóa màn hình hoặc rời trang — ứng dụng tạm dừng micro và báo rõ.',
        '**Mất kết nối** hoặc mạng gửi quá chậm — phần âm thanh chưa gửi đi **không được ghi lại, không được phát lại**. Hãy nói lại phần bị thiếu sau khi kết nối.',
        'Bạn **rút/khóa micro** hoặc trình duyệt ngắt quyền micro.',
      ] },
      { type: 'note', tone: 'warning', text: 'Trên điện thoại, micro chỉ hoạt động khi trang được mở bằng **HTTPS** (hoặc `localhost` trên máy tính). Nếu dùng địa chỉ `http://` qua mạng, nút micro sẽ không thu được.' },
      { type: 'p', text: '**Cấp quyền micro**' },
      { type: 'list', items: [
        'Lần đầu bấm, trình duyệt hỏi quyền truy cập micro — hãy chọn **Cho phép**.',
        'Nếu đã từ chối: mở cài đặt quyền của trình duyệt cho trang này, cấp lại quyền micro rồi bấm **Bắt đầu nghe**.',
        'Micro chỉ bật khi bạn chủ động bấm; ứng dụng không tự ghi âm lại sau sự cố.',
      ] },
    ],
    en: [
      { type: 'p', text: '**Turning the microphone on and off**' },
      { type: 'list', items: [
        'The large button at the bottom of the screen changes state: **Start listening** → *Starting microphone…* → **Stop microphone**.',
        'Once it is on, the microphone **listens continuously**. You do not need to tap anything for each sentence.',
        'When you tap stop, the button changes to *Finalizing speech…* — the app is finishing the last part of what you said.',
        'There is no button for each sentence: the app **finalizes a sentence on its own** after about 400 ms of silence, or after at most 4 seconds of continuous speech.',
      ] },
      { type: 'p', text: '**Live subtitles and final sentences**' },
      { type: 'list', items: [
        'While you speak, the conversation pane may show a **“Listening…”** line with temporary text.',
        'Live subtitles are only there for you to follow along; they are **not saved to the history** and may be skipped when the device is busy.',
        'When a sentence is finalized, the app creates an official conversation entry (with a time and a translation) and saves it to the history.',
      ] },
      { type: 'p', text: '**When the microphone stops on its own**' },
      { type: 'p', text: 'The microphone stops and you need to tap **Start listening** again when:' },
      { type: 'list', items: [
        'You **switch to another app**, lock the screen, or leave the page — the app pauses the microphone and tells you clearly.',
        'The **connection drops** or the network is too slow — audio that has not been sent **is not recorded and is not replayed**. Say the missing part again once you are reconnected.',
        'You **unplug or mute the microphone**, or the browser cuts the microphone permission.',
      ] },
      { type: 'note', tone: 'warning', text: 'On phones, the microphone only works when the page is opened over **HTTPS** (or `localhost` on a computer). If you use an `http://` address over the network, the microphone button will not capture anything.' },
      { type: 'p', text: '**Granting microphone permission**' },
      { type: 'list', items: [
        'The first time you tap, the browser asks for microphone access — choose **Allow**.',
        'If you already denied it: open the browser’s permission settings for this page, grant microphone access again, then tap **Start listening**.',
        'The microphone only turns on when you tap it yourself; the app does not restart recording by itself after an incident.',
      ] },
    ],
    'zh-CN': [
      { type: 'p', text: '**开启和关闭麦克风**' },
      { type: 'list', items: [
        '屏幕底部的大按钮会切换状态：**开始聆听** → *正在开启麦克风…* → **停止麦克风**。',
        '开启后，麦克风会**持续聆听**，您不需要为每一句按任何按钮。',
        '点击停止后，按钮会变成 *正在处理语音…*——应用正在处理您最后一段话。',
        '没有针对单句的按钮：应用会在约 400 毫秒静音后**自动结束一句**，或连续说话最多 4 秒后结束。',
      ] },
      { type: 'p', text: '**实时预览字幕与正式句子**' },
      { type: 'list', items: [
        '您说话时，对话区域可能会显示一行 **“正在聆听…”** 以及临时文字。',
        '实时预览字幕只供您跟随查看；**不会保存到历史记录**，设备繁忙时可能会被跳过。',
        '一句话结束后，应用会生成一条正式对话记录（带时间与译文）并保存到历史记录。',
      ] },
      { type: 'p', text: '**麦克风自动停止的情况**' },
      { type: 'p', text: '在以下情况下麦克风会停止，您需要再次点击**开始聆听**：' },
      { type: 'list', items: [
        '您**切换到其他应用**、锁定屏幕或离开页面——应用会暂停麦克风并明确提示。',
        '**连接中断**或网络上传过慢——尚未发送的音频**不会被录制，也不会重放**。请在恢复连接后重说缺失的部分。',
        '您**拔出或静音麦克风**，或浏览器中断了麦克风权限。',
      ] },
      { type: 'note', tone: 'warning', text: '在手机上，只有通过 **HTTPS** 打开页面时麦克风才能工作（在电脑上也可用 `localhost`）。如果通过网络使用 `http://` 地址，麦克风按钮将无法采集声音。' },
      { type: 'p', text: '**授予麦克风权限**' },
      { type: 'list', items: [
        '第一次点击时，浏览器会询问麦克风访问权限——请选择**允许**。',
        '如果您之前已拒绝：打开浏览器针对本站的权限设置，重新授予麦克风权限，然后点击**开始聆听**。',
        '麦克风只在您主动点击时开启；应用不会在异常后自行重新录音。',
      ] },
    ],
  },
};
