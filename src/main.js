import { resolveAudioSources } from './audio-cache.js';
import { initializeNotifications } from './notifications.js';
import { initializeLiveUpdates } from './live-update.js';
import { Share } from '@capacitor/share';

void (async () => {
  window.resolveAdhkarAudioSources = resolveAudioSources;
  window.shareAdhkarContent = async (options) => {
    const text = options.text || '';
    if (!text.trim()) throw new Error('لا يوجد محتوى لمشاركته.');
    return Share.share({
      title: options.title || 'أذكار الصباح والمساء',
      text,
      dialogTitle: options.dialogTitle || 'مشاركة تطبيق الأذكار'
    });
  };
  await import('../script.js');
  await initializeLiveUpdates();
  await initializeNotifications();
})();
