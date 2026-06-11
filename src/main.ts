import { FileSystemAdapter, Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, PluginSettings, SpeechToTextSettingTab } from './settings';
import { transcribeAudio } from './whisper-client';
import { createNote } from './note-creator';
import { Recorder } from './recorder';
import { RecordingPanel } from './recording-panel';
import { ControlServer } from './control-server';

export default class SpeechToTextPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  private recorder!: Recorder;
  private controlServer: ControlServer | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new SpeechToTextSettingTab(this.app, this));

    this.recorder = new Recorder(this.getPluginDir());
    await this.recorder.cleanup();

    if (this.settings.controlServerEnabled) {
      this.controlServer = new ControlServer(
        this.settings.controlServerPort,
        this.recorder,
        () => this.stopAndTranscribe(),
        msg => new Notice(msg),
      );
      this.controlServer.start();
    }

    this.addRibbonIcon('microphone', 'Speech2Text', () => {
      new RecordingPanel(this.app, this.recorder, (blob, fileName) =>
        this.transcribe(blob, fileName),
      ).open();
    });
  }

  onunload(): void {
    this.controlServer?.stop();
    if (this.recorder?.getState() !== 'idle') {
      new Notice('Speech2Text: recording discarded — Obsidian is closing');
      this.recorder.stop().catch(() => {});
    }
  }

  async transcribe(blob: Blob, fileName: string): Promise<void> {
    const notice = new Notice('Transcribing…', 0);
    try {
      const transcript = await transcribeAudio(blob, fileName, this.settings);
      const noteName = await createNote(this.app, transcript, this.settings);
      notice.hide();
      new Notice(`Saved → ${noteName}`);
    } catch (err) {
      notice.hide();
      new Notice(`Transcription failed: ${(err as Error).message}`);
    }
  }

  private async stopAndTranscribe(): Promise<void> {
    const { blob, fileName } = await this.recorder.stop();
    await this.transcribe(blob, fileName);
  }

  private getPluginDir(): string {
    const adapter = this.app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) {
      return adapter.getFullPath(this.manifest.dir ?? '');
    }
    throw new Error('Speech2Text requires a local vault (desktop only)');
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
