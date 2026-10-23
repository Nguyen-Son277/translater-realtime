export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin', ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError('Không kết nối được máy chủ. Nội dung của bạn vẫn được giữ lại.', 0);
  }
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(body.detail)
      ? body.detail.map(item => item.msg.replace(/^Value error, /, '')).join(' ')
      : typeof body.detail === 'object'
        ? ERROR_LABELS[body.detail?.code] || 'Không kiểm tra được kết nối. Vui lòng thử lại.'
        : body.detail;
    if (response.status === 401 && path !== '/auth/me' && !path.startsWith('/auth/login')) {
      window.dispatchEvent(new Event('session-expired'));
    }
    throw new ApiError(detail || 'Có lỗi xảy ra. Vui lòng thử lại.', response.status);
  }
  return body;
}

export const LANGUAGES = {
  vi: { name: 'Tiếng Việt', short: 'VI', flag: 'VN' },
  en: { name: 'English', short: 'EN', flag: 'GB' },
  ja: { name: '日本語', short: 'JA', flag: 'JP' },
  ko: { name: '한국어', short: 'KO', flag: 'KR' },
  zh: { name: '中文', short: 'ZH', flag: 'CN' },
  fr: { name: 'Français', short: 'FR', flag: 'FR' },
  de: { name: 'Deutsch', short: 'DE', flag: 'DE' },
  es: { name: 'Español', short: 'ES', flag: 'ES' },
};

export const ERROR_LABELS = {
  not_configured: 'Dịch thuật chưa được cấu hình.',
  upstream_auth: 'API key không hợp lệ hoặc chưa có quyền truy cập model.',
  model_not_found: 'Không tìm thấy model. Kiểm tra tên model và Base URL.',
  quota_exceeded: 'Tài khoản API đã hết hạn mức hoặc cần nạp tiền tại nhà cung cấp.',
  configuration_error: 'Không đọc được cấu hình dịch. Chủ phòng cần lưu lại API key hoặc liên hệ quản trị viên.',
  rate_limited: 'Dịch vụ đang bận, hãy thử lại sau.',
  timeout: 'Dịch lâu hơn dự kiến, hãy thử lại.',
  unavailable: 'Chưa kết nối được dịch vụ dịch.',
  invalid_response: 'Dịch vụ trả về bản dịch chưa hợp lệ.',
  queue_full: 'Đang có nhiều câu chờ dịch.',
  interrupted: 'Việc dịch đã bị gián đoạn.',
};

export function newClientId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return [...crypto.getRandomValues(new Uint8Array(16))].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function mergeMessages(current, incoming) {
  const result = new Map(current.map(item => [item.id, item]));
  for (const item of incoming) {
    if (!result.has(item.id) || result.get(item.id).version <= item.version) result.set(item.id, item);
  }
  return [...result.values()].sort((a, b) => a.sequence - b.sequence);
}
