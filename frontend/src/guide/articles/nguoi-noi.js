// Bài hướng dẫn: Ai đang nói (A/B) — nội dung đầy đủ 3 ngôn ngữ (vi, en, zh-CN).
export default {
  slug: 'nguoi-noi',
  titles: {
    vi: {
      title: 'Ai đang nói (A/B)',
      summary: 'Cách ứng dụng gán câu nói cho người A hoặc B, và khi nào bạn cần chọn.',
    },
    en: {
      title: 'Who is speaking (A/B)',
      summary: 'How the app assigns a sentence to Person A or Person B, and when you need to choose.',
    },
    'zh-CN': {
      title: '谁在说话（A/B）',
      summary: '应用如何把句子归给说话人 A 或 B，以及什么时候需要您来选择。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: '**Dùng chung một máy**' },
      { type: 'p', text: 'Cả hai người dùng chung một micro, nên ứng dụng tự gán câu nói cho **người A** hoặc **người B** dựa trên ngôn ngữ nhận dạng được:' },
      { type: 'list', items: [
        'Nói bằng ngôn ngữ của A → câu được gán cho A và dịch sang ngôn ngữ của B.',
        'Nói bằng ngôn ngữ của B → gán cho B và dịch sang ngôn ngữ của A.',
        'Nếu chưa chắc ngôn ngữ (câu bị cắt giữa chừng, nói quá ngắn, hoặc ngôn ngữ ngoài cặp đã chọn), ứng dụng hiện dòng **“Chọn người nói để dịch câu này”** kèm hai nút **A** và **B**. Bấm đúng phía thì câu mới được dịch.',
      ] },
      { type: 'note', tone: 'info', text: 'Ứng dụng **không nhận diện danh tính** qua giọng nói — chỉ dựa vào ngôn ngữ. Hai người cần **nói lần lượt**, tránh nói chồng trong cùng một micro.' },
      { type: 'p', text: '**Dùng hai máy**' },
      { type: 'p', text: 'Mỗi máy cố định một phía (A hoặc B), nên **không cần chọn người nói**. Mỗi người chỉ cần nói đúng ngôn ngữ ghi trên máy mình. Hai máy có thể bật micro cùng lúc.' },
    ],
    en: [
      { type: 'p', text: '**Using one shared device**' },
      { type: 'p', text: 'Both people share one microphone, so the app assigns each sentence to **Person A** or **Person B** based on the language it recognizes:' },
      { type: 'list', items: [
        'Speaking in A’s language → the sentence is assigned to A and translated into B’s language.',
        'Speaking in B’s language → it is assigned to B and translated into A’s language.',
        'If the language is not clear (the sentence was cut off, the speech was too short, or the language is outside the selected pair), the app shows the line **“Choose a speaker to translate this sentence”** with two buttons, **A** and **B**. The sentence is only translated after you tap the correct side.',
      ] },
      { type: 'note', tone: 'info', text: 'The app **does not identify people** by their voice — it relies on language only. The two of you need to **speak in turn** and avoid talking over each other into the same microphone.' },
      { type: 'p', text: '**Using two devices**' },
      { type: 'p', text: 'Each device is fixed to one side (A or B), so **there is no need to choose a speaker**. Each person only needs to speak the language shown on their own device. Both devices can have their microphone on at the same time.' },
    ],
    'zh-CN': [
      { type: 'p', text: '**共用一台设备**' },
      { type: 'p', text: '两人共用一个麦克风，因此应用会根据识别出的语言，自动把句子归给**说话人 A** 或**说话人 B**：' },
      { type: 'list', items: [
        '用 A 的语言说话 → 句子归给 A，并翻译成 B 的语言。',
        '用 B 的语言说话 → 归给 B，并翻译成 A 的语言。',
        '如果无法确定语言（句子中途被切断、说话太短，或语言不在所选语言对中），应用会显示 **“选择说话人以翻译该句”** 以及 **A**、**B** 两个按钮。点选正确的一方，句子才会被翻译。',
      ] },
      { type: 'note', tone: 'info', text: '应用**不会通过声音识别身份**——只依据语言判断。两人需要**轮流说话**，避免对着同一个麦克风同时说。' },
      { type: 'p', text: '**使用两台设备**' },
      { type: 'p', text: '每台设备固定对应一方（A 或 B），因此**不需要选择说话人**。每个人只需说自己设备上标注的语言即可。两台设备可以同时开启麦克风。' },
    ],
  },
};
