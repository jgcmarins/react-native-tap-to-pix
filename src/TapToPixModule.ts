import { requireOptionalNativeModule } from 'expo-modules-core';

import { DEFAULT_SERVICE_NAME, NATIVE_MODULE_NAME } from './constants';

type NativeBridge = {
  getPackageName(): string;
  setPreferred(fullyQualifiedServiceName: string): boolean;
  unsetPreferred(): boolean;
  isDefault(fullyQualifiedServiceName: string): boolean;
  openTapAndPaySettings(): boolean;
};

const nativeModule = requireOptionalNativeModule<NativeBridge>(NATIVE_MODULE_NAME);

export type TapToPixOptions = {
  /**
   * HCE service class name. Accepted forms:
   *   - Short form (preferred): `.nfc.PixTapToPixService`. Leading dot, the
   *     host app's Android package is prepended at runtime.
   *   - Fully qualified: `com.example.app.nfc.PixTapToPixService`.
   *
   * Defaults to the value installed by the config plugin
   * (`DEFAULT_SERVICE_NAME`). Override only if you customized `serviceName`
   * in the plugin options.
   */
  serviceName?: string;
};

/**
 * Resolve the caller-supplied service name to the fully-qualified form that
 * Android's `ComponentName` expects. Returns `null` when the native module
 * is not available (iOS, web, or unlinked build).
 */
const resolveServiceName = (serviceName: string | undefined): string | null => {
  if (!nativeModule) return null;
  const name = serviceName ?? DEFAULT_SERVICE_NAME;
  if (!name.startsWith('.')) return name;
  try {
    return nativeModule.getPackageName() + name;
  } catch {
    return null;
  }
};

/**
 * Claim the Tap to Pix AID while the current Activity is in foreground.
 * Returns `false` off-device, without the native module, without an NFC
 * adapter, or when Android refuses the claim (for example when no
 * foreground Activity is available).
 */
export const setPreferred = (options?: TapToPixOptions): boolean => {
  if (!nativeModule) return false;
  const name = resolveServiceName(options?.serviceName);
  if (!name) return false;
  try {
    return nativeModule.setPreferred(name);
  } catch {
    return false;
  }
};

/**
 * Release the foreground-preferred claim when the screen loses focus.
 */
export const unsetPreferred = (): boolean => {
  if (!nativeModule) return false;
  try {
    return nativeModule.unsetPreferred();
  } catch {
    return false;
  }
};

/**
 * True when the host app's HCE service is the device-wide "Default
 * contactless payment app". Returns `false` without the native module,
 * without an NFC adapter, or when another app holds the default.
 */
export const isDefault = (options?: TapToPixOptions): boolean => {
  if (!nativeModule) return false;
  const name = resolveServiceName(options?.serviceName);
  if (!name) return false;
  try {
    return nativeModule.isDefault(name);
  } catch {
    return false;
  }
};

/**
 * Open the Android "Default contactless payment app" settings screen so the
 * user can mark this app as the default. Falls back to the general NFC
 * settings page on OEM skins that do not expose the specific activity
 * (Xiaomi/MIUI is the known case). Returns `false` when neither intent
 * could be dispatched.
 */
export const openTapAndPaySettings = (): boolean => {
  if (!nativeModule) return false;
  try {
    return nativeModule.openTapAndPaySettings();
  } catch {
    return false;
  }
};
