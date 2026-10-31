import { common } from './common.js';
import { room } from './room.js';
import { join } from './join.js';
import { errorMessages } from './errors.js';

const extra = {
  vi: {
    "common.selectLanguage": "Chọn ngôn ngữ giao diện",
    "common.documentTitle": "Song Ngữ — Hội thoại không khoảng cách",
    "common.backHome": "Về trang chủ",
    "common.notFoundPage": "Không tìm thấy trang.",
    "common.retry": "Thử lại",
  },
  en: {
    "common.selectLanguage": "Select interface language",
    "common.documentTitle": "Song Ngữ — Bridging Languages",
    "common.backHome": "Back to home",
    "common.notFoundPage": "Page not found.",
    "common.retry": "Try again",
  },
  "zh-CN": {
    "common.selectLanguage": "选择界面语言",
    "common.documentTitle": "Song Ngữ — 跨越语言的对话",
    "common.backHome": "返回首页",
    "common.notFoundPage": "未找到页面。",
    "common.retry": "重试",
  }
};

export const SUPPORTED_LOCALES = [
  { code: 'vi', label: 'Tiếng Việt', htmlLang: 'vi', formatLocale: 'vi-VN' },
  { code: 'en', label: 'English', htmlLang: 'en', formatLocale: 'en-US' },
  { code: 'zh-CN', label: '简体中文', htmlLang: 'zh-Hans', formatLocale: 'zh-CN' },
];

export const translations = {
  vi: { ...common.vi, ...room.vi, ...join.vi, ...extra.vi },
  en: { ...common.en, ...room.en, ...join.en, ...extra.en },
  'zh-CN': { ...common['zh-CN'], ...room['zh-CN'], ...join['zh-CN'], ...extra['zh-CN'] },
};

export { errorMessages };
