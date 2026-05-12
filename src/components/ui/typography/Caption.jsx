import { useAppTheme } from '../../../context/AppThemeContext';

export const Caption = ({ 
  children, 
  style, 
  serif = false, 
  component = 'div', 
  ...props 
}) => {
  const { T } = useAppTheme();
  const Tag = component;
  return (
    <Tag style={{
      fontFamily: serif ? T.serif : T.font,
      color: T.inkMuted,
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: '0.2px',
      margin: 0,
      ...style
    }} {...props}>
      {children}
    </Tag>
  );
};

export default Caption;
