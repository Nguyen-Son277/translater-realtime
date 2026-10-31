import { useCallback, useEffect, useRef, useState } from 'react';
import { MicrophoneCapture } from './audio';
import { newClientId } from './api';

// One session owns the browser capture and every asynchronous callback it creates.
export function useMicrophone({ roomId, send, sendAudio, reconnect }) {
  const [mic, setMic] = useState('idle');
  const [notice, setNotice] = useState('');
  const session = useRef(null);
  const stopRef = useRef(null);
  const release = useCallback(current => {
    clearTimeout(current.timer);
    current.allowed = false;
    void current.capture.stop();
    if (session.current === current) { session.current = null; setMic('idle'); }
  }, []);

  const stop = useCallback(async (notify = true) => {
    const current = session.current;
    if (!current) return;
    if (!notify) { release(current); return; }
    if (current.phase === 'stopping') return;
    current.phase = 'stopping'; setMic('stopping'); clearTimeout(current.timer);
    // Flush only the active session; no frames are buffered for replay after reconnect.
    await current.capture.stop({ flush: current.allowed });
    current.allowed = false;
    if (session.current !== current) return;
    if (!current.requested) { release(current); return; }
    if (!send({ type: 'audio.stop', capture_id: current.id })) {
      release(current); reconnect(); return;
    }
    current.timer = setTimeout(() => {
      if (session.current !== current) return;
      release(current);
      setNotice('Chưa xác nhận được việc tắt micro. Đang kết nối lại; hãy bấm bắt đầu để nghe tiếp.');
      reconnect();
    }, 5000);
  }, [release, send, reconnect]);
  stopRef.current = stop;

  const handleEvent = useCallback(event => {
    if (event.type === 'disconnected') {
      if (session.current) {
        release(session.current);
        setNotice('Micro đã dừng vì mất kết nối. Phần lời nói chưa gửi có thể bị mất; hãy nói lại sau khi kết nối và bấm bắt đầu.');
      }
      return;
    }
    // A stopped session may report that its remaining transcription failed. Show
    // that notice without letting its old capture ID change the current microphone.
    if (event.type === 'error' && event.code === 'speech_drain_timeout') {
      setNotice(event.detail); return;
    }
    const current = session.current;
    // New clients require correlated replies; uncorrelated replies remain usable with old servers.
    if (event.capture_id && event.capture_id !== current?.id) return;
    if (event.type === 'audio.state') {
      if (!current) return;
      if (!event.recording) { release(current); return; }
      if (current.phase !== 'starting') return;
      clearTimeout(current.timer); current.allowed = true; current.phase = 'listening'; setMic('listening');
    } else if (event.type === 'error') {
      setNotice(event.detail);
      if (current && ['speech_unavailable', 'capture_in_use', 'audio_queue_full', 'audio_not_started', 'invalid_audio', 'capture_busy'].includes(event.code)) release(current);
    }
  }, [release]);

  const start = useCallback(async () => {
    if (session.current) return;
    const current = { id: newClientId(), capture: new MicrophoneCapture(), phase: 'starting', allowed: false, requested: false };
    session.current = current; setNotice(''); setMic('starting');
    try {
      await current.capture.start(buffer => {
        if (session.current !== current || !current.allowed) return;
        if (!sendAudio(buffer)) {
          current.allowed = false;
          release(current);
          // Closing the socket also releases a server lease if its stop packet cannot arrive.
          reconnect();
          setNotice('Micro đã dừng vì mạng chậm. Âm thanh chưa gửi không được phát lại; hãy kết nối lại rồi nói lại.');
        }
      }, () => {
        if (session.current !== current) return;
        void stopRef.current?.();
        setNotice('Micro đã bị ngắt. Kiểm tra micro rồi bấm Bắt đầu nghe để thử lại.');
      });
      if (session.current !== current || current.phase !== 'starting') { await current.capture.stop(); return; }
      current.requested = true;
      if (!send({ type: 'audio.start', capture_id: current.id })) throw new Error('Chưa kết nối được phòng. Hãy thử lại sau.');
      current.timer = setTimeout(() => {
        if (session.current !== current || current.phase !== 'starting') return;
        void stopRef.current?.(); setNotice('Chưa mở được phiên nhận giọng nói. Hãy thử lại.');
      }, 12000);
    } catch (err) {
      if (session.current !== current) return;
      release(current); setNotice(err.message);
      if (current.requested) reconnect();
    }
  }, [send, sendAudio, reconnect, release]);

  useEffect(() => {
    const hidden = () => {
      if (document.hidden && session.current) {
        void stopRef.current?.();
        setNotice('Micro đã tạm dừng khi bạn chuyển ứng dụng hoặc khóa màn hình. Bấm bắt đầu để nghe tiếp.');
      }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      const current = session.current;
      if (current) {
        if (current.requested) send({ type: 'audio.stop', capture_id: current.id });
        release(current);
      }
    };
  }, [roomId, send, release]);
  return { mic, notice, setNotice, start, stop, handleEvent };
}
