// Bài "Bắt đầu nhanh": nội dung đầy đủ 3 ngôn ngữ (vi, en, zh-CN), cùng cấu trúc block.
export default {
  slug: 'bat-dau-nhanh',
  titles: {
    vi: {
      title: 'Bắt đầu nhanh',
      summary: 'Ba bước để có cuộc trò chuyện đầu tiên: tạo tài khoản, tạo phòng, bấm bắt đầu nghe.',
    },
    en: {
      title: 'Quick start',
      summary: 'Three steps to your first conversation: create an account, create a room, and start listening.',
    },
    'zh-CN': {
      title: '快速开始',
      summary: '三步完成第一次对话：创建账户、创建房间、点击开始聆听。',
    },
  },
  blocks: {
    vi: [
      { type: 'steps', items: [
        '**Mở ứng dụng và tạo tài khoản.** Bấm tab *Tạo tài khoản* ở trang đăng nhập, điền tên đăng nhập, họ tên, email, mật khẩu rồi bấm *Tạo tài khoản*. Bạn vào trang chủ ngay sau đó.',
        '**Tạo một cuộc trò chuyện.** Trên trang chủ, bấm *Tạo cuộc trò chuyện*, chọn *Một máy chung* hoặc *Hai máy riêng*, chọn hai ngôn ngữ rồi bấm *Bắt đầu trò chuyện*.',
        '**Bấm “Bắt đầu nghe” và nói tự nhiên.** Micro được yêu cầu quyền truy cập lần đầu. Sau khi bật, hãy nói bình thường: ứng dụng nghe liên tục, tự chốt câu khi bạn ngừng nói và lần lượt hiện nguyên văn rồi bản dịch.',
      ] },
      { type: 'note', tone: 'info', text: 'Nếu dùng *Hai máy riêng*: sau khi tạo phòng, bấm **Mời bạn**, gửi liên kết hoặc QR cho người kia. Người đó bấm **Vào phòng** là xong — không cần đăng ký, không cần đăng nhập.' },
      { type: 'note', tone: 'warning', text: 'Trên điện thoại, micro chỉ hoạt động khi trang được mở bằng **HTTPS**. Nếu đang dùng `http://` qua mạng, hãy mở lại bằng URL HTTPS trước khi bấm bắt đầu.' },
    ],
    en: [
      { type: 'steps', items: [
        '**Open the app and create an account.** Tap the *Create account* tab on the sign-in page, fill in your username, full name, email and password, then tap *Create account*. You land on the home page right after.',
        '**Create a conversation.** On the home page, tap *Create conversation*, choose *One shared device* or *Two separate devices*, pick the two languages, then tap *Start conversation*.',
        '**Tap “Start listening” and speak naturally.** The app asks for microphone access the first time. Once it is on, just speak normally: the app listens continuously, ends each sentence on its own when you stop talking, and shows the original text and then the translation in turn.',
      ] },
      { type: 'note', tone: 'info', text: 'If you use *Two separate devices*: after creating the room, tap **Invite** and send the link or QR code to the other person. They tap **Join room** and that’s it — no sign-up, no sign-in.' },
      { type: 'note', tone: 'warning', text: 'On a phone, the microphone only works when the page is opened over **HTTPS**. If you are using `http://` over the network, reopen the page with the HTTPS URL before you start.' },
    ],
    'zh-CN': [
      { type: 'steps', items: [
        '**打开应用并创建账户。** 在登录页点击 *创建账户* 标签，填写用户名、姓名、电子邮箱和密码，然后点击 *创建账户*。随后会直接进入首页。',
        '**创建一个对话。** 在首页点击 *创建对话*，选择 *共用一台设备* 或 *两台独立设备*，选择两种语言，然后点击 *开始对话*。',
        '**点击“开始聆听”并自然说话。** 首次使用时会请求麦克风权限。开启后正常说话即可：应用会持续聆听，在您停顿后自动结束一句，并依次显示原文和译文。',
      ] },
      { type: 'note', tone: 'info', text: '如果使用 *两台独立设备*：创建房间后点击 **邀请**，把链接或二维码发给对方。对方点击 **进入房间** 即可——无需注册，无需登录。' },
      { type: 'note', tone: 'warning', text: '在手机上，只有通过 **HTTPS** 打开页面时麦克风才能工作。如果正在通过网络使用 `http://`，请先用 HTTPS 地址重新打开页面，然后再开始。' },
    ],
  },
};
