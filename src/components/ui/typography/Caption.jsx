import { useAppTheme } from '../../../context/AppThemeContext';

export const Caption = ({ children, style, component: Component = 'div', ...props }) => {
  const { T } = useAppTheme();
  return (
    <Component style={{
      fontFamily: T.font,
      color: T.inkMuted,
      fontSize: 11,
      fontWeight: 500,
      margin: 0,
      ...style
    }} {...props}>
      {children}
    </Component>
  );
};

export default Caption;
