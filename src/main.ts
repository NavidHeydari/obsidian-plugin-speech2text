import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, PluginSettings, SpeechToTextSettingTab } from './settings';

export default class SpeechToTextPlugin extends Plugin {
  settings: PluginSettings;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new SpeechToTextSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
