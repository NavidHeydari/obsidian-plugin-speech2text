import { Plugin } from 'obsidian';

export default class SpeechToTextPlugin extends Plugin {
  async onload() {
    console.log('Speech2Text loaded');
  }
}
