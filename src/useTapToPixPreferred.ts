import { useEffect } from 'react';
import { AppState } from 'react-native';

import { setPreferred, unsetPreferred, TapToPixOptions } from './TapToPixModule';

/**
 * Claim the Tap to Pix AID while the calling screen is mounted and the app
 * is in the foreground. Re-claims on `AppState` transitions back to
 * `active`, releases on background and on unmount.
 *
 * This is a foreground override — the primary mechanism is still the
 * device-wide Default Contactless Payment App selection the user makes in
 * Android Settings. Use this hook to increase routing reliability while
 * relevant screens are visible; do not use it as a substitute for the
 * default-app setup.
 */
export const useTapToPixPreferred = (options?: TapToPixOptions): void => {
  const serviceName = options?.serviceName;

  useEffect(() => {
    const claim = () => setPreferred({ serviceName });
    const release = () => unsetPreferred();

    claim();

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        claim();
        return;
      }
      release();
    });

    return () => {
      subscription.remove();
      release();
    };
  }, [serviceName]);
};
