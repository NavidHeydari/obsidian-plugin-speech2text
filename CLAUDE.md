# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

An Obsidian plugin that adds speech-to-text transcription capabilities. Built with TypeScript following the standard Obsidian plugin structure.

## Commands

_To be added once the project is scaffolded. Typical Obsidian plugin commands:_

```bash
npm install        # Install dependencies
npm run dev        # Build in watch mode (esbuild)
npm run build      # Production build
```

## Architecture

_To be documented once code exists. Standard Obsidian plugin layout:_

- `main.ts` — plugin entry point, extends `Plugin`, registers commands/ribbons/settings
- `manifest.json` — plugin metadata (id, name, version, minAppVersion)
- `styles.css` — plugin-specific styles (if any)
- Settings stored via `this.loadData()` / `this.saveData()`
