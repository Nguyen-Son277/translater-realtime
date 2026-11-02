import { KeyRound } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Header } from '../components';
import { PasswordForm } from '../components/PasswordForm';
import { useI18n } from '../i18n';

export function ChangePasswordPage() {
  const { t } = useI18n();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const mustChange = Boolean(user?.must_change_password);
  const done = account => {
    setUser(account);
    navigate('/', { replace: true });
  };
  if (user?.is_guest) return <Navigate to="/" replace />;
  return <div className="admin-shell password-shell">
    <Header />
    <main className="admin-main password-main">
      <section className="password-section">
        <header className="password-heading">
          <span className="password-icon" aria-hidden="true"><KeyRound size={24} /></span>
          <div>
            <h1>{t('password.title')}</h1>
            <p className="muted">{t('password.subtitle')}</p>
          </div>
        </header>
        {mustChange && <p className="password-notice" role="status">{t('password.mustChangeIntro')}</p>}
        <PasswordForm submitLabel={t('password.submit')} onSuccess={done} onCancel={mustChange ? undefined : () => navigate('/')} />
        {!mustChange && <p className="password-back"><Link className="text-button" to="/">{t('password.backHome')}</Link></p>}
      </section>
    </main>
  </div>;
}
