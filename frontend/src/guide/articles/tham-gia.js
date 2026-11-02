export default {
  slug: 'tham-gia',
  titles: {
    vi: {
      title: 'Tham gia bằng lời mời',
      summary: 'Mở liên kết mời một lần hoặc dán mã để vào phòng hai máy, không cần tài khoản.',
    },
    en: {
      title: 'Join with an invitation',
      summary: 'Open a single-use invitation link or paste the code to enter a two-device room without an account.',
    },
    'zh-CN': {
      title: '通过邀请加入',
      summary: '打开一次性邀请链接或粘贴邀请码，无需账户即可进入两台设备房间。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: 'Có hai cách vào một phòng hai máy đã được mời:' },
      { type: 'steps', items: [
        '**Mở liên kết mời** mà chủ phòng gửi (dạng `/join#token=…`), hoặc quét QR — ứng dụng mở sẵn trang tham gia với mã đã điền.',
        '**Bấm “Vào phòng”.** Không cần đăng ký, không cần đăng nhập. Nếu đang đăng nhập sẵn, bạn tham gia bằng chính tài khoản đó.',
      ] },
      { type: 'p', text: 'Nếu chưa có liên kết, bấm **Tham gia phòng** ở trang chủ rồi dán liên kết hoặc mã mời vào ô *Liên kết hoặc mã mời*, bấm *Tiếp tục*.' },
      { type: 'p', text: '**Những điều cần biết về lời mời**' },
      { type: 'list', items: [
        'Liên kết mời **chỉ dùng được một lần** và **hết hạn sau 24 giờ**.',
        'Phòng hai máy chỉ có **tối đa hai thành viên**; người thứ ba sẽ nhận thông báo *Phòng đã có đủ hai người.*',
        'Nếu làm mới phiên bị lỗi sau khi đã vào, nút chuyển thành **Thử mở lại phòng** — bấm nút này sẽ mở lại phòng mà không dùng lời mời lần thứ hai.',
        'Sau khi đã vào phòng, lần sau hãy mở lại phòng từ **danh sách lịch sử** trên cùng trình duyệt thay vì dùng lại liên kết cũ.',
      ] },
      { type: 'p', text: '**Lỗi thường gặp khi tham gia**' },
      { type: 'table', head: ['Thông báo', 'Nguyên nhân và cách xử lý'], rows: [
        ['Lời mời không hợp lệ hoặc đã hết hạn. Hãy xin liên kết mới.', 'Liên kết đã dùng, đã quá 24 giờ hoặc bị thu hồi. Xin chủ phòng tạo lời mời mới.'],
        ['Phòng đã có đủ hai người.', 'Phòng đã đủ A và B. Không thể tham gia thêm.'],
        ['Không tìm thấy cuộc hội thoại.', 'Phòng đã bị chủ phòng xóa.'],
      ] },
    ],
    en: [
      { type: 'p', text: 'There are two ways to enter a two-device room you have been invited to:' },
      { type: 'steps', items: [
        '**Open the invitation link** that the room owner sent (in the form `/join#token=…`), or scan the QR code — the app opens the join page with the code already filled in.',
        '**Press “Join room”.** No sign-up is needed and no sign-in is needed. If you are already signed in, you join with that account.',
      ] },
      { type: 'p', text: 'If you do not have a link yet, press **Join room** on the home page, paste the link or invitation code into the *Link or invitation code* box, then press *Continue*.' },
      { type: 'p', text: '**Things to know about invitations**' },
      { type: 'list', items: [
        'An invitation link **works only once** and **expires after 24 hours**.',
        'A two-device room has **at most two members**; a third person receives the message *Room already has two participants.*',
        'If refreshing the session fails after you have already joined, the button changes to **Try opening the room again** — pressing it reopens the room without using the invitation a second time.',
        'Once you have joined, open the room again next time from the **history list** in the same browser instead of reusing the old link.',
      ] },
      { type: 'p', text: '**Common joining errors**' },
      { type: 'table', head: ['Message', 'Cause and how to fix it'], rows: [
        ['Invalid or expired invitation. Please request a new link.', 'The link was already used, is older than 24 hours, or was revoked. Ask the room owner to create a new invitation.'],
        ['Room already has two participants.', 'The room already has both A and B. No one else can join.'],
        ['Conversation not found.', 'The room was deleted by the room owner.'],
      ] },
    ],
    'zh-CN': [
      { type: 'p', text: '进入已受邀的两台设备房间有两种方式：' },
      { type: 'steps', items: [
        '**打开邀请链接**（房主发送的 `/join#token=…` 形式），或扫描二维码——应用会直接打开加入页面并自动填入邀请码。',
        '**点击“进入房间”。** 无需注册，无需登录。如果您已登录，则以该账户身份加入。',
      ] },
      { type: 'p', text: '如果还没有链接，请在首页点击**加入房间**，将链接或邀请码粘贴到*链接或邀请码*输入框，然后点击*继续*。' },
      { type: 'p', text: '**关于邀请需要了解的事**' },
      { type: 'list', items: [
        '邀请链接**只能使用一次**，并在**24 小时后失效**。',
        '两台设备房间**最多两名成员**；第三个人会收到提示*房间已有两人加入。*',
        '如果进入后刷新会话失败，按钮会变为**重试打开房间**——点击它会重新打开房间，而不会再次使用邀请。',
        '进入房间后，下次请在同一浏览器的**历史列表**中重新打开房间，而不要重复使用旧链接。',
      ] },
      { type: 'p', text: '**加入时常见错误**' },
      { type: 'table', head: ['提示', '原因与处理方法'], rows: [
        ['邀请无效或已过期，请索取新链接。', '链接已被使用、已超过 24 小时或被撤销。请房主创建新的邀请。'],
        ['房间已有两人加入。', '房间已满 A 和 B，无法再加入。'],
        ['未找到该对话。', '房间已被房主删除。'],
      ] },
    ],
  },
};
