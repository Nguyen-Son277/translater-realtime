import { ArrowDownUp, ArrowRight, AudioLines, Clock3, Globe2, Link2, MessageCircleMore, Plus, Smartphone, Trash2, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, LANGUAGES } from '../api';
import { useAuth } from '../auth';
import { Header, Modal } from '../components';
import { useI18n } from '../i18n';

function CreateRoom({ onClose }) {
  const { t, localizeError } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState('shared');
  const [a, setA] = useState('vi');
  const [b, setB] = useState('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const form = new FormData(event.currentTarget);
      const room = await api('/rooms', { method: 'POST', body: { title: form.get('title'), mode, language_a: a, language_b: b } });
      navigate(`/rooms/${room.id}`);
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return <Modal title={t('dashboard.createTitle')} onClose={onClose}>
    <p className="muted modal-intro">{t('dashboard.createIntro')}</p>
    <form onSubmit={submit}>
      <fieldset className="mode-options"><legend className="field-label">{t('dashboard.deviceQuestion')}</legend>
        {[['shared', Smartphone, t('dashboard.shared'), t('dashboard.sharedHint')], ['remote', UsersRound, t('dashboard.remote'), t('dashboard.remoteHint')]].map(([value, Icon, title, description]) =>
          <label key={value} className={`mode-option ${mode === value ? 'selected' : ''}`}><input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} /><Icon size={23} /><strong>{title}</strong><small>{description}</small><span className="radio-indicator" /></label>)}
      </fieldset>
      <label className="field-label" htmlFor="room-title">{t('dashboard.title')} <small>{t('dashboard.optional')}</small></label>
      <input id="room-title" name="title" placeholder={t('dashboard.titlePlaceholder')} maxLength={100} />
      <div className="language-pair-select">
        <label><span className="field-label">{t('dashboard.personA')}</span><select aria-label={t('dashboard.languageA')} value={a} onChange={event => setA(event.target.value)}>{Object.keys(LANGUAGES).map(code => <option key={code} value={code}>{t(`common.language.${code}`)}</option>)}</select></label>
        <button className="icon-btn swap-languages" type="button" aria-label={t('dashboard.swap')} onClick={() => { setA(b); setB(a); }}><ArrowDownUp size={18} /></button>
        <label><span className="field-label">{t('dashboard.personB')}</span><select aria-label={t('dashboard.languageB')} value={b} onChange={event => setB(event.target.value)}>{Object.keys(LANGUAGES).map(code => <option key={code} value={code}>{t(`common.language.${code}`)}</option>)}</select></label>
      </div>
      {a === b && <p className="form-error">{t('dashboard.differentLanguages')}</p>}
      {error && <p role="alert" className="form-error">{localizeError(error)}</p>}
      <button className="btn btn-primary full-width" disabled={busy || a === b}>{busy ? <span className="spinner" /> : <>{t('dashboard.start')} <ArrowRight size={18} /></>}</button>
      <p className="form-footnote">{t('dashboard.startHint')}</p>
    </form>
  </Modal>;
}

export function inviteToken(value) {
  try { return new URLSearchParams(new URL(value).hash.slice(1)).get('token') || value.trim(); }
  catch { return value.trim(); }
}

function JoinModal({ onClose }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return <Modal title={t('dashboard.joinTitle')} onClose={onClose}>
    <p className="muted modal-intro">{t('dashboard.joinIntro')}</p>
    <form onSubmit={event => { event.preventDefault(); const token = inviteToken(new FormData(event.currentTarget).get('invite')); navigate(`/join#token=${encodeURIComponent(token)}`); }}>
      <label className="field-label" htmlFor="invite">{t('dashboard.invite')}</label><input id="invite" name="invite" required placeholder={t('dashboard.invitePlaceholder')} />
      <button className="btn btn-primary full-width mt-5">{t('dashboard.continue')} <ArrowRight size={18} /></button>
    </form>
  </Modal>;
}

export function Dashboard() {
  const { t, formatLocale, localizeError } = useI18n();
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState('');
  const close = useCallback(() => setModal(null), []);
  const load = useCallback(() => {
    setError(''); setLoading(true);
    api('/rooms').then(setRooms).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  const remove = async () => {
    setDeleting(true); setError('');
    try { await api(`/rooms/${modal.room.id}`, { method: 'DELETE' }); setRooms(current => current.filter(room => room.id !== modal.room.id)); close(); }
    catch (err) { setError(err.message); }
    finally { setDeleting(false); }
  };
  const filtered = rooms.filter(room => room.title.toLowerCase().includes(query.toLowerCase()));
  return <div className="dashboard-shell">
    <Header />
    <main className="dashboard-main">
      <section className="welcome-section">
        <div className="welcome-copy"><span className="eyebrow"><span className="status-dot" /> {t('dashboard.eyebrow')}</span>
          <h1>{t('dashboard.heading')}<br /><em>{t('dashboard.headingEmphasis')}</em></h1>
          <p>{t('dashboard.greeting', { name: user.name || user.username })}</p>
          <div className="welcome-actions"><button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}><Plus size={19} /> {t('dashboard.create')}</button><button className="btn btn-secondary" onClick={() => setModal({ type: 'join' })}><Link2 size={18} /> {t('dashboard.join')}</button></div>
        </div>
        <div className="welcome-art" aria-hidden="true"><div className="art-orbit" /><span className="art-language art-lang-top">你好</span><span className="art-language art-lang-bottom">안녕하세요</span><div className="art-card art-card-a"><span className="art-avatar">A</span><div><small>TIẾNG VIỆT</small><strong>Chào bạn, mình là An.</strong></div><span className="art-dot" /></div><div className="art-bridge"><AudioLines size={27} /></div><div className="art-card art-card-b"><span className="art-avatar">B</span><div><small>ENGLISH</small><strong>Hi, I'm An. Nice to meet you.</strong></div></div><span className="art-caption"><span /> {t('dashboard.artCaption')}</span></div>
      </section>
      <div className="feature-strip"><span><AudioLines size={17} /> {t('dashboard.featureLive')}</span><span><Smartphone size={17} /> {t('dashboard.featureDevices')}</span><span><Globe2 size={17} /> {t('dashboard.featureLanguages')}</span></div>
      <section className="history-section">
        <div className="section-heading"><div><span className="section-kicker">{t('dashboard.historyKicker')}</span><h2>{t('dashboard.historyTitle')} <span className="count-badge">{rooms.length}</span></h2></div>{rooms.length > 0 && <input className="search-input" aria-label={t('dashboard.searchLabel')} placeholder={t('dashboard.searchPlaceholder')} value={query} onChange={event => setQuery(event.target.value)} />}</div>
        {error && <div className="alert" role="alert">{localizeError(error)}<button className="text-button" onClick={load}>{t('dashboard.retry')}</button></div>}
        {loading ? <div className="history-loading"><span className="spinner" /> {t('dashboard.loading')}</div> : filtered.length ? <div className="room-grid">{filtered.map(room => <article className="room-card" key={room.id}>
          <Link to={`/rooms/${room.id}`} className="room-card-link"><div className="room-card-top"><span className={`room-mode-icon ${room.mode}`}>{room.mode === 'shared' ? <Smartphone size={22} /> : <UsersRound size={22} />}</span><span className="mode-label">{room.mode === 'shared' ? t('dashboard.sharedBadge') : t('dashboard.remoteBadge')}</span><ArrowRight size={18} className="room-arrow" /></div><h3>{room.title}</h3><div className="room-language-pair"><span>{t(`common.language.${room.language_a}`)}</span><ArrowDownUp size={13} /><span>{t(`common.language.${room.language_b}`)}</span></div><div className="room-card-bottom"><span><Clock3 size={13} />{new Intl.DateTimeFormat(formatLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(room.updated_at))}</span><span>{room.members.length === 2 ? t('dashboard.twoPeople') : room.mode === 'shared' ? t('dashboard.direct') : t('dashboard.waiting')}</span></div></Link>
          {room.owner_id === user.id && <button className="delete-room icon-btn" aria-label={t('dashboard.deleteNamed', { name: room.title })} title={t('dashboard.delete')} onClick={() => setModal({ type: 'delete', room })}><Trash2 size={16} /></button>}
        </article>)}</div> : <div className="history-empty"><span className="history-empty-icon"><MessageCircleMore size={27} /></span><div><h3>{query ? t('dashboard.notFound') : t('dashboard.empty')}</h3><p>{query ? t('dashboard.searchHint') : t('dashboard.emptyHint')}</p></div>{!query && <button className="icon-btn" aria-label={t('dashboard.createFirst')} onClick={() => setModal({ type: 'create' })}><Plus size={21} /></button>}</div>}
      </section>
      <footer className="dashboard-footer"><span>songngữ.</span><p>{t('dashboard.footer')}</p><span className="footer-indicator"><span /> {t('dashboard.audioPrivacy')}</span></footer>
    </main>
    {modal?.type === 'create' && <CreateRoom onClose={close} />}
    {modal?.type === 'join' && <JoinModal onClose={close} />}
    {modal?.type === 'delete' && <Modal title={t('dashboard.deleteTitle')} onClose={close}><p className="muted modal-intro">{t('dashboard.deleteDescription', { name: modal.room.title })}</p>{error && <p className="form-error" role="alert">{localizeError(error)}</p>}<div className="modal-actions"><button className="btn btn-secondary" onClick={close}>{t('dashboard.keep')}</button><button className="btn btn-danger" onClick={remove} disabled={deleting}>{deleting ? t('dashboard.deleting') : t('dashboard.delete')}</button></div></Modal>}
  </div>;
}
