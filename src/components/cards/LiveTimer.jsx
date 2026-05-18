import { useEffect, useState } from 'react';

export default function LiveTimer({ startTime }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startTime) return;
    const update = () => {
      const diff = Math.max(0, new Date() - new Date(startTime));
      const hh = Math.floor(diff / 3600000);
      const mm = Math.floor((diff % 3600000) / 60000);
      const ss = Math.floor((diff % 60000) / 1000);
      setElapsed(`${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  if (!startTime) return null;

  return (
    <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'monospace', letterSpacing: -1, margin: '8px 0 12px' }}>
      {elapsed}
    </div>
  );
}
