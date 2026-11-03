import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAdmin, RequireAuth } from './auth';
import { I18nProvider, useI18n } from './i18n';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { AdminAccountsPage } from './pages/AdminAccountsPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { GuideArticlePage } from './pages/GuideArticlePage';
import { GuideIndexPage } from './pages/GuideIndexPage';
import { JoinPage } from './pages/JoinPage';
import { RoomPage } from './pages/RoomPage';
import { FeedbackPage, AdminFeedbackPage } from './pages/FeedbackPage';
import { SupportPage, AdminSupportPage } from './pages/SupportPage';
import { UpdatesPage } from './pages/UpdatesPage';
import './styles.css';
import './community.css';

function NotFoundPage() {
  const { t } = useI18n();
  return <div className="page-loading"><h1>{t('common.notFoundPage')}</h1><a href="/">{t('common.backHome')}</a></div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter><I18nProvider><AuthProvider><Routes>
    <Route path="/feedback" element={<FeedbackPage />} />
    <Route path="/updates" element={<UpdatesPage />} />
    <Route path="/support" element={<SupportPage />} />
    <Route path="/admin/feedback" element={<RequireAuth><RequireAdmin><AdminFeedbackPage /></RequireAdmin></RequireAuth>} />
    <Route path="/admin/support" element={<RequireAuth><RequireAdmin><AdminSupportPage /></RequireAdmin></RequireAuth>} />
    <Route path="/login" element={<AuthPage />} />
    <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
    <Route path="/admin" element={<RequireAuth><RequireAdmin><AdminAccountsPage /></RequireAdmin></RequireAuth>} />
    <Route path="/admin/settings" element={<RequireAuth><RequireAdmin><AdminSettingsPage /></RequireAdmin></RequireAuth>} />
    <Route path="/change-password" element={<RequireAuth><ChangePasswordPage /></RequireAuth>} />
    <Route path="/join" element={<JoinPage />} />
    <Route path="/guide" element={<GuideIndexPage />} />
    <Route path="/guide/:slug" element={<GuideArticlePage />} />
    <Route path="/rooms/:roomId" element={<RequireAuth><RoomPage /></RequireAuth>} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes></AuthProvider></I18nProvider></BrowserRouter></React.StrictMode>,
);
