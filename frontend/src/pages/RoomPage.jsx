import { ArrowLeft, AudioLines, Check, ChevronDown, Copy, Keyboard, Link2, Mic, MicOff, Radio, RefreshCw, RotateCw, Send, ShieldCheck, Wifi, WifiOff, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ERROR_LABELS, LANGUAGES, newClientId } from '../api';
import { MicrophoneCapture } from '../audio';
import { EmptyConversation, Modal } from '../components';
import { useRoom } from '../useRoom';

function Composer({ side, onSend, language }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = useRef(newClientId());
  const submit = async event => {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true); setError('');
    try {
      await onSend(text.trim(), side, id.current);
      setText(''); id.current = newClientId();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <form className="composer-wrap" onSubmit={submit}>
    {error && <p role="alert" className="composer-error">{error}</p>}
    <div className="composer"><Keyboard size={18} /><textarea aria-label={`Tin nhắn người ${side}`} placeholder={language === 'en' ? 'Type a message…' : 'Nhập lời bạn muốn nói…'} rows={1} maxLength={4000} value={text} disabled={busy} onChange={event => { setText(event.target.value); id.current = newClientId(); }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(event); } }} /><button type="submit" className="send-button" aria-label={`Gửi tin nhắn người ${side}`} disabled={!text.trim() || busy}>{busy ? <span className="spinner" /> : <Send size={18} />}</button></div>
  </form>;
}

function Message({ message, language, room, onRetry, onAssign }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const action = async callback => { setBusy(true); setError(''); try { await callback(); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  const originalPreferred = language === message.source_language;
  const time = new Date(message.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const speaker = room.members.find(member => member.side === message.speaker)?.username;
  return <article className={`message speaker-${message.speaker?.toLowerCase() || 'unknown'}`} data-message-id={message.id}>
    <div className="message-meta"><span><span className={`speaker-dot ${message.speaker === 'B' ? 'purple' : ''}`} />{message.speaker ? `Người ${message.speaker}${room.mode === 'remote' && speaker ? ` · ${speaker}` : ''}` : 'Chưa xác định người nói'}</span><span>{message.source === 'voice' && <Mic size={11} />}{time}</span></div>
    <p className={`message-text ${originalPreferred || !message.translation ? 'preferred' : ''}`} lang={message.source_language || undefined}>{message.text}</p>
    {message.translation && <div className={`message-translation ${!originalPreferred ? 'preferred' : ''}`}><span className="translation-tag">{LANGUAGES[message.target_language]?.short}</span><p lang={message.target_language}>{message.translation}</p></div>}
    {message.status === 'pending' && <div className="message-status"><span className="typing-dots"><i /><i /><i /></span> Đang dịch…</div>}
    {message.status === 'error' && <div className="message-error"><span>{ERROR_LABELS[message.error_code] || 'Chưa dịch được câu này.'}</span><button disabled={busy} onClick={() => action(() => onRetry(message.id))}><RefreshCw size={12} /> Thử lại</button></div>}
    {message.status === 'needs_speaker' && <div className="assign-speaker"><span>Chọn người nói để dịch câu này:</span><div>{['A', 'B'].map(side => <button disabled={busy} key={side} onClick={() => action(() => onAssign(message.id, side))}>{side} · {LANGUAGES[side === 'A' ? room.language_a : room.language_b].name}</button>)}</div></div>}
    {error && <p className="composer-error" role="alert">{error}</p>}
  </article>;
}

function ConversationPanel({ side, room, messages, partials, onSend, onRetry, onAssign, rotated, hasMore, loadOlder, shared, listening }) {
  const language = side === 'A' ? room.language_a : room.language_b;
  const scroll = useRef(null);
  const lastSequence = useRef(null);
  const lastPartialOrder = useRef(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const last = messages.at(-1);
  const livePartials = Object.values(partials).sort((a, b) => b.receivedOrder - a.receivedOrder);
  const newestPartialOrder = livePartials[0]?.receivedOrder ?? 0;
  const activeSpeaker = listening && side === room.side;
  useLayoutEffect(() => {
    const element = scroll.current;
    const sequence = last?.sequence ?? 0;
    if (element && (lastSequence.current === null || sequence > lastSequence.current || newestPartialOrder > lastPartialOrder.current)) {
      element.scrollTop = 0;
    }
    lastSequence.current = sequence;
    lastPartialOrder.current = Math.max(lastPartialOrder.current, newestPartialOrder);
  }, [last?.sequence, newestPartialOrder]);
  const older = async () => {
    if (loadingOlder) return;
    setLoadingOlder(true);
    setHistoryError('');
    try {
      await loadOlder();
    } catch (err) { setHistoryError(err.message); }
    finally { setLoadingOlder(false); }
  };
  return <section className={`conversation-panel panel-${side.toLowerCase()} ${rotated ? 'rotated' : ''} ${shared ? '' : 'remote-panel'} ${activeSpeaker ? 'capturing' : ''}`} aria-label={`Màn hình người ${side}`}>
    <div className="panel-heading"><div className="panel-person"><span className="person-badge">{side}</span><div><h2>{LANGUAGES[language].name}</h2><span>{shared ? `NGƯỜI ${side}${side === room.side ? ' · BẠN' : ''}` : `${room.members.find(member => member.side === side)?.username || `Người ${side}`} · BẠN`}</span></div></div><span className="panel-language-tag">{LANGUAGES[language].short}</span>{activeSpeaker && <span className="panel-live"><Radio size={13} /> LIVE</span>}</div>
    <div className="conversation-feed" ref={scroll} role="log" aria-label={`Hội thoại người ${side}`}>
      {!messages.length && !Object.keys(partials).length && <EmptyConversation language={language} compact={shared} />}
      {livePartials.map(partial => <div className="partial-message" key={partial.segment_id}><span><AudioLines size={13} /> Đang nghe{partial.speaker ? ` người ${partial.speaker}` : ''}…</span><p>{partial.text}</p></div>)}
      {[...messages].reverse().map(message => <Message key={message.id} message={message} language={language} room={room} onRetry={onRetry} onAssign={onAssign} />)}
      {historyError && <p className="composer-error">{historyError}</p>}
      {hasMore && <button className="load-older" onClick={older} disabled={loadingOlder}><ChevronDown size={14} />{loadingOlder ? 'Đang tải…' : 'Xem hội thoại trước'}</button>}
    </div>
    <Composer side={side} language={language} onSend={onSend} />
  </section>;
}

function InviteModal({ invite, onClose }) {
  const [copied, setCopied] = useState(false);
  const input = useRef(null);
  const url = invite.token ? `${window.location.origin}/join#token=${invite.token}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch { input.current?.select(); setCopied(false); }
  };
  return <Modal title="Mời người còn lại" onClose={onClose} className="invite-modal">
    {invite.loading ? <div className="page-loading small"><span className="spinner" /> Đang tạo lời mời…</div> : invite.error ? <p role="alert" className="form-error">{invite.error}</p> : <><p className="muted modal-intro">Quét QR bằng điện thoại còn lại, hoặc gửi liên kết. Người tham gia cần đăng nhập.</p><div className="qr-wrap"><QRCodeSVG value={url} size={188} level="M" role="img" aria-label="QR tham gia phòng Song Ngữ" title="QR tham gia phòng Song Ngữ" /></div><label className="field-label" htmlFor="share-url">Liên kết mời</label><div className="copy-input"><input id="share-url" ref={input} value={url} readOnly onFocus={event => event.target.select()} /><button className="icon-btn" aria-label="Sao chép liên kết" onClick={copy}>{copied ? <Check size={18} /> : <Copy size={18} />}</button></div><p className="form-footnote">{copied ? 'Đã sao chép liên kết.' : 'Lời mời dùng một lần, có hiệu lực 24 giờ.'}</p></>}
  </Modal>;
}

export function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const capture = useRef(null);
  const allowed = useRef(false);
  const stopRef = useRef(null);
  const startTimer = useRef(null);
  const [mic, setMic] = useState('idle');
  const [notice, setNotice] = useState('');
  const [rotated, setRotated] = useState(false);
  const [config, setConfig] = useState(null);
  const [invite, setInvite] = useState(null);
  const eventHandler = event => {
    if (event.type === 'room.deleted') navigate('/', { replace: true });
    if (event.type === 'disconnected') stopRef.current?.(false);
    if (event.type === 'audio.state') {
      clearTimeout(startTimer.current);
      if (event.recording && capture.current) { allowed.current = true; setMic('listening'); }
      else if (!event.recording) { allowed.current = false; capture.current?.stop(); capture.current = null; setMic('idle'); }
    }
    if (event.type === 'error') {
      setNotice(event.detail);
      if (['speech_unavailable', 'capture_in_use', 'audio_queue_full', 'audio_not_started', 'invalid_audio'].includes(event.code)) stopRef.current?.(false);
    }
  };
  const state = useRoom(roomId, eventHandler);
  const { room, connection, send, sendAudio, upsert } = state;
  const stopMicrophone = useCallback(async (notify = true) => {
    clearTimeout(startTimer.current);
    const current = capture.current;
    capture.current = null;
    if (!notify) allowed.current = false;
    if (current) { setMic(notify ? 'stopping' : 'idle'); await current.stop({ flush: notify }); }
    allowed.current = false;
    if (notify && current && send({ type: 'audio.stop' })) return;
    setMic('idle');
  }, [send]);
  stopRef.current = stopMicrophone;

  useEffect(() => {
    let disposed = false, timer;
    const load = async () => {
      try {
        const value = await api(`/config?room_id=${encodeURIComponent(roomId)}`);
        if (disposed) return;
        setConfig(value);
        timer = setTimeout(load, value.speech === 'loading' ? 3000 : 10000);
      } catch { if (!disposed) timer = setTimeout(load, 5000); }
    };
    load();
    return () => { disposed = true; clearTimeout(timer); };
  }, [connection, roomId]);

  useEffect(() => {
    const hidden = () => {
      if (document.hidden && capture.current) {
        stopRef.current?.(); setNotice('Micro đã tạm dừng khi bạn chuyển ứng dụng. Bấm bắt đầu để nghe tiếp.');
      }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => { document.removeEventListener('visibilitychange', hidden); clearTimeout(startTimer.current); allowed.current = false; capture.current?.stop(); capture.current = null; };
  }, [roomId]);

  const startMicrophone = async () => {
    setNotice(''); setMic('starting'); allowed.current = false;
    const current = new MicrophoneCapture(); capture.current = current;
    try {
      await current.start(buffer => {
        if (allowed.current && !sendAudio(buffer)) {
          stopRef.current?.(false); setNotice('Âm thanh đã tạm dừng vì kết nối chậm. Hãy kết nối lại rồi bắt đầu.');
        }
      }, () => { stopRef.current?.(); setNotice('Micro đã bị ngắt. Bạn có thể bắt đầu lại hoặc nhập chữ.'); });
      if (capture.current !== current) { await current.stop(); return; }
      if (!send({ type: 'audio.start' })) throw new Error('Chưa kết nối được phòng. Hãy thử lại sau.');
      startTimer.current = setTimeout(() => { stopRef.current?.(); setNotice('Chưa mở được phiên nhận giọng nói. Hãy thử lại.'); }, 12000);
    } catch (err) { if (capture.current === current) { await stopMicrophone(false); setNotice(err.message); } }
  };
  const onSend = async (text, side, id) => {
    const message = await api(`/rooms/${roomId}/messages`, { method: 'POST', body: { text, speaker: side, client_message_id: id } });
    upsert([message]);
  };
  const retry = async id => upsert([await api(`/rooms/${roomId}/messages/${id}/retry`, { method: 'POST' })]);
  const assign = async (id, speaker) => upsert([await api(`/rooms/${roomId}/messages/${id}/speaker`, { method: 'POST', body: { speaker } })]);
  const share = async () => {
    setInvite({ loading: true });
    try { const result = await api(`/rooms/${roomId}/invite`, { method: 'POST' }); setInvite(current => current ? { ...result, loading: false } : null); }
    catch (err) { setInvite(current => current ? { error: err.message, loading: false } : null); }
  };
  const closeInvite = useCallback(() => setInvite(null), []);

  if (state.error) return <div className="page-loading"><p role="alert">{state.error}</p><Link className="btn btn-primary" to="/">Về trang chủ</Link></div>;
  if (!room) return <div className="page-loading"><span className="spinner" /> Đang mở cuộc trò chuyện…</div>;
  const shared = room.mode === 'shared';
  const connected = connection === 'connected';
  const listening = mic === 'listening';
  const canSpeak = config?.speech === 'ready' && connected;
  const spokenLanguage = LANGUAGES[room.side === 'A' ? room.language_a : room.language_b].name;
  const panelProps = { room, messages: state.messages, partials: state.partials, onSend, onRetry: retry, onAssign: assign, hasMore: state.hasMore, loadOlder: state.loadOlder, shared, listening };
  return <main className={`room-page ${shared ? 'shared-room' : 'remote-room'}`}>
    <header className="room-header"><Link to="/" className="icon-btn room-back" aria-label="Về danh sách hội thoại"><ArrowLeft size={21} /></Link><div className="room-title"><h1>{room.title}</h1><span>{LANGUAGES[room.language_a].name} <span className="pair-arrow">↔</span> {LANGUAGES[room.language_b].name}<i />{shared ? 'Một máy chung' : `Bạn là người ${room.side}`}</span></div><div className={`connection-pill ${connected ? '' : 'offline'}`} role="status">{connected ? <><span />Đã kết nối</> : <><WifiOff size={13} />Đang kết nối lại</>}</div>{shared ? <button className={`icon-btn rotate-button ${rotated ? 'active' : ''}`} aria-label="Xoay màn hình người A 180 độ" aria-pressed={rotated} title="Xoay phía A để ngồi đối diện" onClick={() => setRotated(!rotated)}><RotateCw size={19} /></button> : room.side === 'A' && room.members.length < 2 ? <button className="btn btn-small btn-secondary" aria-label="Mời bạn" onClick={share} disabled={invite?.loading}><Link2 size={16} /><span>Mời bạn</span></button> : <span className="member-count">2 người</span>}</header>
    {!connected && <div className="room-banner"><Wifi size={15} /> Kết nối đang gián đoạn. Micro đã dừng; hội thoại sẽ tự đồng bộ khi kết nối lại.</div>}
    <div className="room-banner translation-owner">Dịch bằng cấu hình của chủ phòng. {config?.translation_is_owner && <Link to={`/settings/translation?room=${encodeURIComponent(roomId)}`}>Cài đặt dịch thuật</Link>}</div>
    {config && !config.translation_configured && <div className="room-banner warning">{config.translation_is_owner ? <>Bạn chưa cấu hình dịch thuật. <Link to={`/settings/translation?room=${encodeURIComponent(roomId)}`}>Thiết lập API của bạn</Link> rồi bấm Thử lại ở câu chưa dịch.</> : 'Chủ phòng chưa cấu hình dịch thuật. Hãy liên hệ chủ phòng để thiết lập API.'} Bạn vẫn có thể nhập và lưu nguyên văn.</div>}
    {!shared && room.members.length < 2 && <div className="room-banner waiting"><span className="status-dot" />Đang chờ người còn lại. Gửi lời mời để cùng trò chuyện.</div>}
    <div className={`panels-layout ${shared ? 'two-panels' : 'one-panel'}`}>
      {shared ? <><ConversationPanel {...panelProps} side="A" rotated={rotated} /><div className="panel-divider"><span><AudioLines size={16} /></span></div><ConversationPanel {...panelProps} side="B" /></> : <ConversationPanel {...panelProps} side={room.side} />}
    </div>
    {notice && <div className="room-notice" role="alert"><span>{notice}</span><button className="icon-btn" aria-label="Đóng thông báo" onClick={() => setNotice('')}><X size={16} /></button></div>}
    <footer className="room-controls"><div className="microphone-explanation microphone-identity"><ShieldCheck size={17} /><span>Bạn là {room.side} · {spokenLanguage}<small>Hãy nói {spokenLanguage} · Tự động dịch</small></span></div><button className={`mic-button ${listening ? 'listening' : ''}`} disabled={(mic === 'idle' && !canSpeak) || mic === 'starting' || mic === 'stopping'} onClick={listening ? () => stopMicrophone() : startMicrophone}>{mic === 'starting' || mic === 'stopping' ? <span className="spinner" /> : listening ? <MicOff size={21} /> : <Mic size={21} />}<span>{mic === 'starting' ? 'Đang mở micro…' : mic === 'stopping' ? 'Đang chốt đoạn nói…' : listening ? 'Dừng micro' : 'Bắt đầu nghe'}</span>{listening && <span className="live-wave"><i /><i /><i /><i /></span>}</button><div className="microphone-hint">{listening ? <><span className="status-dot" /> Đang nghe liên tục</> : config?.speech === 'loading' ? <><span className="spinner" /> Đang chuẩn bị nhận giọng nói</> : config?.speech === 'error' || config?.speech === 'disabled' ? 'Nhập chữ để tiếp tục trò chuyện' : 'Bấm micro rồi nói tự nhiên'}</div></footer>
    {invite && <InviteModal invite={invite} onClose={closeInvite} />}
  </main>;
}
