// Bài "Phiên khách": người được mời vào không cần tài khoản — được gì, mất khi nào.
export default {
  slug: 'khach',
  titles: {
    vi: {
      title: 'Phiên khách',
      summary: 'Người được mời vào không cần tài khoản: được gì, mất khi nào.',
    },
    en: {
      title: 'Guest session',
      summary: 'Invited people need no account: what they get and when they lose it.',
    },
    'zh-CN': {
      title: '访客会话',
      summary: '受邀进入的人无需账户：可以获得什么，何时会失去。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: 'Khi người được mời mở liên kết mà **chưa đăng nhập**, ứng dụng cấp một **phiên khách** gắn với trình duyệt đó. Người đó vẫn xem và sử dụng được phòng mình đã được mời.' },
      { type: 'table', head: ['Khách được phép', 'Khách không được phép'], rows: [
        ['Mở và xem các phòng đã được mời', 'Tạo cuộc trò chuyện mới'],
        ['Bật micro, xem nguyên văn và bản dịch', 'Tạo lời mời cho người khác'],
        ['Xem lại lịch sử các phòng đó', 'Xóa cuộc trò chuyện'],
        ['Đăng nhập vào tài khoản thật', 'Sửa cài đặt tài khoản / đổi email'],
      ] },
      { type: 'list', items: [
        'Phiên khách có hiệu lực theo cấu hình phiên, mặc định **7 ngày**; tải lại trang hoặc mở lại phòng từ lịch sử trên cùng trình duyệt vẫn dùng được.',
        'Bạn **mất quyền truy cập** bằng phiên khách nếu: đăng xuất, đăng nhập tài khoản khác, xóa cookie trình duyệt hoặc phiên hết hạn.',
        'Liên kết mời đã dùng **không khôi phục được phiên**. Nếu mất phiên, hãy xin chủ phòng tạo phòng/lời mời mới.',
        'Hiện **chưa hỗ trợ chuyển thiết bị** hay thay khách trong phòng.',
        'Khách bấm **Đăng nhập** ở thanh đầu trang để chuyển sang tài khoản thật; sau khi đăng nhập vẫn quay lại đúng trang đang mở.',
      ] },
    ],
    en: [
      { type: 'p', text: 'When an invited person opens the link while **not signed in**, the app gives them a **guest session** tied to that browser. They can still view and use the room they were invited to.' },
      { type: 'table', head: ['Guests can', 'Guests cannot'], rows: [
        ['Open and view the rooms they were invited to', 'Create a new conversation'],
        ['Turn on the microphone and read the original text and the translation', 'Create an invitation for someone else'],
        ['Review the history of those rooms', 'Delete a conversation'],
        ['Sign in to a real account', 'Change account settings / change email'],
      ] },
      { type: 'list', items: [
        'A guest session lasts according to the session configuration, **7 days** by default; reloading the page or reopening the room from the history in the same browser still works.',
        'You **lose access** through a guest session if you: sign out, sign in with another account, clear your browser cookies, or the session expires.',
        'An invitation link that has already been used **cannot restore a session**. If you lose the session, ask the room host to create a new room/invitation.',
        '**Moving to another device** or swapping the guest in a room is **not supported** yet.',
        'A guest clicks **Sign in** in the top bar to switch to a real account; after signing in, they are returned to the same page they had open.',
      ] },
    ],
    'zh-CN': [
      { type: 'p', text: '当受邀者在**未登录**的情况下打开链接时，应用会为其分配一个与该浏览器绑定的**访客会话**。该访客仍然可以查看并使用受邀进入的房间。' },
      { type: 'table', head: ['访客可以', '访客不可以'], rows: [
        ['打开并查看受邀进入的房间', '创建新的对话'],
        ['开启麦克风，查看原文和译文', '为其他人创建邀请'],
        ['回看这些房间的历史记录', '删除对话'],
        ['登录真实账户', '修改账户设置 / 更改邮箱'],
      ] },
      { type: 'list', items: [
        '访客会话的有效期取决于会话配置，默认为**7 天**；在同一浏览器中刷新页面或从历史记录重新打开房间仍然可用。',
        '如果您退出登录、登录其他账户、清除浏览器 Cookie 或会话过期，就会**失去访客会话的访问权限**。',
        '已使用过的邀请链接**无法恢复会话**。如果会话丢失，请让房主创建新的房间/邀请。',
        '目前**不支持更换设备**，也不支持在房间中替换访客。',
        '访客点击顶部栏的**登录**即可切换到真实账户；登录后会回到原来正在查看的页面。',
      ] },
    ],
  },
};
