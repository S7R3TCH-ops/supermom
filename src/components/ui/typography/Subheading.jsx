import { useAppTheme } from '../../../context/AppThemeContext';

export const Subheading = ({ 
  children, 
  style, 
  serif = true, 
  component: Component = 'h2', 
  ...props 
}) => {
  const { T } = useAppTheme();
  return (
    <Component style={{
      fontFamily: serif ? T.serif : T.font,
      color: T.ink,
      fontSize: 20,
      fontWeight: 600,
      letterSpacing: serif ? '-0.01em' : 'normal',
      margin: 0,
      ...style
    }} {...props}>
      {children}
    </Component>
  );
};

export default Subheading;
