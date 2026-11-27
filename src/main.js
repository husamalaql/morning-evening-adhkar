import { resolveAudioSources } from './audio-cache.js';
import { initializeNotifications } from './notifications.js';
import { initializeLiveUpdates } from './live-update.js';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

void (async () => {
  window.resolveAdhkarAudioSources = resolveAudioSources;
  window.shareAdhkarContent = async (options) => {
    const file = await Filesystem.writeFile({
      path: options.fileName || 'adhkar-app-links.txt',
      data: options.text || '',
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    });
    return Share.share({
      title: options.title || 'أذكار الصباح والمساء',
      files: [file.uri],
      dialogTitle: options.dialogTitle || 'مشاركة تطبيق الأذكار'
    });
  };
  await import('../script.js');
  await initializeLiveUpdates();
  await initializeNotifications();
})();
