export default {
  slug: 'moi-nguoi',
  titles: {
    vi: {
      title: 'Mời người tham gia',
      summary: 'Tạo QR và liên kết mời, giới hạn một lần trong 24 giờ và cảnh báo địa chỉ.',
    },
    en: {
      title: 'Invite someone to join',
      summary: 'Create a QR code and an invitation link, the single-use 24-hour limit, and the address warning.',
    },
    'zh-CN': {
      title: '邀请他人加入',
      summary: '生成二维码和邀请链接、24 小时内仅限一次的规则，以及地址警告。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: 'Chỉ **chủ phòng** của phòng hai máy mới tạo được lời mời, và chỉ khi phòng chưa đủ hai người.' },
      { type: 'steps', items: [
        'Trong phòng, bấm nút **Mời bạn** ở thanh đầu trang. Ứng dụng tạo lời mời và mở hộp thoại.',
        'Đưa người kia **quét mã QR**, hoặc bấm biểu tượng **sao chép** để lấy liên kết và gửi qua tin nhắn.',
        'Người đó mở liên kết, bấm **Vào phòng**. Phòng chuyển sang trạng thái đủ hai người và cả hai bắt đầu trò chuyện.',
      ] },
      { type: 'list', items: [
        'Liên kết mời **chỉ dùng một lần**, có hiệu lực **24 giờ**. Hết hạn thì mở lại hộp thoại mời để tạo liên kết mới.',
        'Người tham gia **không cần đăng nhập**; hệ thống cấp cho họ một **phiên khách**.',
      ] },
      { type: 'note', tone: 'warning', text: 'Nếu hộp thoại mời hiện cảnh báo *Địa chỉ hiện tại là HTTP hoặc địa chỉ nội bộ…*, nghĩa là liên kết có thể không mở được từ mạng khác. Hãy **mở ứng dụng bằng đúng URL HTTPS công khai** rồi tạo lại lời mời từ địa chỉ đó.' },
    ],
    en: [
      { type: 'p', text: 'Only the **room owner** of a two-device room can create an invitation, and only while the room does not yet have two people.' },
      { type: 'steps', items: [
        'In the room, press the **Invite** button in the top bar. The app creates an invitation and opens a dialog.',
        'Let the other person **scan the QR code**, or press the **copy** icon to get the link and send it in a message.',
        'That person opens the link and presses **Join room**. The room switches to the two-person state and both of you start talking.',
      ] },
      { type: 'list', items: [
        'An invitation link is **single-use** and valid for **24 hours**. Once it expires, reopen the invite dialog to create a new link.',
        'The person joining **does not need to sign in**; the system gives them a **guest session**.',
      ] },
      { type: 'note', tone: 'warning', text: 'If the invite dialog shows the warning *The current address is HTTP or an internal address…*, it means the link may not open from another network. **Open the app at its public HTTPS URL**, then create the invitation again from that address.' },
    ],
    'zh-CN': [
      { type: 'p', text: '只有两台独立设备房间的**房主**才能生成邀请，且仅在房间尚未满两人时可用。' },
      { type: 'steps', items: [
        '在房间中，点击顶部栏的**邀请**按钮。应用会生成邀请并打开对话框。',
        '让对方**扫描二维码**，或点击**复制**图标获取链接，再通过消息发送。',
        '对方打开链接后点击**进入房间**。房间随即进入两人状态，双方开始对话。',
      ] },
      { type: 'list', items: [
        '邀请链接**仅可使用一次**，有效期为 **24 小时**。过期后请重新打开邀请对话框生成新链接。',
        '受邀加入的人**无需登录**；系统会为其分配一个**访客会话**。',
      ] },
      { type: 'note', tone: 'warning', text: '如果邀请对话框显示警告*当前地址为 HTTP 或内网地址……*，说明该链接可能无法从其他网络打开。请**使用公开的 HTTPS URL 打开应用**，再从该地址重新生成邀请。' },
    ],
  },
};
