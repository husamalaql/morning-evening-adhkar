import { resolveAudioSources } from './audio-cache.js';

void (async () => {
  window.resolveAdhkarAudioSources = resolveAudioSources;
  await import('../script.js');
})();
