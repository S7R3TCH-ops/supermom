import { useAppTheme } from '../../../context/AppThemeContext';

export const Text = ({ 
  children, 
  variant = 'primary', 
  style, 
  serif = false,
  component: Component = 'div', 
  ...props 
}) => {
  const { T } = useAppTheme();
  let color = T.ink;
  if (variant === 'secondary') color = T.inkSub;
  if (variant === 'muted') color = T.inkMuted;
  return (
    <Component style={{
      fontFamily: serif ? T.serif : T.font,
      color,
      fontSize: 16,
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
