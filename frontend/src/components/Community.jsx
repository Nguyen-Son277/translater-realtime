import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components';
import { AdminNavigation } from './AdminNavigation';
import { api } from '../api';
import { useI18n } from '../i18n';

export function useCommunityData(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false); setData(null);
    api(path).then(value => { if (active) setData(value); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, version]);
  return { data, loading, error, reload: () => setVersion(value => value + 1) };
}

export function CommunityLayout({ title, intro, admin = false, children }) {
  const { t } = useI18n();
  return <div className="community-shell"><Header /><main className="community-main">
    {admin ? <AdminNavigation /> : <Link className="text-link" to="/">← {t('common.backHome')}</Link>}
    <header className="community-heading"><h1>{title}</h1><p className="muted">{intro}</p></header>
    {children}
  </main></div>;
}

export function ResourceState({ resource }) {
  const { t } = useI18n();
  if (resource.loading) return <p className="community-loading" role="status"><span className="spinner" />{t('community.loading')}</p>;
  if (resource.error) return <div className="alert" role="alert">{t('community.loadError')}<button className="text-button" onClick={resource.reload}>{t('common.retry')}</button></div>;
  return null;
}

export function FeedbackEntries({ items, action }) {
  const { t, formatLocale } = useI18n();
  if (!items.length) return <p className="community-card muted">{t('community.empty')}</p>;
  return <div className="feedback-entries">{items.map(item => <article className="community-card feedback-entry" key={item.id}>
    <div className="feedback-meta"><strong>{item.author_name}</strong><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString(formatLocale, { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
    <p className="community-text">{item.content}</p>
    {action && <div className="feedback-moderation"><span className={`admin-badge ${item.is_hidden ? 'admin-badge-locked' : 'admin-badge-active'}`}>{t(`community.${item.is_hidden ? 'hidden' : 'visible'}`)}</span>{action(item)}</div>}
  </article>)}</div>;
}

export function Pagination({ data, page, onPage, disabled = false }) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(data.total / data.page_size));
  return <nav className="community-pagination" aria-label={t('community.feedbackList')}>
    <button className="btn btn-secondary btn-small" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>{t('community.previous')}</button>
    <span>{t('community.page', { page, pages })}</span>
    <button className="btn btn-secondary btn-small" disabled={disabled || page >= pages} onClick={() => onPage(page + 1)}>{t('community.next')}</button>
  </nav>;
}
