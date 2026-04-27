import { useAppTheme } from '../../context/AppThemeContext';

export default function SectionLabel({ children, color }) {
  const { T } = useAppTheme();
  return (
    <div style={{
      fontFamily: T.font,
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: '1px',
      textTransform: 'uppercase',
      color: color || T.secLabel,
      marginBottom: 8,
    }}>
      {children}
    </div>
  );
}
