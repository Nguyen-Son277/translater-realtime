import { ArrowLeft, AudioLines, Check, ChevronUp, Copy, Link2, Mic, MicOff, RefreshCw, ShieldCheck, Wifi, WifiOff, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ERROR_LABELS, LANGUAGES } from '../api';
import { useMicrophone } from '../useMicrophone';
import { invitationWarning } from '../remote';
import { EmptyConversation, Modal } from '../components';
import { useRoom } from '../useRoom';
import { useI18n, LanguageSelector } from '../i18n';

function Message({ message, language, room, onRetry, onAssign }) {
  const { t, formatLocale, localizeError } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const action = async callback => { setBusy(true); setError(''); try { await callback(); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  const originalPreferred = language === message.source_language;
  const time = new Date(message.created_at).toLocaleTimeString(formatLocale, { hour: '2-digit', minute: '2-digit' });
  const member = room.members.find(member => member.side === message.speaker);
  const speaker = member?.name || member?.username;
  return <article className={`message speaker-${message.speaker?.toLowerCase() || 'unknown'}`} data-message-id={message.id}>
    <div className="message-meta"><span><span className={`speaker-dot ${message.speaker === 'B' ? 'purple' : ''}`} />{message.speaker ? t('room.speakerLabel', { speaker: message.speaker }) + (room.mode === 'remote' && speaker ? ` · ${speaker}` : '') : t('room.unknownSpeaker')}</span><span>{message.source === 'voice' && <Mic size={11} />}{time}</span></div>
    <p className={`message-text ${originalPreferred || !message.translation ? 'preferred' : ''}`} lang={message.source_language || undefined}>{message.text}</p>
    {message.translation && <div className={`message-translation ${!originalPreferred ? 'preferred' : ''}`}><span className="translation-tag">{LANGUAGES[message.target_language]?.short}</span><p lang={message.target_language}>{message.translation}</p></div>}
    {message.status === 'pending' && <div className="message-status"><span className="typing-dots"><i /><i /><i /></span> {t('room.translating')}</div>}
    {message.status === 'error' && <div className="message-error"><span>{localizeError(message.error_code) || t('room.translateErrorFallback')}</span><button disabled={busy} onClick={() => action(() => onRetry(message.id))}><RefreshCw size={12} /> {t('common.retry')}</button></div>}
    {message.status === 'needs_speaker' && <div className="assign-speaker"><span>{t('room.chooseSpeaker')}</span><div>{['A', 'B'].map(side => <button disabled={busy} key={side} onClick={() => action(() => onAssign(message.id, side))}>{side} · {LANGUAGES[side === 'A' ? room.language_a : room.language_b].name}</button>)}</div></div>}
    {error && <p className="conversation-error" role="alert">{localizeError(error)}</p>}
  </article>;
}

function ConversationPanel({ side, room, messages, partials, onRetry, onAssign, hasMore, loadOlder, shared }) {
  const { t, localizeError } = useI18n();
  const language = side === 'A' ? room.language_a : room.language_b;
  const scroll = useRef(null);
  const lastSequence = useRef(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const nearBottom = useRef(true);
  const count = messages.length;
  const last = messages.at(-1);
  useEffect(() => {
    const element = scroll.current;
    if (element && (nearBottom.current || lastSequence.current === null)) element.scrollTop = element.scrollHeight;
    lastSequence.current = last?.sequence ?? null;
  }, [count, last?.id, last?.version, partials]);
  const older = async () => {
    if (loadingOlder) return;
    setLoadingOlder(true); setHistoryError('');
    const previousHeight = scroll.current.scrollHeight;
    const previousTop = scroll.current.scrollTop;
    try {
      await loadOlder();
      requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = previousTop + scroll.current.scrollHeight - previousHeight; });
    } catch (err) { setHistoryError(err.message); }
    finally { setLoadingOlder(false); }
  };
  return <section className={`conversation-panel panel-${side.toLowerCase()} ${shared ? 'shared-panel' : 'remote-panel'}`} aria-label={shared ? t('room.sharedPanelAria') : t('room.remotePanelAria', { side })}>
    <div className="conversation-feed" ref={scroll} role="log" aria-label={shared ? t('room.sharedLogAria') : t('room.remoteLogAria', { side })} onScroll={() => { const el = scroll.current; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      {hasMore && <button className="load-older" onClick={older} disabled={loadingOlder}><ChevronUp size={14} />{loadingOlder ? t('room.loadingOlder') : t('room.viewOlder')}</button>}
      {historyError && <p className="conversation-error">{localizeError(historyError)}</p>}
      {!messages.length && !Object.keys(partials).length && <EmptyConversation language={language} compact={shared} />}
      {messages.map(message => <Message key={message.id} message={message} language={language} room={room} onRetry={onRetry} onAssign={onAssign} />)}
      {Object.values(partials).map(partial => <div className="partial-message" key={partial.segment_id}><span><AudioLines size={13} /> {partial.speaker ? t('room.listeningSpeaker', { speaker: partial.speaker }) : t('room.listening')}</span><p>{partial.text}</p></div>)}
    </div>
  </section>;
}

function InviteModal({ invite, onClose }) {
  const { t, localizeError } = useI18n();
  const [copied, setCopied] = useState(false);
  const input = useRef(null);
  const url = invite.token ? `${window.location.origin}/join#token=${invite.token}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch { input.current?.select(); setCopied(false); }
  };
  return <Modal title={t('room.inviteTitle')} onClose={onClose} className="invite-modal">
    {invitationWarning(window.location) && <p className="form-error" role="note">{localizeError(invitationWarning(window.location))}</p>}
    {invite.loading ? <div className="page-loading small"><span className="spinner" /> {t('room.creatingInvite')}</div> : invite.error ? <p role="alert" className="form-error">{localizeError(invite.error)}</p> : <><p className="muted modal-intro">{t('room.inviteIntro')}</p><div className="qr-wrap"><QRCodeSVG value={url} size={188} level="M" role="img" aria-label={t('room.qrAria')} title={t('room.qrAria')} /></div><label className="field-label" htmlFor="share-url">{t('room.inviteLinkLabel')}</label><div className="copy-input"><input id="share-url" ref={input} value={url} readOnly onFocus={event => event.target.select()} /><button className="icon-btn" aria-label={t('room.copyLink')} onClick={copy}>{copied ? <Check size={18} /> : <Copy size={18} />}</button></div><p className="form-footnote">{copied ? t('room.linkCopied') : t('room.inviteFootnote')}</p></>}
  </Modal>;
}

export function RoomPage() {
  const { t, localizeError } = useI18n();
  const { roomId } = useParams();
  const navigate = useNavigate();
  const microphoneEvents = useRef(null);
  const [config, setConfig] = useState(null);
  const [invite, setInvite] = useState(null);
  const state = useRoom(roomId, event => {
    if (event.type === 'room.deleted') navigate('/', { replace: true });
    microphoneEvents.current?.(event);
  });
  const { room, connection, send, sendAudio, upsert, reconnect } = state;
  const microphone = useMicrophone({ roomId, send, sendAudio, reconnect });
  microphoneEvents.current = microphone.handleEvent;
  const { mic, notice, setNotice, start: startMicrophone, stop: stopMicrophone } = microphone;

  useEffect(() => {
    let disposed = false, timer;
    const load = async () => {
      try {
        const value = await api('/config');
        if (disposed) return;
        setConfig(value);
        if (value.speech === 'loading') timer = setTimeout(load, 3000);
      } catch { if (!disposed) timer = setTimeout(load, 5000); }
    };
    load();
    return () => { disposed = true; clearTimeout(timer); };
  }, [connection]);

  const retry = async id => upsert([await api(`/rooms/${roomId}/messages/${id}/retry`, { method: 'POST' })]);
  const assign = async (id, speaker) => upsert([await api(`/rooms/${roomId}/messages/${id}/speaker`, { method: 'POST', body: { speaker } })]);
  const share = async () => {
    setInvite({ loading: true });
    try { const result = await api(`/rooms/${roomId}/invite`, { method: 'POST' }); setInvite(current => current ? { ...result, loading: false } : null); }
    catch (err) { setInvite(current => current ? { error: err.message, loading: false } : null); }
  };
  const closeInvite = useCallback(() => setInvite(null), []);

  if (state.error) return <div className="page-loading"><p role="alert">{localizeError(state.error)}</p><Link className="btn btn-primary" to="/">{t('common.backHome')}</Link></div>;
  if (!room) return <div className="page-loading"><span className="spinner" /> {t('room.openingRoom')}</div>;
  const shared = room.mode === 'shared';
  const connected = connection === 'connected';
  const listening = mic === 'listening';
  const canSpeak = config?.speech === 'ready' && connected;
  const panelProps = { room, messages: state.messages, partials: state.partials, onRetry: retry, onAssign: assign, hasMore: state.hasMore, loadOlder: state.loadOlder, shared };
  const otherSide = room.side === 'A' ? 'B' : 'A';
  const otherMember = room.members.find(member => member.side === otherSide);
  const otherPresence = state.presence.find(member => member.side === otherSide);
  const peerStatus = !otherMember ? t('room.peerNotJoined') : !connected ? t('room.peerUnknown') : !otherPresence?.online ? t('room.peerOffline') : otherPresence.recording ? t('room.peerRecording') : t('room.peerOnline');
  const ownLanguage = room.side === 'A' ? room.language_a : room.language_b;
  const otherLanguage = room.side === 'A' ? room.language_b : room.language_a;
  return <main className={`room-page ${shared ? 'shared-room' : 'remote-room'}`}>
    <header className="room-header"><Link to="/" className="icon-btn room-back" aria-label={t('room.backToRooms')}><ArrowLeft size={21} /></Link><div className="room-title"><h1>{room.title}</h1><span>{LANGUAGES[room.language_a].name} <span className="pair-arrow">↔</span> {LANGUAGES[room.language_b].name}<i />{shared ? t('room.oneSharedDevice') : t('room.youArePerson', { side: room.side })}</span></div><div className={`connection-pill ${connected ? '' : 'offline'}`} role="status">{connected ? <><span />{t('room.connected')}</> : <><WifiOff size={13} />{t('room.reconnecting')}</>}</div><LanguageSelector />{shared ? <span className="member-count">{t('room.twoPeople')}</span> : room.side === 'A' && room.members.length < 2 ? <button className="btn btn-small btn-secondary" aria-label={t('room.inviteButton')} onClick={share} disabled={invite?.loading}><Link2 size={16} /><span>{t('room.inviteButton')}</span></button> : <span className="member-count">{t('room.twoPeople')}</span>}</header>
    {!connected && <div className="room-banner"><Wifi size={15} /> {t('room.bannerDisconnected')}</div>}
    {config && !config.translation_configured && <div className="room-banner warning">{t('room.bannerTranslationNotReady')}</div>}
    {!shared && room.members.length < 2 && <div className="room-banner waiting"><span className="status-dot" />{t('room.bannerWaitingPeer')}</div>}
    {!shared && <div className="room-banner remote-presence" aria-live="polite"><span>{t('room.bannerRemoteDescription', { own: LANGUAGES[ownLanguage].name, other: LANGUAGES[otherLanguage].name })}</span><span data-testid="peer-presence">{otherMember?.name || otherMember?.username || t('room.peerDefault')}: {peerStatus}</span><small>{t('room.bannerRemoteNote')}</small></div>}
    <div className="panels-layout one-panel">
      <ConversationPanel {...panelProps} side={shared ? 'A' : room.side} />
    </div>
    {notice && <div className="room-notice" role="alert"><span>{localizeError(notice)}</span><button className="icon-btn" aria-label={t('room.closeNotice')} onClick={() => setNotice('')}><X size={16} /></button></div>}
    <footer className="room-controls"><div className="microphone-explanation"><ShieldCheck size={17} /><span>{shared ? t('room.micShared') : t('room.micRemote')}<small>{t('room.audioNotSaved')}</small></span></div><button className={`mic-button ${listening ? 'listening' : ''}`} disabled={(mic === 'idle' && !canSpeak) || mic === 'starting' || mic === 'stopping'} onClick={listening ? () => stopMicrophone() : startMicrophone}>{mic === 'starting' || mic === 'stopping' ? <span className="spinner" /> : listening ? <MicOff size={21} /> : <Mic size={21} />}<span>{mic === 'starting' ? t('room.micStarting') : mic === 'stopping' ? t('room.micStopping') : listening ? t('room.micStop') : t('room.micStart')}</span>{listening && <span className="live-wave"><i /><i /><i /><i /></span>}</button><div className="microphone-hint" aria-live="polite">{listening ? <><span className="status-dot" /> {t('room.micListeningContinuous')}</> : config?.speech === 'loading' ? <><span className="spinner" /> {t('room.speechPreparing')}</> : config?.speech === 'error' || config?.speech === 'disabled' ? t('room.speechUnavailable') : t('room.speechPrompt')}</div></footer>
    {invite && <InviteModal invite={invite} onClose={closeInvite} />}
  </main>;
}
