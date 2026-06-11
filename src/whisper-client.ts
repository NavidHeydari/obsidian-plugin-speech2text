import type { PluginSettings } from './settings';

export async function transcribeAudio(
  audioBlob: Blob,
  fileName: string,
  settings: PluginSettings,
): Promise<string> {
  const form = new FormData();
  form.append('file', audioBlob, fileName);
  form.append('model', 'whisper-1');
  if (settings.language !== 'auto') {
    form.append('language', settings.language);
  }

  let response: Response;
  try {
    response = await fetch(`${settings.serverUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      body: form,
    });
  } catch {
    throw new Error(`Cannot reach Whisper server at ${settings.serverUrl} — is it running?`);
  }

  if (!response.ok) {
    throw new Error(`Whisper server error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { text?: string };
  if (typeof json.text !== 'string') {
    throw new Error(`Whisper server returned unexpected response format`);
  }
  return json.text;
}
