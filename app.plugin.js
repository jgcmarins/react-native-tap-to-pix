// Entry point for Expo's config-plugin resolver. Re-exports the built plugin
// so that `["react-native-tap-to-pix", options]` in app.json resolves here.
module.exports = require('./plugin/build');
