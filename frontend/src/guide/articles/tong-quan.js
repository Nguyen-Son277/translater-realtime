// Chuẩn mẫu cho mọi bài hướng dẫn: cùng cấu trúc block và cùng thứ tự ở cả 3 ngôn ngữ.
export default {
  slug: 'tong-quan',
  titles: {
    vi: {
      title: 'Tổng quan',
      summary: 'Song Ngữ là gì, hai cách dùng và bốn điều cần biết ngay.',
    },
    en: {
      title: 'Overview',
      summary: 'What Song Ngữ is, the two ways to use it, and four things to know right away.',
    },
    'zh-CN': {
      title: '总览',
      summary: 'Song Ngữ 是什么、两种使用方式，以及需要立刻了解的四件事。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: 'Song Ngữ là ứng dụng web dịch hội thoại hai chiều, hiển thị **đồng thời nguyên văn và bản dịch** của từng câu nói. Ứng dụng dành cho hai người nói hai ngôn ngữ khác nhau, và có hai cách dùng:' },
      { type: 'list', items: [
        '**Một máy chung** — hai người cùng nhìn một màn hình điện thoại và nói lần lượt vào cùng một micro.',
        '**Hai máy riêng** — mỗi người một điện thoại, mỗi máy tự bật micro của mình, hai máy có thể ở hai mạng Internet khác nhau.',
      ] },
      { type: 'p', text: 'Bốn điều cần ghi nhớ ngay:' },
      { type: 'list', items: [
        'Giao diện chỉ dùng **giọng nói** để tạo nội dung — *không có ô nhập chữ*.',
        'Ứng dụng **chỉ dịch bằng chữ**: chưa có gọi thoại, chưa đọc bản dịch qua loa.',
        '**Âm thanh không được lưu.** Chỉ nguyên văn và bản dịch được lưu vào lịch sử.',
        'Hội thoại chỉ hiển thị với những người đã tham gia phòng.',
      ] },
      { type: 'note', tone: 'info', text: 'Muốn đi thẳng vào thao tác? Mở hướng dẫn **Bắt đầu nhanh** ở bài kế tiếp.' },
    ],
    en: [
      { type: 'p', text: 'Song Ngữ is a two-way conversation translation web app. It shows the **original wording and the translation together** for every sentence. It is built for two people who speak different languages and offers two ways to use it:' },
      { type: 'list', items: [
        '**One shared device** — both people look at the same phone screen and take turns speaking into the same microphone.',
        '**Two separate devices** — each person uses their own phone, each phone turns on its own microphone, and the two devices can be on different internet connections.',
      ] },
      { type: 'p', text: 'Four things to remember right away:' },
      { type: 'list', items: [
        'Content is created by **voice only** — there is *no text input box*.',
        'The app **translates text only**: there is no voice call yet and no spoken playback of the translation.',
        '**Audio is never stored.** Only the original text and the translation are kept in the history.',
        'A conversation is visible only to the people who have joined the room.',
      ] },
      { type: 'note', tone: 'info', text: 'Ready to start using it? Open the **Quick start** guide on the next page.' },
    ],
    'zh-CN': [
      { type: 'p', text: 'Song Ngữ 是一款双向对话翻译网页应用，会**同时显示原始内容和译文**。它面向使用两种不同语言交流的两个人，提供两种使用方式：' },
      { type: 'list', items: [
        '**共用一台设备** —— 两人看着同一块手机屏幕，轮流对着同一个麦克风说话。',
        '**两台独立设备** —— 每人使用自己的手机，各自开启本机麦克风，两台设备可以处于不同的网络环境。',
      ] },
      { type: 'p', text: '需要立刻记住的四件事：' },
      { type: 'list', items: [
        '内容只能通过**语音**产生——*没有文字输入框*。',
        '应用**只做文字翻译**：目前没有语音通话，也不会朗读译文。',
        '**音频不会被保存。** 历史记录中只保留原文和译文。',
        '对话只对已加入房间的人可见。',
      ] },
      { type: 'note', tone: 'info', text: '想直接开始操作？请打开下一篇指南**快速开始**。' },
    ],
  },
};
