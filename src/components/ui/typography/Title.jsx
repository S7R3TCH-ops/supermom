import { useAppTheme } from '../../../context/AppThemeContext';

export const Title = ({ 
  children, 
  style, 
  serif = true, 
  component = 'h1', 
  ...props 
}) => {
  const { T } = useAppTheme();
  const Tag = component;
  return (
    <Tag style={{
      fontFamily: serif ? T.serif : T.font,
      color: T.ink,
      fontSize: 28,
      fontWeight: 600,
      letterSpacing: serif ? '-0.02em' : 'normal',
      margin: 0,
      ...style
    }} {...props}>
      {children}
    </Tag>
  );
};

export default Title;
