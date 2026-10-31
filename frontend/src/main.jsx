import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './auth';
import { I18nProvider, useI18n } from './i18n';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { JoinPage } from './pages/JoinPage';
import { RoomPage } from './pages/RoomPage';
import './styles.css';

function NotFoundPage() {
  const { t } = useI18n();
  return <div className="page-loading"><h1>{t('common.notFoundPage')}</h1><a href="/">{t('common.backHome')}</a></div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter><I18nProvider><AuthProvider><Routes>
    <Route path="/login" element={<AuthPage />} />
    <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
    <Route path="/join" element={<RequireAuth><JoinPage /></RequireAuth>} />
    <Route path="/rooms/:roomId" element={<RequireAuth><RoomPage /></RequireAuth>} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes></AuthProvider></I18nProvider></BrowserRouter></React.StrictMode>,
);
