package dev.jgcmarins.taptopix

import android.content.ComponentName
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.cardemulation.CardEmulation
import android.provider.Settings
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Native bridge around Android's HCE API. Four capabilities exposed to JS:
 *
 * 1. `getPackageName()`
 *    Returns the host app's Android package name. The JS wrapper uses this
 *    to resolve short service names (`.nfc.PixTapToPixService`) into the
 *    fully-qualified form Android's ComponentName expects.
 *
 * 2. `setPreferred(fullyQualifiedServiceName)` / `unsetPreferred()`
 *    Route APDUs for registered AIDs to the host app's HCE service while
 *    the current Activity is foreground. Released on blur.
 *
 * 3. `isDefault(fullyQualifiedServiceName)`
 *    True when the host app's HCE service is the device-wide default
 *    payment app for `CATEGORY_PAYMENT`. The user sets this in Settings.
 *
 * 4. `openTapAndPaySettings()`
 *    Deep-link the user to the Android "Default contactless payment app"
 *    settings screen so they can pick the host app without hunting menus.
 *    Falls back to the general NFC settings screen on OEM skins that do not
 *    expose the specific activity.
 *
 * Debug tag: `adb logcat -s TapToPix:V`
 */
private const val TAG = "TapToPix"

class TapToPixModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TapToPix")

    Function("getPackageName") {
      val activity = appContext.currentActivity
      if (activity == null) {
        Log.w(TAG, "getPackageName: no current Activity")
        return@Function ""
      }
      return@Function activity.packageName
    }

    Function("setPreferred") { serviceClassName: String ->
      val activity = appContext.currentActivity
      if (activity == null) {
        Log.w(TAG, "setPreferred: no current Activity — app likely still booting")
        return@Function false
      }
      val adapter = NfcAdapter.getDefaultAdapter(activity)
      if (adapter == null) {
        Log.w(TAG, "setPreferred: NfcAdapter is null — device has no NFC or it's disabled")
        return@Function false
      }
      val cardEmulation = CardEmulation.getInstance(adapter)
      val component = ComponentName(activity.packageName, serviceClassName)
      val ok = cardEmulation.setPreferredService(activity, component)
      Log.i(TAG, "setPreferred component=${component.flattenToShortString()} result=$ok")
      return@Function ok
    }

    Function("unsetPreferred") {
      val activity = appContext.currentActivity
      if (activity == null) {
        Log.w(TAG, "unsetPreferred: no current Activity")
        return@Function false
      }
      val adapter = NfcAdapter.getDefaultAdapter(activity)
      if (adapter == null) {
        Log.w(TAG, "unsetPreferred: NfcAdapter is null")
        return@Function false
      }
      val cardEmulation = CardEmulation.getInstance(adapter)
      val ok = cardEmulation.unsetPreferredService(activity)
      Log.i(TAG, "unsetPreferred result=$ok")
      return@Function ok
    }

    Function("isDefault") { serviceClassName: String ->
      val activity = appContext.currentActivity
      if (activity == null) {
        Log.w(TAG, "isDefault: no current Activity")
        return@Function false
      }
      val adapter = NfcAdapter.getDefaultAdapter(activity)
      if (adapter == null) {
        Log.w(TAG, "isDefault: NfcAdapter is null")
        return@Function false
      }
      val cardEmulation = CardEmulation.getInstance(adapter)
      val component = ComponentName(activity.packageName, serviceClassName)
      val ok = cardEmulation.isDefaultServiceForCategory(component, CardEmulation.CATEGORY_PAYMENT)
      Log.i(TAG, "isDefault component=${component.flattenToShortString()} result=$ok")
      return@Function ok
    }

    Function("openTapAndPaySettings") {
      val activity = appContext.currentActivity
      if (activity == null) {
        Log.w(TAG, "openTapAndPaySettings: no current Activity")
        return@Function false
      }
      // Settings.ACTION_NFC_PAYMENT_SETTINGS is the public string constant
      // ("android.settings.NFC_PAYMENT_SETTINGS") that lands on the
      // "Default tap-and-pay" chooser on stock Android. Some OEM skins
      // (Xiaomi/MIUI in particular) do not expose that activity — fall
      // back to the general NFC settings screen so the user can still
      // reach the preference manually.
      val primary = Intent(Settings.ACTION_NFC_PAYMENT_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      val fallback = Intent(Settings.ACTION_NFC_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      return@Function try {
        activity.startActivity(primary)
        true
      } catch (primaryError: Throwable) {
        Log.w(TAG, "Primary NFC payment settings intent failed, trying fallback", primaryError)
        try {
          activity.startActivity(fallback)
          true
        } catch (fallbackError: Throwable) {
          Log.e(TAG, "Failed to open any NFC settings screen", fallbackError)
          false
        }
      }
    }
  }
}
