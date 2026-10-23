import { useCallback, useEffect, useRef, useState } from 'react';
import { api, mergeMessages } from './api';

export function useRoom(roomId, onEvent) {
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [partials, setPartials] = useState({});
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const socket = useRef(null);
  const messagesRef = useRef([]);
  const callback = useRef(onEvent);
  callback.current = onEvent;
  messagesRef.current = messages;
  const upsert = useCallback(items => setMessages(current => mergeMessages(current, items)), []);

  useEffect(() => {
    let disposed = false, timer, retries = 0;
    setRoom(null); setMessages([]); setPartials({}); messagesRef.current = []; setError('');
    const connect = async () => {
      if (disposed) return;
      setConnection(retries ? 'reconnecting' : 'connecting');
      try {
        const currentRoom = await api(`/rooms/${roomId}`);
        if (disposed) return;
        setRoom(currentRoom);
      } catch (err) {
        if (disposed) return;
        if (err.status === 404 || err.status === 401) { setError(err.message); setConnection('closed'); return; }
        timer = setTimeout(connect, Math.min(1000 * 2 ** retries++, 10000));
        return;
      }
      const from = messagesRef.current[0]?.sequence;
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${location.host}/ws/rooms/${roomId}${from ? `?from_sequence=${from}` : ''}`);
      socket.current = ws;
      ws.onmessage = event => {
        if (disposed) return;
        let payload;
        try { payload = JSON.parse(event.data); } catch { return; }
        if (payload.type === 'room.snapshot') {
          setRoom(payload.room); upsert(payload.messages); setHasMore(payload.has_more);
          setConnection('connected'); setError(''); retries = 0;
        } else if (payload.type === 'message.upsert' || payload.type === 'message.ack') upsert([payload.message]);
        else if (payload.type === 'room.members') setRoom(current => ({ ...current, members: payload.members }));
        else if (payload.type === 'transcript.partial') {
          setPartials(current => {
            const next = { ...current };
            if (payload.text) next[payload.segment_id] = payload;
            else delete next[payload.segment_id];
            return next;
          });
        } else if (payload.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
        callback.current?.(payload);
      };
      ws.onclose = event => {
        if (disposed) return;
        setPartials({});
        callback.current?.({ type: 'disconnected' });
        if (event.code === 4401) { window.dispatchEvent(new Event('session-expired')); return; }
        if (event.code === 4404) { setError('Cuộc hội thoại không còn tồn tại.'); setConnection('closed'); return; }
        setConnection('reconnecting');
        timer = setTimeout(connect, Math.min(1000 * 2 ** retries++, 10000));
      };
      ws.onerror = () => {}; // onclose performs the retry and preserves loaded history.
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      socket.current?.close();
      socket.current = null;
    };
  }, [roomId, upsert]);

  const send = useCallback(event => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify(event));
    return true;
  }, []);

  const sendAudio = useCallback(buffer => {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN || ws.bufferedAmount > 256000) return false;
    ws.send(buffer);
    return true;
  }, []);

  const loadOlder = async () => {
    if (!messagesRef.current.length) return;
    const page = await api(`/rooms/${roomId}/messages?before=${messagesRef.current[0].sequence}`);
    upsert(page.messages); setHasMore(page.has_more);
  };

  return { room, messages, partials, connection, error, hasMore, loadOlder, send, sendAudio, upsert };
}
