import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './auth';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { JoinPage } from './pages/JoinPage';
import { RoomPage } from './pages/RoomPage';
import { TranslationSettings } from './pages/TranslationSettings';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<AuthPage />} />
    <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
    <Route path="/join" element={<RequireAuth><JoinPage /></RequireAuth>} />
    <Route path="/settings/translation" element={<RequireAuth><TranslationSettings /></RequireAuth>} />
    <Route path="/rooms/:roomId" element={<RequireAuth><RoomPage /></RequireAuth>} />
    <Route path="*" element={<div className="page-loading"><h1>Không tìm thấy trang.</h1><a href="/">Về trang chủ</a></div>} />
  </Routes></AuthProvider></BrowserRouter></React.StrictMode>,
);
