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
