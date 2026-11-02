import { ArrowRight, ArrowUpRight, AudioLines, Eye, EyeOff, Globe2, LockKeyhole, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Brand } from '../components';
import { useI18n, LanguageSelector } from '../i18n';

export function AuthPage() {
  const { t, localizeError } = useI18n();
  const { user, setUser, loading } = useAuth();
  const [register, setRegister] = useState(false);
  const [visible, setVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from?.startsWith('/') && !location.state.from.startsWith('//') ? location.state.from : '/';
  if (!loading && user && !user.is_guest) return <Navigate to={user.must_change_password ? '/change-password' : from} replace />;
  const submit = async event => {
    event.preventDefault(); setError('');
    const form = new FormData(event.currentTarget);
    if (register && form.get('password') !== form.get('password_confirmation')) {
      setError('Mật khẩu nhập lại chưa khớp.');
      return;
    }
    setBusy(true);
    try {
      const account = await api(`/auth/${register ? 'register' : 'login'}`, {
        method: 'POST', body: register
          ? {
              username: form.get('username'), name: form.get('name'), email: form.get('email'),
              password: form.get('password'), password_confirmation: form.get('password_confirmation'),
            }
          : { username: form.get('username'), password: form.get('password') },
      });
      setUser(account); navigate(account.must_change_password ? '/change-password' : from, { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <main className="auth-layout">
    <section className="auth-story">
      <Brand />
      <div className="auth-story-content">
        <span className="eyebrow"><span className="status-dot" /> {t('auth.eyebrow')}</span>
        <h1>{t('auth.headingOne')}<br />{t('auth.headingTwo')}<br /><em>{t('auth.headingThree')}</em></h1>
        <p>{t('auth.storyOne')}<br />{t('auth.storyTwo')}</p>
        <div className="story-dialogue">
          <div className="story-message story-a"><span className="mini-avatar">A</span><div><small>TIẾNG VIỆT</small><strong>Rất vui được gặp bạn!</strong></div><ArrowUpRight size={20} /></div>
          <div className="story-connector"><AudioLines size={23} /><span>{t('auth.connector')}</span></div>
          <div className="story-message story-b"><span className="mini-avatar">B</span><div><small>ENGLISH</small><strong>It's lovely to meet you!</strong></div><Sparkles size={18} /></div>
        </div>
      </div>
      <div className="story-footer"><Globe2 size={16} /><span>{t('auth.features')}</span></div>
    </section>
    <section className="auth-form-side">
      <div className="auth-mobile-brand"><Brand /></div>
      <div className="auth-form-wrap">
        <div className="auth-lang-row"><Link className="text-button" to="/guide">{t('guide.nav')}</Link><LanguageSelector /></div>
        <span className="section-kicker">{t('auth.welcome')}</span>
        <h2>{register ? t('auth.registerTitle') : t('auth.loginTitle')}</h2>
        <p className="muted">{register ? t('auth.registerIntro') : t('auth.loginIntro')}</p>
        <div className="auth-tabs" role="tablist" aria-label={t('auth.account')}>
          <button role="tab" aria-selected={!register} className={!register ? 'active' : ''} disabled={busy} onClick={() => { setRegister(false); setError(''); }}>{t('auth.login')}</button>
          <button role="tab" aria-selected={register} className={register ? 'active' : ''} disabled={busy} onClick={() => { setRegister(true); setError(''); }}>{t('auth.register')}</button>
        </div>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="username">{t('common.username')}</label>
          <input id="username" name="username" placeholder={t('auth.usernamePlaceholder')} autoComplete="username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_.\-]{3,32}" spellCheck={false} autoCapitalize="none" />
          {register && <>
            <label className="field-label" htmlFor="name">{t('auth.name')}</label>
            <input id="name" name="name" placeholder={t('auth.namePlaceholder')} autoComplete="name" required minLength={1} maxLength={100} />
            <label className="field-label" htmlFor="email">{t('common.email')}</label>
            <input id="email" name="email" type="email" placeholder="ban@example.com" autoComplete="email" required maxLength={254} />
          </>}
          <label className="field-label" htmlFor="password">{t('auth.password')} <small>{t('auth.passwordMin')}</small></label>
          <div className="password-input"><input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} placeholder={t('auth.passwordPlaceholder')} minLength={8} maxLength={128} required />
            <button className="icon-btn" type="button" onClick={() => setVisible(!visible)} aria-label={visible ? t('auth.passwordHide') : t('auth.passwordShow')}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          {register && <>
            <label className="field-label" htmlFor="password_confirmation">{t('auth.confirm')}</label>
            <div className="password-input"><input id="password_confirmation" name="password_confirmation" type={confirmationVisible ? 'text' : 'password'} autoComplete="new-password" placeholder={t('auth.confirm')} minLength={8} maxLength={128} required />
              <button className="icon-btn" type="button" onClick={() => setConfirmationVisible(!confirmationVisible)} aria-label={confirmationVisible ? t('auth.confirmHide') : t('auth.confirmShow')}>{confirmationVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </>}
          {error && <p className="form-error" role="alert">{error === 'Mật khẩu nhập lại chưa khớp.' ? t('auth.passwordMismatch') : localizeError(error)}</p>}
          <button className="btn btn-primary auth-submit" disabled={busy || loading}>{busy ? <span className="spinner" /> : <>{register ? t('auth.register') : t('auth.login')}<ArrowRight size={18} /></>}</button>
        </form>
        <div className="auth-note"><LockKeyhole size={16} /><span>{t('auth.privacyOne')}<br />{t('auth.privacyTwo')}</span></div>
      </div>
      <p className="auth-bottom">{t('auth.bottom')}</p>
    </section>
  </main>;
}
