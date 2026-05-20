import type { App } from 'obsidian';
import type { PluginSettings } from './settings';

export function truncateAtWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen);
  // If the character immediately after the slice is a space, the slice ends on a word boundary
  if (text[maxLen] === ' ') return slice;
  const lastSpace = slice.lastIndexOf(' ');
  return lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
}

export function buildContext(transcript: string): string {
  const clean = transcript.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  if (clean.length < 50) return clean;
  const words = clean.split(' ');
  let result = '';
  for (const word of words) {
    const candidate = result ? `${result} ${word}` : word;
    if (candidate.length >= 50) break;
    result = candidate;
  }
  return result;
}

export function buildNoteName(transcript: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${dateStr} ${timeStr}__${buildContext(transcript)}.md`;
}

export function buildNotePath(folder: string, name: string): string {
  const normalized = folder.replace(/^\/+|\/+$/g, '');
  return normalized ? `${normalized}/${name}` : name;
}

export async function createNote(
  app: App,
  transcript: string,
  settings: PluginSettings,
): Promise<string> {
  const name = buildNoteName(transcript);
  const path = buildNotePath(settings.outputFolder, name);

  const folderPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
    await app.vault.createFolder(folderPath);
  }

  await app.vault.create(path, transcript);
  return name;
}
