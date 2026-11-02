import { ArrowRight, Link2, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
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
  const [joinedRoom, setJoinedRoom] = useState(null);
  const { reload, loading } = useAuth();
  const navigate = useNavigate();
  const join = async event => {
    event.preventDefault();
    if (busy || loading) return;
    setBusy(true); setError('');
    try {
      // If refreshing the session fails, retry it without redeeming the one-use invite again.
      const room = joinedRoom || await api('/rooms/join', { method: 'POST', body: { token: inviteToken(value) } });
      setJoinedRoom(room);
      await reload({ throwOnError: true });
      navigate(`/rooms/${room.id}`, { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <div><Header /><main className="join-main"><div className="join-icon"><UsersRound size={32} /></div><span className="section-kicker">{t('join.kicker')}</span><h1>{t('join.headingOne')}<br /><em>{t('join.headingTwo')}</em></h1><p className="muted">{t('join.introOne')}<br />{t('join.introTwo')}</p><form onSubmit={join}><label htmlFor="join-token" className="field-label"><Link2 size={15} /> {t('join.inputLabel')}</label><input id="join-token" value={value} onChange={event => setValue(event.target.value)} required disabled={busy || !!joinedRoom} placeholder={t('join.placeholder')} />{error && <p className="form-error" role="alert">{localizeError(error)}</p>}<button className="btn btn-primary full-width mt-5" disabled={busy || loading}>{busy ? <span className="spinner" /> : <>{t(joinedRoom ? 'join.resume' : 'join.submit')} <ArrowRight size={18} /></>}</button></form><Link className="text-button" to="/">{t('join.backHome')}</Link></main></div>;
}
