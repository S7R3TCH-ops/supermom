import { useCallback, useEffect, useRef, useState } from 'react';

export function useIdleTimeout({ timeoutMs, warningMs, onTimeout }) {
  const lastActivityRef = useRef(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const warningActiveRef = useRef(false);
  const countdownRef = useRef(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const reset = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (warningActiveRef.current) {
      warningActiveRef.current = false;
      setShowWarning(false);
      clearInterval(countdownRef.current);
    }
  }, []);

  useEffect(() => {
    const events = ['touchstart', 'click', 'keydown'];
    events.forEach(e => document.addEventListener(e, reset, { passive: true }));

    const checkIdle = () => {
      const idle = Date.now() - lastActivityRef.current;
      const warnAt = timeoutMs - warningMs;

      if (idle >= timeoutMs) {
        clearInterval(countdownRef.current);
        onTimeoutRef.current?.();
        return;
      }

      if (idle >= warnAt && !warningActiveRef.current) {
        warningActiveRef.current = true;
        const secs = Math.ceil((timeoutMs - idle) / 1000);
        setSecondsRemaining(secs);
        setShowWarning(true);

        countdownRef.current = setInterval(() => {
          const remaining = Math.ceil((timeoutMs - (Date.now() - lastActivityRef.current)) / 1000);
          if (remaining <= 0) {
            clearInterval(countdownRef.current);
            onTimeoutRef.current?.();
          } else {
            setSecondsRemaining(remaining);
          }
        }, 1000);
      }
    };

    const intervalId = setInterval(checkIdle, 60_000);

    const onVisibilityChange = () => {
      if (!document.hidden) checkIdle();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(intervalId);
      clearInterval(countdownRef.current);
      events.forEach(e => document.removeEventListener(e, reset));
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [timeoutMs, warningMs, reset]);

  return { showWarning, secondsRemaining, reset };
}
