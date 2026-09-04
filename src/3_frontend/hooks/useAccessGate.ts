import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  subscribeActiveSessions,
  claimSession,
  heartbeat,
  releaseSession,
  MAX_CONCURRENT_SESSIONS,
  SESSION_HEARTBEAT_MS,
  IDLE_TIMEOUT_MS,
} from '../../2_backend/services/sessionService';

export type AccessStatus = 'checking' | 'waiting' | 'granted' | 'idle';

export function useAccessGate(user: User | null) {
  const [status, setStatus] = useState<AccessStatus>('checking');
  const [activeCount, setActiveCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const grantedRef = useRef(false);

  // Reactive capacity check: grants access the instant a slot is free.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeActiveSessions((sessions) => {
      const amIActive = sessions.some((s) => s.uid === user.uid);
      const otherCount = sessions.filter((s) => s.uid !== user.uid).length;
      setActiveCount(otherCount);

      if (amIActive) {
        grantedRef.current = true;
        setStatus('granted');
      } else if (otherCount < MAX_CONCURRENT_SESSIONS) {
        claimSession(user.uid, user.email || '');
      } else if (!grantedRef.current) {
        setStatus('waiting');
      }
    });
    return unsub;
  }, [user]);

  // Keep-alive ping so this session doesn't look stale to others.
  useEffect(() => {
    if (status !== 'granted' || !user) return;
    const interval = setInterval(() => heartbeat(user.uid, user.email || ''), SESSION_HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [status, user]);

  // Release the slot after a minute of no interaction.
  useEffect(() => {
    if (status !== 'granted' || !user) return;
    let idleTimer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        releaseSession(user.uid);
        grantedRef.current = false;
        setStatus('idle');
      }, IDLE_TIMEOUT_MS);
    };
    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((e) => window.addEventListener(e, resetIdle));
    resetIdle();
    return () => {
      clearTimeout(idleTimer);
      events.forEach((e) => window.removeEventListener(e, resetIdle));
    };
  }, [status, user]);

  // Visible countdown while waiting (real admission is reactive, above).
  useEffect(() => {
    if (status !== 'waiting') {
      setSecondsLeft(60);
      return;
    }
    setSecondsLeft(60);
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 60 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const resume = () => setStatus('checking');

  return { status, activeCount, secondsLeft, resume };
}