import * as http from 'http';
import { ControlServer } from '../src/control-server';

const TEST_PORT = 27999;

function get(path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${TEST_PORT}${path}`, res => {
        let raw = '';
        res.on('data', chunk => (raw += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }),
        );
      })
      .on('error', reject);
  });
}

describe('ControlServer', () => {
  let server: ControlServer;
  const mockRecorder = {
    getState: jest.fn<'idle' | 'recording' | 'paused', []>(),
    start: jest.fn<Promise<void>, []>(),
  };
  const mockOnStop = jest.fn<Promise<void>, []>();
  const mockOnError = jest.fn<void, [string]>();

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRecorder.getState.mockReturnValue('idle');
    mockRecorder.start.mockResolvedValue(undefined);
    mockOnStop.mockResolvedValue(undefined);
    server = new ControlServer(TEST_PORT, mockRecorder as any, mockOnStop, mockOnError);
    server.start();
    // give the server a tick to bind
    await new Promise(r => setTimeout(r, 20));
  });

  afterEach(async () => {
    await server.stop();
  });

  // /status
  it('GET /status returns idle state', async () => {
    mockRecorder.getState.mockReturnValue('idle');
    const { status, body } = await get('/status');
    expect(status).toBe(200);
    expect(body).toEqual({ recording: false, state: 'idle' });
  });

  it('GET /status returns recording:true when state is recording', async () => {
    mockRecorder.getState.mockReturnValue('recording');
    const { body } = await get('/status');
    expect(body).toEqual({ recording: true, state: 'recording' });
  });

  it('GET /status returns recording:true when state is paused', async () => {
    mockRecorder.getState.mockReturnValue('paused');
    const { body } = await get('/status');
    expect(body).toEqual({ recording: true, state: 'paused' });
  });

  // /start
  it('GET /start calls recorder.start() when idle', async () => {
    mockRecorder.getState.mockReturnValue('idle');
    const { status, body } = await get('/start');
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mockRecorder.start).toHaveBeenCalledTimes(1);
  });

  it('GET /start does not call recorder.start() when already recording', async () => {
    mockRecorder.getState.mockReturnValue('recording');
    await get('/start');
    expect(mockRecorder.start).not.toHaveBeenCalled();
  });

  // /stop
  it('GET /stop calls onStop when recording', async () => {
    mockRecorder.getState.mockReturnValue('recording');
    const { status } = await get('/stop');
    expect(status).toBe(200);
    expect(mockOnStop).toHaveBeenCalledTimes(1);
  });

  it('GET /stop does not call onStop when idle', async () => {
    mockRecorder.getState.mockReturnValue('idle');
    await get('/stop');
    expect(mockOnStop).not.toHaveBeenCalled();
  });

  // /toggle
  it('GET /toggle starts recording when idle', async () => {
    mockRecorder.getState.mockReturnValue('idle');
    await get('/toggle');
    expect(mockRecorder.start).toHaveBeenCalledTimes(1);
    expect(mockOnStop).not.toHaveBeenCalled();
  });

  it('GET /toggle stops when recording', async () => {
    mockRecorder.getState.mockReturnValue('recording');
    await get('/toggle');
    expect(mockOnStop).toHaveBeenCalledTimes(1);
    expect(mockRecorder.start).not.toHaveBeenCalled();
  });

  it('GET /toggle stops when paused', async () => {
    mockRecorder.getState.mockReturnValue('paused');
    await get('/toggle');
    expect(mockOnStop).toHaveBeenCalledTimes(1);
  });

  // unknown path
  it('GET /unknown returns 404', async () => {
    const { status, body } = await get('/unknown');
    expect(status).toBe(404);
    expect(body).toEqual({ error: 'not found' });
  });
});
