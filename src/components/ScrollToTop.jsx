import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollMainToTop } from '../lib/scrollTop';

export default function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    scrollMainToTop();
  }, [location.key]);
  return null;
}
