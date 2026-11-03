export const currentVersion = '1.0.0';

// Newest first. Do not invent release dates: add a date only when confirmed.
export const releases = [{
  version: '1.0.0',
  title: { vi: 'Phiên bản đầu tiên', en: 'First release', 'zh-CN': '首个版本' },
  features: {
    vi: [
      'Hội thoại song ngữ với nhận diện giọng nói và bản dịch.',
      'Tạo cuộc trò chuyện, mời người khác tham gia và xem lại lịch sử.',
      'Hướng dẫn sử dụng và giao diện tiếng Việt, Anh, Trung.',
      'Gửi feedback công khai, xem lịch sử phiên bản và ủng hộ phát triển ứng dụng.',
    ],
    en: [
      'Bilingual conversations with speech recognition and translation.',
      'Create conversations, invite others and revisit conversation history.',
      'User guides and Vietnamese, English and Chinese interfaces.',
      'Public feedback, release history and support for app development.',
    ],
    'zh-CN': [
      '支持语音识别和翻译的双语会话。',
      '创建会话、邀请他人加入并查看历史记录。',
      '使用指南及越南语、英语和中文界面。',
      '公开反馈、版本历史及应用开发支持页面。',
    ],
  },
  improvements: {
    vi: ['Bộ nhận diện Transqora thiết kế riêng với biểu tượng, logo và favicon đồng bộ.'],
    en: ['Custom Transqora branding with a consistent symbol, logo and favicon.'],
    'zh-CN': ['采用专属 Transqora 品牌设计，统一标志、徽标和网站图标。'],
  },
}];
