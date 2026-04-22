import { useAppTheme } from '../../context/AppThemeContext';

export default function SectionLabel({ children }) {
  const { T } = useAppTheme();
  return (
    <div style={{
      fontFamily: T.font,
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '0.7px',
      textTransform: 'uppercase',
      color: T.secLabel,
      marginBottom: 7,
    }}>
      {children}
    </div>
  );
}
