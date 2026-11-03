import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, newClientId } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { CommunityLayout, FeedbackEntries, Pagination, ResourceState, useCommunityData } from '../components/Community';

export function FeedbackPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const resource = useCommunityData(`/feedback?page=${page}&page_size=20`);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const request = useRef(null);
  const submit = async event => {
    event.preventDefault();
    if (content.trim().length < 10 || content.trim().length > 2000) { setError('feedbackLength'); return; }
    const text = content.trim();
    if (!request.current || request.current.content !== text) request.current = { content: text, client_request_id: newClientId() };
    setBusy(true); setError(''); setSent(false);
    try {
      await api('/feedback', { method: 'POST', body: request.current });
      request.current = null; setContent(''); setSent(true); setPage(1); resource.reload();
    } catch (err) { setError(err.status === 429 ? 'rateLimited' : 'saveError'); }
    finally { setBusy(false); }
  };
  return <CommunityLayout title={t('community.feedback')} intro={t('community.feedbackIntro')}>
    <section className="community-card feedback-compose">
      <p id="feedback-public-notice" className="muted">{t('community.publicNotice')}</p>
      {!authLoading && (user && !user.is_guest ? <form onSubmit={submit} aria-busy={busy}>
        <label className="field-label" htmlFor="feedback-content">{t('community.feedbackLabel')}</label>
        <textarea id="feedback-content" value={content} onChange={event => { setContent(event.target.value); setSent(false); setError(''); }} required minLength={10} maxLength={2000} rows={5} disabled={busy} placeholder={t('community.feedbackPlaceholder')} aria-describedby="feedback-public-notice feedback-length" />
        <p id="feedback-length" className="field-help">{t('community.feedbackLength')} ({content.length}/2000)</p>
        <button className="btn btn-primary mt-5" disabled={busy}>{busy && <span className="spinner" />}{t('community.send')}</button>
      </form> : <div className="feedback-login"><p>{t('community.loginHint')}</p><Link className="btn btn-primary" to="/login" state={{ from: '/feedback' }}>{t('community.login')}</Link></div>)}
      {error && <p role="alert" className="form-error">{t(`community.${error}`)}</p>}
      {sent && <p role="status" className="form-success">{t('community.sent')}</p>}
    </section>
    <section aria-labelledby="feedback-list-title"><h2 id="feedback-list-title" className="community-section-title">{t('community.feedbackList')}</h2>
      <ResourceState resource={resource} />
      {resource.data && <><FeedbackEntries items={resource.data.items} /><Pagination data={resource.data} page={page} onPage={setPage} /></>}
    </section>
  </CommunityLayout>;
}

export function AdminFeedbackPage() {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(false);
  const resource = useCommunityData(`/admin/feedback?page=${page}&page_size=20&status=${status}`);
  const toggle = async item => {
    setBusy(item.id); setError(false);
    try {
      await api(`/admin/feedback/${item.id}`, { method: 'PATCH', body: { is_hidden: !item.is_hidden } });
      if (status !== 'all' && resource.data.items.length === 1 && page > 1) setPage(page - 1);
      else resource.reload();
    } catch { setError(true); }
    finally { setBusy(''); }
  };
  return <CommunityLayout admin title={t('community.feedback')} intro={t('community.adminFeedbackIntro')}>
    <label className="community-filter field-label">{t('community.filter')}<select value={status} disabled={Boolean(busy)} onChange={event => { setStatus(event.target.value); setPage(1); setError(false); }}>{['all', 'visible', 'hidden'].map(value => <option key={value} value={value}>{t(`community.${value}`)}</option>)}</select></label>
    {error && <p className="form-error" role="alert">{t('community.saveError')}</p>}
    <ResourceState resource={resource} />
    {resource.data && <><FeedbackEntries items={resource.data.items} action={item => <button className="btn btn-secondary btn-small" disabled={Boolean(busy)} onClick={() => toggle(item)}>{busy === item.id && <span className="spinner" />}{t(`community.${item.is_hidden ? 'show' : 'hide'}`)}</button>} /><Pagination data={resource.data} page={page} onPage={setPage} disabled={Boolean(busy)} /></>}
  </CommunityLayout>;
}
