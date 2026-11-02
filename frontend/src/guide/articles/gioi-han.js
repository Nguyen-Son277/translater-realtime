// Nội dung đầy đủ 3 ngôn ngữ (vi, en, zh-CN) theo khuôn của tong-quan.js.
export default {
  slug: 'gioi-han',
  titles: {
    vi: {
      title: 'Giới hạn đã biết và mẹo',
      summary: 'Những gì ứng dụng chưa làm được, và cách nói để có kết quả tốt hơn.',
    },
    en: {
      title: 'Known limits and tips',
      summary: 'What the app cannot do yet, and how to speak so the results come out better.',
    },
    'zh-CN': {
      title: '已知限制与技巧',
      summary: '应用目前还做不到的事情，以及让结果更好的说话方式。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: '**Giới hạn hiện tại**' },
      { type: 'list', items: [
        '**Chưa có gọi thoại** và **chưa đọc bản dịch qua loa** — bạn đọc bản dịch trên màn hình.',
        '**Chưa có ô nhập chữ** — nội dung chỉ được tạo bằng giọng nói.',
        '**Không nhận diện danh tính người nói** — ở chế độ dùng chung máy, việc gán A/B dựa trên ngôn ngữ.',
        '**Chưa có quên/đổi mật khẩu** hay xác minh email.',
        '**Phiên khách không chuyển được thiết bị**; lời mời đã dùng không khôi phục được.',
        '**Độ trễ không được cam kết dưới một giây** — phụ thuộc máy chủ, độ dài câu và tốc độ dịch vụ.',
        'Phụ đề tạm có thể **bị bỏ qua** khi máy bận; hãy dựa vào các câu chính thức trong lịch sử.',
      ] },
      { type: 'p', text: '**Mẹo dùng tốt hơn**' },
      { type: 'list', items: [
        'Nói thành **câu ngắn, trọn ý**, ngắt hơi rõ để ứng dụng chốt câu nhanh và bản dịch đủ ngữ cảnh.',
        'Nói **đúng ngôn ngữ của phía mình**, đặc biệt ở chế độ hai máy.',
        'Nói **lần lượt**, tránh nói chồng khi dùng chung micro; hai máy thì có thể bật micro cùng lúc.',
        'Giữ tab **mở và hiển thị** trong lúc nói; chuyển ứng dụng sẽ dừng micro.',
        'Với phòng hai máy ở xa, tạo lời mời từ **URL HTTPS công khai** để người kia mở được từ mạng khác.',
        'Thấy câu sai hoặc thiếu thì nói lại câu đó; lịch sử chỉ lưu các câu đã chốt.',
      ] },
    ],
    en: [
      { type: 'p', text: '**Current limits**' },
      { type: 'list', items: [
        '**No voice calls yet** and **no spoken playback of translations** — you read the translation on screen.',
        '**No text input box yet** — content is created by voice only.',
        '**No speaker identity detection** — in shared-device mode, the A/B assignment is based on language.',
        '**No forgot or change password** yet, and no email verification.',
        '**A guest session cannot move to another device**; a used invitation cannot be restored.',
        '**Latency is not promised to be under one second** — it depends on the server, the sentence length and the speed of the translation service.',
        'Temporary captions may be **skipped** when the machine is busy; rely on the confirmed sentences in the history.',
      ] },
      { type: 'p', text: '**Tips for better results**' },
      { type: 'list', items: [
        'Speak in **short, complete sentences** and pause clearly so the app confirms the sentence quickly and the translation has enough context.',
        'Speak **in the language of your own side**, especially in two-device mode.',
        'Take turns and avoid talking over each other when sharing one microphone; with two devices both microphones can be on at the same time.',
        'Keep the tab **open and visible** while speaking; switching apps stops the microphone.',
        'For a two-device room across networks, create the invitation from a **public HTTPS URL** so the other person can open it from another network.',
        'If a sentence is wrong or missing, say it again; the history keeps only the sentences that were confirmed.',
      ] },
    ],
    'zh-CN': [
      { type: 'p', text: '**目前的限制**' },
      { type: 'list', items: [
        '**尚不支持语音通话**，也**不会朗读译文**——译文需要您自己看屏幕。',
        '**没有文字输入框**——内容只能通过语音产生。',
        '**不识别说话人身份**——共用设备模式下，A/B 的归属依据语言判断。',
        '**尚不支持忘记或修改密码**，也没有邮箱验证。',
        '**访客会话无法转移到其他设备**；已使用的邀请也无法恢复。',
        '**不承诺延迟低于一秒**——取决于服务器、句子长度和翻译服务的速度。',
        '设备繁忙时，实时预览字幕可能**被跳过**；请以历史记录中已确认的句子为准。',
      ] },
      { type: 'p', text: '**更好使用的技巧**' },
      { type: 'list', items: [
        '说**简短、意思完整的句子**，并清晰地停顿，让应用尽快确认句子，译文也能保留足够的上下文。',
        '**用自己一方的语言**说话，双设备模式尤其重要。',
        '**轮流**说话，共用麦克风时避免同时开口；两台设备则可以同时开启麦克风。',
        '说话时保持标签页**打开并处于前台**；切换应用会停止麦克风。',
        '跨网络的双设备房间，请用**公网 HTTPS 网址**创建邀请，让对方可以从其他网络打开。',
        '发现句子有误或缺失就重说一遍；历史记录只保存已确认的句子。',
      ] },
    ],
  },
};
