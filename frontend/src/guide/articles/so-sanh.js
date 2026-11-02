export default {
  slug: 'so-sanh',
  titles: {
    vi: {
      title: 'So sánh hai chế độ',
      summary: 'Bảng so sánh một máy chung và hai máy riêng để chọn đúng cách dùng.',
    },
    en: {
      title: 'Compare the two modes',
      summary: 'A comparison table of one shared device and two separate devices to choose the right setup.',
    },
    'zh-CN': {
      title: '两种模式对比',
      summary: '共用一台设备与两台独立设备的对比表，帮助您选择合适的使用方式。',
    },
  },
  blocks: {
    vi: [
      { type: 'table', head: ['Tiêu chí', 'Một máy chung', 'Hai máy riêng'], rows: [
        ['Cần tài khoản?', 'Có — chủ phòng cần đăng nhập', 'Chủ phòng đăng nhập; người B có thể vào bằng phiên khách'],
        ['Số micro dùng cùng lúc', 'Một micro dùng chung', 'Mỗi máy một micro, có thể bật cùng lúc'],
        ['Xác định A/B', 'Theo ngôn ngữ; câu chưa chắc người nói cần bấm chọn A/B', 'Cố định theo máy'],
        ['Cách mời', 'Không cần mời', 'QR hoặc liên kết mời dùng một lần, 24 giờ'],
        ['Tình huống phù hợp', 'Hai người ngồi cạnh nhau, chỉ có một điện thoại', 'Hai người ở xa nhau, mỗi người một điện thoại'],
      ] },
      { type: 'p', text: 'Cả hai chế độ đều **chỉ dịch bằng chữ**: chưa có gọi thoại và chưa đọc bản dịch qua loa.' },
    ],
    en: [
      { type: 'table', head: ['Criteria', 'One shared device', 'Two separate devices'], rows: [
        ['Need an account?', 'Yes — the room owner has to sign in', 'The room owner signs in; Person B can join with a guest session'],
        ['Microphones active at the same time', 'One shared microphone', 'One microphone per device, both can be on at the same time'],
        ['Identifying A/B', 'By language; when the speaker is unclear you press A/B to choose', 'Fixed per device'],
        ['How to invite', 'No invitation needed', 'QR code or a single-use invitation link, 24 hours'],
        ['Best suited to', 'Two people sitting side by side with only one phone', 'Two people far apart, each with their own phone'],
      ] },
      { type: 'p', text: 'Both modes **translate text only**: there is no voice call and no spoken playback of the translation.' },
    ],
    'zh-CN': [
      { type: 'table', head: ['对比项', '共用一台设备', '两台独立设备'], rows: [
        ['需要账户吗？', '需要——房主必须登录', '房主登录；参与者 B 可用访客会话加入'],
        ['同时使用的麦克风数量', '共用一个麦克风', '每台设备一个麦克风，可同时开启'],
        ['确定 A/B', '按语言判断；无法确定说话人时需点击 A/B 选择', '按设备固定'],
        ['邀请方式', '无需邀请', '二维码或一次性邀请链接，有效期 24 小时'],
        ['适用场景', '两人并排而坐，只有一部手机', '两人相距较远，各有一部手机'],
      ] },
      { type: 'p', text: '两种模式都**只做文字翻译**：目前没有语音通话，也不会朗读译文。' },
    ],
  },
};
