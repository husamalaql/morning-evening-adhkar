import { resolveAudioSources } from './audio-cache.js';
import { initializeNotifications } from './notifications.js';
import { initializeLiveUpdates } from './live-update.js';
import { Share } from '@capacitor/share';

void (async () => {
  window.resolveAdhkarAudioSources = resolveAudioSources;
  window.shareAdhkarContent = (options) => Share.share(options);
  await import('../script.js');
  await initializeLiveUpdates();
  await initializeNotifications();
})();
