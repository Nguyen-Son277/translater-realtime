export default {
  slug: 'trang-thai-doi-phuong',
  titles: {
    vi: {
      title: 'Trạng thái đối phương',
      summary: 'Trực tuyến, ngoại tuyến, micro đang bật — và điều chúng không nói lên.',
    },
    en: {
      title: 'Peer status',
      summary: 'Online, offline, microphone on — and what those states do not tell you.',
    },
    'zh-CN': {
      title: '对方状态',
      summary: '在线、离线、麦克风开启——以及这些状态并不代表的事情。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: 'Ở phòng hai máy, ngay dưới tiêu đề có dòng trạng thái người còn lại, ví dụ *Alex: Trực tuyến*. Các giá trị có thể gặp:' },
      { type: 'table', head: ['Trạng thái', 'Ý nghĩa'], rows: [
        ['Chưa tham gia', 'Người B chưa vào phòng — hãy gửi lời mời.'],
        ['Trực tuyến', 'Người kia đang mở phòng và kết nối ổn định.'],
        ['Micro đang bật', 'Người kia đã bật micro trên máy họ.'],
        ['Ngoại tuyến', 'Người kia đã đóng trang hoặc mất kết nối.'],
        ['Chưa rõ kết nối', 'Máy bạn đang mất kết nối nên chưa biết trạng thái người kia.'],
      ] },
      { type: 'note', tone: 'info', text: '**“Micro đang bật” không có nghĩa là đang nói.** Đây là trạng thái tạm trong bộ nhớ, không phải số thành viên đã đăng ký vào phòng.' },
    ],
    en: [
      { type: 'p', text: 'In a two-device room, the status line for the other person sits right below the title, for example *Alex: Online*. The values you may see are:' },
      { type: 'table', head: ['Status', 'Meaning'], rows: [
        ['Not joined yet', 'Person B has not entered the room yet — send an invitation.'],
        ['Online', 'The other person has the room open and the connection is stable.'],
        ['Microphone on', 'The other person has turned on the microphone on their own device.'],
        ['Offline', 'The other person has closed the page or lost the connection.'],
        ['Connection unknown', 'Your device has lost its connection, so the other person’s status is not known yet.'],
      ] },
      { type: 'note', tone: 'info', text: '**“Microphone on” does not mean they are speaking.** It is a temporary state kept in memory, not the number of members registered in the room.' },
    ],
    'zh-CN': [
      { type: 'p', text: '在两台独立设备的房间里，标题正下方会显示对方的状态行，例如 *Alex：在线*。可能出现的取值有：' },
      { type: 'table', head: ['状态', '含义'], rows: [
        ['尚未加入', '参与者 B 还未进入房间——请发送邀请。'],
        ['在线', '对方正在打开房间，连接稳定。'],
        ['麦克风开启', '对方已在其设备上开启麦克风。'],
        ['离线', '对方已关闭页面或连接中断。'],
        ['连接状态未知', '您的设备已断开连接，暂时无法得知对方的状态。'],
      ] },
      { type: 'note', tone: 'info', text: '**“麦克风开启”并不表示对方正在说话。** 这只是内存中的临时状态，并不代表房间已注册的成员数量。' },
    ],
  },
};
