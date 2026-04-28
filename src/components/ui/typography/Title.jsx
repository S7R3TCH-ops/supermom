import { useAppTheme } from '../../../context/AppThemeContext';

export function Title({ children, component: Component = 'h1', style, ...props }) {
  const { T } = useAppTheme();
  return (
    <Component style={{
      fontFamily: T.serif,
      color: T.ink,
      fontSize: 28,
      fontWeight: 600,
      margin: 0, // Reset default margin for semantic tags
      ...style
    }} {...props}>
      {children}
    </Component>
  );
}

export default Title;
