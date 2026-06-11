import * as http from 'http';
import type { Recorder } from './recorder';

export class ControlServer {
  private server: http.Server | null = null;

  constructor(
    private readonly port: number,
    private readonly recorder: Recorder,
    private readonly onStop: () => Promise<void>,
    private readonly onError: (message: string) => void = () => {},
  ) {}

  start(): void {
    this.server = http.createServer(this.handleRequest.bind(this));
    this.server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        this.onError(
          `Speech2Text: control server failed to start — port ${this.port} already in use`,
        );
      }
    });
    this.server.listen(this.port, '127.0.0.1');
  }

  stop(): Promise<void> {
    return new Promise(resolve => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
      this.server = null;
    });
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    res.setHeader('Content-Type', 'application/json');
    const url = req.url ?? '';

    try {
      if (url === '/status') {
        const state = this.recorder.getState();
        res.writeHead(200);
        res.end(JSON.stringify({ recording: state !== 'idle', state }));
        return;
      }

      if (url === '/start') {
        if (this.recorder.getState() === 'idle') await this.recorder.start();
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (url === '/stop') {
        if (this.recorder.getState() !== 'idle') await this.onStop();
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (url === '/toggle') {
        if (this.recorder.getState() === 'idle') {
          await this.recorder.start();
        } else {
          await this.onStop();
        }
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'not found' }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  }
}
