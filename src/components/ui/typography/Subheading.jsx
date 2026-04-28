import { useAppTheme } from '../../../context/AppThemeContext';

export default function Subheading({ children, style, ...props }) {
  const { T } = useAppTheme();
  return (
    <div style={{
      fontFamily: T.serif,
      color: T.ink,
      fontSize: 20,
      fontWeight: 600,
      ...style
    }} {...props}>
      {children}
    </div>
  );
}
