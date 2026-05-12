import { useAppTheme } from '../../../context/AppThemeContext';

export const SectionLabel = ({ 
  children, 
  color, 
  style, 
  serif = true, 
  component = 'div', 
  ...props 
}) => {
  const { T } = useAppTheme();
  const Tag = component;
  
  return (
    <Tag style={{
      fontFamily: serif ? T.serif : T.font,
      fontSize: 10,
      fontWeight: serif ? 700 : 800,
      letterSpacing: serif ? '0.05em' : '1px',
      textTransform: 'uppercase',
      color: color || T.secLabel,
      margin: 0,
      marginBottom: 8,
      ...style
    }} {...props}>
      {children}
    </Tag>
  );
};

export default SectionLabel;
