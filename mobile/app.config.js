// Adds the Firebase file for Android push. On EAS the file comes from the file variable GOOGLE_SERVICES_JSON
// (eas env:create ... --type file), locally from mobile/google-services.json; neither is in git. See docs/ZASTITA.md 3.9.
module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json' },
});
