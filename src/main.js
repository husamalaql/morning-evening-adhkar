import { resolveAudioSources } from './audio-cache.js';
import { initializeNotifications } from './notifications.js';

void (async () => {
  window.resolveAdhkarAudioSources = resolveAudioSources;
  await import('../script.js');
  await initializeNotifications();
})();
