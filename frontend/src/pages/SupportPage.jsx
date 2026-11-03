import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { CommunityLayout, ResourceState, useCommunityData } from '../components/Community';

function QrImage({ url }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setFailed(false); setAttempt(0); }, [url]);
  const source = attempt && url && !url.startsWith('data:') ? `${url}${url.includes('?') ? '&' : '?'}retry=${attempt}` : url;
  return url && !failed ? <img className="support-qr" src={source} alt={t('community.qrAlt')} onError={() => setFailed(true)} /> : <div className="support-qr-empty muted"><p>{t(url ? 'community.loadError' : 'community.noQr')}</p>{url && <button type="button" className="text-button" onClick={() => { setAttempt(value => value + 1); setFailed(false); }}>{t('common.retry')}</button>}</div>;
}

export function SupportPage() {
  const { t } = useI18n();
  const resource = useCommunityData('/support');
  return <CommunityLayout title={t('community.support')} intro={t('community.supportIntro')}>
    <ResourceState resource={resource} />
    {resource.data && <section className="community-card support-card"><span className="support-heart" aria-hidden="true"><Heart size={30} /></span><p className="community-text support-message">{resource.data.content}</p><QrImage url={resource.data.qr_url} /><p className="muted">{t('community.supportNote')}</p></section>}
  </CommunityLayout>;
}

export function AdminSupportPage() {
  const { t } = useI18n();
  const resource = useCommunityData('/admin/support');
  return <CommunityLayout admin title={t('community.support')} intro={t('community.adminSupportIntro')}>
    <ResourceState resource={resource} />
    {resource.data && <SupportEditor key={resource.data.revision} initial={resource.data} onReload={resource.reload} />}
  </CommunityLayout>;
}

function SupportEditor({ initial, onReload }) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(initial);
  const [content, setContent] = useState(initial.content);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const pick = async event => {
    const file = event.target.files[0];
    setNotice(false); setError(''); setImage(null);
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('invalidImage'); event.target.value = ''; return; }
    setReading(true);
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
      });
      await new Promise((resolve, reject) => {
        const preview = new Image(); preview.onload = () => preview.width <= 4096 && preview.height <= 4096 ? resolve() : reject(); preview.onerror = reject; preview.src = data;
      });
      setImage(data);
    } catch { setError('invalidImage'); }
    finally { setReading(false); }
  };
  const save = async event => {
    event.preventDefault();
    if (!content.trim() || content.trim().length > 5000) { setError('contentLength'); return; }
    setBusy(true); setError(''); setNotice(false);
    try {
      const body = { content: content.trim(), revision: saved.revision };
      if (image) body.qr_base64 = image.split(',')[1];
      const data = await api('/admin/support', { method: 'PATCH', body });
      setSaved(data); setContent(data.content); setImage(null); setInputKey(value => value + 1); setNotice(true);
    } catch (err) { setError(err.status === 409 ? 'conflict' : err.status === 413 || err.status === 422 ? 'invalidImage' : 'saveError'); }
    finally { setBusy(false); }
  };
  const locked = busy || reading || error === 'conflict';
  return <section className="community-card"><form onSubmit={save} aria-busy={busy || reading}>
    <fieldset className="community-fieldset" disabled={locked}>
      <label className="field-label" htmlFor="support-content">{t('community.content')}</label>
      <textarea id="support-content" value={content} required maxLength={5000} rows={6} onChange={event => { setContent(event.target.value); setNotice(false); setError(''); }} />
      <label className="field-label" htmlFor="support-qr-upload">{t('community.qrUpload')}</label>
      <input key={inputKey} id="support-qr-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} aria-describedby="support-qr-help" />
      <p id="support-qr-help" className="field-help">{t('community.qrHelp')}</p>
      <h2 className="community-section-title">{t('community.preview')}</h2>
      <div className="support-preview"><p className="community-text">{content}</p><QrImage url={image || saved.qr_url} /></div>
      <button className="btn btn-primary mt-5" disabled={locked || (content === saved.content && !image)}>{(busy || reading) && <span className="spinner" />}{t('community.save')}</button>
    </fieldset>
    {error && <div role="alert" className="form-error">{t(`community.${error}`)}{error === 'conflict' && <button type="button" className="text-button" onClick={onReload}>{t('community.reload')}</button>}</div>}
    {notice && <p role="status" className="form-success">{t('community.saved')}</p>}
  </form></section>;
}
