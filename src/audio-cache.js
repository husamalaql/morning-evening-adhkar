import { Capacitor } from '@capacitor/core';
import { FileTransfer } from '@capacitor/file-transfer';
import { Directory, Filesystem } from '@capacitor/filesystem';

function filenameFor(url, index) {
  const name = new URL(url).pathname.split('/').filter(Boolean).pop() || `recording-${index}.mp3`;
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function resolveNativeAudio(url, index) {
  const path = `adhkar-audio/${filenameFor(url, index)}`;
  const destination = await Filesystem.getUri({ directory: Directory.Data, path });

  try {
    await Filesystem.stat({ directory: Directory.Data, path });
    return Capacitor.convertFileSrc(destination.uri);
  } catch (_) {
    if (!navigator.onLine) {
      throw new Error('هذا التسجيل لم يُحمّل بعد. اتصل بالإنترنت مرة واحدة لتخزينه.');
    }
  }

  try {
    await FileTransfer.downloadFile({ url, path: destination.uri, progress: false });
    return Capacitor.convertFileSrc(destination.uri);
  } catch (error) {
    if (!navigator.onLine) {
      throw new Error('تعذر تنزيل التسجيل. تحقق من اتصال الإنترنت ثم حاول مجدداً.');
    }
    throw error;
  }
}

export async function resolveAudioSources(sources) {
  if (!Array.isArray(sources) || !sources.length) return [];
  if (!Capacitor.isNativePlatform()) return sources;

  const resolved = [];
  for (let index = 0; index < sources.length; index += 1) {
    resolved.push(await resolveNativeAudio(sources[index], index));
  }
  return resolved;
}
