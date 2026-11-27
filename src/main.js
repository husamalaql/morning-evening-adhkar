import { resolveAudioSources } from './audio-cache.js';
import { initializeNotifications } from './notifications.js';
import { initializeLiveUpdates } from './live-update.js';

void (async () => {
  window.resolveAdhkarAudioSources = resolveAudioSources;
  await import('../script.js');
  await initializeLiveUpdates();
  await initializeNotifications();
})();
