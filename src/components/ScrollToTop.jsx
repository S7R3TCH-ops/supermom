import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll('.sm-scroll').forEach(el => { el.scrollTop = 0; });
  }, [location.key]);
  return null;
}
