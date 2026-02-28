const { withAndroidManifest } = require('@expo/config-plugins');

// Adds the @supersami/rn-foreground-service services to the Android manifest
// with foregroundServiceType="mediaPlayback" for Android 14+ compatibility.
module.exports = function withForegroundService(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application[0];

    if (!app.service) app.service = [];

    const hasMain = app.service.some(
      s => s.$['android:name'] === 'com.supersami.foregroundservice.ForegroundService'
    );
    if (!hasMain) {
      app.service.push({
        $: {
          'android:name': 'com.supersami.foregroundservice.ForegroundService',
          'android:foregroundServiceType': 'mediaPlayback',
          'android:exported': 'false',
        },
      });
    }

    const hasTask = app.service.some(
      s => s.$['android:name'] === 'com.supersami.foregroundservice.ForegroundServiceTask'
    );
    if (!hasTask) {
      app.service.push({
        $: {
          'android:name': 'com.supersami.foregroundservice.ForegroundServiceTask',
          'android:foregroundServiceType': 'mediaPlayback',
          'android:exported': 'false',
        },
      });
    }

    return config;
  });
};
