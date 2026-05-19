# Obsidian Speech2Text Plugin — Design Spec

**Date:** 2026-05-19
**Status:** Approved

## Overview

An Obsidian plugin for Windows that captures microphone audio, transcribes it via a local Whisper server, and saves the result as a new timestamped note. Recording can be triggered globally (even while Obsidian is not the focused window, e.g. during a meeting) via a small HTTP control server paired with an AutoHotkey script.

---

## Architecture

Six modules, each with one responsibility:

| Module | File | Responsibility |
|---|---|---|
| Plugin Core | `main.ts` | Entry point, wires all modules together, registers commands and ribbon |
| Recorder | `recorder.ts` | Mic capture via `getUserMedia` + `MediaRecorder`; saves audio file; cleanup |
| Whisper Client | `whisper-client.ts` | HTTP POST to local whisper server, returns transcript string |
| Note Creator | `note-creator.ts` | Creates new vault note with datetime + context name |
| Control Server | `control-server.ts` | Tiny Node.js HTTP server for external start/stop triggers |
| Server Manager | `server-manager.ts` | Manages whisper server process lifecycle (manual or auto mode) |
| Settings | `settings.ts` | All plugin config and settings UI tab |

Data flows in one direction: **trigger → recorder → whisper-client → note-creator**. The control server and server manager are independent side concerns.

---

## Recording & Transcription Flow

1. Trigger received via ribbon button, Obsidian hotkey, or HTTP request to the control server
2. **If idle:** call `getUserMedia` with audio, start `MediaRecorder`; ribbon icon turns red with pulsing indicator
3. **If recording:** stop `MediaRecorder`, collect audio chunks into a single `Blob` (WebM/Opus — native `MediaRecorder` format, no conversion needed)
4. **Save audio file** to `.obsidian/plugins/obsidian-speech2text/recordings/YYYY-MM-DD_HH-MM-SS.webm` immediately
5. POST the blob as `multipart/form-data` to `/v1/audio/transcriptions` on the local whisper server
6. On successful response, pass transcript text to note creator
7. Ribbon icon returns to idle; show Obsidian notice: `"Saved → <note title>"`

### Audio File Retention

- Files stored in `.obsidian/plugins/obsidian-speech2text/recordings/`
- Filename: `YYYY-MM-DD_HH-MM-SS.webm` (full timestamp, Windows-safe)
- Cleanup runs on plugin load and after each recording: delete any file older than 7 days
- Cleanup logic lives in `recorder.ts` alongside the save logic

### Note Naming

Format: `YYYY-MM-DD HH-MM-SS__<context>.md`

- Colons replaced with dashes (Windows filesystem compatibility)
- `<context>` = first ~40 characters of the transcript, stripped of special characters
- Example: `2026-05-19 14-32-55__the quarterly review is next week and I want to.md`
- Created in a configurable vault folder (default: vault root)

---

## Whisper Server Management

A toggle in settings selects between two modes. Both modes share `whisper-client.ts` — only who started the server differs.

### Manual Mode

User installs and manages the whisper server themselves. Plugin provides:
- Step-by-step install guide for `faster-whisper-server` (pip-based, OpenAI-compatible API) with copy-pasteable commands
- A **Start Server** button that runs the configured start command via Node.js `child_process`
- Optional: auto-start the server when Obsidian launches (runs the same command)
- Live status indicator (green/red) that polls the server health endpoint

Recommended server: `faster-whisper-server` — pip-installable, exposes OpenAI-compatible `/v1/audio/transcriptions`, works on Windows.

```
pip install faster-whisper-server
faster-whisper-server --model small
```

### Auto Mode

Plugin manages the full lifecycle:
- On first enable, downloads the `whisper.cpp` Windows binary from GitHub releases and the selected model file
- Files stored in the plugin data folder (`.obsidian/plugins/obsidian-speech2text/bin/`)
- Server starts automatically when Obsidian opens, stops when it closes
- Settings shows download progress, model size selector with speed/accuracy tradeoffs noted (tiny → large)
- A **Re-download / Update** button to refresh binaries

### Shared Server Settings

- Server URL (default: `http://localhost:8000`) — used by both modes
- Model size: tiny / base / small / medium / large
- Language: auto-detect or a specific language code

---

## Global Hotkey Bridge (Control Server)

The plugin runs a Node.js HTTP server on a configurable port (default: `27183`). This allows any external tool to trigger recording without Obsidian needing to be the focused window.

### Endpoints

```
GET /toggle   — start if idle, stop if recording
GET /start    — start recording (no-op if already recording)
GET /stop     — stop recording (no-op if idle)
GET /status   — returns {"recording": true|false}
```

### AutoHotkey Integration

Settings displays a ready-to-use AutoHotkey v2 snippet (with a copy button):

```autohotkey
; Save as recording.ahk and run at Windows startup
^+R::  ; Ctrl+Shift+R — change to any key combo
{
    http := ComObject("WinHttp.WinHttpRequest.5.1")
    http.Open("GET", "http://localhost:27183/toggle", false)
    http.Send()
}
```

The user saves this as a `.ahk` file and runs it at Windows startup. From that point, the hotkey works from any app including during meetings.

---

## Settings Tab Layout

### Whisper Server

- Mode: `Manual` / `Auto` (toggle)
- **Manual:** server URL, install guide (collapsible), Start/Stop button, auto-start on launch toggle
- **Auto:** model size selector (tiny/base/small/medium/large), download/status indicator, auto-start on launch toggle (default on), Re-download button
- Status indicator: live green/red dot showing whether server is reachable

### Recording

- Output folder for new notes (vault-relative path, default: `/`)
- Language (default: `auto`)
- Example note name preview (updates live)

### Control Server

- Enable/disable toggle
- Port number (default: `27183`)
- AutoHotkey snippet with copy button

---

## Out of Scope

- Speaker diarisation
- Streaming/real-time transcription (transcription happens only after recording stops)
- Mobile support
- Cloud STT backends
- Editing or managing past transcription notes from within the plugin
