import tongQuan from './articles/tong-quan.js';
import batDauNhanh from './articles/bat-dau-nhanh.js';
import taiKhoan from './articles/tai-khoan.js';
import trangChu from './articles/trang-chu.js';
import taoCuocTroChuyen from './articles/tao-cuoc-tro-chuyen.js';
import thamGia from './articles/tham-gia.js';
import trongPhong from './articles/trong-phong.js';
import micro from './articles/micro.js';
import nguoiNoi from './articles/nguoi-noi.js';
import docHoiThoai from './articles/doc-hoi-thoai.js';
import moiNguoi from './articles/moi-nguoi.js';
import trangThaiDoiPhuong from './articles/trang-thai-doi-phuong.js';
import soSanh from './articles/so-sanh.js';
import ngonNgu from './articles/ngon-ngu.js';
import lichSu from './articles/lich-su.js';
import khach from './articles/khach.js';
import suCo from './articles/su-co.js';
import gioiHan from './articles/gioi-han.js';

// Fixed order: drives numbering, "previous"/"next" and the grouped index.
const META = [
  { slug: 'tong-quan', icon: 'BookOpen', category: 'basics', title: 'Tổng quan', article: tongQuan },
  { slug: 'bat-dau-nhanh', icon: 'Rocket', category: 'basics', title: 'Bắt đầu nhanh', article: batDauNhanh },
  { slug: 'tai-khoan', icon: 'UserRound', category: 'account', title: 'Tài khoản', article: taiKhoan },
  { slug: 'trang-chu', icon: 'House', category: 'rooms', title: 'Trang chủ', article: trangChu },
  { slug: 'tao-cuoc-tro-chuyen', icon: 'Plus', category: 'rooms', title: 'Tạo cuộc trò chuyện', article: taoCuocTroChuyen },
  { slug: 'tham-gia', icon: 'Link2', category: 'rooms', title: 'Tham gia bằng lời mời', article: thamGia },
  { slug: 'trong-phong', icon: 'LayoutDashboard', category: 'rooms', title: 'Màn hình trong phòng', article: trongPhong },
  { slug: 'micro', icon: 'Mic', category: 'voice', title: 'Micro và cách nói', article: micro },
  { slug: 'nguoi-noi', icon: 'UsersRound', category: 'voice', title: 'Ai đang nói (A/B)', article: nguoiNoi },
  { slug: 'doc-hoi-thoai', icon: 'MessagesSquare', category: 'voice', title: 'Đọc hội thoại', article: docHoiThoai },
  { slug: 'moi-nguoi', icon: 'QrCode', category: 'rooms', title: 'Mời người tham gia', article: moiNguoi },
  { slug: 'trang-thai-doi-phuong', icon: 'Activity', category: 'rooms', title: 'Trạng thái đối phương', article: trangThaiDoiPhuong },
  { slug: 'so-sanh', icon: 'ArrowLeftRight', category: 'reference', title: 'So sánh hai chế độ', article: soSanh },
  { slug: 'ngon-ngu', icon: 'Languages', category: 'reference', title: 'Ngôn ngữ', article: ngonNgu },
  { slug: 'lich-su', icon: 'History', category: 'reference', title: 'Lịch sử và quyền riêng tư', article: lichSu },
  { slug: 'khach', icon: 'UserCheck', category: 'account', title: 'Phiên khách', article: khach },
  { slug: 'su-co', icon: 'TriangleAlert', category: 'reference', title: 'Sự cố thường gặp', article: suCo },
  { slug: 'gioi-han', icon: 'Info', category: 'reference', title: 'Giới hạn đã biết và mẹo', article: gioiHan },
];

export const CATEGORIES = ['basics', 'account', 'rooms', 'voice', 'reference'];

export const ARTICLES = META.map((entry, index) => ({
  slug: entry.slug,
  icon: entry.icon,
  category: entry.category,
  number: index + 1,
  title: entry.title,
  titles: entry.article.titles,
  blocks: entry.article.blocks,
}));

export const TOTAL = ARTICLES.length;

const bySlug = new Map(ARTICLES.map(article => [article.slug, article]));

export function findArticle(slug) {
  return bySlug.get(slug) || null;
}

export function neighbours(slug) {
  const index = ARTICLES.findIndex(article => article.slug === slug);
  if (index < 0) return { previous: null, next: null };
  return {
    previous: index > 0 ? ARTICLES[index - 1] : null,
    next: index < ARTICLES.length - 1 ? ARTICLES[index + 1] : null,
  };
}

export function groupedArticles() {
  return CATEGORIES
    .map(category => ({ category, items: ARTICLES.filter(article => article.category === category) }))
    .filter(group => group.items.length > 0);
}
