# Speech2Text Plugin — MVP 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Obsidian plugin that lets a user pick a local audio file, transcribes it via a local Whisper-compatible HTTP server, and saves the transcript as a timestamped vault note.

**Architecture:** Four focused modules: `settings.ts` (config + UI), `whisper-client.ts` (HTTP POST), `note-creator.ts` (pure naming logic + vault write), and `main.ts` (plugin entry, ribbon button, TranscribeModal). No recorder, control server, or server-manager in MVP 1.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild (bundler), Jest + ts-jest (tests), Node 18+

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `manifest.json` | Obsidian plugin metadata |
| Create | `package.json` | npm scripts + devDependencies |
| Create | `tsconfig.json` | TypeScript compiler config |
| Create | `esbuild.config.mjs` | Build/watch script |
| Create | `jest.config.js` | Test runner config |
| Create | `__mocks__/obsidian.ts` | Stub Obsidian module for Jest |
| Create | `src/settings.ts` | PluginSettings type, defaults, SettingTab UI |
| Create | `src/note-creator.ts` | Pure name-building functions + vault.create wrapper |
| Create | `src/whisper-client.ts` | HTTP POST to /v1/audio/transcriptions |
| Create | `src/main.ts` | Plugin class, TranscribeModal, wiring |
| Create | `tests/note-creator.test.ts` | Unit tests for name-building logic |
| Create | `tests/whisper-client.test.ts` | Unit tests for HTTP client |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `manifest.json`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `jest.config.js`
- Create: `__mocks__/obsidian.ts`
- Create: `src/main.ts` (bootstrap stub)

- [ ] **Step 1: Create `manifest.json`**

```json
{
  "id": "obsidian-speech2text",
  "name": "Speech2Text",
  "version": "0.1.0",
  "minAppVersion": "1.0.0",
  "description": "Transcribe audio files via a local Whisper server and save as timestamped notes.",
  "author": "navidheydari",
  "authorUrl": "",
  "isDesktopOnly": true
}
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "obsidian-speech2text",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production",
    "test": "jest"
  },
  "devDependencies": {
    "@types/jest": "^29.0.0",
    "@types/node": "^20.0.0",
    "esbuild": "^0.20.0",
    "jest": "^29.0.0",
    "obsidian": "latest",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES2018",
    "allowSyntheticDefaultImports": true,
    "moduleResolution": "node",
    "strict": true,
    "lib": ["ES2018", "DOM"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "tests", "__mocks__"]
}
```

- [ ] **Step 4: Create `esbuild.config.mjs`**

```javascript
import esbuild from 'esbuild';

const prod = process.argv[2] === 'production';

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
  format: 'cjs',
  target: 'es2018',
  outfile: 'main.js',
  minify: prod,
  sourcemap: prod ? false : 'inline',
});

if (prod) {
  await ctx.rebuild();
  await ctx.dispose();
} else {
  await ctx.watch();
  console.log('Watching for changes…');
}
```

- [ ] **Step 5: Create `jest.config.js`**

```javascript
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/__mocks__/obsidian.ts',
  },
  testMatch: ['**/tests/**/*.test.ts'],
};
```

- [ ] **Step 6: Create `__mocks__/obsidian.ts`**

```typescript
export class Plugin {
  app: any;
  loadData = jest.fn(async () => ({}));
  saveData = jest.fn(async () => {});
  addSettingTab = jest.fn();
  addRibbonIcon = jest.fn();
  addCommand = jest.fn();
}

export class PluginSettingTab {
  containerEl = { empty: jest.fn(), createEl: jest.fn() };
  constructor(public app: any, public plugin: any) {}
}

export class Setting {
  constructor(_containerEl: any) {}
  setName = jest.fn(() => this);
  setDesc = jest.fn(() => this);
  addText = jest.fn((_cb: any) => this);
}

export class Notice {
  constructor(_message: string, _timeout?: number) {}
  hide = jest.fn();
}

export class Modal {
  contentEl = { empty: jest.fn(), createEl: jest.fn(), appendChild: jest.fn() };
  constructor(public app: any) {}
  open = jest.fn();
  close = jest.fn();
}

export class App {}
```

- [ ] **Step 7: Create bootstrap `src/main.ts`** (minimal — just enough for esbuild to succeed)

```typescript
import { Plugin } from 'obsidian';

export default class SpeechToTextPlugin extends Plugin {
  async onload() {
    console.log('Speech2Text loaded');
  }
}
```

- [ ] **Step 8: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 9: Verify build compiles**

```bash
npm run build
```

Expected: `main.js` appears in repo root, no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add manifest.json package.json tsconfig.json esbuild.config.mjs jest.config.js __mocks__/obsidian.ts src/main.ts
git commit -m "chore: scaffold plugin build toolchain"
```

---

## Task 2: Settings Module

**Files:**
- Create: `src/settings.ts`

- [ ] **Step 1: Create `src/settings.ts`**

```typescript
import { App, PluginSettingTab, Setting } from 'obsidian';
import type SpeechToTextPlugin from './main';

export interface PluginSettings {
  serverUrl: string;
  outputFolder: string;
  language: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  serverUrl: 'http://localhost:8000',
  outputFolder: '/',
  language: 'auto',
};

export class SpeechToTextSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: SpeechToTextPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Whisper server URL')
      .setDesc('URL of your local Whisper server (e.g. http://localhost:8000)')
      .addText(text =>
        text
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async value => {
            this.plugin.settings.serverUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Output folder')
      .setDesc('Vault-relative folder for new notes (use / for vault root)')
      .addText(text =>
        text
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async value => {
            this.plugin.settings.outputFolder = value.trim() || '/';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Language')
      .setDesc('Language code (e.g. en, fa) or "auto" for auto-detect')
      .addText(text =>
        text
          .setValue(this.plugin.settings.language)
          .onChange(async value => {
            this.plugin.settings.language = value.trim() || 'auto';
            await this.plugin.saveSettings();
          }),
      );
  }
}
```

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/settings.ts
git commit -m "feat: add settings module with server URL, output folder, language"
```

---

## Task 3: Note Creator (TDD)

**Files:**
- Create: `tests/note-creator.test.ts`
- Create: `src/note-creator.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/note-creator.test.ts`:

```typescript
import {
  truncateAtWordBoundary,
  buildContext,
  buildNoteName,
  buildNotePath,
} from '../src/note-creator';

describe('truncateAtWordBoundary', () => {
  it('returns string unchanged when under limit', () => {
    expect(truncateAtWordBoundary('hello world', 50)).toBe('hello world');
  });

  it('truncates at the nearest word boundary', () => {
    expect(truncateAtWordBoundary('the quick brown fox jumped over', 15)).toBe('the quick brown');
  });

  it('hard-truncates when no space exists', () => {
    expect(truncateAtWordBoundary('superlongwordwithoutspaces', 10)).toBe('superlongw');
  });

  it('handles exactly maxLen chars', () => {
    expect(truncateAtWordBoundary('hello world', 11)).toBe('hello world');
  });
});

describe('buildContext', () => {
  it('strips special characters', () => {
    expect(buildContext('hello, world! how are you?')).toBe('hello world how are you');
  });

  it('truncates long transcripts to ≤50 chars at a word boundary', () => {
    // "the quarterly review is next week and I want to" = 47 chars
    // "the quarterly review is next week and I want to be" = 50 chars
    const transcript = 'the quarterly review is next week and I want to be there';
    const result = buildContext(transcript);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result).toBe('the quarterly review is next week and I want to');
  });

  it('handles empty string', () => {
    expect(buildContext('')).toBe('');
  });

  it('collapses multiple spaces', () => {
    expect(buildContext('hello   world')).toBe('hello   world');
  });
});

describe('buildNoteName', () => {
  it('formats as YYYY-MM-DD HH-MM-SS__<context>.md', () => {
    const fixed = new Date(2026, 4, 19, 14, 32, 55); // month is 0-indexed
    expect(buildNoteName('hello world', fixed)).toBe('2026-05-19 14-32-55__hello world.md');
  });

  it('zero-pads single-digit month, day, hour, minute, second', () => {
    const fixed = new Date(2026, 0, 5, 9, 5, 3);
    expect(buildNoteName('test', fixed)).toBe('2026-01-05 09-05-03__test.md');
  });

  it('applies buildContext to the transcript', () => {
    const fixed = new Date(2026, 4, 19, 0, 0, 0);
    expect(buildNoteName('hello, world!', fixed)).toBe('2026-05-19 00-00-00__hello world.md');
  });
});

describe('buildNotePath', () => {
  it('returns just filename for root folder /', () => {
    expect(buildNotePath('/', 'note.md')).toBe('note.md');
  });

  it('returns just filename for empty folder', () => {
    expect(buildNotePath('', 'note.md')).toBe('note.md');
  });

  it('prepends folder for non-root folder', () => {
    expect(buildNotePath('notes', 'note.md')).toBe('notes/note.md');
  });

  it('strips leading and trailing slashes from folder', () => {
    expect(buildNotePath('/notes/', 'note.md')).toBe('notes/note.md');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --testPathPattern=note-creator
```

Expected output contains: `Cannot find module '../src/note-creator'`

- [ ] **Step 3: Create `src/note-creator.ts`**

```typescript
import type { App } from 'obsidian';
import type { PluginSettings } from './settings';

export function truncateAtWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  return lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
}

export function buildContext(transcript: string): string {
  const clean = transcript.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  return truncateAtWordBoundary(clean, 50);
}

export function buildNoteName(transcript: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${dateStr} ${timeStr}__${buildContext(transcript)}.md`;
}

export function buildNotePath(folder: string, name: string): string {
  const normalized = folder.replace(/^\/+|\/+$/g, '');
  return normalized ? `${normalized}/${name}` : name;
}

export async function createNote(
  app: App,
  transcript: string,
  settings: PluginSettings,
): Promise<string> {
  const name = buildNoteName(transcript);
  const path = buildNotePath(settings.outputFolder, name);

  const folderPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
    await app.vault.createFolder(folderPath);
  }

  await app.vault.create(path, transcript);
  return name;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --testPathPattern=note-creator
```

Expected: all tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/note-creator.ts tests/note-creator.test.ts
git commit -m "feat: add note-creator with timestamp naming and word-boundary truncation"
```

---

## Task 4: Whisper Client (TDD)

**Files:**
- Create: `tests/whisper-client.test.ts`
- Create: `src/whisper-client.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/whisper-client.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --testPathPattern=whisper-client
```

Expected output contains: `Cannot find module '../src/whisper-client'`

- [ ] **Step 3: Create `src/whisper-client.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --testPathPattern=whisper-client
```

Expected: all tests pass, 0 failures.

- [ ] **Step 5: Run all tests to confirm nothing broken**

```bash
npm test
```

Expected: all tests pass across both suites.

- [ ] **Step 6: Commit**

```bash
git add src/whisper-client.ts tests/whisper-client.test.ts
git commit -m "feat: add whisper-client with fetch POST and language param handling"
```

---

## Task 5: Main Plugin

**Files:**
- Modify: `src/main.ts` (replace bootstrap stub with full implementation)

- [ ] **Step 1: Replace `src/main.ts` with the full plugin**

```typescript
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
  settings: PluginSettings;

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
```

- [ ] **Step 2: Build in production mode**

```bash
npm run build
```

Expected: `main.js` rebuilt, no TypeScript errors, exits 0.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: complete MVP 1 — file-picker modal, ribbon button, transcribe command"
```

---

## Task 6: Manual Integration Test

No automated tests cover the Obsidian UI or live server communication. Follow these steps to verify end-to-end behaviour.

**Prerequisites:**
- Obsidian installed on Windows
- A test vault
- `faster-whisper-server` running locally: `pip install faster-whisper-server && faster-whisper-server --model small`

- [ ] **Step 1: Copy plugin files to vault**

```
<vault>/.obsidian/plugins/obsidian-speech2text/manifest.json
<vault>/.obsidian/plugins/obsidian-speech2text/main.js
```

- [ ] **Step 2: Enable plugin in Obsidian**

Go to **Settings → Community plugins → turn off safe mode** → find "Speech2Text" → Enable.

- [ ] **Step 3: Configure plugin settings**

Open **Settings → Speech2Text**. Verify defaults:
- Server URL: `http://localhost:8000`
- Output folder: `/`
- Language: `auto`

- [ ] **Step 4: Trigger transcription**

Click the microphone ribbon icon (left sidebar). A modal appears asking to pick a file.
Select any short audio file (MP3, WAV, etc.).

- [ ] **Step 5: Verify success**

Expected:
- "Transcribing…" notice appears briefly
- Notice `"Saved → YYYY-MM-DD HH-MM-SS__<transcript context>.md"` appears
- The new note is visible in the vault with the transcript as its content

- [ ] **Step 6: Verify error handling**

Stop the Whisper server. Trigger transcription again.
Expected: notice `"Transcription failed: Whisper server error: …"` appears, no crash.

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Task |
|---|---|
| HTTP POST to `/v1/audio/transcriptions` | Task 4 |
| Note named `YYYY-MM-DD HH-MM-SS__<context>.md` | Task 3 |
| Context truncated to 50 chars at word boundary | Task 3 |
| Special chars stripped, colons → dashes | Task 3 |
| Note created via `vault.create()` | Task 3 |
| Configurable server URL, output folder, language | Task 2 |
| `language` omitted when set to `auto` | Task 4 |
| User notice `"Saved → <note title>"` | Task 5 |
| Ribbon icon trigger | Task 5 |
| Obsidian command palette trigger | Task 5 |

MVP 1 intentionally omits: mic recording, 7-day cleanup, control server, server manager, ribbon colour change — those belong to later MVPs.

### Type consistency

- `PluginSettings` defined in `settings.ts`, imported by `whisper-client.ts`, `note-creator.ts`, and `main.ts` ✓
- `transcribeAudio(blob, fileName, settings)` signature used consistently ✓
- `createNote(app, transcript, settings)` signature used consistently ✓
- `buildNoteName(transcript, now?)` — `now` defaults to `new Date()`, test passes a fixed date ✓
