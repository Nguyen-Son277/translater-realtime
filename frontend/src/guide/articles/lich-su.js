// Bài "Lịch sử và quyền riêng tư": nội dung được lưu bao lâu, cách xóa và những gì không được lưu.
export default {
  slug: 'lich-su',
  titles: {
    vi: {
      title: 'Lịch sử và quyền riêng tư',
      summary: 'Nội dung được lưu bao lâu, cách xóa và những gì không được lưu.',
    },
    en: {
      title: 'History and privacy',
      summary: 'How long content is kept, how to delete it, and what is never stored.',
    },
    'zh-CN': {
      title: '历史记录与隐私',
      summary: '内容保留多久、如何删除，以及哪些内容不会被保存。',
    },
  },
  blocks: {
    vi: [
      { type: 'p', text: '**Lịch sử**' },
      { type: 'list', items: [
        'Ứng dụng lưu **nguyên văn và bản dịch** của mọi câu đã chốt, để cả hai thành viên xem lại.',
        'Lịch sử được giữ cho tới khi **chủ phòng xóa toàn bộ cuộc trò chuyện**.',
        'Phụ đề tạm trong lúc nói **không** được lưu.',
        'Mở lại phòng từ danh sách lịch sử để xem tiếp nội dung cũ.',
      ] },
      { type: 'p', text: '**Xóa cuộc trò chuyện**' },
      { type: 'steps', items: [
        'Về trang chủ, tìm thẻ phòng của mình.',
        'Bấm biểu tượng **thùng rác** trên thẻ phòng.',
        'Đọc cảnh báo rồi bấm **Xóa hội thoại**. Nếu đổi ý, bấm **Giữ lại**.',
      ] },
      { type: 'p', text: 'Phòng và toàn bộ nội dung bị xóa khỏi lịch sử của **cả hai người**. Người đang mở phòng sẽ được đưa về trang chủ.' },
      { type: 'p', text: '**Quyền riêng tư**' },
      { type: 'list', items: [
        '**Âm thanh chỉ nằm trong bộ nhớ** trong lúc xử lý: không ghi thành tệp, không lưu vào cơ sở dữ liệu, không phát lại.',
        'Hội thoại chỉ hiển thị với người trong phòng; phiên đăng nhập lưu trong cookie bảo mật của trình duyệt.',
        'Email chỉ hiển thị với chính bạn.',
      ] },
    ],
    en: [
      { type: 'p', text: '**History**' },
      { type: 'list', items: [
        'The app stores the **original text and the translation** of every finalized sentence so both members can review them.',
        'The history is kept until the **room host deletes the whole conversation**.',
        'Temporary subtitles shown while you speak are **not** stored.',
        'Reopen the room from the history list to continue reading earlier content.',
      ] },
      { type: 'p', text: '**Deleting a conversation**' },
      { type: 'steps', items: [
        'Go back to the home page and find the card of your room.',
        'Click the **trash** icon on the room card.',
        'Read the warning, then click **Delete conversation**. If you change your mind, click **Keep it**.',
      ] },
      { type: 'p', text: 'The room and all of its content are removed from the history of **both people**. Anyone with the room open is taken back to the home page.' },
      { type: 'p', text: '**Privacy**' },
      { type: 'list', items: [
        '**Audio stays in memory only** while it is processed: it is not written to a file, not stored in the database, and not played back.',
        'A conversation is visible only to the people in the room; the sign-in session is stored in a secure browser cookie.',
        'Your email is visible only to you.',
      ] },
    ],
    'zh-CN': [
      { type: 'p', text: '**历史记录**' },
      { type: 'list', items: [
        '应用会保存每一句已确认语句的**原文和译文**，供两位成员回看。',
        '历史记录会一直保留，直到**房主删除整个对话**。',
        '说话过程中的实时预览字幕**不会**被保存。',
        '从历史记录列表重新打开房间，即可继续查看之前的内容。',
      ] },
      { type: 'p', text: '**删除对话**' },
      { type: 'steps', items: [
        '回到首页，找到自己房间的卡片。',
        '点击房间卡片上的**垃圾桶**图标。',
        '阅读警告后点击**删除对话**。如果改变主意，请点击**保留**。',
      ] },
      { type: 'p', text: '房间及其全部内容会从**双方的**历史记录中删除。正在打开该房间的人会被带回首页。' },
      { type: 'p', text: '**隐私**' },
      { type: 'list', items: [
        '**音频只在处理过程中存在于内存中**：不会写成文件，不会存入数据库，也不会回放。',
        '对话只对房间内的人可见；登录会话保存在浏览器的安全 Cookie 中。',
        '邮箱只对您本人可见。',
      ] },
    ],
  },
};
