// Bài "Ngôn ngữ": 8 ngôn ngữ dịch, 3 ngôn ngữ giao diện và cách đổi.
export default {
  slug: 'ngon-ngu',
  titles: {
    vi: {
      title: 'Ngôn ngữ',
      summary: 'Tám ngôn ngữ dịch, ba ngôn ngữ giao diện và cách đổi.',
    },
    en: {
      title: 'Languages',
      summary: 'Eight translation languages, three interface languages, and how to switch.',
    },
    'zh-CN': {
      title: '语言',
      summary: '八种翻译语言、三种界面语言以及切换方法。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: '**Ngôn ngữ dịch**' },
      { type: 'p', text: 'Hỗ trợ 8 ngôn ngữ, mặc định Việt ↔ Anh: Tiếng Việt, Tiếng Anh, Tiếng Nhật, Tiếng Hàn, Tiếng Trung (giản thể), Tiếng Pháp, Tiếng Đức, Tiếng Tây Ban Nha.' },
      { type: 'list', items: [
        'Cặp ngôn ngữ được chọn **một lần khi tạo phòng** và giữ cố định trong suốt cuộc trò chuyện.',
        'Hai ngôn ngữ phải khác nhau.',
        'Mỗi người cần nói đúng ngôn ngữ của phía mình để bản dịch đúng chiều.',
      ] },
      { type: 'p', text: '**Ngôn ngữ giao diện**' },
      { type: 'list', items: [
        'Ô chọn ngôn ngữ ở thanh đầu trang đổi **chữ của giao diện** giữa *Tiếng Việt*, *English* và *简体中文*.',
        'Lựa chọn được ghi nhớ trên trình duyệt và giữ nguyên khi tải lại trang.',
        'Đổi ngôn ngữ giao diện **không** làm đổi ngôn ngữ dịch của phòng.',
        'Toàn bộ trang hướng dẫn này cũng đổi theo ngôn ngữ giao diện.',
      ] },
      { type: 'p', text: '**Chữ lớn, dễ đọc**' },
      { type: 'list', items: [
        'Chữ chính từ 18px, chữ phụ từ 16px; nguyên văn và bản dịch cùng cỡ lớn (khoảng 22px trên điện thoại, 24px trên máy tính).',
        'Cỡ chữ theo thiết lập phóng to của trình duyệt; có thể zoom 200% mà nút micro vẫn tới được.',
      ] },
    ],
    en: [
      { type: 'p', text: '**Translation languages**' },
      { type: 'p', text: 'It supports 8 languages, with Vietnamese ↔ English as the default: Vietnamese, English, Japanese, Korean, Chinese (simplified), French, German, and Spanish.' },
      { type: 'list', items: [
        'The language pair is chosen **once when you create a room** and stays fixed for the whole conversation.',
        'The two languages must be different.',
        'Each person needs to speak the language of their own side so the translation goes in the right direction.',
      ] },
      { type: 'p', text: '**Interface language**' },
      { type: 'list', items: [
        'The language selector in the top bar changes the **interface text** between *Vietnamese*, *English*, and *简体中文*.',
        'Your choice is remembered in the browser and kept when you reload the page.',
        'Changing the interface language does **not** change the translation languages of the room.',
        'This whole guide page also follows the interface language.',
      ] },
      { type: 'p', text: '**Large, easy-to-read text**' },
      { type: 'list', items: [
        'Main text starts at 18px and secondary text at 16px; the original and the translation are both large (about 22px on phones and 24px on computers).',
        'Text size follows the browser zoom setting; you can zoom to 200% and still reach the microphone button.',
      ] },
    ],
    'zh-CN': [
      { type: 'p', text: '**翻译语言**' },
      { type: 'p', text: '支持 8 种语言，默认越南语 ↔ 英语：越南语、英语、日语、韩语、中文（简体）、法语、德语、西班牙语。' },
      { type: 'list', items: [
        '语言对在**创建房间时选择一次**，并在整个对话过程中保持不变。',
        '两种语言必须不同。',
        '每个人需要说自己一侧的语言，译文方向才正确。',
      ] },
      { type: 'p', text: '**界面语言**' },
      { type: 'list', items: [
        '顶部栏的语言选择器用于切换**界面文字**，可在 *越南语*、*English* 和 *简体中文* 之间切换。',
        '选择结果会记录在浏览器中，刷新页面后保持不变。',
        '更改界面语言**不会**改变房间的翻译语言。',
        '整个使用指南页面也会跟随界面语言切换。',
      ] },
      { type: 'p', text: '**大字号，易阅读**' },
      { type: 'list', items: [
        '主要文字从 18px 起，次要文字从 16px 起；原文和译文都是大字号（手机上约 22px，电脑上约 24px）。',
        '字号跟随浏览器的缩放设置；即使放大到 200%，麦克风按钮仍然可以点到。',
      ] },
    ],
  },
};
