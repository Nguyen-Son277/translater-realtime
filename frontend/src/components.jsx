import { ArrowUpRight, AudioLines, LogOut, MessageCircleMore, Settings, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import { useI18n, LanguageSelector } from './i18n';

export function Brand({ light = false }) {
  const { t } = useI18n();
  return <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label={t('common.home')}>
    <span className="brand-mark"><MessageCircleMore size={22} /><span /></span>
    <span>song<span className="brand-dot">ngữ.</span></span>
  </Link>;
}

export function Header() {
  const { t, localizeError } = useI18n();
  const { user, setUser, logout } = useAuth();
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  return <header className="site-header">
    <div className="header-left">
      <Brand />
      <span className="header-tagline private-badge"><AudioLines size={14} /> <span>{t('common.tagline')}</span></span>
    </div>
    <div className="header-right">
      <LanguageSelector />
      <div className="header-divider" aria-hidden="true" />
      <div className="header-user-group">
        <span className="user-chip" title={user.name || user.username}>
          <span className="avatar">{(user.name || user.username)[0].toUpperCase()}</span>
          <span className="user-name">{user.name || user.username}</span>
        </span>
        <button className="icon-btn header-action-btn" aria-label={t('common.settings')} title={t('common.settings')} onClick={() => setSettingsOpen(true)}><Settings size={18} /></button>
        <button className="icon-btn header-action-btn" aria-label={t('common.logout')} title={error ? localizeError(error) : t('common.logout')} onClick={() => logout().catch(err => setError(err.message))}><LogOut size={18} /></button>
      </div>
      {error && <span role="alert" className="header-error">{localizeError(error)}</span>}
    </div>
    {settingsOpen && <AccountSettings user={user} onSaved={setUser} onClose={closeSettings} />}
  </header>;
}

function AccountSettings({ user, onSaved, onClose }) {
  const { t, localizeError } = useI18n();
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
  return <Modal title={t('common.settings')} onClose={onClose}>
    <p className="muted modal-intro">{t('common.settingsIntro')}</p>
    <div className="account-summary">
      <div><span className="account-summary-label">{t('common.displayName')}</span><strong>{user.name || user.username}</strong></div>
      <div><span className="account-summary-label">{t('common.username')}</span><strong>{user.username}</strong></div>
    </div>
    <form onSubmit={submit}>
      <label className="field-label" htmlFor="settings-email">{t('common.email')}</label>
      <input id="settings-email" name="email" type="email" value={email} onChange={event => { setEmail(event.target.value); setSaved(false); setError(''); }} placeholder={t('common.emailPlaceholder')} required maxLength={254} autoComplete="email" disabled={busy} />
      {error && <p className="form-error" role="alert">{localizeError(error)}</p>}
      {saved && <p className="form-success" role="status">{t('common.emailSaved')}</p>}
      <button className="btn btn-primary full-width mt-5" disabled={busy || email.trim().toLowerCase() === (user.email || '')}>{busy ? <span className="spinner" /> : t('common.save')}</button>
    </form>
  </Modal>;
}

export function Modal({ title, children, onClose, className = '' }) {
  const { t } = useI18n();
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
      <div className="modal-heading"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button></div>
      {children}
    </section>
  </div>;
}

export function EmptyConversation({ compact = false }) {
  const { t } = useI18n();
  return <div className={`empty-conversation ${compact ? 'compact' : ''}`}>
    <span className="empty-bubbles"><MessageCircleMore size={32} /><MessageCircleMore size={24} /></span>
    <h3>{t('common.emptyTitle')}</h3>
    <p>{t('common.emptyHint')}</p>
  </div>;
}

export function TextLink({ children, ...props }) {
  return <Link className="text-link" {...props}>{children}<ArrowUpRight size={16} /></Link>;
}
