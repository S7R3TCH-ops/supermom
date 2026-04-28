import { useAppTheme } from '../../../context/AppThemeContext';

export const SectionLabel = ({ 
  children, 
  color, 
  style, 
  component: Component = 'div', 
  ...props 
}) => {
  const { T } = useAppTheme();
  
  return (
    <Component style={{
      fontFamily: T.font,
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: '1px',
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
