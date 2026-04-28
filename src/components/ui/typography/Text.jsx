import { useAppTheme } from '../../../context/AppThemeContext';

export const Text = ({ children, variant = 'primary', component: Component = 'div', style, ...props }) => {
  const { T } = useAppTheme();
  let color = T.ink;
  if (variant === 'secondary') color = T.inkSub;
  if (variant === 'muted') color = T.inkMuted;
  return (
    <Component style={{
      fontFamily: T.font,
      color,
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.5,
      margin: 0,
      ...style
    }} {...props}>
      {children}
    </Component>
  );
};

export default Text;
