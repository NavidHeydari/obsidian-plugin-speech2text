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
  addToggle = jest.fn((_cb: any) => this);
  addDropdown = jest.fn((_cb: any) => this);
  addButton = jest.fn((_cb: any) => this);
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
