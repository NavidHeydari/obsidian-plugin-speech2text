import * as fs from 'fs';
import * as path from 'path';

type RecorderState = 'idle' | 'recording' | 'paused';

export class Recorder {
  private state: RecorderState = 'idle';
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private readonly recordingsDir: string;

  constructor(private readonly pluginDir: string) {
    this.recordingsDir = path.join(pluginDir, 'recordings');
  }

  getState(): RecorderState {
    return this.state;
  }

  async start(): Promise<void> {
    if (this.state !== 'idle') return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
    this.state = 'recording';
  }

  pause(): void {
    if (this.state !== 'recording') return;
    this.mediaRecorder?.pause();
    this.state = 'paused';
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.mediaRecorder?.resume();
    this.state = 'recording';
  }

  async stop(): Promise<{ blob: Blob; fileName: string }> {
    if (this.state === 'idle') throw new Error('Not recording');
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return reject(new Error('No active recorder'));
      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, { type: 'audio/webm' });
          this.chunks = [];
          this.stream?.getTracks().forEach(t => t.stop());
          this.stream = null;
          this.mediaRecorder = null;
          this.state = 'idle';

          const fileName = this.buildFileName();
          await fs.promises.mkdir(this.recordingsDir, { recursive: true });
          const buffer = Buffer.from(await blob.arrayBuffer());
          await fs.promises.writeFile(path.join(this.recordingsDir, fileName), buffer);

          resolve({ blob, fileName });
        } catch (err) {
          reject(err);
        }
      };
      this.mediaRecorder.stop();
    });
  }

  async cleanup(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.recordingsDir);
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      await Promise.all(
        files
          .filter(f => f.endsWith('.webm'))
          .map(async f => {
            const filePath = path.join(this.recordingsDir, f);
            const { mtimeMs } = await fs.promises.stat(filePath);
            if (mtimeMs < cutoff) await fs.promises.unlink(filePath);
          }),
      );
    } catch {
      // recordings directory doesn't exist yet — ignore
    }
  }

  private buildFileName(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.webm`
    );
  }
}
