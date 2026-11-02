import { Eye, EyeOff, KeyRound, Lock, Search, ShieldOff, Trash2, Unlock } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Header, Modal } from '../components';
import { useI18n } from '../i18n';

const PAGE_SIZE = 25;

function ConfirmAccountModal({ type, account, onClose, onDone }) {
  const { t, localizeError } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const config = {
    lock: {
      title: t('admin.lockModalTitle'),
      body: t('admin.lockModalBody', { username: account.username }),
      confirm: t('admin.confirmLock'),
      className: '',
    },
    unlock: {
      title: t('admin.unlockModalTitle'),
      body: t('admin.unlockModalBody', { username: account.username }),
      confirm: t('admin.confirmUnlock'),
      className: '',
    },
    delete: {
      title: t('admin.deleteModalTitle'),
      body: t('admin.deleteModalBody', { username: account.username }),
      confirm: t('admin.confirmDelete'),
      className: 'btn-danger',
    },
  }[type];
  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (type === 'delete') await api(`/admin/accounts/${account.id}`, { method: 'DELETE' });
      else await api(`/admin/accounts/${account.id}`, { method: 'PATCH', body: { is_active: type === 'unlock' } });
      onDone();
    } catch (err) {
      setError(localizeError(err));
      setBusy(false);
    }
  };
  return <Modal title={config.title} onClose={busy ? () => {} : onClose}>
    <p className="muted modal-intro">{config.body}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions">
      <button className="btn btn-secondary" type="button" onClick={onClose} disabled={busy}>{t('admin.cancel')}</button>
      <button className={`btn ${config.className || 'btn-primary'}`} type="button" onClick={submit} disabled={busy}>{busy ? <span className="spinner" /> : null}{config.confirm}</button>
    </div>
  </Modal>;
}

function ResetPasswordModal({ account, onClose, onDone }) {
  const { t, localizeError } = useI18n();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setBusy(true);
    try {
      await api(`/admin/accounts/${account.id}/password`, {
        method: 'POST',
        body: { new_password: newPassword, new_password_confirmation: confirmPassword },
      });
      onDone();
    } catch (err) {
      setError(localizeError(err));
      setBusy(false);
    }
  };
  return <Modal title={t('admin.resetModalTitle', { username: account.username })} onClose={busy ? () => {} : onClose}>
    <p className="muted modal-intro">{t('admin.resetModalIntro')}</p>
    <form onSubmit={submit}>
      <label className="field-label" htmlFor="admin-reset-password">{t('admin.resetNewPassword')}</label>
      <div className="password-input">
        <input id="admin-reset-password" name="new_password" type={visible ? 'text' : 'password'} value={newPassword} onChange={event => { setNewPassword(event.target.value); setError(''); }} placeholder={t('password.newPlaceholder')} autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy} />
        <button type="button" className="icon-btn" onClick={() => setVisible(value => !value)} aria-label={visible ? t('auth.passwordHide') : t('auth.passwordShow')} aria-pressed={visible}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
      </div>
      <label className="field-label" htmlFor="admin-reset-confirm">{t('admin.resetConfirmPassword')}</label>
      <div className="password-input">
        <input id="admin-reset-confirm" name="new_password_confirmation" type={visible ? 'text' : 'password'} value={confirmPassword} onChange={event => { setConfirmPassword(event.target.value); setError(''); }} placeholder={t('password.confirmPlaceholder')} autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy} />
        <button type="button" className="icon-btn" onClick={() => setVisible(value => !value)} aria-label={visible ? t('auth.passwordHide') : t('auth.passwordShow')} aria-pressed={visible}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button className="btn btn-secondary" type="button" onClick={onClose} disabled={busy}>{t('admin.cancel')}</button>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : null}{t('admin.confirmReset')}</button>
      </div>
    </form>
  </Modal>;
}

export function AdminAccountsPage() {
  const { t, formatLocale, localizeError } = useI18n();
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const update = () => setCompact(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState(null);
  const requestRef = useRef(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = queryInput.trim();
      if (query !== next) {
        setPage(1);
        setQuery(next);
        setSuccess('');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput, query]);
  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (query) params.set('query', query);
      params.set('role', role);
      params.set('status', status);
      params.set('page', String(page));
      params.set('page_size', String(PAGE_SIZE));
      const data = await api(`/admin/accounts?${params.toString()}`);
      if (request !== requestRef.current) return;
      const items = Array.isArray(data?.items) ? data.items : [];
      const nextTotal = Number(data?.total) || 0;
      setAccounts(items);
      setTotal(nextTotal);
      const pages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
      if (page > pages) setPage(pages);
    } catch (err) {
      if (request !== requestRef.current) return;
      setError(err.message);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [query, role, status, page]);
  useEffect(() => {
    load();
    return () => { requestRef.current += 1; };
  }, [load]);
  useEffect(() => { if (modal) setSuccess(''); }, [modal]);
  const closeModal = useCallback(() => setModal(null), []);
  const finishAction = useCallback(() => {
    setModal(null);
    setSuccess(t('admin.actionSuccess'));
    load();
  }, [load, t]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtering = Boolean(query) || role !== 'all' || status !== 'all';
  const roleLabel = account => (account.is_admin ? t('admin.filterRoleAdmin') : account.is_guest ? t('admin.filterRoleGuest') : t('admin.filterRoleUser'));
  const createdLabel = value => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(formatLocale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  };
  const renderBadges = account => <span className="admin-badges">
    {account.is_admin && <span className="admin-badge admin-badge-admin">{t('admin.badgeAdmin')}</span>}
    {account.is_guest && <span className="admin-badge admin-badge-guest">{t('admin.badgeGuest')}</span>}
  </span>;
  const renderStatus = account => <span className="admin-status">
    <span className={`admin-badge ${account.is_active ? 'admin-badge-active' : 'admin-badge-locked'}`}>{account.is_active ? t('admin.badgeActive') : t('admin.badgeLocked')}</span>
    {account.must_change_password && <span className="admin-badge admin-badge-must-change">{t('admin.badgeMustChange')}</span>}
  </span>;
  const renderActions = account => account.is_admin
    ? <span className="admin-forbidden" title={t('admin.selfActionForbidden')}>
        <ShieldOff size={18} aria-hidden="true" /><span>{t('admin.selfActionForbidden')}</span>
      </span>
    : <div className="admin-actions">
        <button className="btn btn-secondary btn-small" type="button" onClick={() => setModal({ type: account.is_active ? 'lock' : 'unlock', account })}>
          {account.is_active ? <Lock size={17} aria-hidden="true" /> : <Unlock size={17} aria-hidden="true" />}
          {account.is_active ? t('admin.lockAccount') : t('admin.unlockAccount')}
        </button>
        {!account.is_guest && <button className="btn btn-secondary btn-small" type="button" onClick={() => setModal({ type: 'reset', account })}>
          <KeyRound size={17} aria-hidden="true" />{t('admin.resetPassword')}
        </button>}
        <button className="btn btn-danger btn-small" type="button" onClick={() => setModal({ type: 'delete', account })}>
          <Trash2 size={17} aria-hidden="true" />{t('admin.deleteAccount')}
        </button>
      </div>;
  const renderIdentity = account => <div className="admin-identity">
    <strong className="admin-identity-name">{account.name || account.username}</strong>
    <span className="admin-username">@{account.username}</span>
    {renderBadges(account)}
  </div>;
  const content = () => {
    if (loading) return <div className="admin-loading"><span className="spinner" /> {t('admin.loading')}</div>;
    if (error) return <div className="alert" role="alert">{localizeError(error)}<button className="text-button" type="button" onClick={load}>{t('common.retry')}</button></div>;
    if (!accounts.length) return <p className="admin-empty">{filtering ? t('admin.emptyFilter') : t('admin.empty')}</p>;
    return <>
      {!compact && <div className="admin-table-wrap">
        <table className="admin-table">
          <caption className="sr-only">{t('admin.title')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('admin.colUser')}</th>
              <th scope="col">{t('admin.colEmail')}</th>
              <th scope="col">{t('admin.colRole')}</th>
              <th scope="col">{t('admin.colStatus')}</th>
              <th scope="col">{t('admin.colCreated')}</th>
              <th scope="col">{t('admin.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(account => <tr key={account.id}>
              <td data-label={t('admin.colUser')}>{renderIdentity(account)}</td>
              <td data-label={t('admin.colEmail')}><span className="admin-email">{account.email || t('admin.noEmail')}</span></td>
              <td data-label={t('admin.colRole')}>{roleLabel(account)}</td>
              <td data-label={t('admin.colStatus')}>{renderStatus(account)}</td>
              <td data-label={t('admin.colCreated')}>{createdLabel(account.created_at)}</td>
              <td data-label={t('admin.colActions')}>{renderActions(account)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>}
      {compact && <ul className="admin-cards">
        {accounts.map(account => <li key={account.id}>
          <article className="admin-card">
            <div className="admin-card-head">{renderIdentity(account)}</div>
            <dl className="admin-card-fields">
              <div><dt>{t('admin.colEmail')}</dt><dd>{account.email || t('admin.noEmail')}</dd></div>
              <div><dt>{t('admin.colRole')}</dt><dd>{roleLabel(account)}</dd></div>
              <div><dt>{t('admin.colStatus')}</dt><dd>{renderStatus(account)}</dd></div>
              <div><dt>{t('admin.colCreated')}</dt><dd>{createdLabel(account.created_at)}</dd></div>
              <div className="admin-card-actions"><dt>{t('admin.colActions')}</dt><dd>{renderActions(account)}</dd></div>
            </dl>
          </article>
        </li>)}
      </ul>}
    </>;
  };
  return <div className="admin-shell">
    <Header />
    <main className="admin-main">
      <header className="admin-heading">
        <h1>{t('admin.title')}</h1>
        <p className="muted">{t('admin.subtitle')}</p>
      </header>
      {success && <p className="form-success" role="status">{success}</p>}
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={19} aria-hidden="true" />
          <input type="search" maxLength={100} value={queryInput} onChange={event => setQueryInput(event.target.value)} aria-label={t('admin.searchLabel')} placeholder={t('admin.searchPlaceholder')} />
        </div>
        <div className="admin-filters">
          <select aria-label={t('admin.colRole')} value={role} onChange={event => { setRole(event.target.value); setPage(1); }}>
            <option value="all">{t('admin.filterRoleAll')}</option>
            <option value="admin">{t('admin.filterRoleAdmin')}</option>
            <option value="user">{t('admin.filterRoleUser')}</option>
            <option value="guest">{t('admin.filterRoleGuest')}</option>
          </select>
          <select aria-label={t('admin.colStatus')} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
            <option value="all">{t('admin.filterStatusAll')}</option>
            <option value="active">{t('admin.filterStatusActive')}</option>
            <option value="locked">{t('admin.filterStatusLocked')}</option>
          </select>
        </div>
      </div>
      <section className="admin-results" aria-busy={loading}>{content()}</section>
      {!loading && !error && accounts.length > 0 && <footer className="admin-pagination">
        <p className="admin-total">{t('admin.totalAccounts', { total })}</p>
        <div className="admin-page-controls">
          <button className="btn btn-secondary btn-small" type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1}>{t('admin.prevPage')}</button>
          <span className="admin-page-indicator">{t('admin.pageIndicator', { page, pages })}</span>
          <button className="btn btn-secondary btn-small" type="button" onClick={() => setPage(current => Math.min(pages, current + 1))} disabled={page >= pages}>{t('admin.nextPage')}</button>
        </div>
      </footer>}
    </main>
    {modal?.type === 'reset' && <ResetPasswordModal account={modal.account} onClose={closeModal} onDone={finishAction} />}
    {modal && modal.type !== 'reset' && <ConfirmAccountModal type={modal.type} account={modal.account} onClose={closeModal} onDone={finishAction} />}
  </div>;
}
