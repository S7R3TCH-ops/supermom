import { useAppTheme } from '../../../context/AppThemeContext';

export default function Text({ children, variant = 'primary', style, ...props }) {
  const { T } = useAppTheme();
  let color = T.ink;
  if (variant === 'secondary') color = T.inkSub;
  if (variant === 'muted') color = T.inkMuted;
  return (
    <div style={{
      fontFamily: T.font,
      color,
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.5,
      ...style
    }} {...props}>
      {children}
    </div>
  );
}
