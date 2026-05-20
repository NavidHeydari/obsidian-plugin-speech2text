import { App, Modal, Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, PluginSettings, SpeechToTextSettingTab } from './settings';
import { transcribeAudio } from './whisper-client';
import { createNote } from './note-creator';

class TranscribeModal extends Modal {
  constructor(app: App, private onFile: (blob: Blob, name: string) => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Transcribe Audio File' });
    contentEl.createEl('p', {
      text: 'Select an audio file (MP3, WAV, M4A, WebM, OGG, FLAC) to transcribe.',
    });

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp3,.wav,.m4a,.webm,.ogg,.flac';
    input.style.marginTop = '1em';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      this.close();
      this.onFile(file, file.name);
    };
    contentEl.appendChild(input);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export default class SpeechToTextPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new SpeechToTextSettingTab(this.app, this));

    this.addRibbonIcon('microphone', 'Transcribe audio file', () => {
      this.openTranscribeModal();
    });

    this.addCommand({
      id: 'transcribe-audio-file',
      name: 'Transcribe audio file',
      callback: () => this.openTranscribeModal(),
    });
  }

  private openTranscribeModal(): void {
    new TranscribeModal(this.app, (blob, name) => {
      this.transcribe(blob, name);
    }).open();
  }

  async transcribe(audioBlob: Blob, fileName: string): Promise<void> {
    const notice = new Notice('Transcribing…', 0);
    try {
      const transcript = await transcribeAudio(audioBlob, fileName, this.settings);
      const noteName = await createNote(this.app, transcript, this.settings);
      notice.hide();
      new Notice(`Saved → ${noteName}`);
    } catch (err) {
      notice.hide();
      new Notice(`Transcription failed: ${(err as Error).message}`);
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
