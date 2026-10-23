import { ArrowDownUp, ArrowRight, AudioLines, Clock3, Globe2, Link2, MessageCircleMore, Plus, Smartphone, Trash2, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, LANGUAGES } from '../api';
import { useAuth } from '../auth';
import { Header, Modal } from '../components';

function CreateRoom({ onClose }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('shared');
  const [a, setA] = useState('vi');
  const [b, setB] = useState('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const form = new FormData(event.currentTarget);
      const room = await api('/rooms', { method: 'POST', body: { title: form.get('title'), mode, language_a: a, language_b: b } });
      navigate(`/rooms/${room.id}`);
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return <Modal title="Một cuộc trò chuyện mới" onClose={onClose}>
    <p className="muted modal-intro">Chọn cách kết nối. Phần ngôn ngữ cứ để Song Ngữ.</p>
    <form onSubmit={submit}>
      <fieldset className="mode-options"><legend className="field-label">Hai bạn sẽ dùng thiết bị thế nào?</legend>
        {[['shared', Smartphone, 'Một máy chung', 'Ngồi đối diện, cùng xem'], ['remote', UsersRound, 'Hai máy riêng', 'Kết nối qua liên kết hoặc QR']].map(([value, Icon, title, description]) =>
          <label key={value} className={`mode-option ${mode === value ? 'selected' : ''}`}><input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} /><Icon size={23} /><strong>{title}</strong><small>{description}</small><span className="radio-indicator" /></label>)}
      </fieldset>
      <label className="field-label" htmlFor="room-title">Tên hội thoại <small>Không bắt buộc</small></label>
      <input id="room-title" name="title" placeholder="Ví dụ: Cà phê cùng Alex" maxLength={100} />
      <div className="language-pair-select">
        <label><span className="field-label">Người A</span><select aria-label="Ngôn ngữ người A" value={a} onChange={event => setA(event.target.value)}>{Object.entries(LANGUAGES).map(([code, lang]) => <option key={code} value={code}>{lang.name}</option>)}</select></label>
        <button className="icon-btn swap-languages" type="button" aria-label="Đổi hai ngôn ngữ" onClick={() => { setA(b); setB(a); }}><ArrowDownUp size={18} /></button>
        <label><span className="field-label">Người B</span><select aria-label="Ngôn ngữ người B" value={b} onChange={event => setB(event.target.value)}>{Object.entries(LANGUAGES).map(([code, lang]) => <option key={code} value={code}>{lang.name}</option>)}</select></label>
      </div>
      {a === b && <p className="form-error">Hãy chọn hai ngôn ngữ khác nhau.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="btn btn-primary full-width" disabled={busy || a === b}>{busy ? <span className="spinner" /> : <>Bắt đầu trò chuyện <ArrowRight size={18} /></>}</button>
      <p className="form-footnote">Có thể dùng micro hoặc nhập chữ trong phòng.</p>
    </form>
  </Modal>;
}

export function inviteToken(value) {
  try { return new URLSearchParams(new URL(value).hash.slice(1)).get('token') || value.trim(); }
  catch { return value.trim(); }
}

function JoinModal({ onClose }) {
  const navigate = useNavigate();
  return <Modal title="Tham gia cuộc trò chuyện" onClose={onClose}>
    <p className="muted modal-intro">Dán liên kết hoặc mã mời mà người kia chia sẻ.</p>
    <form onSubmit={event => { event.preventDefault(); const token = inviteToken(new FormData(event.currentTarget).get('invite')); navigate(`/join#token=${encodeURIComponent(token)}`); }}>
      <label className="field-label" htmlFor="invite">Liên kết hoặc mã mời</label><input id="invite" name="invite" required placeholder="Dán lời mời tại đây…" />
      <button className="btn btn-primary full-width mt-5">Tiếp tục <ArrowRight size={18} /></button>
    </form>
  </Modal>;
}

export function Dashboard() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState('');
  const close = useCallback(() => setModal(null), []);
  const load = useCallback(() => {
    setError(''); setLoading(true);
    api('/rooms').then(setRooms).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  const remove = async () => {
    setDeleting(true); setError('');
    try { await api(`/rooms/${modal.room.id}`, { method: 'DELETE' }); setRooms(current => current.filter(room => room.id !== modal.room.id)); close(); }
    catch (err) { setError(err.message); }
    finally { setDeleting(false); }
  };
  const filtered = rooms.filter(room => room.title.toLowerCase().includes(query.toLowerCase()));
  return <div className="dashboard-shell">
    <Header />
    <main className="dashboard-main">
      <section className="welcome-section">
        <div className="welcome-copy"><span className="eyebrow"><span className="status-dot" /> KHÔNG CÒN RÀO CẢN NGÔN NGỮ</span>
          <h1>Hiểu nhau,<br /><em>ngay lúc này.</em></h1>
          <p>Xin chào {user.username}. Mỗi người một ngôn ngữ,<br className="desktop-break" /> cùng chia sẻ một câu chuyện.</p>
          <div className="welcome-actions"><button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}><Plus size={19} /> Tạo cuộc trò chuyện</button><button className="btn btn-secondary" onClick={() => setModal({ type: 'join' })}><Link2 size={18} /> Tham gia phòng</button></div>
        </div>
        <div className="welcome-art" aria-hidden="true"><div className="art-orbit" /><span className="art-language art-lang-top">你好</span><span className="art-language art-lang-bottom">안녕하세요</span><div className="art-card art-card-a"><span className="art-avatar">A</span><div><small>TIẾNG VIỆT</small><strong>Chào bạn, mình là An.</strong></div><span className="art-dot" /></div><div className="art-bridge"><AudioLines size={27} /></div><div className="art-card art-card-b"><span className="art-avatar">B</span><div><small>ENGLISH</small><strong>Hi, I'm An. Nice to meet you.</strong></div></div><span className="art-caption"><span /> HIỂU NHAU TRONG TỪNG CÂU NÓI</span></div>
      </section>
      <div className="feature-strip"><span><AudioLines size={17} /> Dịch hội thoại trực tiếp</span><span><Smartphone size={17} /> Một máy chung hoặc hai máy</span><span><Globe2 size={17} /> 8 ngôn ngữ, hai chiều</span></div>
      <section className="history-section">
        <div className="section-heading"><div><span className="section-kicker">NHỮNG CÂU CHUYỆN CỦA BẠN</span><h2>Cuộc trò chuyện <span className="count-badge">{rooms.length}</span></h2></div>{rooms.length > 0 && <input className="search-input" aria-label="Tìm hội thoại" placeholder="Tìm cuộc trò chuyện…" value={query} onChange={event => setQuery(event.target.value)} />}</div>
        {error && <div className="alert" role="alert">{error}<button className="text-button" onClick={load}>Thử lại</button></div>}
        {loading ? <div className="history-loading"><span className="spinner" /> Đang tải hội thoại…</div> : filtered.length ? <div className="room-grid">{filtered.map(room => <article className="room-card" key={room.id}>
          <Link to={`/rooms/${room.id}`} className="room-card-link"><div className="room-card-top"><span className={`room-mode-icon ${room.mode}`}>{room.mode === 'shared' ? <Smartphone size={22} /> : <UsersRound size={22} />}</span><span className="mode-label">{room.mode === 'shared' ? 'MỘT MÁY CHUNG' : 'HAI MÁY RIÊNG'}</span><ArrowRight size={18} className="room-arrow" /></div><h3>{room.title}</h3><div className="room-language-pair"><span>{LANGUAGES[room.language_a].name}</span><ArrowDownUp size={13} /><span>{LANGUAGES[room.language_b].name}</span></div><div className="room-card-bottom"><span><Clock3 size={13} />{new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(room.updated_at))}</span><span>{room.members.length === 2 ? '2 người' : room.mode === 'shared' ? 'Đối thoại trực tiếp' : 'Chờ người còn lại'}</span></div></Link>
          {room.owner_id === user.id && <button className="delete-room icon-btn" aria-label={`Xóa ${room.title}`} title="Xóa hội thoại" onClick={() => setModal({ type: 'delete', room })}><Trash2 size={16} /></button>}
        </article>)}</div> : <div className="history-empty"><span className="history-empty-icon"><MessageCircleMore size={27} /></span><div><h3>{query ? 'Chưa tìm thấy hội thoại này.' : 'Câu chuyện đầu tiên đang chờ bạn.'}</h3><p>{query ? 'Thử tìm bằng một tên khác.' : 'Tạo phòng, chọn ngôn ngữ và bắt đầu bằng một lời chào.'}</p></div>{!query && <button className="icon-btn" aria-label="Tạo hội thoại đầu tiên" onClick={() => setModal({ type: 'create' })}><Plus size={21} /></button>}</div>}
      </section>
      <footer className="dashboard-footer"><span>songngữ.</span><p>Mỗi lời nói đều xứng đáng được lắng nghe.</p><span className="footer-indicator"><span /> Âm thanh không được lưu</span></footer>
    </main>
    {modal?.type === 'create' && <CreateRoom onClose={close} />}
    {modal?.type === 'join' && <JoinModal onClose={close} />}
    {modal?.type === 'delete' && <Modal title="Xóa cuộc trò chuyện?" onClose={close}><p className="muted modal-intro">“{modal.room.title}” và toàn bộ nội dung sẽ được xóa khỏi lịch sử của cả hai người.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="btn btn-secondary" onClick={close}>Giữ lại</button><button className="btn btn-danger" onClick={remove} disabled={deleting}>{deleting ? 'Đang xóa…' : 'Xóa hội thoại'}</button></div></Modal>}
  </div>;
}
