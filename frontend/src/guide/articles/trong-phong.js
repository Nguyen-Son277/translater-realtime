export default {
  slug: 'trong-phong',
  titles: {
    vi: {
      title: 'Màn hình trong phòng',
      summary: 'Các thông tin trên đầu phòng, pill kết nối và các dải thông báo.',
    },
    en: {
      title: 'The room screen',
      summary: 'What the room header shows, the connection pill and the notice banners.',
    },
    'zh-CN': {
      title: '房间内界面',
      summary: '房间顶部的信息、连接状态标签以及各类提示条。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: 'Phần đầu trang của phòng cho biết:' },
      { type: 'list', items: [
        '**Tên cuộc trò chuyện** và cặp ngôn ngữ A ↔ B.',
        '**Một máy chung** (khi hai người dùng chung máy) hoặc **Bạn là người A/B** (khi dùng hai máy).',
        '**Pill kết nối** — *Đã kết nối* hoặc *Đang kết nối lại*.',
        '**Chọn ngôn ngữ giao diện** — chỉ đổi ngôn ngữ chữ giao diện, không đổi ngôn ngữ dịch của phòng.',
        '**Nút “Mời bạn”** — chỉ có với chủ phòng ở phòng hai máy khi chưa đủ hai người. Khi không còn chỗ để mời (phòng hai máy đã đủ người, hoặc phòng một máy chung), vị trí đó hiện nhãn *2 người*.',
        '**Nút quay lại** (mũi tên trái) — về danh sách hội thoại.',
      ] },
      { type: 'p', text: '**Các dải thông báo có thể xuất hiện**' },
      { type: 'table', head: ['Dải thông báo', 'Ý nghĩa'], rows: [
        ['Kết nối đang gián đoạn. Micro đã dừng; hội thoại sẽ tự đồng bộ khi kết nối lại.', 'Mất mạng hoặc máy chủ tạm thời không phản hồi. Chờ kết nối lại rồi bấm bắt đầu micro.'],
        ['Dịch thuật chưa sẵn sàng. Lời nói vẫn được lưu nguyên văn; hãy thử dịch lại khi dịch vụ hoạt động.', 'Dịch vụ dịch chưa cấu hình hoặc chưa kết nối được. Nguyên văn vẫn được lưu và có thể dịch lại sau.'],
        ['Đang chờ người còn lại. Gửi lời mời để cùng trò chuyện.', 'Phòng hai máy chưa đủ hai thành viên.'],
        ['Hai máy từ xa · Bạn nói …; đối phương nói …', 'Nhắc bạn nói đúng ngôn ngữ của phía mình. Kèm trạng thái trực tuyến của người kia và ghi chú chỉ dịch bằng chữ.'],
      ] },
      { type: 'note', tone: 'info', text: 'Nếu phòng bị chủ phòng xóa trong lúc bạn đang mở, ứng dụng tự đưa bạn về trang chủ.' },
    ],
    en: [
      { type: 'p', text: 'The top of the room screen shows:' },
      { type: 'list', items: [
        '**The conversation name** and the A ↔ B language pair.',
        '**One shared device** (when both people use the same device) or **You are Person A/B** (when using two devices).',
        '**The connection pill** — *Connected* or *Reconnecting*.',
        '**The interface language selector** — this only changes the language of the interface text, not the room’s translation languages.',
        '**The “Invite” button** — only available to the room owner in a two-device room that does not have two people yet. When there is no room left to invite (a two-device room is already full, or the room is a shared-device room), that spot shows the label *2 people*.',
        '**The back button** (left arrow) — returns to the conversation list.',
      ] },
      { type: 'p', text: '**Notice banners you may see**' },
      { type: 'table', head: ['Banner', 'Meaning'], rows: [
        ['Connection interrupted. Microphone stopped; messages will sync automatically upon reconnection.', 'The network dropped or the server is temporarily not responding. Wait for the connection to return, then start the microphone again.'],
        ['Translation service is not ready. Speech is still recorded verbatim; try translating again when the service is active.', 'The translation service is not configured or could not be reached. The original text is still saved and can be translated again later.'],
        ['Waiting for the other person. Send an invite to chat together.', 'The two-device room does not have two members yet.'],
        ['Two separate devices · You speak …; peer speaks …', 'A reminder to speak your own side’s language. It also shows the other person’s online status and a note that translation is text only.'],
      ] },
      { type: 'note', tone: 'info', text: 'If the room owner deletes the room while you have it open, the app takes you back to the home page automatically.' },
    ],
    'zh-CN': [
      { type: 'p', text: '房间顶部会显示：' },
      { type: 'list', items: [
        '**对话名称**和 A ↔ B 语言对。',
        '**共用一台设备**（两人共用同一台设备时）或**您是参与者 A/B**（使用两台设备时）。',
        '**连接状态标签** —— *已连接*或*正在重新连接*。',
        '**界面语言选择** —— 只更改界面文字的语言，不更改房间的翻译语言。',
        '**“邀请”按钮** —— 仅在两台设备房间尚未满两人时对房主显示。当无法再邀请时（两台设备房间已满两人，或共用一台设备的房间），该位置显示标签*2人*。',
        '**返回按钮**（左箭头）——返回对话列表。',
      ] },
      { type: 'p', text: '**可能出现的提示条**' },
      { type: 'table', head: ['提示条', '含义'], rows: [
        ['连接已中断。麦克风已停止；重新连接后将自动同步对话。', '网络中断或服务器暂时无响应。等待重新连接后再次启动麦克风。'],
        ['翻译服务尚未就绪。语音仍会完整保留原文；服务恢复后可重试翻译。', '翻译服务未配置或无法连接。原文仍会保存，可稍后重新翻译。'],
        ['等待对方加入。发送邀请即可共同对话。', '两台设备房间尚未满两人。'],
        ['两台独立设备 · 您说 …；对方说 …', '提醒您使用自己一方的语言说话。同时显示对方的在线状态，以及仅做文字翻译的说明。'],
      ] },
      { type: 'note', tone: 'info', text: '如果您正在打开房间时房主删除了该房间，应用会自动将您带回首页。' },
    ],
  },
};
