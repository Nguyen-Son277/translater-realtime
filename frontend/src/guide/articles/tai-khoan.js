// Bài "Tài khoản": nội dung đầy đủ 3 ngôn ngữ (vi, en, zh-CN), cùng cấu trúc block.
export default {
  slug: 'tai-khoan',
  titles: {
    vi: {
      title: 'Tài khoản',
      summary: 'Đăng ký, đăng nhập, phiên 7 ngày, cài đặt email và những gì chưa có.',
    },
    en: {
      title: 'Account',
      summary: 'Signing up, signing in, the 7-day session, email settings and what is not available yet.',
    },
    'zh-CN': {
      title: '账户',
      summary: '注册、登录、7 天会话、电子邮箱设置，以及暂未提供的功能。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: 'Bấm tab **Tạo tài khoản** ở trang đăng nhập và điền bốn thông tin:' },
      { type: 'table', head: ['Trường', 'Quy tắc'], rows: [
        ['Tên đăng nhập', '3–32 ký tự, chỉ gồm chữ cái, chữ số, dấu chấm, gạch dưới hoặc gạch ngang. Chữ hoa được chuyển thành chữ thường. Không được trùng tài khoản khác.'],
        ['Họ và tên', '1–100 ký tự. Đây là tên hiển thị với người cùng phòng.'],
        ['Email', 'Email hợp lệ, tối đa 254 ký tự, không được trùng tài khoản khác. Email chỉ bạn nhìn thấy và chưa được xác minh qua thư.'],
        ['Mật khẩu', '8–128 ký tự, nhập hai lần và phải khớp nhau. Dùng biểu tượng con mắt để hiện/ẩn nội dung đã nhập.'],
      ] },
      { type: 'p', text: 'Sau khi tạo thành công, bạn được đưa thẳng vào trang chủ và có thể tạo cuộc trò chuyện.' },
      { type: 'p', text: '**Đăng nhập, phiên làm việc và đăng xuất**' },
      { type: 'list', items: [
        'Đăng nhập bằng **tên đăng nhập + mật khẩu** (không phải email).',
        'Phiên đăng nhập có hiệu lực **7 ngày**; trong thời gian đó mở lại trang không phải đăng nhập lại.',
        'Nút **Đăng xuất** ở thanh đầu trang kết thúc phiên ngay trên trình duyệt này.',
        'Bấm sai quá nhiều lần trong một phút sẽ bị tạm chặn; hãy đợi một phút rồi thử lại.',
      ] },
      { type: 'p', text: '**Cài đặt tài khoản**' },
      { type: 'p', text: 'Bấm biểu tượng **Cài đặt tài khoản** (bánh răng) trên thanh đầu trang để:' },
      { type: 'list', items: [
        'Xem **tên hiển thị** và **tên đăng nhập** — hai thông tin này không sửa được trong ứng dụng.',
        'Cập nhật **email**, rồi bấm **Lưu thay đổi**. Nếu email đã thuộc tài khoản khác, ứng dụng báo *Email đã được sử dụng.*',
      ] },
      { type: 'note', tone: 'warning', text: '**Chưa có chức năng quên mật khẩu hay đổi mật khẩu.** Hãy lưu mật khẩu cẩn thận ngay khi đăng ký.' },
    ],
    en: [
      { type: 'p', text: 'Tap the **Create account** tab on the sign-in page and fill in four fields:' },
      { type: 'table', head: ['Field', 'Rules'], rows: [
        ['Username', '3–32 characters, using only letters, digits, dots, underscores or hyphens. Uppercase letters are converted to lowercase. It must not duplicate another account.'],
        ['Full name', '1–100 characters. This is the name shown to the people in your room.'],
        ['Email', 'A valid email, up to 254 characters, not already used by another account. Only you can see your email, and it has not been verified by mail.'],
        ['Password', '8–128 characters, entered twice and both entries must match. Use the eye icon to show or hide what you have typed.'],
      ] },
      { type: 'p', text: 'Once it is created, you go straight to the home page and can create a conversation.' },
      { type: 'p', text: '**Signing in, your session and signing out**' },
      { type: 'list', items: [
        'Sign in with your **username + password** (not your email).',
        'A signed-in session lasts **7 days**; during that time you can reopen the page without signing in again.',
        'The **Sign out** button in the top bar ends the session in this browser right away.',
        'Too many failed attempts within one minute will be temporarily blocked; wait a minute and try again.',
      ] },
      { type: 'p', text: '**Account settings**' },
      { type: 'p', text: 'Tap the **Account settings** icon (the gear) in the top bar to:' },
      { type: 'list', items: [
        'See your **display name** and **username** — these two cannot be changed inside the app.',
        'Update your **email**, then tap **Save changes**. If the email already belongs to another account, the app shows *Email is already in use.*',
      ] },
      { type: 'note', tone: 'warning', text: '**There is no forgot-password or change-password feature yet.** Keep your password safe when you sign up.' },
    ],
    'zh-CN': [
      { type: 'p', text: '在登录页点击 **创建账户** 标签，填写四项信息：' },
      { type: 'table', head: ['字段', '规则'], rows: [
        ['用户名', '3–32 个字符，只能包含字母、数字、句点、下划线或连字符。大写字母会转换为小写。不能与其他账户重复。'],
        ['姓名', '1–100 个字符。这是向房间内其他人显示的名称。'],
        ['电子邮箱', '有效的电子邮箱，最多 254 个字符，不能已被其他账户使用。电子邮箱仅您本人可见，且尚未通过邮件验证。'],
        ['密码', '8–128 个字符，需输入两次且必须一致。使用眼睛图标可显示或隐藏已输入的内容。'],
      ] },
      { type: 'p', text: '创建成功后，您会直接进入首页，并可以创建对话。' },
      { type: 'p', text: '**登录、会话与退出登录**' },
      { type: 'list', items: [
        '使用 **用户名 + 密码** 登录（不是电子邮箱）。',
        '登录会话有效期为 **7 天**；在此期间重新打开页面无需再次登录。',
        '顶栏的 **退出登录** 按钮会立即结束此浏览器上的会话。',
        '一分钟内错误次数过多会被暂时限制登录；请等待一分钟后再重试。',
      ] },
      { type: 'p', text: '**账户设置**' },
      { type: 'p', text: '点击顶栏的 **账户设置** 图标（齿轮）即可：' },
      { type: 'list', items: [
        '查看 **显示名称** 和 **用户名** —— 这两项信息无法在应用内修改。',
        '更新 **电子邮箱**，然后点击 **保存更改**。如果该电子邮箱已属于其他账户，应用会提示 *电子邮箱已被使用。*',
      ] },
      { type: 'note', tone: 'warning', text: '**目前没有忘记密码或修改密码功能。** 注册时请妥善保存密码。' },
    ],
  },
};
