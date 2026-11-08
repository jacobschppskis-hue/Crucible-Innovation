// A light tap felt in the hand, where the platform allows it: Android (and other browsers with the Vibration API)
// get a short pulse. iOS Safari has no Vibration API, but since iOS 18 flipping a switch control (`<input type="checkbox"
// switch>`) plays the system's selection haptic, also when its label is clicked from a user gesture; so on iOS a
// throwaway, hidden, aria-hidden switch is flipped and removed in the same task. It never takes focus, never reaches
// the accessibility tree and does nothing where it isn't supported. Call it only from a user gesture (a click).
const ios = () =>
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent)));

export function haptic(ms = 8) {
  if (typeof navigator === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
      return;
    }
    if (!ios()) return;
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;clip-path:inset(50%)';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    label.click();
    label.remove();
  } catch {
    /* no haptics here: the bar's own motion carries the press */
  }
}
