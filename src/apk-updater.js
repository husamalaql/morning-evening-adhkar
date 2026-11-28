import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { FileTransfer } from '@capacitor/file-transfer';
import { Filesystem, Directory } from '@capacitor/filesystem';

const ApkInstaller = registerPlugin('ApkInstaller');
const MANIFEST_URL = 'https://raw.githubusercontent.com/husamalaql/morning-evening-adhkar/main/apk-update-manifest.json';
const MANIFEST_TIMEOUT_MS = 12000;
let manifestCache = null;
let activeManifest = null;
let downloadInProgress = false;

function isAndroidApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function compareVersions(left, right) {
  const a = String(left).split('.').map(Number);
  const b = String(right).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] || 0) - (b[i] || 0);
    if (difference) return difference > 0 ? 1 : -1;
  }
  return 0;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = MANIFEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error('انتهت مهلة الاتصال بخادم التحديثات');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getManifest(force = false) {
  if (manifestCache && !force) return manifestCache;
  const response = await fetchWithTimeout(MANIFEST_URL + '?t=' + Date.now(), { cache: 'no-store' });
  if (!response.ok) throw new Error('تعذر الاتصال بخادم التحديثات');
  const manifest = await response.json();
  if (!manifest.version || !manifest.apk || !manifest.apk['arm64-v8a']) {
    throw new Error('ملف تحديث APK غير صالح');
  }
  manifestCache = manifest;
  return manifest;
}

export async function checkApkUpdate({ silent = true } = {}) {
  if (!isAndroidApp()) return { status: 'unsupported' };
  const [manifest, appInfo] = await Promise.all([getManifest(true), App.getInfo()]);
  activeManifest = manifest;
  if (compareVersions(manifest.version, appInfo.version) <= 0) {
    return { status: 'current', version: appInfo.version };
  }
  const result = { status: 'available', version: manifest.version, notes: manifest.notes || '', required: Boolean(manifest.required) };
  if (!silent) window.showAdhkarApkUpdatePrompt?.(result);
  return result;
}

export async function downloadAndInstallApkUpdate() {
  if (downloadInProgress) throw new Error('يوجد تنزيل تحديث جارٍ بالفعل');
  downloadInProgress = true;
  try {
  if (!isAndroidApp()) throw new Error('تحديث APK متاح على أندرويد فقط');
  const manifest = activeManifest || await getManifest(true);
  let abi;
  try {
    ({ abi } = await ApkInstaller.getDeviceAbi());
  } catch (_) {
    return {
      status: 'manual-install-required',
      url: 'https://github.com/husamalaql/morning-evening-adhkar/releases/tag/v' + manifest.version
    };
  }
  const apkUrl = manifest.apk[abi];
  if (!apkUrl) throw new Error('لا توجد نسخة APK مناسبة لهذا الجهاز');

  const permission = await ApkInstaller.canInstallUnknownApps();
  if (!permission.granted) {
    await ApkInstaller.openInstallUnknownAppsSettings();
    return { status: 'permission-required' };
  }

  const directory = 'updates';
  await Filesystem.mkdir({ directory: Directory.Data, path: directory, recursive: true }).catch(() => {});
  const fileName = `adhkar-${manifest.version}.apk`;
  const filePath = `${directory}/${fileName}`;
  const fileInfo = await Filesystem.getUri({ directory: Directory.Data, path: filePath });

  // Always remove a previously cached APK before downloading. Older versions
  // reused any non-empty file with the same version name, even if it was stale.
  await Filesystem.deleteFile({ directory: Directory.Data, path: filePath }).catch(() => {});
  const progressListener = await FileTransfer.addListener('progress', event => {
    const total = Number(event.contentLength || event.total || 0);
    const received = Number(event.bytes || event.loaded || 0);
    const percent = total > 0 ? Math.max(0, Math.min(99, received / total * 100)) : 0;
    window.updateAdhkarApkDownloadProgress?.(percent);
  });
  try {
    await FileTransfer.downloadFile({ url: apkUrl, path: fileInfo.uri, progress: true });
  } catch (error) {
    await Filesystem.deleteFile({ directory: Directory.Data, path: filePath }).catch(() => {});
    throw error;
  } finally {
    await progressListener.remove();
  }

  const downloaded = await Filesystem.stat({ directory: Directory.Data, path: filePath });
  if (!downloaded.size || downloaded.size < 500000) {
    await Filesystem.deleteFile({ directory: Directory.Data, path: filePath }).catch(() => {});
    throw new Error('لم يكتمل تنزيل ملف التحديث');
  }

  window.updateAdhkarApkDownloadProgress?.(100);
  await ApkInstaller.installApk({ filePath: fileInfo.uri });
  return { status: 'installer-opened', version: manifest.version };
  } finally {
    downloadInProgress = false;
  }
}

export async function initializeApkUpdates() {
  if (!isAndroidApp()) return;
  window.checkAdhkarApkUpdate = checkApkUpdate;
  window.downloadAndInstallAdhkarApkUpdate = downloadAndInstallApkUpdate;
  // APK updates are checked only when the user taps the unified update button.
}
