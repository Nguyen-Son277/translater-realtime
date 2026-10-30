import { ArrowUpRight, AudioLines, LogOut, MessageCircleMore, Settings, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';

export function Brand({ light = false }) {
  return <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="Song Ngữ — Trang chủ">
    <span className="brand-mark"><MessageCircleMore size={22} /><span /></span>
    <span>song<span className="brand-dot">ngữ.</span></span>
  </Link>;
}

export function Header() {
  const { user, setUser, logout } = useAuth();
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  return <header className="site-header">
    <Brand />
    <div className="header-right"><span className="private-badge"><AudioLines size={14} /> Không khoảng cách ngôn ngữ</span>
      <span className="user-chip"><span className="avatar">{(user.name || user.username)[0].toUpperCase()}</span><span>{user.name || user.username}</span></span>
      <button className="icon-btn" aria-label="Cài đặt tài khoản" title="Cài đặt tài khoản" onClick={() => setSettingsOpen(true)}><Settings size={18} /></button>
      <button className="icon-btn" aria-label="Đăng xuất" title={error || 'Đăng xuất'} onClick={() => logout().catch(err => setError(err.message))}><LogOut size={18} /></button>
      {error && <span role="alert" className="header-error">{error}</span>}
    </div>
    {settingsOpen && <AccountSettings user={user} onSaved={setUser} onClose={closeSettings} />}
  </header>;
}

function AccountSettings({ user, onSaved, onClose }) {
  const [email, setEmail] = useState(user.email || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError(''); setSaved(false);
    try {
      const account = await api('/auth/me', { method: 'PATCH', body: { email } });
      onSaved(account); setEmail(account.email || ''); setSaved(true);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <Modal title="Cài đặt tài khoản" onClose={onClose}>
    <p className="muted modal-intro">Quản lý thông tin tài khoản và cập nhật email của bạn.</p>
    <div className="account-summary">
      <div><span className="account-summary-label">Tên hiển thị</span><strong>{user.name || user.username}</strong></div>
      <div><span className="account-summary-label">Tên đăng nhập</span><strong>{user.username}</strong></div>
    </div>
    <form onSubmit={submit}>
      <label className="field-label" htmlFor="settings-email">Email</label>
      <input id="settings-email" name="email" type="email" value={email} onChange={event => { setEmail(event.target.value); setSaved(false); setError(''); }} placeholder="Chưa cập nhật" required maxLength={254} autoComplete="email" disabled={busy} />
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && <p className="form-success" role="status">Đã cập nhật email.</p>}
      <button className="btn btn-primary full-width mt-5" disabled={busy || email.trim().toLowerCase() === (user.email || '')}>{busy ? <span className="spinner" /> : 'Lưu thay đổi'}</button>
    </form>
  </Modal>;
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
    <p>{language === 'en' ? 'Press Start listening, then speak naturally.' : 'Bấm Bắt đầu nghe, rồi nói tự nhiên.'}</p>
  </div>;
}

export function TextLink({ children, ...props }) {
  return <Link className="text-link" {...props}>{children}<ArrowUpRight size={16} /></Link>;
}
