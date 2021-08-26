import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, WorkspaceLeaf, normalizePath, debounce } from 'obsidian';

declare module "obsidian" {
  interface App {
    internalPlugins: any
  }
  interface MetadataCache {
    onCleanCache: any
  }
}

export default class ActiveNoteTitlePlugin extends Plugin {
  // Get the window title
  baseTitle: string = document.title;
  appVer: string;
  settings: any;

  async onload() {
    // Show the plugin is loading for developers
    console.log(`loading ${this.manifest.id} plugin`);

    // parse the version from the original title string
    if (this.baseTitle == '' || this.baseTitle == undefined) {
      console.log('baseTitle is unset')
      this.baseTitle = 'Obsidian';
    }
    const m: string[] = this.baseTitle.match(/v([0-9.]+)$/);
    this.appVer = m[m.length-1] || '';
    //console.log(`appVer set to [${this.appVer}]`);

    // Load the settings
    await this.loadSettings();

    // Add the settings tab
    this.addSettingTab(new ActiveNoteTitlePluginSettingsTab(this.app, this));

    // Set up initial title change
    this.app.workspace.onLayoutReady(this.initialize.bind(this));
    this.refreshTitle();
    //this.app.metadataCache.onCleanCache(this.handleMeta.bind(this));
  }

  initialize() {
    // console.log('registering callbacks');
    // When opening, renaming, or deleting a file, update the window title
    this.registerEvent(this.app.workspace.on('file-open', this.handleOpen));
    this.registerEvent(this.app.workspace.on('active-leaf-change', this.handleLeafChange));
    this.registerEvent(this.app.vault.on('rename', this.handleRename));
    this.registerEvent(this.app.vault.on('delete', this.handleDelete));
    this.registerEvent(this.app.metadataCache.on('changed', this.handleMetaChange));
    //this.registerEvent(this.app.metadataCache.on('resolve', this.handleMetaResolve));
  }

  // Restore original title on unload.
  onunload() {
    console.log(`unloading ${this.manifest.id} plugin`);
    //console.log(`reverting title to '${this.baseTitle}'`);
    document.title = this.baseTitle;
  }

  // Debounced refreshTitle
  debouncedRefreshTitle = debounce((file?: TFile) => {
    this.refreshTitle(file);
  }, 500, false);

  // The main method that is responsible for updating the title
  refreshTitle(file?: TFile): void {
    let template: any;
    if (!file) {
      file = this.app.workspace.getActiveFile() || undefined;
    }
    // For the template, the vault and workspace are always available
    template = {
      'vault': this.app.vault.getName(),
      'version': (this.appVer || ''),
      'workspace': this.app.internalPlugins.plugins.workspaces.instance.activeWorkspace // Defaults to: '' if not enabled
    };
    if (file instanceof TFile) {
      // If a file is open, the filename, path and frontmatter is added
      let cache = this.app.metadataCache.getFileCache(file);
      if (cache && cache.frontmatter) {
        const isTemplate = new RegExp('<%');
        for (const [frontmatterKey, frontmatterValue] of Object.entries(cache.frontmatter || {})) {
          let k = ('frontmatter.' + frontmatterKey) as string;
          if (!isTemplate.test(frontmatterValue)) {
            template[k] = frontmatterValue;
          }
        }
      }
      let friendlyBasename: string = file.basename;
      if (file.extension !== 'md') {
        friendlyBasename = file.name;
      }
      template = {
        'filepath': file.path,
        'filename': file.name,
        'basename': friendlyBasename,
        'extension': file.extension,
        ...template
      }
      //console.log(template)
      document.title = this.templateTitle(template, this.settings.titleTemplate);
    } else {
      document.title = this.templateTitle(template, this.settings.titleTemplateEmpty);
    }
  }

  templateTitle(template: any, title: string): string {
    let delimStr = this.settings.delimStr;
    let titleSeparator = this.settings.titleSeparator;
    // Process each template key
    Object.keys(template).forEach(field => {
      const hasField = new RegExp(`{{${field}}}`);
      //console.log(`%cchecking if ${title} contains {{${field}}}`, 'background: #222; color: #a0ffff');
      //console.log('bool: ' + hasField.test(title));
      //console.log('type of field: ' + typeof(field));
      //console.log(`val: [${template[field]}]`);
      if (hasField.test(title) && template[field] !== null && String(template[field]).length > 0) {
        //console.log(`%cexecuting transforms: [${field}] --> [${template[field]}]`, 'background: #222; color: #bada55');
        let re = new RegExp(`{{${field}}}`);
        title = title.replace(re, `${template[field]}`);
      }
    });
    // clean up delimiters
    let re = /([(]+)?{{[^}]+}}([)]+)?/g;
    title = title.replace(re, '');
    // clean up delimiters
    const replacements = new Map([
      [`^${delimStr}`, ''],
      [`${delimStr}+`, delimStr],
      [`${delimStr}(?!\ )`, titleSeparator],
      [`(?<!\ )${delimStr}`, ''],
    ]);
    for (const [key, value] of replacements) {
      let re = new RegExp(key, 'g');
      title = title.replace(re, value);
    }
    return title
  };

  private readonly handleRename = async (file: TFile, oldPath: string): Promise<void> => {
    // console.log(`file: ${oldPath} renamed to: ${file.path}`);
    if (file instanceof TFile && file === this.app.workspace.getActiveFile()) {
      this.app.metadataCache.onCleanCache(() => { this.refreshTitle(file); });
    }
  };

  private readonly handleDelete = async (file: TFile): Promise<void> => {
    this.refreshTitle();
  };

  private readonly handleOpen = async (file: TFile): Promise<void> => {
    if (file instanceof TFile && file === this.app.workspace.getActiveFile()) {
      this.debouncedRefreshTitle(file);
    }
  };

  private readonly handleLeafChange = async (leaf: WorkspaceLeaf | null): Promise<void> => {
    this.debouncedRefreshTitle();
  };

  private readonly handleMetaChange = async (file: TFile): Promise<void> => {
    if (file instanceof TFile && file === this.app.workspace.getActiveFile()) {
      this.refreshTitle(file);
    }
  };

  private readonly handleMetaResolve = async (file: TFile): Promise<void> => {
    if (file instanceof TFile && file === this.app.workspace.getActiveFile()) {
      this.refreshTitle(file);
    }
  };

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

}

interface ActiveNoteTitlePluginSettings {
  titleTemplate: string,
  titleTemplateEmpty: string,
  titleSeparator: string,
  delimStr: string
}

const DEFAULT_SETTINGS: ActiveNoteTitlePluginSettings = {
  titleTemplate: "{{basename}}~~{{vault}} - Obsidian v{{version}}",
  titleTemplateEmpty: "{{vault}} - Obsidian v{{version}}",
  titleSeparator: " - ",
  delimStr: "~~"
}

class ActiveNoteTitlePluginSettingsTab extends PluginSettingTab {

  plugin: ActiveNoteTitlePlugin;

  constructor(app: App, plugin: ActiveNoteTitlePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;
    let desc: DocumentFragment;
    containerEl.empty();
    containerEl.createEl('h2', {text: 'Window title templates'});
    containerEl.createEl('p', {text: 'These two templates override the window title of the Obsidian window. This is useful for example when you use tracking software that works with window titles. You can use the format `~~{{placeholder}}~~` if you want the placeholder to be completely omitted when blank, otherwise whitespace and other characters will be preserved. You can surround a placeholder with parentheses e.g. `({{frontmatter.project}})` and it will be hidden if the referenced field is empty.'});

    desc = document.createDocumentFragment();
    desc.append('Available ');
    desc.createEl('b').innerText = 'placeholders:';
    let placeholders = [
      [ "vault", "workspace", "version" ],
      [ "filename", "filepath", "basename", "extension" ],
      [ "frontmatter.<any_frontmatter_key>" ]
    ]
    placeholders.forEach(row => {
      desc.createEl("br")
      row.forEach(key => {
        desc.append(`{{${key}}} `)
      })
    });

    new Setting(containerEl)
      .setName('Default Template')
      .setDesc(desc)
      .addText(text => {
        text.inputEl.style.fontFamily = 'monospace';
        text.inputEl.style.width = '500px';
        text.inputEl.style.height = '46px';
        text
          .setPlaceholder(DEFAULT_SETTINGS.titleTemplate)
          .setValue(this.plugin.settings.titleTemplate)
          .onChange((value) => {
            this.plugin.settings.titleTemplate = value;
            this.plugin.saveData(this.plugin.settings);
            this.plugin.refreshTitle();
          });
      });

    desc = document.createDocumentFragment();
    desc.append('Available ');
    desc.createEl('b').innerText = 'placeholders:';
    placeholders = [
      [ "vault", "workspace", "version" ],
    ]
    placeholders.forEach(key => {
      desc.createEl("br")
      desc.append(`{{${key}}}`)
    });

    new Setting(containerEl)
      .setName('Template for when no file is open')
      .setDesc(desc)
      .addText(text => {
        text.inputEl.style.fontFamily = 'monospace';
        text.inputEl.style.width = '500px';
        text.inputEl.style.height = '46px';
        text
          .setPlaceholder(DEFAULT_SETTINGS.titleTemplateEmpty)
          .setValue(this.plugin.settings.titleTemplateEmpty)
          .onChange((value) => {
            this.plugin.settings.titleTemplateEmpty = value;
            this.plugin.saveData(this.plugin.settings);
            this.plugin.refreshTitle();
          });
        });

    new Setting(containerEl)
      .setName('Separator to insert between placeholder elements')
      .setDesc('Replaces delimiter string between placeholders that are not null.')
      .addText(text => {
        text.inputEl.style.fontFamily = 'monospace';
        text.inputEl.style.width = '142px';
        text.inputEl.style.height = '46px';
        text
          .setPlaceholder(' - ')
          .setValue(this.plugin.settings.titleSeparator)
          .onChange((value) => {
            this.plugin.settings.titleSeparator = value;
            this.plugin.saveData(this.plugin.settings);
            this.plugin.refreshTitle();
          });
        });

    new Setting(containerEl)
      .setName('Delimiter string')
      .setDesc('Select a string to be used to mark locations for separators to be inserted.')
      .addDropdown((dropdown) => {
        dropdown.addOption('~~', '~~ (Tilde)');
        dropdown.addOption('##', '## (Hash)');
        dropdown.addOption('__', '__ (Underscore)');
        dropdown.setValue(this.plugin.settings.delimStr);
        dropdown.onChange((option) => {
          this.plugin.settings.delimStr = option;
          this.plugin.saveData(this.plugin.settings);
          this.plugin.refreshTitle();
        });
      });

  }
}
