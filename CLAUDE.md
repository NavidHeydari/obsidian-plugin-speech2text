# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

An Obsidian plugin for Windows that transcribes audio via a local Whisper server and saves the result as a timestamped note.

**MVP 1:** Receive an MP3/audio file, transcribe via local Whisper server, save result as timestamped note.
**MVP 2:** Guide the user through server installation from within the plugin; connect automatically.
**MVP 3:** Full microphone capture triggered globally (even when Obsidian is not focused) via a small HTTP control server paired with an AutoHotkey script.

**Status:** Pre-implementation. Design spec is finalized; no source files exist yet. Implement MVP 1 first.

Design spec: `docs/superpowers/specs/2026-05-19-speech2text-design.md`
Implementation plan: `docs/superpowers/plans/2026-05-19-speech2text.md` (to be written)

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Build in watch mode (esbuild)
npm run build      # Production build
```

## Obsidian Plugin Development Workflow

To test the plugin in Obsidian during development:

1. Create a test vault (or use an existing one).
2. Enable **Settings → Community plugins → Turn off safe mode**.
3. Copy `main.js`, `manifest.json`, and `styles.css` (if any) into `<vault>/.obsidian/plugins/obsidian-speech2text/`.
4. In Obsidian, go to **Community plugins** and enable "Speech2Text".
5. With `npm run dev` running, Obsidian hot-reloads on file change if you have the **Hot Reload** community plugin installed; otherwise reload manually with `Ctrl+R`.

**Required files** for Obsidian to recognise the plugin:
- `manifest.json` — plugin metadata (`id`, `name`, `version`, `minAppVersion`, `author`, `description`)
- `main.js` — compiled output (esbuild target: CommonJS, for Electron's Node.js runtime)

## Architecture

Seven modules, each with one responsibility:

| File | Responsibility |
|---|---|
| `main.ts` | Entry point — wires all modules, registers ribbon button and commands |
| `recorder.ts` | Mic capture via `getUserMedia` + `MediaRecorder`; saves `.webm` audio; 7-day cleanup |
| `whisper-client.ts` | HTTP POST to local whisper server `/v1/audio/transcriptions`, returns transcript string |
| `note-creator.ts` | Creates vault note named `YYYY-MM-DD HH-MM-SS__<50-char context>.md` |
| `control-server.ts` | Node.js HTTP server on port 27183 for external start/stop triggers |
| `server-manager.ts` | Manages whisper server process lifecycle (Manual or Auto mode) |
| `settings.ts` | All plugin config and `PluginSettingTab` UI |

Data flow: **trigger → recorder → whisper-client → note-creator**. The control server and server manager are independent side concerns.

## Key Behaviors

- **Audio files** saved to `.obsidian/plugins/obsidian-speech2text/recordings/YYYY-MM-DD_HH-MM-SS.webm`; deleted after 7 days
- **Note naming**: `YYYY-MM-DD HH-MM-SS__<context>.md` where `<context>` is the transcript truncated to 50 chars at the nearest word boundary and stripped of special characters; colons replaced with dashes for Windows filesystem compatibility
  - Example: `2026-05-19 14-32-55__the quarterly review is next week and I want to.md`
- **Ribbon icon**: turns red with pulsing indicator while recording; returns to idle on stop
- **Success notice**: Obsidian notice shows `"Saved → <note title>"` after transcription completes
- **Whisper server modes**:
  - *Manual*: user installs `faster-whisper-server` via pip; plugin shows install guide with copy-pasteable commands, provides a Start/Stop button, and optionally auto-starts the server when Obsidian launches (via `child_process`)
  - *Auto*: plugin downloads pre-built `whisper.cpp` Windows binary (no Python required) into `.obsidian/plugins/obsidian-speech2text/bin/` and manages its full lifecycle; starts automatically on Obsidian open
- **Control server**: bare Node.js `http` module (no Express) on a configurable port (default `27183`); endpoints: `GET /toggle`, `/start`, `/stop`, `/status`
- **Audio format**: `MediaRecorder` produces WebM/Opus natively — no conversion needed before POSTing to `/v1/audio/transcriptions`
- **Settings sections**: Whisper Server (mode toggle, server URL, status indicator), Recording (output folder, language, live name preview), Control Server (port, AHK v2 snippet with copy button)

## Obsidian Plugin Constraints

- Extends `Plugin` from the `obsidian` module; use `this.app.vault` for all file operations, never raw `fs`
- Note creation must go through `this.app.vault.create()` so Obsidian indexes it
- `getUserMedia` is available in Obsidian's Electron renderer context
- esbuild must target the Node.js version bundled with the Obsidian Electron release; external: `['obsidian', 'electron', '@codemirror/*', '@lezer/*']`

## Out of Scope

Speaker diarisation, streaming transcription, mobile support, cloud STT, managing past notes from within the plugin.
