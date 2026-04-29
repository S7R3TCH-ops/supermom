import { useAppTheme } from '../../../context/AppThemeContext';

export const Caption = ({ 
  children, 
  style, 
  serif = false,
  component: Component = 'div', 
  ...props 
}) => {
  const { T } = useAppTheme();
  return (
    <Component style={{
      fontFamily: serif ? T.serif : T.font,
      color: T.inkMuted,
      fontSize: 12,
      fontWeight: 500,
      margin: 0,
      ...style
    }} {...props}>
      {children}
    </Component>
  );
};

export default Caption;
