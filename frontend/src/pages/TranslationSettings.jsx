import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { api } from '../api';
import { Header, Modal } from '../components';

export function TranslationSettings() {
  const [search] = useSearchParams();
  const returnRoom = search.get('room');
  const back = returnRoom ? `/rooms/${encodeURIComponent(returnRoom)}` : '/';
  const [saved, setSaved] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = saved && (baseUrl !== saved.base_url || model !== saved.model || key !== '');

  useEffect(() => {
    let active = true;
    api('/settings/translation').then(value => {
      if (!active) return;
      setSaved(value);
      setBaseUrl(value.base_url);
      setModel(value.model);
    }).catch(err => {
      if (active) setError(err.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function save(event) {
    event.preventDefault();
    setBusy('save');
    setError('');
    setNotice('');
    try {
      const value = await api('/settings/translation', {
        method: 'PUT',
        body: { base_url: baseUrl, model, api_key: key },
      });
      setSaved(value);
      setBaseUrl(value.base_url);
      setModel(value.model);
      setKey('');
      setNotice('Đã lưu. Bạn có thể kiểm tra kết nối hoặc quay lại phòng để thử lại câu chưa dịch.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function test() {
    setBusy('test');
    setError('');
    setNotice('');
    try {
      const result = await api('/settings/translation/test', { method: 'POST' });
      setNotice(`Kết nối thành công. “Xin chào” → ${result.translation}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    setBusy('delete');
    setError('');
    setNotice('');
    try {
      await api('/settings/translation', { method: 'DELETE' });
      setSaved({ configured: false, has_api_key: false, base_url: '', model: '' });
      setBaseUrl('');
      setModel('');
      setKey('');
      setConfirmDelete(false);
      setNotice('Đã xóa cấu hình và API key. Các phòng của bạn tạm ngừng dịch cho đến khi cấu hình lại.');
    } catch (err) {
      setError(err.message);
      setConfirmDelete(false);
    } finally {
      setBusy('');
    }
  }

  return <div className="dashboard-shell">
    <Header />
    <main className="translation-settings">
      <Link className="text-link" to={back}><ArrowLeft size={17} />{returnRoom ? 'Quay lại hội thoại' : 'Về trang chủ'}</Link>
      <span className="eyebrow">MODEL CỦA BẠN</span>
      <h1>Cài đặt dịch thuật</h1>
      <p className="muted">Kết nối model ngôn ngữ (LLM) để dịch phần chữ sau khi nhận dạng giọng nói. Chọn model hỗ trợ tiếng Việt và tiếng Trung nếu bạn trò chuyện bằng hai ngôn ngữ này.</p>
      <div className="settings-explanation"><KeyRound size={22} /><p>Phòng do bạn tạo dùng cấu hình này để dịch cho cả hai người. <strong>Nhà cung cấp tính phí trực tiếp vào tài khoản API của bạn.</strong> Song Ngữ không thu tiền hoặc quản lý số dư.</p></div>
      {error && <p role="alert" className="form-error">{error}</p>}
      {notice && <p role="status" className="settings-notice">{notice}</p>}
      {loading ? <p className="muted">Đang tải cài đặt…</p> : !saved ? <button className="btn btn-secondary" onClick={() => window.location.reload()}>Tải lại cài đặt</button> : <form className="settings-card" onSubmit={save}>
        <h2>API tương thích OpenAI</h2>
        <p className="muted">Lấy địa chỉ API, tên model và API key trong trang quản lý của nhà cung cấp. Tài khoản chat thông thường có thể chưa bao gồm tiền sử dụng API.</p>
        <fieldset disabled={Boolean(busy)}>
          <label className="field-label" htmlFor="llm-url">Base URL</label>
          <input id="llm-url" type="url" required maxLength={2048} value={baseUrl} onChange={event => setBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" aria-describedby="url-help" />
          <p id="url-help" className="settings-help">Địa chỉ gốc của API, có hoặc không có /v1. Không thêm /chat/completions hoặc API key vào URL. Mặc định cần HTTPS công khai.</p>
          <label className="field-label" htmlFor="llm-model">Tên model</label>
          <input id="llm-model" required maxLength={200} value={model} onChange={event => setModel(event.target.value)} placeholder="Nhập đúng mã model từ nhà cung cấp" />
          <p className="settings-help">Dùng mã model API, không phải tên hiển thị của ứng dụng chat.</p>
          <label className="field-label" htmlFor="llm-key">API key <small>{saved.has_api_key ? 'Đã lưu API key' : 'Chưa lưu API key'}</small></label>
          <input id="llm-key" type="password" autoComplete="new-password" maxLength={8192} value={key} onChange={event => setKey(event.target.value)} placeholder={saved.has_api_key ? 'Để trống để giữ khóa hiện có' : 'Dán API key của bạn'} aria-describedby="key-help" />
          <p id="key-help" className="settings-help">Khóa được mã hóa khi lưu trên máy chủ và không hiển thị lại. Để trống giữ khóa hiện có; API local không yêu cầu khóa có thể bỏ trống. Muốn loại bỏ khóa, hãy xóa cấu hình rồi tạo lại.</p>
          <div className="settings-actions">
            <button className="btn btn-primary" type="submit">{busy === 'save' ? 'Đang lưu…' : 'Lưu'}</button>
            <button className="btn btn-secondary" type="button" disabled={!saved.configured || dirty} onClick={test}>{busy === 'test' ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}</button>
            <button className="text-button settings-delete" type="button" disabled={!saved.configured} onClick={() => setConfirmDelete(true)}>Xóa cấu hình</button>
          </div>
          <p className="settings-help">Kiểm tra dùng cấu hình đã lưu và gửi một câu Việt–Trung ngắn, có thể phát sinh phí. {dirty ? 'Hãy lưu thay đổi trước khi kiểm tra.' : ''}</p>
        </fieldset>
      </form>}
      {confirmDelete && <Modal title="Xóa cấu hình dịch thuật?" onClose={() => !busy && setConfirmDelete(false)}>
        <p>API key sẽ bị xóa. Các phòng do bạn tạo sẽ ngừng dịch câu mới; lịch sử vẫn được giữ.</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => setConfirmDelete(false)}>Giữ lại</button>
          <button className="btn btn-danger" disabled={Boolean(busy)} onClick={remove}>{busy ? 'Đang xóa…' : 'Xóa cấu hình'}</button>
        </div>
      </Modal>}
    </main>
  </div>;
}
