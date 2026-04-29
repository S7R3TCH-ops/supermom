import { useAppTheme } from '../../../context/AppThemeContext';

export const SectionLabel = ({ 
  children, 
  color, 
  style, 
  serif = true, 
  component: Component = 'div', 
  ...props 
}) => {
  const { T } = useAppTheme();
  
  return (
    <Component style={{
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
    </Component>
  );
};

export default SectionLabel;
