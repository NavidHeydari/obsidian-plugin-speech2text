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

  const response = await fetch(`${settings.serverUrl}/v1/audio/transcriptions`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Whisper server error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { text: string };
  return json.text;
}
