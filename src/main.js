import { resolveAudioSources } from './audio-cache.js';
import { initializeNotifications } from './notifications.js';
import { initializeLiveUpdates } from './live-update.js';
import { Share } from '@capacitor/share';
import { App } from '@capacitor/app';
import { initializeApkUpdates } from './apk-updater.js';

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
  window.getAdhkarNativeAppInfo = () => App.getInfo();
  await import('../script.js');
  await App.addListener('backButton', () => {
    const apkDialog = document.getElementById('apk-update-backdrop');
    if (apkDialog?.dataset.downloading === 'true') return;
    const nestedDialog = apkDialog
      || document.getElementById('contact-confirm-backdrop')
      || document.getElementById('share-confirm-backdrop');

    if (nestedDialog) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      return;
    }

    const mainDialog = document.getElementById('dialog-backdrop');
    if (mainDialog && !mainDialog.hidden) {
      document.getElementById('dialog-close')?.click();
      return;
    }

    void App.exitApp();
  });
  await initializeLiveUpdates();
  await initializeApkUpdates();
  await initializeNotifications();
})();
