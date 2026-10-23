import { ArrowRight, Link2, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Header } from '../components';
import { inviteToken } from './Dashboard';

export function JoinPage() {
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
  return <div><Header /><main className="join-main"><div className="join-icon"><UsersRound size={32} /></div><span className="section-kicker">MỘT LỜI MỜI KẾT NỐI</span><h1>Cùng một<br /><em>cuộc trò chuyện.</em></h1><p className="muted">Bạn sẽ là người B trong phòng.<br />Cả hai cùng xem nguyên văn và bản dịch trực tiếp.</p><form onSubmit={join}><label htmlFor="join-token" className="field-label"><Link2 size={15} /> Liên kết hoặc mã mời</label><input id="join-token" value={value} onChange={event => setValue(event.target.value)} required placeholder="Dán lời mời tại đây…" />{error && <p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary full-width mt-5" disabled={busy}>{busy ? <span className="spinner" /> : <>Vào phòng <ArrowRight size={18} /></>}</button></form><Link className="text-button" to="/">Quay lại trang chủ</Link></main></div>;
}
