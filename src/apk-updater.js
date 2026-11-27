import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { FileTransfer } from '@capacitor/file-transfer';
import { Filesystem, Directory } from '@capacitor/filesystem';

const ApkInstaller = registerPlugin('ApkInstaller');
const MANIFEST_URL = 'https://raw.githubusercontent.com/husamalaql/morning-evening-adhkar/main/apk-update-manifest.json';
let manifestCache = null;
let activeManifest = null;

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

async function getManifest(force = false) {
  if (manifestCache && !force) return manifestCache;
  const response = await fetch(MANIFEST_URL + '?t=' + Date.now(), { cache: 'no-store' });
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
  const apkUrl = manifest.apk[abi] || manifest.apk['arm64-v8a'];
  if (!apkUrl) throw new Error('لا توجد نسخة APK مناسبة لهذا الجهاز');

  const directory = 'updates';
  await Filesystem.mkdir({ directory: Directory.Data, path: directory, recursive: true }).catch(() => {});
  const fileName = `adhkar-${manifest.version}.apk`;
  const filePath = `${directory}/${fileName}`;
  const fileInfo = await Filesystem.getUri({ directory: Directory.Data, path: filePath });

  const existing = await Filesystem.stat({ directory: Directory.Data, path: filePath }).catch(() => null);
  if (!existing?.size) {
    await FileTransfer.downloadFile({ url: apkUrl, path: fileInfo.uri, progress: false });
  }

  const downloaded = await Filesystem.stat({ directory: Directory.Data, path: filePath });
  if (!downloaded.size || downloaded.size < 500000) {
    await Filesystem.deleteFile({ directory: Directory.Data, path: filePath }).catch(() => {});
    throw new Error('لم يكتمل تنزيل ملف التحديث');
  }

  const permission = await ApkInstaller.canInstallUnknownApps();
  if (!permission.granted) {
    await ApkInstaller.openInstallUnknownAppsSettings();
    return { status: 'permission-required' };
  }

  await ApkInstaller.installApk({ filePath: fileInfo.uri });
  return { status: 'installer-opened', version: manifest.version };
}

export async function initializeApkUpdates() {
  if (!isAndroidApp()) return;
  window.checkAdhkarApkUpdate = checkApkUpdate;
  window.downloadAndInstallAdhkarApkUpdate = downloadAndInstallApkUpdate;
  try {
    const result = await checkApkUpdate({ silent: true });
    if (result.status === 'available') window.showAdhkarApkUpdatePrompt?.(result);
  } catch (error) {
    console.warn('APK update check failed:', error);
  }
}
