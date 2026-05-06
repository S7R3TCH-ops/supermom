/**
 * Subtle haptic feedback for mobile devices.
 */
export function triggerHaptic(type = 'light') {
  if (!window.navigator || !window.navigator.vibrate) return;

  switch (type) {
    case 'light':
      window.navigator.vibrate(10);
      break;
    case 'medium':
      window.navigator.vibrate(20);
      break;
    case 'heavy':
      window.navigator.vibrate([30, 50, 30]);
      break;
    case 'success':
      window.navigator.vibrate([10, 30, 10]);
      break;
    case 'error':
      window.navigator.vibrate([50, 100, 50, 100]);
      break;
    default:
      window.navigator.vibrate(10);
  }
}
