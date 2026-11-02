// Bài hướng dẫn: Đọc hội thoại — nội dung đầy đủ 3 ngôn ngữ (vi, en, zh-CN).
export default {
  slug: 'doc-hoi-thoai',
  titles: {
    vi: {
      title: 'Đọc hội thoại',
      summary: 'Cấu trúc mỗi câu, trạng thái dịch, cuộn và tải lịch sử cũ.',
    },
    en: {
      title: 'Reading the conversation',
      summary: 'How each sentence is laid out, translation states, scrolling, and loading older history.',
    },
    'zh-CN': {
      title: '阅读对话',
      summary: '每句的结构、翻译状态、滚动查看，以及加载更早的历史记录。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: 'Mỗi câu trong khung hội thoại gồm:' },
      { type: 'list', items: [
        '**Nhãn người nói** — *Người A* / *Người B*; ở phòng hai máy có kèm tên người nói. Câu chưa gán được người nói hiện *Chưa xác định người nói*.',
        '**Giờ** và biểu tượng micro nếu câu được tạo từ giọng nói.',
        '**Nguyên văn** — đúng ngôn ngữ bạn đã nói.',
        '**Bản dịch** — kèm nhãn ngôn ngữ ngắn như *VI*, *EN*, *JA*… Câu đúng ngôn ngữ của người đọc được **nhấn mạnh** để dễ nhìn hơn.',
      ] },
      { type: 'p', text: '**Trạng thái của câu**' },
      { type: 'table', head: ['Trạng thái', 'Ý nghĩa'], rows: [
        ['Đang dịch…', 'Câu đã được lưu nguyên văn, bản dịch đang được tạo.'],
        ['Lỗi dịch + nút Thử lại', 'Dịch vụ dịch chưa sẵn sàng, quá bận, quá lâu hoặc trả kết quả không hợp lệ. Bấm Thử lại để dịch lại câu đó.'],
        ['Chọn người nói A/B', 'Câu chờ xác định người nói (chỉ ở chế độ một máy chung). Bấm A hoặc B để dịch.'],
      ] },
      { type: 'p', text: '**Cuộn và xem lịch sử**' },
      { type: 'list', items: [
        'Khi có câu mới, khung hội thoại **tự cuộn xuống** — trừ khi bạn đã cuộn lên để đọc lại.',
        'Nút **Xem hội thoại trước** ở đầu khung tải thêm tối đa **50 câu** mỗi lần; vị trí đang đọc được giữ nguyên.',
        'Nếu tải lịch sử lỗi, ứng dụng hiện thông báo ngay trong khung và bạn có thể bấm lại.',
      ] },
    ],
    en: [
      { type: 'p', text: 'Each sentence in the conversation pane has:' },
      { type: 'list', items: [
        '**A speaker label** — *Person A* / *Person B*; in two-device rooms it also shows the speaker’s name. A sentence that cannot be assigned yet shows *Unknown speaker*.',
        '**The time** and a microphone icon if the sentence was created from speech.',
        '**The original text** — exactly in the language you spoke.',
        '**The translation** — with a short language label such as *VI*, *EN*, *JA*… A sentence in the reader’s own language is **highlighted** so it is easier to spot.',
      ] },
      { type: 'p', text: '**Sentence states**' },
      { type: 'table', head: ['State', 'Meaning'], rows: [
        ['Translating…', 'The sentence has been saved in its original form and its translation is being generated.'],
        ['Translation error + Try again button', 'The translation service is unavailable, too busy, too slow, or returned an invalid result. Tap Try again to retranslate that sentence.'],
        ['Choose speaker A/B', 'The sentence is waiting for its speaker to be determined (shared-device mode only). Tap A or B to translate it.'],
      ] },
      { type: 'p', text: '**Scrolling and viewing history**' },
      { type: 'list', items: [
        'When a new sentence arrives, the conversation pane **scrolls down automatically** — unless you have scrolled up to re-read something.',
        'The **View previous messages** button at the top of the pane loads up to **50 more sentences** each time; your reading position stays where it was.',
        'If loading history fails, the app shows a message right in the pane and you can tap again.',
      ] },
    ],
    'zh-CN': [
      { type: 'p', text: '对话区域中的每一句都包含：' },
      { type: 'list', items: [
        '**说话人标签** —— *说话人 A* / *说话人 B*；在两台设备模式中还会带上说话人姓名。尚未确定说话人的句子显示 *未确定说话人*。',
        '**时间**，以及句子由语音产生时的麦克风图标。',
        '**原文** —— 与您所说语言一致的原始内容。',
        '**译文** —— 带有 *VI*、*EN*、*JA*… 这样的简短语言标签。与读者语言相同的句子会被**加重显示**，更方便辨认。',
      ] },
      { type: 'p', text: '**句子的状态**' },
      { type: 'table', head: ['状态', '含义'], rows: [
        ['正在翻译…', '句子已按原文保存，译文正在生成。'],
        ['翻译出错 + 重试按钮', '翻译服务尚未就绪、过于繁忙、耗时过长或返回了无效结果。点击重试可重新翻译该句。'],
        ['选择说话人 A/B', '句子正在等待确定说话人（仅在共用一台设备模式下出现）。点击 A 或 B 进行翻译。'],
      ] },
      { type: 'p', text: '**滚动与查看历史**' },
      { type: 'list', items: [
        '有新句子时，对话区域会**自动向下滚动**——除非您已经向上滚动回去重读。',
        '区域顶部的**查看更早对话**按钮每次会再加载最多 **50 句**；您正在阅读的位置保持不变。',
        '如果加载历史失败，应用会在区域内直接提示，您可以再次点击。',
      ] },
    ],
  },
};
