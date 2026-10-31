import { ArrowRight, Link2, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Header } from '../components';
import { useI18n } from '../i18n';
import { inviteToken } from './Dashboard';

export function JoinPage() {
  const { t, localizeError } = useI18n();
  const location = useLocation();
  const initial = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const join = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const room = await api('/rooms/join', { method: 'POST', body: { token: inviteToken(value) } });
      navigate(`/rooms/${room.id}`, { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <div><Header /><main className="join-main"><div className="join-icon"><UsersRound size={32} /></div><span className="section-kicker">{t('join.kicker')}</span><h1>{t('join.headingOne')}<br /><em>{t('join.headingTwo')}</em></h1><p className="muted">{t('join.introOne')}<br />{t('join.introTwo')}</p><form onSubmit={join}><label htmlFor="join-token" className="field-label"><Link2 size={15} /> {t('join.inputLabel')}</label><input id="join-token" value={value} onChange={event => setValue(event.target.value)} required placeholder={t('join.placeholder')} />{error && <p className="form-error" role="alert">{localizeError(error)}</p>}<button className="btn btn-primary full-width mt-5" disabled={busy}>{busy ? <span className="spinner" /> : <>{t('join.submit')} <ArrowRight size={18} /></>}</button></form><Link className="text-button" to="/">{t('join.backHome')}</Link></main></div>;
}
