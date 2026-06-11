import * as fs from 'fs';
import { Recorder } from '../src/recorder';

// ── fs mock ──────────────────────────────────────────────────────────────────
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn().mockResolvedValue([]),
    stat: jest.fn(),
    unlink: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

// ── MediaRecorder mock ────────────────────────────────────────────────────────
class FakeMediaRecorder {
  onstop: (() => void) | null = null;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;

  constructor(public stream: MediaStream) {}
  start() {}
  pause() {}
  resume() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(['audio']) });
    this.onstop?.();
  }
}

const mockGetUserMedia = jest.fn().mockResolvedValue({
  getTracks: () => [{ stop: jest.fn() }],
});

(global as any).MediaRecorder = FakeMediaRecorder;
(global as any).navigator = { mediaDevices: { getUserMedia: mockGetUserMedia } };

// ── state machine ─────────────────────────────────────────────────────────────
describe('Recorder state machine', () => {
  let recorder: Recorder;

  beforeEach(() => {
    recorder = new Recorder('/fake/dir');
    mockGetUserMedia.mockClear();
    (fs.promises.writeFile as jest.Mock).mockClear();
    (fs.promises.mkdir as jest.Mock).mockClear();
  });

  it('starts in idle state', () => {
    expect(recorder.getState()).toBe('idle');
  });

  it('transitions to recording after start()', async () => {
    await recorder.start();
    expect(recorder.getState()).toBe('recording');
  });

  it('calls getUserMedia with audio constraint', async () => {
    await recorder.start();
    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it('does not call getUserMedia a second time if already recording', async () => {
    await recorder.start();
    await recorder.start();
    expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    expect(recorder.getState()).toBe('recording');
  });

  it('transitions to paused after pause()', async () => {
    await recorder.start();
    recorder.pause();
    expect(recorder.getState()).toBe('paused');
  });

  it('pause() is a no-op when idle', () => {
    recorder.pause();
    expect(recorder.getState()).toBe('idle');
  });

  it('transitions back to recording after resume()', async () => {
    await recorder.start();
    recorder.pause();
    recorder.resume();
    expect(recorder.getState()).toBe('recording');
  });

  it('resume() is a no-op when not paused', async () => {
    await recorder.start();
    recorder.resume();
    expect(recorder.getState()).toBe('recording');
  });

  it('transitions to idle after stop() and returns blob + fileName', async () => {
    await recorder.start();
    const result = await recorder.stop();
    expect(recorder.getState()).toBe('idle');
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.fileName).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.webm$/);
  });

  it('writes the recording to disk after stop()', async () => {
    await recorder.start();
    await recorder.stop();
    expect(fs.promises.mkdir).toHaveBeenCalledWith('/fake/dir/recordings', { recursive: true });
    expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
  });

  it('stop() throws when called while idle', async () => {
    await expect(recorder.stop()).rejects.toThrow('Not recording');
  });

  it('transitions to idle after stop() from paused state', async () => {
    await recorder.start();
    recorder.pause();
    const result = await recorder.stop();
    expect(recorder.getState()).toBe('idle');
    expect(result.blob).toBeInstanceOf(Blob);
  });
});

// ── cleanup ───────────────────────────────────────────────────────────────────
describe('Recorder.cleanup()', () => {
  beforeEach(() => {
    (fs.promises.readdir as jest.Mock).mockReset();
    (fs.promises.stat as jest.Mock).mockReset();
    (fs.promises.unlink as jest.Mock).mockReset();
  });

  it('deletes .webm files older than 7 days', async () => {
    const recorder = new Recorder('/fake/dir');
    const oldMtime = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const newMtime = Date.now();
    (fs.promises.readdir as jest.Mock).mockResolvedValue(['old.webm', 'new.webm']);
    (fs.promises.stat as jest.Mock)
      .mockResolvedValueOnce({ mtimeMs: oldMtime })
      .mockResolvedValueOnce({ mtimeMs: newMtime });

    await recorder.cleanup();

    expect(fs.promises.unlink).toHaveBeenCalledWith('/fake/dir/recordings/old.webm');
    expect(fs.promises.unlink).not.toHaveBeenCalledWith('/fake/dir/recordings/new.webm');
  });

  it('ignores non-.webm files', async () => {
    const recorder = new Recorder('/fake/dir');
    (fs.promises.readdir as jest.Mock).mockResolvedValue(['notes.md', 'image.png']);

    await recorder.cleanup();

    expect(fs.promises.stat).not.toHaveBeenCalled();
    expect(fs.promises.unlink).not.toHaveBeenCalled();
  });

  it('does nothing if recordings directory does not exist', async () => {
    const recorder = new Recorder('/fake/dir');
    (fs.promises.readdir as jest.Mock).mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );

    await expect(recorder.cleanup()).resolves.toBeUndefined();
  });
});
