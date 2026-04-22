/**
 * BACEN-published AID for the Pix por aproximação protocol.
 *
 * Reference: BACEN "Especificações do Pix por aproximação para Android" v1.0,
 * 05/06/2025, § 2.1.
 */
export const BACEN_PIX_AID = 'A000000940BCB000';

/**
 * Default service class name (relative to the host app's Android package)
 * where the HCE service is installed by the config plugin. Consumers that
 * override `serviceName` in the plugin options must pass the same value to
 * the runtime helpers.
 */
export const DEFAULT_SERVICE_NAME = '.nfc.PixTapToPixService';

/**
 * Name of the Expo native module exposed to JavaScript. Kept here so both
 * the runtime wrapper and any diagnostic tool agree on the identifier.
 */
export const NATIVE_MODULE_NAME = 'TapToPix';
