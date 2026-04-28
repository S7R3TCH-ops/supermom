import { useAppTheme } from '../../../context/AppThemeContext';

export const Subheading = ({ children, component: Component = 'h2', style, ...props }) => {
  const { T } = useAppTheme();
  return (
    <Component style={{
      fontFamily: T.serif,
      color: T.ink,
      fontSize: 20,
      fontWeight: 600,
      margin: 0,
      ...style
    }} {...props}>
      {children}
    </Component>
  );
};

export default Subheading;
