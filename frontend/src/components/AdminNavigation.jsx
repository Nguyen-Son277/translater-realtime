import { NavLink } from 'react-router-dom';
import { useI18n } from '../i18n';

export function AdminNavigation() {
  const { t } = useI18n();
  return <nav className="admin-navigation" aria-label={t('admin.navigation')}>
    <NavLink to="/admin" end>{t('admin.accountsNav')}</NavLink>
    <NavLink to="/admin/settings">{t('admin.settingsNav')}</NavLink>
    <NavLink to="/admin/feedback">{t('community.feedback')}</NavLink>
    <NavLink to="/admin/support">{t('community.support')}</NavLink>
  </nav>;
}
