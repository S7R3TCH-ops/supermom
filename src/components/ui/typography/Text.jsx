import { useAppTheme } from '../../../context/AppThemeContext';

export const Text = ({ 
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
      color: T.ink,
      fontSize: 15,
      fontWeight: 400,
      lineHeight: 1.5,
      margin: 0,
      ...style
    }} {...props}>
      {children}
    </Tag>
  );
};

export default Text;
