export const errorMessages = {
  // Client & network errors
  "Không kết nối được máy chủ. Nội dung của bạn vẫn được giữ lại.": {
    en: "Unable to connect to server. Your content has been preserved.",
    "zh-CN": "无法连接到服务器。您的内容已被保留。"
  },
  "Có lỗi xảy ra. Vui lòng thử lại.": {
    en: "An error occurred. Please try again.",
    "zh-CN": "发生错误，请重试。"
  },
  "Mật khẩu nhập lại chưa khớp.": {
    en: "Passwords do not match.",
    "zh-CN": "两次输入的密码不一致。"
  },
  "Micro cần kết nối HTTPS trên điện thoại, hoặc localhost trên máy tính.": {
    en: "Microphone requires HTTPS on mobile, or localhost on computer.",
    "zh-CN": "在手机上使用麦克风需要 HTTPS 连接，或在电脑上使用 localhost。"
  },
  "Trình duyệt chưa hỗ trợ thu âm. Hãy cập nhật Chrome hoặc Safari.": {
    en: "Browser does not support audio recording. Please update Chrome or Safari.",
    "zh-CN": "浏览器不支持录音。请升级 Chrome 或 Safari。"
  },
  "Bạn chưa cho phép dùng micro. Hãy cấp quyền micro trong trình duyệt, rồi bấm Bắt đầu nghe để thử lại.": {
    en: "Microphone permission denied. Please allow microphone access in your browser and try again.",
    "zh-CN": "您尚未允许使用麦克风。请在浏览器中授予权限后重试。"
  },
  "Không tìm thấy micro. Hãy kết nối micro, rồi bấm Bắt đầu nghe để thử lại.": {
    en: "Microphone not found. Please connect a microphone and try again.",
    "zh-CN": "未找到麦克风。请连接麦克风后重试。"
  },
  "Chưa kết nối được phòng. Hãy thử lại sau.": {
    en: "Could not connect to the room. Please try again later.",
    "zh-CN": "无法连接到房间。请稍后重试。"
  },
  "Địa chỉ hiện tại là HTTP hoặc địa chỉ nội bộ. Người ở mạng khác có thể không mở được lời mời. Hãy mở ứng dụng bằng URL HTTPS công khai rồi tạo liên kết mời từ URL đó.": {
    en: "The current address is HTTP or local network. Users on other networks may not be able to open the invitation. Please open the app with a public HTTPS URL and generate the link from there.",
    "zh-CN": "当前地址为 HTTP 或局域网地址。其他网络的用户可能无法打开此邀请。请使用公开 HTTPS 网址访问并生成邀请。"
  },
  "Chưa dịch được câu này.": {
    en: "Could not translate this message.",
    "zh-CN": "未能翻译该句。"
  },

  // Backend HTTP & WebSocket errors
  "Nguồn yêu cầu không được phép.": {
    en: "Origin not allowed.",
    "zh-CN": "请求来源不允许。"
  },
  "Bạn đã thử nhiều lần. Vui lòng đợi một phút.": {
    en: "Too many attempts. Please wait a minute.",
    "zh-CN": "尝试次数过多，请稍候一分钟。"
  },
  "Tên đăng nhập hoặc email đã được sử dụng.": {
    en: "Username or email is already in use.",
    "zh-CN": "用户名或电子邮箱已被使用。"
  },
  "Tên đăng nhập hoặc mật khẩu chưa đúng.": {
    en: "Incorrect username or password.",
    "zh-CN": "用户名或密码不正确。"
  },
  "Vui lòng đăng nhập để tiếp tục.": {
    en: "Please sign in to continue.",
    "zh-CN": "请登录以继续。"
  },
  "Email đã được sử dụng.": {
    en: "Email is already in use.",
    "zh-CN": "电子邮箱已被使用。"
  },
  "Lời mời không hợp lệ hoặc đã hết hạn. Hãy xin liên kết mới.": {
    en: "Invalid or expired invitation. Please request a new link.",
    "zh-CN": "邀请无效或已过期，请索取新链接。"
  },
  "Phòng đã có đủ hai người.": {
    en: "Room already has two participants.",
    "zh-CN": "房间已有两人加入。"
  },
  "Chỉ chủ phòng hai điện thoại có thể tạo lời mời.": {
    en: "Only the room owner can create an invitation.",
    "zh-CN": "仅两台手机模式的房主可创建邀请。"
  },
  "Chỉ chủ phòng được xóa cuộc hội thoại.": {
    en: "Only the room owner can delete this conversation.",
    "zh-CN": "仅房主可删除此对话。"
  },
  "Không tìm thấy cuộc hội thoại.": {
    en: "Conversation not found.",
    "zh-CN": "未找到该对话。"
  },
  "Hãy bắt đầu micro trước khi gửi âm thanh.": {
    en: "Please start the microphone before sending audio.",
    "zh-CN": "发送音频前请先开启麦克风。"
  },
  "Gói âm thanh không hợp lệ.": {
    en: "Invalid audio packet.",
    "zh-CN": "无效的音频数据包。"
  },
  "Nhận giọng nói đang quá tải. Hãy tạm dừng rồi thử lại.": {
    en: "Speech recognition is overloaded. Please pause and try again.",
    "zh-CN": "语音识别正忙，请暂停后重试。"
  },
  "Phiên micro trước vẫn đang mở. Hãy dừng trước khi mở phiên mới.": {
    en: "Previous microphone session is still open. Please stop it first.",
    "zh-CN": "上一个麦克风会话仍在运行，请先停止它。"
  },
  "Nhận giọng nói chưa sẵn sàng. Bạn có thể nhập chữ.": {
    en: "Speech recognition is not ready. You may type instead.",
    "zh-CN": "语音识别未就绪，您可以输入文字。"
  },
  "Đang xử lý các đoạn nói trước. Chờ một chút rồi bấm bắt đầu lại.": {
    en: "Processing previous speech segments. Please wait a moment and try again.",
    "zh-CN": "正在处理上一段语音，请稍候再试。"
  },
  "Micro đang được sử dụng trong một cửa sổ khác.": {
    en: "Microphone is being used in another window.",
    "zh-CN": "麦克风正在另一个窗口中使用。"
  },
  "Sự kiện không được hỗ trợ.": {
    en: "Unsupported event.",
    "zh-CN": "不支持的事件。"
  },
  "Dữ liệu gửi lên không hợp lệ.": {
    en: "Invalid data submitted.",
    "zh-CN": "提交的数据无效。"
  },
  "Không nhận dạng được đoạn nói. Hãy thử lại hoặc nhập chữ.": {
    en: "Could not recognize speech. Please try again or type instead.",
    "zh-CN": "未能识别语音，请重试或输入文字。"
  },
  "Một đoạn nói trước chưa xử lý xong do quá tải. Hãy kiểm tra hội thoại và nói lại phần bị thiếu.": {
    en: "A previous speech segment was not processed due to high load. Please check conversation and speak again.",
    "zh-CN": "因系统繁忙上一段语音未能处理完成，请检查对话并重新发言。"
  },
  "Bạn chỉ có thể gửi lời của mình.": {
    en: "You can only send your own messages.",
    "zh-CN": "您只能发送自己的发言。"
  },
  "Vui lòng chọn người A hoặc B.": {
    en: "Please select Person A or B.",
    "zh-CN": "请选择参与者 A 或 B。"
  },
  "Mã câu đã được sử dụng cho nội dung khác.": {
    en: "Message ID has already been used for other content.",
    "zh-CN": "该语句标识已被其他内容使用。"
  },
  "Không tìm thấy câu hội thoại.": {
    en: "Message not found.",
    "zh-CN": "未找到该语句。"
  },
  "Câu này đã xác định người nói.": {
    en: "Speaker has already been identified for this message.",
    "zh-CN": "该句已确定说话人。"
  },
  "Bạn không thể thay đổi câu này.": {
    en: "You cannot modify this message.",
    "zh-CN": "您无法修改此语句。"
  },

  // Codes from ERROR_LABELS in api.js
  "not_configured": {
    vi: "Dịch thuật chưa được cấu hình.",
    en: "Translation has not been configured.",
    "zh-CN": "翻译服务尚未配置。"
  },
  "upstream_auth": {
    vi: "Dịch vụ dịch chưa chấp nhận kết nối.",
    en: "Translation service rejected connection.",
    "zh-CN": "翻译服务未接受连接。"
  },
  "rate_limited": {
    vi: "Dịch vụ đang bận, hãy thử lại sau.",
    en: "Service is busy, please try again later.",
    "zh-CN": "服务繁忙，请稍后重试。"
  },
  "timeout": {
    vi: "Dịch lâu hơn dự kiến, hãy thử lại.",
    en: "Translation timed out, please try again.",
    "zh-CN": "翻译超时，请重试。"
  },
  "unavailable": {
    vi: "Chưa kết nối được dịch vụ dịch.",
    en: "Unable to connect to translation service.",
    "zh-CN": "无法连接翻译服务。"
  },
  "invalid_response": {
    vi: "Dịch vụ trả về bản dịch chưa hợp lệ.",
    en: "Translation service returned an invalid response.",
    "zh-CN": "翻译服务返回了无效结果。"
  },
  "queue_full": {
    vi: "Đang có nhiều câu chờ dịch.",
    en: "Too many messages in queue for translation.",
    "zh-CN": "排队等待翻译的语句过多。"
  },
  "interrupted": {
    vi: "Việc dịch đã bị gián đoạn.",
    en: "Translation was interrupted.",
    "zh-CN": "翻译已被中断。"
  }
};
