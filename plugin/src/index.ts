import {
  AndroidConfig,
  ConfigPlugin,
  withAndroidManifest,
  withDangerousMod,
  withStringsXml,
} from '@expo/config-plugins';
import fs from 'fs';
import path from 'path';

export type TapToPixPluginOptions = {
  /**
   * Relative class name for the HCE service, starting with a dot. Written
   * into AndroidManifest.xml and resolved against the host app's
   * `android.package` at build time.
   *
   * Default: `.nfc.PixTapToPixService`.
   */
  serviceName?: string;

  /**
   * Short label shown next to the HCE service in the Android Default
   * Contactless Payment App picker. Keep it under ~30 characters.
   *
   * Default: `Tap to Pix`.
   */
  description?: string;

  /**
   * Description shown in Android's tap-and-pay settings for the AID group
   * registered by this plugin.
   *
   * Default: `Pagamentos Pix por aproximacao`.
   */
  aidGroupDescription?: string;
};

const DEFAULT_SERVICE_NAME = '.nfc.PixTapToPixService';
const DEFAULT_DESCRIPTION = 'Tap to Pix';
const DEFAULT_AID_GROUP_DESCRIPTION = 'Pagamentos Pix por aproximacao';
const BIND_NFC_SERVICE_PERMISSION = 'android.permission.BIND_NFC_SERVICE';

const withTapToPixManifest: ConfigPlugin<TapToPixPluginOptions> = (config, props) => {
  const serviceName = props?.serviceName ?? DEFAULT_SERVICE_NAME;

  return withAndroidManifest(config, (cfg) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manifest = cfg.modResults.manifest as any;

    manifest['uses-permission'] = manifest['uses-permission'] || [];
    const hasNfcPermission = manifest['uses-permission'].some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => p.$?.['android:name'] === 'android.permission.NFC',
    );
    if (!hasNfcPermission) {
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.NFC' },
      });
    }

    manifest['uses-feature'] = manifest['uses-feature'] || [];
    const hasHceFeature = manifest['uses-feature'].some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (f: any) => f.$?.['android:name'] === 'android.hardware.nfc.hce',
    );
    if (!hasHceFeature) {
      manifest['uses-feature'].push(
        {
          $: {
            'android:name': 'android.hardware.nfc',
            'android:required': 'true',
          },
        },
        {
          $: {
            'android:name': 'android.hardware.nfc.hce',
            'android:required': 'true',
          },
        },
      );
    }

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    application.service = application.service || [];
    const existing = application.service.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.$?.['android:name'] === serviceName,
    );
    if (!existing) {
      application.service.push({
        $: {
          'android:name': serviceName,
          'android:exported': 'true',
          'android:permission': BIND_NFC_SERVICE_PERMISSION,
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name':
                    'android.nfc.cardemulation.action.HOST_APDU_SERVICE',
                },
              },
            ],
            category: [
              { $: { 'android:name': 'android.intent.category.DEFAULT' } },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.nfc.cardemulation.host_apdu_service',
              'android:resource': '@xml/apduservice',
            },
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    }

    return cfg;
  });
};

const withTapToPixStrings: ConfigPlugin<TapToPixPluginOptions> = (config, props) => {
  const description = props?.description ?? DEFAULT_DESCRIPTION;
  const aidGroupDescription =
    props?.aidGroupDescription ?? DEFAULT_AID_GROUP_DESCRIPTION;

  return withStringsXml(config, (cfg) => {
    cfg.modResults = AndroidConfig.Strings.setStringItem(
      [
        {
          $: { name: 'tap_to_pix_description', translatable: 'false' },
          _: description,
        },
        {
          $: { name: 'tap_to_pix_aid_group', translatable: 'false' },
          _: aidGroupDescription,
        },
      ],
      cfg.modResults,
    );
    return cfg;
  });
};

const withTapToPixFiles: ConfigPlugin<TapToPixPluginOptions> = (config) => {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const platformRoot = cfg.modRequest.platformProjectRoot;

      // Templates ship inside the published npm package at
      // `android-native-templates/`. Resolve via __dirname so the path is
      // correct both at dev-time (plugin/src/index.ts) and at consume-time
      // (plugin/build/index.js) — two levels up from either is the package
      // root.
      const templatesDir = path.resolve(
        __dirname,
        '..',
        '..',
        'android-native-templates',
      );

      const apduXmlDest = path.join(
        platformRoot,
        'app/src/main/res/xml/apduservice.xml',
      );
      fs.mkdirSync(path.dirname(apduXmlDest), { recursive: true });
      fs.copyFileSync(path.join(templatesDir, 'apduservice.xml'), apduXmlDest);

      const pkg = cfg.android?.package;
      if (!pkg) {
        throw new Error(
          '[react-native-tap-to-pix] Missing android.package in app config.',
        );
      }
      const ktDest = path.join(
        platformRoot,
        'app/src/main/java',
        pkg.replace(/\./g, '/'),
        'nfc/PixTapToPixService.kt',
      );
      fs.mkdirSync(path.dirname(ktDest), { recursive: true });
      const ktSource = fs
        .readFileSync(path.join(templatesDir, 'PixTapToPixService.kt.tmpl'), 'utf8')
        .replace(/__PACKAGE__/g, pkg);
      fs.writeFileSync(ktDest, ktSource);

      return cfg;
    },
  ]);
};

const withTapToPix: ConfigPlugin<TapToPixPluginOptions> = (config, props) => {
  config = withTapToPixManifest(config, props);
  config = withTapToPixStrings(config, props);
  config = withTapToPixFiles(config, props);
  return config;
};

export default withTapToPix;
module.exports = withTapToPix;
