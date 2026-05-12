import { useAppTheme } from '../../../context/AppThemeContext';

export const Subheading = ({ 
  children, 
  style, 
  serif = true, 
  component = 'h2', 
  ...props 
}) => {
  const { T } = useAppTheme();
  const Tag = component;
  return (
    <Tag style={{
      fontFamily: serif ? T.serif : T.font,
      color: T.ink,
      fontSize: 20,
      fontWeight: 500,
      letterSpacing: serif ? '-0.01em' : 'normal',
      margin: 0,
      ...style
    }} {...props}>
      {children}
    </Tag>
  );
};

export default Subheading;
