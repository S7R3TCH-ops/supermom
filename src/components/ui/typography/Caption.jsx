import { useAppTheme } from '../../../context/AppThemeContext';

export default function Caption({ children, style, ...props }) {
  const { T } = useAppTheme();
  return (
    <div style={{
      fontFamily: T.font,
      color: T.inkMuted,
      fontSize: 11,
      fontWeight: 500,
      ...style
    }} {...props}>
      {children}
    </div>
  );
}
