export default {
  slug: 'tao-cuoc-tro-chuyen',
  titles: {
    vi: {
      title: 'Tạo cuộc trò chuyện',
      summary: 'Chọn một máy chung hay hai máy riêng, đặt tên và chọn cặp ngôn ngữ.',
    },
    en: {
      title: 'Create a conversation',
      summary: 'Choose one shared device or two separate devices, name the room and pick a language pair.',
    },
    'zh-CN': {
      title: '创建对话',
      summary: '选择共用一台设备还是两台独立设备，命名房间并选择语言对。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: 'Bấm **Tạo cuộc trò chuyện** ở trang chủ để mở hộp thoại gồm ba phần.' },
      { type: 'p', text: '**1. Chọn cách dùng thiết bị**' },
      { type: 'table', head: ['Lựa chọn', 'Khi nào dùng'], rows: [
        ['Một máy chung', 'Hai người ngồi cạnh nhau, cùng nhìn một màn hình và nói vào cùng một micro.'],
        ['Hai máy riêng', 'Mỗi người một điện thoại, liên kết qua QR hoặc liên kết mời; hai máy có thể ở hai mạng khác nhau.'],
      ] },
      { type: 'p', text: '**2. Đặt tên và chọn ngôn ngữ**' },
      { type: 'list', items: [
        '**Tên hội thoại** — không bắt buộc, tối đa 100 ký tự. Để trống thì phòng có tên *Cuộc trò chuyện mới*. Ví dụ: “Cà phê cùng Alex”.',
        '**Người A / Người B** — chọn ngôn ngữ cho từng phía trong 8 ngôn ngữ; mặc định Việt ↔ Anh. Nút **hoán đổi** (mũi tên hai chiều) đảo nhanh hai ngôn ngữ.',
        '**Chặn chọn trùng** — nếu hai ngôn ngữ giống nhau, ứng dụng báo *Hãy chọn hai ngôn ngữ khác nhau* và không cho bắt đầu.',
      ] },
      { type: 'p', text: '**3. Bắt đầu**' },
      { type: 'p', text: 'Bấm **Bắt đầu trò chuyện** để vào phòng ngay. Cặp ngôn ngữ và chế độ đã chọn **giữ cố định** trong suốt cuộc trò chuyện; muốn đổi thì tạo cuộc trò chuyện mới.' },
    ],
    en: [
      { type: 'p', text: 'Press **Create conversation** on the home page to open a dialog with three parts.' },
      { type: 'p', text: '**1. Choose how you use your devices**' },
      { type: 'table', head: ['Option', 'When to use it'], rows: [
        ['One shared device', 'Two people sit next to each other, look at the same screen and speak into the same microphone.'],
        ['Two separate devices', 'Each person has their own phone, connected through a QR code or an invitation link; the two devices can be on different networks.'],
      ] },
      { type: 'p', text: '**2. Name it and choose languages**' },
      { type: 'list', items: [
        '**Conversation name** — optional, up to 100 characters. If you leave it blank, the room is called *New conversation*. For example: “Coffee with Alex”.',
        '**Person A / Person B** — choose a language for each side from 8 languages; the default is Vietnamese ↔ English. The **swap** button (two-way arrow) flips the two languages quickly.',
        '**No duplicate languages** — if both languages are the same, the app shows *Choose two different languages* and will not let you start.',
      ] },
      { type: 'p', text: '**3. Start**' },
      { type: 'p', text: 'Press **Start conversation** to enter the room right away. The language pair and the mode you chose **stay fixed** for the whole conversation; to change them, create a new conversation.' },
    ],
    'zh-CN': [
      { type: 'p', text: '在首页点击**创建对话**，打开包含三个部分的对话框。' },
      { type: 'p', text: '**1. 选择设备使用方式**' },
      { type: 'table', head: ['选项', '适用场景'], rows: [
        ['共用一台设备', '两人并排而坐，看着同一个屏幕，对着同一个麦克风说话。'],
        ['两台独立设备', '每人一部手机，通过二维码或邀请链接连接；两台设备可以处于不同网络。'],
      ] },
      { type: 'p', text: '**2. 命名并选择语言**' },
      { type: 'list', items: [
        '**对话名称** —— 选填，最多 100 个字符。留空时房间名为 *Cuộc trò chuyện mới*（新对话）。例如：“和 Alex 喝咖啡”。',
        '**参与者 A / 参与者 B** —— 从 8 种语言中为各方选择语言；默认为越南语 ↔ 英语。**交换**按钮（双向箭头）可快速对调两种语言。',
        '**禁止重复选择** —— 若两种语言相同，应用会提示*请选择两种不同的语言*，且不允许开始。',
      ] },
      { type: 'p', text: '**3. 开始**' },
      { type: 'p', text: '点击**开始对话**即可立即进入房间。所选语言对和模式在整个对话期间**保持固定**；如需更改，请创建新的对话。' },
    ],
  },
};
