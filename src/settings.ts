import { App, PluginSettingTab, Setting } from 'obsidian';
import type SpeechToTextPlugin from './main';
import { setLoggingEnabled } from './logger';

export interface PluginSettings {
  serverUrl: string;
  outputFolder: string;
  language: string;
  model: string;
  controlServerEnabled: boolean;
  controlServerPort: number;
  loggingEnabled: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  serverUrl: 'http://localhost:8000',
  outputFolder: '/',
  language: 'auto',
  model: 'whisper-1',
  controlServerEnabled: true,
  controlServerPort: 27183,
  loggingEnabled: true,
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
      .setName('Model')
      .setDesc('Model name sent to the Whisper server (e.g. whisper-1, base, small, medium, large-v3)')
      .addText(text =>
        text
          .setValue(this.plugin.settings.model)
          .onChange(async value => {
            this.plugin.settings.model = value.trim() || 'whisper-1';
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

    containerEl.createEl('h3', { text: 'Logging' });

    new Setting(containerEl)
      .setName('Enable logging')
      .setDesc('Write detailed error logs to logs/speech2text.log in the plugin folder (for troubleshooting)')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.loggingEnabled).onChange(async value => {
          this.plugin.settings.loggingEnabled = value;
          setLoggingEnabled(value);
          await this.plugin.saveSettings();
        }),
      );

    containerEl.createEl('h3', { text: 'Control Server' });

    new Setting(containerEl)
      .setName('Enable control server')
      .setDesc('Expose a local HTTP server so AutoHotkey or other tools can trigger recording')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.controlServerEnabled).onChange(async value => {
          this.plugin.settings.controlServerEnabled = value;
          await this.plugin.saveSettings();
        }),
      );

    let snippetPre: HTMLPreElement;

    const buildSnippet = (p: number) =>
      `; Save as recording.ahk and run it at Windows startup\n` +
      `^+R::  ; Ctrl+Shift+R — change to any key combo\n` +
      `{\n` +
      `    http := ComObject("WinHttp.WinHttpRequest.5.1")\n` +
      `    http.Open("GET", "http://localhost:${p}/toggle", false)\n` +
      `    http.Send()\n` +
      `}`;

    new Setting(containerEl)
      .setName('Port')
      .setDesc('Port for the control server (default: 27183). Restart Obsidian after changing.')
      .addText(text =>
        text
          .setValue(String(this.plugin.settings.controlServerPort))
          .onChange(async value => {
            const port = parseInt(value, 10);
            if (!isNaN(port) && port > 0 && port < 65536) {
              this.plugin.settings.controlServerPort = port;
              await this.plugin.saveSettings();
              if (snippetPre) snippetPre.textContent = buildSnippet(port);
            }
          }),
      );

    new Setting(containerEl)
      .setName('AutoHotkey v2 snippet')
      .setDesc('Copy this into a .ahk file and run it at Windows startup');

    snippetPre = containerEl.createEl('pre');
    snippetPre.textContent = buildSnippet(this.plugin.settings.controlServerPort);
    snippetPre.style.cssText =
      'background:var(--background-secondary);padding:8px;border-radius:4px;' +
      'font-size:12px;overflow-x:auto;margin-bottom:8px;white-space:pre;';

    const copyBtn = containerEl.createEl('button', { text: 'Copy' });
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(snippetPre.textContent ?? '');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    };
  }
}
