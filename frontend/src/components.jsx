import { ArrowUpRight, AudioLines, LogOut, MessageCircleMore, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';

export function Brand({ light = false }) {
  return <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="Song Ngữ — Trang chủ">
    <span className="brand-mark"><MessageCircleMore size={22} /><span /></span>
    <span>song<span className="brand-dot">ngữ.</span></span>
  </Link>;
}

export function Header() {
  const { user, logout } = useAuth();
  const [error, setError] = useState('');
  return <header className="site-header">
    <Brand />
    <div className="header-right"><span className="private-badge"><AudioLines size={14} /> Không khoảng cách ngôn ngữ</span>
      <span className="user-chip"><span className="avatar">{user.username[0].toUpperCase()}</span><span>{user.username}</span></span>
      <button className="icon-btn" aria-label="Đăng xuất" title={error || 'Đăng xuất'} onClick={() => logout().catch(err => setError(err.message))}><LogOut size={18} /></button>
      {error && <span role="alert" className="header-error">{error}</span>}
    </div>
  </header>;
}

export function Modal({ title, children, onClose, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const elements = () => [...ref.current.querySelectorAll('button, input, select, textarea, a[href]')].filter(el => !el.disabled);
    elements()[0]?.focus();
    const onKey = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const targets = elements();
        const first = targets[0], last = targets.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-heading"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Đóng"><X size={20} /></button></div>
      {children}
    </section>
  </div>;
}

export function EmptyConversation({ language, compact = false }) {
  return <div className={`empty-conversation ${compact ? 'compact' : ''}`}>
    <span className="empty-bubbles"><MessageCircleMore size={32} /><MessageCircleMore size={24} /></span>
    <h3>{language === 'en' ? 'A little hello goes a long way.' : 'Bắt đầu bằng một lời chào.'}</h3>
    <p>{language === 'en' ? 'Speak naturally, or type a message below.' : 'Nói tự nhiên, hoặc nhập tin nhắn bên dưới.'}</p>
  </div>;
}

export function TextLink({ children, ...props }) {
  return <Link className="text-link" {...props}>{children}<ArrowUpRight size={16} /></Link>;
}
