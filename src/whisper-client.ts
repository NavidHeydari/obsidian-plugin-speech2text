import type { PluginSettings } from './settings';
import { logError } from './logger';

function buildCurl(url: string, fileName: string, settings: PluginSettings): string {
  const parts = [
    `curl -X POST "${url}"`,
    `-F "file=@${fileName}"`,
    `-F "model=${settings.model}"`,
  ];
  if (settings.language !== 'auto') {
    parts.push(`-F "language=${settings.language}"`);
  }
  return parts.join(' ');
}

export async function transcribeAudio(
  audioBlob: Blob,
  fileName: string,
  settings: PluginSettings,
): Promise<string> {
  const form = new FormData();
  form.append('file', audioBlob, fileName);
  form.append('model', settings.model);
  if (settings.language !== 'auto') {
    form.append('language', settings.language);
  }

  const url = `${settings.serverUrl}/v1/audio/transcriptions`;
  const curl = buildCurl(url, fileName, settings);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: form,
    });
  } catch (error) {
    await logError('whisper-client: fetch failed', error, { serverUrl: settings.serverUrl, curl, fileName });
    throw new Error(`Cannot reach Whisper server at ${settings.serverUrl} — is it running?`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '<unreadable body>');
    await logError('whisper-client: non-ok response', new Error(body), {
      serverUrl: settings.serverUrl,
      curl,
      fileName,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(`Whisper server error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { text?: string };
  if (typeof json.text !== 'string') {
    await logError('whisper-client: unexpected response shape', new Error('missing text field'), {
      serverUrl: settings.serverUrl,
      curl,
      fileName,
      json,
    });
    throw new Error(`Whisper server returned unexpected response format`);
  }
  return json.text;
}
