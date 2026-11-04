import { ArrowUpRight, AudioLines, BookOpen, LogOut, Menu, MessageCircleMore, Settings, ShieldCheck, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import { useI18n, LanguageSelector } from './i18n';

export function Brand({ light = false }) {
  const { t } = useI18n();
  return <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label={t('common.home')}>
    <img className="brand-logo" src={light ? '/brand/logo-mono-light.svg' : '/brand/logo.svg'} width="340" height="64" alt="" aria-hidden="true" />
  </Link>;
}

export function CommunityNavigation() {
  const { t } = useI18n();
  const location = useLocation();
  return ['feedback', 'updates', 'support'].map(page => <Link key={page} to={`/${page}`} aria-current={location.pathname === `/${page}` ? 'page' : undefined}>{t(`community.${page}`)}</Link>);
}

export function Header() {
  const { t, localizeError } = useI18n();
  const { user, setUser, logout } = useAuth();
  const location = useLocation();
  const loginState = { from: location.pathname + location.search + location.hash };
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutPending = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const headerRef = useRef(null);
  const menuButtonRef = useRef(null);
  const panelRef = useRef(null);
  const settingsButtonRef = useRef(null);
  const panelId = useId();
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    // Modal restores its original trigger first; a resize may have hidden it.
    requestAnimationFrame(() => {
      if (!headerRef.current?.isConnected) return;
      const target = window.matchMedia('(max-width: 1400px)').matches ? menuButtonRef.current : settingsButtonRef.current;
      target?.focus();
    });
  }, []);
  const closeMenu = useCallback(() => {
    // Restore focus before hiding the panel, including when a modal opens from it.
    if (window.matchMedia('(max-width: 1400px)').matches && panelRef.current?.contains(document.activeElement)) {
      menuButtonRef.current?.focus();
    }
    setMenuOpen(false);
  }, []);

  useEffect(() => { closeMenu(); }, [location, closeMenu]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1400px)');
    const onChange = () => {
      if (media.matches) closeMenu();
      else {
        setMenuOpen(false);
        if (document.activeElement === menuButtonRef.current) panelRef.current?.querySelector('a')?.focus();
      }
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [closeMenu]);
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = event => {
      if (!headerRef.current?.contains(event.target)) closeMenu();
    };
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen, closeMenu]);

  const openSettings = () => { closeMenu(); setSettingsOpen(true); };
  const signOut = async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setLoggingOut(true);
    setError('');
    try { await logout(); closeMenu(); }
    catch (err) { setError(err.message); }
    finally { logoutPending.current = false; setLoggingOut(false); }
  };
  const displayName = user ? (user.is_guest ? t('common.guest') : user.name || user.username || t('common.guest')) : '';
  const isSection = path => location.pathname === path || location.pathname.startsWith(`${path}/`);

  return <header className="site-header" ref={headerRef}>
    <div className="header-left">
      <Brand />
      <span className="header-tagline private-badge"><AudioLines size={14} aria-hidden="true" /> <span>{t('common.tagline')}</span></span>
    </div>
    <button type="button" className="icon-btn header-menu-toggle" ref={menuButtonRef} aria-expanded={menuOpen} aria-controls={panelId} aria-label={t(menuOpen ? 'common.closeMenu' : 'common.openMenu')} onClick={() => setMenuOpen(open => !open)}>
      {menuOpen ? <X size={23} aria-hidden="true" /> : <Menu size={23} aria-hidden="true" />}
    </button>
    <div id={panelId} ref={panelRef} className="header-right" data-open={menuOpen} onClick={event => { if (event.target.closest('a[href]')) closeMenu(); }}>
      <nav className="header-navigation" aria-label={t('common.navigation')}>
        <CommunityNavigation />
        {user?.is_admin && <Link className="header-guide-btn" to="/admin" aria-current={isSection('/admin') ? 'page' : undefined} aria-label={t('common.adminNav')} title={t('common.adminNav')}><ShieldCheck size={19} aria-hidden="true" /><span className="header-action-label">{t('common.adminNav')}</span></Link>}
        <Link className="header-guide-btn" to="/guide" aria-current={isSection('/guide') ? 'page' : undefined} aria-label={t('guide.nav')} title={t('guide.nav')}><BookOpen size={19} aria-hidden="true" /><span className="header-action-label">{t('guide.nav')}</span></Link>
      </nav>
      <div className="header-lang-group" onChange={closeMenu}><LanguageSelector /></div>
      <div className="header-divider" aria-hidden="true" />
      {user ? <div className="header-user-group">
        <span className="user-chip" title={displayName}>
          <span className="avatar" aria-hidden="true">{displayName[0]?.toUpperCase()}</span>
          <span className="user-name">{displayName}</span>
        </span>
        {user.is_guest ? <Link className="text-button" to="/login" state={loginState}>{t('auth.login')}</Link> : <button type="button" className="icon-btn header-action-btn" aria-label={t('common.settings')} title={t('common.settings')} ref={settingsButtonRef} onClick={openSettings}><Settings size={18} aria-hidden="true" /><span className="header-action-label">{t('common.settings')}</span></button>}
        <button type="button" className="icon-btn header-action-btn" aria-label={t('common.logout')} title={t('common.logout')} disabled={loggingOut} aria-busy={loggingOut} onClick={signOut}><LogOut size={18} aria-hidden="true" /><span className="header-action-label">{t('common.logout')}</span></button>
      </div> : <Link className="text-button" to="/login" state={loginState}>{t('auth.login')}</Link>}
    </div>
    {error && <span role="alert" className="header-error">{localizeError(error)}</span>}
    {settingsOpen && user && !user.is_guest && <AccountSettings user={user} onSaved={setUser} onClose={closeSettings} />}
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
    <Link className="btn btn-secondary full-width mt-5" to="/change-password" onClick={onClose}>{t('common.changePassword')}</Link>
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
