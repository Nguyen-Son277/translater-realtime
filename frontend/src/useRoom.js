import { useCallback, useEffect, useRef, useState } from 'react';
import { api, mergeMessages } from './api';

export function useRoom(roomId, onEvent) {
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [partials, setPartials] = useState({});
  const [presence, setPresence] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const socket = useRef(null);
  const reconnectRef = useRef(null);
  const roomEpoch = useRef(null);
  const messagesRef = useRef([]);
  const activeRoomId = useRef(roomId);
  activeRoomId.current = roomId;
  const callback = useRef(onEvent);
  callback.current = onEvent;
  messagesRef.current = messages;
  const upsert = useCallback(items => setMessages(current => mergeMessages(current, items.filter(item => item.room_id === activeRoomId.current))), []);

  useEffect(() => {
    const epoch = {}; roomEpoch.current = epoch;
    let disposed = false, terminal = false, timer, watchdog, fetchTimer, controller, retries = 0, attempt = 0;
    const cancelAttempt = () => {
      attempt++;
      clearTimeout(fetchTimer);
      controller?.abort(); controller = null;
    };
    setRoom(null); setMessages([]); setPartials({}); setPresence([]);
    messagesRef.current = []; setError(''); setConnection('connecting');
    const active = () => !disposed && !terminal;
    const retireSocket = () => {
      clearTimeout(watchdog);
      const old = socket.current;
      socket.current = null;
      if (old) { old.onmessage = old.onclose = old.onerror = null; old.close(); }
    };
    const finish = (message, expired = false) => {
      terminal = true;
      clearTimeout(timer); cancelAttempt(); retireSocket();
      setPresence([]); setPartials({}); setConnection('closed'); setError(message);
      callback.current?.({ type: 'disconnected' });
      if (expired) window.dispatchEvent(new Event('session-expired'));
    };
    const retry = () => {
      if (!active()) return;
      clearTimeout(timer); cancelAttempt(); retireSocket();
      setPresence([]); setPartials({}); setConnection('reconnecting');
      callback.current?.({ type: 'disconnected' });
      const delay = Math.min(1000 * 2 ** Math.min(retries++, 4), 10000);
      timer = setTimeout(connect, delay * (0.8 + Math.random() * 0.2));
    };
    const connect = async () => {
      if (!active()) return;
      clearTimeout(timer); cancelAttempt(); retireSocket();
      const myAttempt = attempt;
      const valid = () => active() && myAttempt === attempt;
      setConnection(retries ? 'reconnecting' : 'connecting');
      const requestController = new AbortController(); controller = requestController;
      const requestTimer = setTimeout(() => requestController.abort(), 15000); fetchTimer = requestTimer;
      try {
        const currentRoom = await api(`/rooms/${roomId}`, { signal: requestController.signal });
        if (!valid()) return;
        setRoom(currentRoom);
      } catch (err) {
        if (!valid()) return;
        if ([401, 403, 404].includes(err.status)) { finish(err.message, err.status === 401); return; }
        retry(); return;
      } finally {
        clearTimeout(requestTimer);
        if (controller === requestController) controller = null;
      }
      if (!valid()) return;
      const from = messagesRef.current[0]?.sequence;
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      let ws;
      try { ws = new WebSocket(`${protocol}//${location.host}/ws/rooms/${roomId}${from ? `?from_sequence=${from}` : ''}`); }
      catch { retry(); return; }
      socket.current = ws;
      const current = () => active() && socket.current === ws;
      const armWatchdog = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => { if (current()) retry(); }, 30000);
      };
      armWatchdog(); // Includes sockets stuck connecting or waiting for a snapshot.
      ws.onmessage = event => {
        if (!current()) return;
        let payload;
        try { payload = JSON.parse(event.data); } catch { return; }
        if (!payload || typeof payload !== 'object') return;
        if (payload.type === 'room.snapshot') {
          setRoom(payload.room); upsert(payload.messages); setHasMore(payload.has_more);
          setPresence(payload.presence || []);
          setConnection('connected'); setError(''); retries = 0; armWatchdog();
        } else if (payload.type === 'room.presence') setPresence(payload.members || []);
        else if (payload.type === 'message.upsert' || payload.type === 'message.ack') upsert([payload.message]);
        else if (payload.type === 'room.members') setRoom(currentRoom => currentRoom && ({ ...currentRoom, members: payload.members }));
        else if (payload.type === 'transcript.partial') {
          setPartials(currentPartials => {
            const next = { ...currentPartials };
            if (payload.text) next[payload.segment_id] = payload;
            else delete next[payload.segment_id];
            return next;
          });
        } else if (payload.type === 'ping') {
          armWatchdog();
          try { ws.send(JSON.stringify({ type: 'pong' })); } catch { retry(); return; }
        } else if (payload.type === 'room.deleted') {
          finish('Cuộc hội thoại không còn tồn tại.');
        }
        callback.current?.(payload);
      };
      ws.onclose = event => {
        if (!current()) return;
        if (event.code === 4401) { finish('Phiên đăng nhập đã hết hạn.', true); return; }
        if (event.code === 4403) { finish('Bạn không có quyền kết nối phòng từ địa chỉ này.'); return; }
        if (event.code === 4404) { finish('Cuộc hội thoại không còn tồn tại.'); return; }
        retry();
      };
      ws.onerror = () => { if (current()) retry(); };
    };
    reconnectRef.current = retry;
    const offline = () => retry();
    window.addEventListener('offline', offline);
    connect();
    return () => {
      disposed = true;
      clearTimeout(timer); cancelAttempt();
      if (roomEpoch.current === epoch) roomEpoch.current = null;
      retireSocket(); reconnectRef.current = null;
      window.removeEventListener('offline', offline);
    };
  }, [roomId, upsert]);

  const reconnect = useCallback(() => reconnectRef.current?.(), []);
  const send = useCallback(event => {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    try { ws.send(JSON.stringify(event)); return true; } catch { return false; }
  }, []);
  const sendAudio = useCallback(buffer => {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN || ws.bufferedAmount > 256000) return false;
    try { ws.send(buffer); return true; } catch { return false; }
  }, []);
  const loadOlder = async () => {
    if (!messagesRef.current.length) return;
    const epoch = roomEpoch.current;
    const page = await api(`/rooms/${roomId}/messages?before=${messagesRef.current[0].sequence}`);
    if (epoch !== roomEpoch.current) return;
    upsert(page.messages); setHasMore(page.has_more);
  };
  return { room, messages, partials, presence, connection, error, hasMore, loadOlder, send, sendAudio, upsert, reconnect };
}
