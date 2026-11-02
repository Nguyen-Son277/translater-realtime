// Bài "Trang chủ": nội dung đầy đủ 3 ngôn ngữ (vi, en, zh-CN), cùng cấu trúc block.
export default {
  slug: 'trang-chu',
  titles: {
    vi: {
      title: 'Trang chủ',
      summary: 'Tạo phòng, tham gia phòng, tìm kiếm và quản lý danh sách cuộc trò chuyện.',
    },
    en: {
      title: 'Home page',
      summary: 'Create a room, join a room, search and manage your list of conversations.',
    },
    'zh-CN': {
      title: '首页',
      summary: '创建房间、加入房间、搜索并管理对话列表。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: 'Đây là nơi bắt đầu mọi cuộc trò chuyện và xem lại lịch sử.' },
      { type: 'list', items: [
        '**Nút “Tạo cuộc trò chuyện”** — mở hộp thoại tạo phòng (không hiện với tài khoản khách).',
        '**Nút “Tham gia phòng”** — dán liên kết hoặc mã mời để vào phòng của người khác.',
        '**Ô tìm kiếm** — lọc nhanh danh sách theo tên cuộc trò chuyện; khi không tìm thấy, ứng dụng gợi ý thử tên khác.',
        '**Thẻ cuộc trò chuyện** — hiện nhãn *MỘT MÁY CHUNG* hoặc *HAI MÁY RIÊNG*, cặp ngôn ngữ A ↔ B, thời điểm cập nhật gần nhất và trạng thái: *Đối thoại trực tiếp* (một máy chung), *2 người* (phòng hai máy đã đủ người) hoặc *Chờ người còn lại* (phòng hai máy chưa đủ). Bấm vào thẻ để mở phòng.',
        '**Nút xóa** (biểu tượng thùng rác) — chỉ hiện với chủ phòng trên thẻ phòng của mình.',
        '**Trạng thái rỗng** — khi chưa có phòng, trang gợi ý tạo cuộc trò chuyện đầu tiên; tài khoản khách được nhắc chờ chủ phòng gửi lời mời.',
        '**Lỗi khi tải danh sách** — kèm nút *Thử lại*; dữ liệu bạn đã thao tác không bị mất.',
      ] },
      { type: 'p', text: 'Trên thanh đầu trang luôn có: nút **Hướng dẫn sử dụng**, chọn ngôn ngữ giao diện, tên tài khoản hiện tại, nút cài đặt tài khoản và nút đăng xuất.' },
    ],
    en: [
      { type: 'p', text: 'This is where every conversation starts and where you look back at the history.' },
      { type: 'list', items: [
        '**The “Create conversation” button** — opens the create-room dialog (not shown for guest accounts).',
        '**The “Join room” button** — paste a link or invitation code to enter someone else’s room.',
        '**The search box** — filters the list quickly by conversation name; when nothing matches, the app suggests trying another name.',
        '**Conversation cards** — show the *SHARED DEVICE* or *SEPARATE DEVICES* badge, the language pair A ↔ B, when it was last updated and its status: *Face-to-face conversation* (one shared device), *2 people* (a separate-devices room with both people in it) or *Waiting for the other person* (a separate-devices room that is not full yet). Tap a card to open the room.',
        '**The delete button** (trash icon) — shown only to the room owner, on their own room card.',
        '**The empty state** — when there are no rooms yet, the page suggests creating your first conversation; guest accounts are reminded to wait for the room owner to send an invitation.',
        '**A loading error** — comes with a *Try again* button; the data you already worked on is not lost.',
      ] },
      { type: 'p', text: 'The top bar always has: the **User guide** button, the interface language selector, the current account name, the account settings button and the sign-out button.' },
    ],
    'zh-CN': [
      { type: 'p', text: '这里是每场对话的起点，也是回看历史记录的地方。' },
      { type: 'list', items: [
        '**“创建对话”按钮** —— 打开新建对话对话框（访客账户不可见）。',
        '**“加入房间”按钮** —— 粘贴链接或邀请码，进入他人创建的房间。',
        '**搜索框** —— 按对话名称快速筛选列表；没有结果时，应用会提示尝试其他名称。',
        '**对话卡片** —— 显示 *共用设备* 或 *独立设备* 标记、语言对 A ↔ B、最近更新时间以及状态：*面对面对话*（共用一台设备）、*2人*（两台独立设备的房间已满两人）或 *等待对方加入*（两台独立设备的房间还未满）。点击卡片即可打开房间。',
        '**删除按钮**（垃圾桶图标） —— 仅在房主自己的房间卡片上显示。',
        '**空状态** —— 还没有房间时，页面会建议创建第一个对话；访客账户会收到等待房主发送邀请的提示。',
        '**列表加载失败** —— 附带 *重试* 按钮；您已操作的数据不会丢失。',
      ] },
      { type: 'p', text: '顶栏始终包含：**使用指南** 按钮、界面语言选择、当前账户名称、账户设置按钮和退出登录按钮。' },
    ],
  },
};
