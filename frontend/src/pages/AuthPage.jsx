import { ArrowRight, ArrowUpRight, AudioLines, Eye, EyeOff, Globe2, LockKeyhole, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Brand } from '../components';

export function AuthPage() {
  const { user, setUser, loading } = useAuth();
  const [register, setRegister] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from?.startsWith('/') && !location.state.from.startsWith('//') ? location.state.from : '/';
  if (!loading && user) return <Navigate to={from} replace />;
  const submit = async event => {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const account = await api(`/auth/${register ? 'register' : 'login'}`, {
        method: 'POST', body: { username: form.get('username'), password: form.get('password') },
      });
      setUser(account); navigate(from, { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <main className="auth-layout">
    <section className="auth-story">
      <Brand />
      <div className="auth-story-content">
        <span className="eyebrow"><span className="status-dot" /> KẾT NỐI BẰNG SỰ THẤU HIỂU</span>
        <h1>Hai ngôn ngữ.<br />Một cuộc<br /><em>trò chuyện.</em></h1>
        <p>Để ngôn ngữ trở thành cầu nối.<br />Nói tự nhiên, hiểu nhau ngay lúc này.</p>
        <div className="story-dialogue">
          <div className="story-message story-a"><span className="mini-avatar">A</span><div><small>TIẾNG VIỆT</small><strong>Rất vui được gặp bạn!</strong></div><ArrowUpRight size={20} /></div>
          <div className="story-connector"><AudioLines size={23} /><span>một lời chào, hai cách nói</span></div>
          <div className="story-message story-b"><span className="mini-avatar">B</span><div><small>ENGLISH</small><strong>It's lovely to meet you!</strong></div><Sparkles size={18} /></div>
        </div>
      </div>
      <div className="story-footer"><Globe2 size={16} /><span>8 ngôn ngữ · Hội thoại trực tiếp · Dữ liệu của bạn</span></div>
    </section>
    <section className="auth-form-side">
      <div className="auth-mobile-brand"><Brand /></div>
      <div className="auth-form-wrap">
        <span className="section-kicker">CHÀO MỪNG ĐẾN VỚI SONG NGỮ</span>
        <h2>{register ? 'Một khởi đầu mới.' : 'Tiếp nối câu chuyện.'}</h2>
        <p className="muted">{register ? 'Tạo tài khoản để bắt đầu và lưu lại hội thoại.' : 'Đăng nhập để bắt đầu trò chuyện theo cách của bạn.'}</p>
        <div className="auth-tabs" role="tablist" aria-label="Tài khoản">
          <button role="tab" aria-selected={!register} className={!register ? 'active' : ''} onClick={() => { setRegister(false); setError(''); }}>Đăng nhập</button>
          <button role="tab" aria-selected={register} className={register ? 'active' : ''} onClick={() => { setRegister(true); setError(''); }}>Tạo tài khoản</button>
        </div>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="username">Tên đăng nhập</label>
          <input id="username" name="username" placeholder="Tên của bạn" autoComplete="username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_.\-]{3,32}" spellCheck={false} autoCapitalize="none" />
          <label className="field-label" htmlFor="password">Mật khẩu <small>Ít nhất 8 ký tự</small></label>
          <div className="password-input"><input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} placeholder="Nhập mật khẩu" minLength={8} maxLength={128} required />
            <button className="icon-btn" type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary auth-submit" disabled={busy || loading}>{busy ? <span className="spinner" /> : <>{register ? 'Tạo tài khoản' : 'Đăng nhập'}<ArrowRight size={18} /></>}</button>
        </form>
        <div className="auth-note"><LockKeyhole size={16} /><span>Hội thoại chỉ hiển thị với người trong phòng.<br />Âm thanh được xử lý và không lưu lại.</span></div>
      </div>
      <p className="auth-bottom">Lắng nghe nhiều hơn. Hiểu nhau gần hơn.</p>
    </section>
  </main>;
}
