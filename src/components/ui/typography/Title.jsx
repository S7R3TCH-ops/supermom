import { useAppTheme } from '../../../context/AppThemeContext';

export const Title = ({ children, style, component: Component = 'h1', ...props }) => {
  const { T } = useAppTheme();
  return (
    <Component style={{
      fontFamily: T.serif,
      color: T.ink,
      fontSize: 28,
      fontWeight: 600,
      margin: 0,
      ...style
    }} {...props}>
      {children}
    </Component>
  );
};

export default Title;
