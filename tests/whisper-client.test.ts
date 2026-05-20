import { transcribeAudio } from '../src/whisper-client';
import { DEFAULT_SETTINGS } from '../src/settings';

global.fetch = jest.fn();

describe('transcribeAudio', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POSTs to /v1/audio/transcriptions and returns the text field', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'hello world' }),
    });

    const result = await transcribeAudio(new Blob(['audio']), 'test.mp3', DEFAULT_SETTINGS);

    expect(result).toBe('hello world');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/v1/audio/transcriptions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws a descriptive error on non-2xx response', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(
      transcribeAudio(new Blob(['audio']), 'test.mp3', DEFAULT_SETTINGS),
    ).rejects.toThrow('Whisper server error: 500 Internal Server Error');
  });

  it('omits language param when language is "auto"', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'hello' }),
    });

    await transcribeAudio(new Blob(['audio']), 'test.mp3', {
      ...DEFAULT_SETTINGS,
      language: 'auto',
    });

    const body: FormData = (fetch as jest.Mock).mock.calls[0][1].body;
    expect(body.get('language')).toBeNull();
  });

  it('includes language param when a specific language is set', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'سلام' }),
    });

    await transcribeAudio(new Blob(['audio']), 'test.mp3', {
      ...DEFAULT_SETTINGS,
      language: 'fa',
    });

    const body: FormData = (fetch as jest.Mock).mock.calls[0][1].body;
    expect(body.get('language')).toBe('fa');
  });
});
