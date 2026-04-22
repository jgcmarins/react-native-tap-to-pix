# react-native-tap-to-pix

React Native library that implements BACEN's **"Pix por aproximação para Android"** (Tap to Pix) protocol end-to-end. Ships the Android HCE service, the AID registration, the Expo config plugin, and a native bridge for the "Default contactless payment app" Android settings. Android only.

> iOS is not supported. Apple does not currently allow third-party HCE services to claim Pix AIDs in Brazil; this library deliberately does not ship speculative iOS fallbacks.

## What this library does

1. Registers your app as an HCE (Host Card Emulation) service under the BACEN Tap to Pix AID `A000000940BCB000`, `category="payment"`.
2. Handles the full APDU state machine from a Pix-compatible POS terminal (`SELECT AID`, chunked `UPDATE BINARY`, short and extended Lc forms).
3. Reassembles the NDEF URI record and fires `Intent.ACTION_VIEW` on the extracted `pix://<host>?qr=<URL-encoded EMV>` URI.
4. Exposes a native bridge for `CardEmulation.setPreferredService` (foreground override), `isDefaultServiceForCategory` (default-app check), and a deep link to the Android "Default contactless payment app" settings screen.

## What it does NOT do

- Payment UI, PIN, biometrics, confirmation screens.
- Backend integration with any Pix BaaS provider.
- Deep-link routing — register your own `pix` scheme intent filter and handle the URI however you want.
- iOS anything.

The library's contract ends at `Intent.ACTION_VIEW`: after a successful tap, your app receives a `pix://...?qr=<EMV>` URL through the intent filter you registered. Everything from there is your code.

## Install

```bash
npm install react-native-tap-to-pix
npx expo prebuild --clean
```

Requires Expo SDK 52+, React Native 0.76+, and `expo-dev-client` installed in the host app.

## Setup

### 1. Add the config plugin

In `app.json`:

```json
{
  "expo": {
    "plugins": [
      ["react-native-tap-to-pix", {
        "serviceName": ".nfc.PixTapToPixService",
        "description": "Tap to Pix",
        "aidGroupDescription": "Pagamentos Pix por aproximacao"
      }]
    ]
  }
}
```

All options are optional. Defaults shown.

| Option | Default | Notes |
| --- | --- | --- |
| `serviceName` | `.nfc.PixTapToPixService` | Relative class name, starts with a dot. Written into `AndroidManifest.xml` and resolved against `android.package` at build time. |
| `description` | `Tap to Pix` | Short label shown next to your service in the Android Default Contactless Payment App picker. |
| `aidGroupDescription` | `Pagamentos Pix por aproximacao` | Description shown for the AID group in Android's tap-and-pay settings. |

### 2. Register the `pix` scheme in your app

Still in `app.json`:

```json
{
  "expo": {
    "scheme": ["yourapp", "pix"],
    "android": {
      "package": "com.yourapp",
      "intentFilters": [
        {
          "action": "VIEW",
          "category": ["DEFAULT", "BROWSABLE"],
          "data": [{ "scheme": "pix" }],
          "autoVerify": false
        }
      ]
    }
  }
}
```

### 3. Handle the `pix://` URI

When the user taps a POS, Android fires `Intent.ACTION_VIEW` on a URL like `pix://cielo.com.br?qr=<URL-encoded EMV>`. Your app receives it via the `pix` scheme intent filter. With `expo-router` a catch-all route works well:

```tsx
// app/[...rest].tsx
import { useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function CatchAll() {
  const router = useRouter();
  const params = useLocalSearchParams<{ qr?: string | string[] }>();
  const dispatched = useRef(false);

  useEffect(() => {
    if (dispatched.current) return;
    dispatched.current = true;

    const qr =
      typeof params.qr === 'string'
        ? params.qr
        : Array.isArray(params.qr)
        ? params.qr[0]
        : null;

    if (qr) {
      // The library's job is done. Hand off to your own payment flow.
      router.replace({ pathname: '/payment', params: { emv: qr } });
      return;
    }

    router.replace('/');
  }, [params, router]);

  return null;
}
```

The `qr` query param is already URL-decoded by expo-router. It is the Pix "Copia e Cola" EMV string — it starts with `000201`. Post it to your PSP (Pix BaaS) to decode and create a charge.

### 4. (Optional) Claim the AID while your screen is focused

`setPreferredService` is a foreground override — it makes the OS route taps to your HCE service while your Activity is in foreground, even if another app is the device-wide default. The `useTapToPixPreferred` hook handles the mount/blur lifecycle for you:

```tsx
import { useTapToPixPreferred } from 'react-native-tap-to-pix';

export default function PaymentOptionsScreen() {
  useTapToPixPreferred();
  return <View>...</View>;
}
```

This is **in addition to** the user marking your app as the Default Contactless Payment App in Android Settings — not a replacement. The default-app setting is the primary mechanism; this hook is an extra safety net for when your screen is visible.

### 5. (Optional) Check default-app status and open Android settings

```tsx
import { isDefault, openTapAndPaySettings } from 'react-native-tap-to-pix';

if (!isDefault()) {
  openTapAndPaySettings(); // drops the user on the Android default-payment chooser
}
```

## API

All runtime functions are no-ops (return `false` / `null`) when the native module isn't available (iOS, web, or the module failed to link).

```ts
import {
  setPreferred,
  unsetPreferred,
  isDefault,
  openTapAndPaySettings,
  useTapToPixPreferred,
  parsePixUri,
  BACEN_PIX_AID,
  DEFAULT_SERVICE_NAME,
} from 'react-native-tap-to-pix';
```

| Export | Signature | Purpose |
| --- | --- | --- |
| `setPreferred` | `(options?: { serviceName?: string }) => boolean` | Claim the AID while your Activity is foreground. |
| `unsetPreferred` | `() => boolean` | Release the foreground claim. |
| `isDefault` | `(options?: { serviceName?: string }) => boolean` | Whether your HCE service is the device-wide default payment app. |
| `openTapAndPaySettings` | `() => boolean` | Deep link the user to the Android default-payment chooser. |
| `useTapToPixPreferred` | `(options?: { serviceName?: string }) => void` | Hook: calls `setPreferred` on mount and `unsetPreferred` on blur/unmount, handles AppState transitions. |
| `parsePixUri` | `(uri: string) => { host, qr, params } \| null` | Pure helper to extract the EMV from a `pix://...?qr=...` URI. |
| `BACEN_PIX_AID` | `'A000000940BCB000'` | The AID this library registers. |
| `DEFAULT_SERVICE_NAME` | `'.nfc.PixTapToPixService'` | Default HCE service class (relative to host `android.package`). |

## Default Contactless Payment App — a note

Because the BACEN Pix AID shares the `category="payment"` namespace with Google Wallet, the user must manually set your app as the Default Contactless Payment App in Android Settings. Same UX every bank app uses — this is an Android security policy, not something any app can self-promote around.

Expect to build onboarding UI in your app that:

1. Checks `isDefault()`.
2. If `false`, shows a banner / card instructing the user to enable it.
3. Calls `openTapAndPaySettings()` when the user taps the CTA (drops them on the exact Android screen).
4. Re-checks `isDefault()` when the user returns (e.g. on `AppState.active`).

The library stays UI-free so you can design this to match your app.

## Verifying HCE registration

After `expo prebuild --clean` and a local build:

```bash
adb shell dumpsys nfc | grep -A 5 "A000000940BCB000"
```

Must show:

```
"A000000940BCB000" (category: payment)
    ComponentInfo{com.yourapp/.nfc.PixTapToPixService}
```

`category: payment` is non-negotiable — Android refuses to let `category="other"` services preempt Google Wallet via `setPreferredService`. If you see `other`, the APK was built from a stale manifest: `adb uninstall com.yourapp` then `adb install` a fresh build.

## Reference

- [BACEN "Especificações do Pix por aproximação para Android" v1.0, 05/06/2025](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/especificacoes_pix_aproximacao_android.pdf) — authoritative protocol reference.
- NFC Forum URI Record Type Definition — the URI prefix abbreviation table used by the NDEF parser.

## Status

Protocol validated against a live Cielo POS terminal. The library's plumbing is frozen relative to the BACEN spec v1.0; changes to `0.x` will be API-level refinements. Track open items on [GitHub Issues](https://github.com/jgcmarins/react-native-tap-to-pix/issues).

## License

MIT © jgcmarins
