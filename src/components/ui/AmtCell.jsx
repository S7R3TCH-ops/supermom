import { useState } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';

export default function AmtCell({ amount, size = 14, color }) {
  const { T, privacyOn } = useAppTheme();
  const [show, setShow] = useState(false);

  if (!privacyOn) {
    return (
      <span style={{
        fontFamily: T.serif, fontSize: size, fontWeight: 500,
        letterSpacing: '-0.3px', color: color || T.ink,
      }}>{amount}</span>
    );
  }
  return (
    <button
      onClick={() => setShow(v => !v)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      {show ? (
        <span style={{ fontFamily: T.serif, fontSize: size, fontWeight: 500, color: T.pink }}>{amount}</span>
      ) : (
        <span style={{
          fontFamily: T.font, fontSize: size - 2, fontWeight: 700,
          color: T.inkMuted, letterSpacing: '3px',
        }}>•••</span>
      )}
    </button>
  );
}
