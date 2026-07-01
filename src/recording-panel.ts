import { App, Modal, Notice } from 'obsidian';
import type { Recorder } from './recorder';

export class RecordingPanel extends Modal {
  private startBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private browseBtn!: HTMLButtonElement;
  private statusEl!: HTMLElement;

  constructor(
    app: App,
    private readonly recorder: Recorder,
    private readonly transcribe: (blob: Blob, fileName: string) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Speech2Text' });

    const btnRow = contentEl.createDiv();
    btnRow.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;';

    this.startBtn = btnRow.createEl('button', { text: '▶ Start' });
    this.pauseBtn = btnRow.createEl('button', { text: '⏸ Pause' });
    this.stopBtn = btnRow.createEl('button', { text: '⏹ Stop' });

    const sep = contentEl.createEl('p', { text: '── or ──' });
    sep.style.cssText = 'text-align:center;color:var(--text-muted);margin:8px 0;';

    this.browseBtn = contentEl.createEl('button', { text: '📂 Browse File' });

    const fileInput = contentEl.createEl('input');
    fileInput.type = 'file';
    fileInput.accept = '.mp3,.wav,.m4a,.webm,.ogg,.flac';
    fileInput.style.display = 'none';

    this.statusEl = contentEl.createEl('p', { text: 'Status: Idle' });
    this.statusEl.style.cssText = 'margin-top:12px;color:var(--text-muted);';

    this.startBtn.onclick = async () => {
      try {
        await this.recorder.start();
      } catch (err) {
        new Notice(`Microphone error: ${(err as Error).message}`);
        return;
      }
      this.syncButtons();
    };

    this.pauseBtn.onclick = () => {
      if (this.recorder.getState() === 'recording') {
        this.recorder.pause();
      } else {
        this.recorder.resume();
      }
      this.syncButtons();
    };

    this.stopBtn.onclick = async () => {
      let result: { blob: Blob; fileName: string };
      try {
        result = await this.recorder.stop();
      } catch (err) {
        new Notice(`Stop failed: ${(err as Error).message}`);
        return;
      }
      this.close();
      await this.transcribe(result.blob, result.fileName);
    };

    this.browseBtn.onclick = () => fileInput.click();

    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      this.close();
      await this.transcribe(file, file.name);
    };

    this.syncButtons();
  }

  private syncButtons(): void {
    const state = this.recorder.getState();

    this.startBtn.disabled = state !== 'idle';
    this.pauseBtn.disabled = state === 'idle';
    this.stopBtn.disabled = state === 'idle';
    this.browseBtn.disabled = state !== 'idle';

    this.pauseBtn.textContent = state === 'paused' ? '▶ Resume' : '⏸ Pause';

    const statusText: Record<typeof state, string> = {
      idle: 'Status: Idle',
      recording: 'Status: Recording…',
      paused: 'Status: Paused',
    };
    this.statusEl.textContent = statusText[state];
  }

  onClose(): void {
    if (this.recorder.getState() !== 'idle') {
      this.recorder.stop().catch(() => {});
    }
    this.contentEl.empty();
  }
}
