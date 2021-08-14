import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, normalizePath } from 'obsidian';

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
	baseTitle = document.title;
	appVer: string[];
	settings: any;

	async onload() {
		// Show the plugin is loading for developers
		console.log(`loading ${this.manifest.id} plugin`);

		// Load the settings
		await this.loadSettings();

		// parse the version from the original title string
		this.appVer = this.baseTitle.match(/[0-9.]+$/);

		// Add the settings tab
		this.addSettingTab(new ActiveNoteTitlePluginSettingsTab(this.app, this));

		// Set up initial title change
		this.app.workspace.onLayoutReady(this.initialize.bind(this));
		//this.app.metadataCache.onCleanCache(this.handleMeta.bind(this));

		//if (!this.app.workspace.layoutReady) {
		//	this.registerEvent(this.app.workspace.on('layout-ready', this.initialize));
		//}
	}

	initialize() {
		// console.log('registering callbacks');
		// When opening, renaming, or deleting a file, update the window title
		this.registerEvent(this.app.workspace.on('file-open', this.handleOpen));
		this.registerEvent(this.app.vault.on('rename', this.handleRename));
		this.registerEvent(this.app.vault.on('delete', this.handleDelete));
		this.registerEvent(this.app.metadataCache.on('changed', this.handleMetaChange));
		//this.registerEvent(this.app.metadataCache.on('resolve', this.handleMetaResolve));
		//this.refreshTitle();
	}

	// Restore original title on unload.
	onunload() {
		document.title = this.baseTitle;
	}

	// The main method that is responsible for updating the title
	refreshTitle(file?: TFile) {
		// For the template, the vault and workspace are always available
		let template = {
			'vault': this.app.vault.getName(),
			'version': this.appVer || '',
			'workspace': this.app.internalPlugins.plugins.workspaces.instance.activeWorkspace // Defaults to: '' if not enabled
		} as any;
		if (file instanceof TFile) {
			// If a file is open, the filename, path and frontmatter is added
			let cache = this.app.metadataCache.getFileCache(file);
			if (cache && cache.frontmatter) {
				for (const [frontmatterKey, frontmatterValue] of Object.entries(cache.frontmatter || {})) {
					let k = ('frontmatter.' + frontmatterKey) as string;
					template[k] = frontmatterValue;
				}
			}
			template = {
				'filepath': file.path,
				'filename': file.name,
				'basename': file.basename,
				'extension': file.extension,
				...template
			}
			// console.log(template)
			document.title = this.templateTitle(template, this.settings.titleTemplate)
		} else {
			document.title = this.templateTitle(template, this.settings.titleTemplateEmpty)
		}
	}

	templateTitle(template: any, title: string): string {
		// Try each template key
		let delimStr = this.settings.delimStr;
		let titleSeparator = this.settings.titleSeparator;
		Object.keys(template).forEach(key => {
			if (template[key] && template[key].length > 0) {
				let reSepRight = new RegExp(`{{${key}}}${delimStr}`);
				let reSepLeft = new RegExp(`${delimStr}{{${key}}}`);
				let reNoSep = new RegExp(`{{${key}}}`);
				title = title.replace(reSepRight, (template[key] + titleSeparator));
				title = title.replace(reSepLeft, (titleSeparator + template[key]));
				title = title.replace(reNoSep, template[key]);
			}
		});
		// Remove any templates that cannot be filled
		let reOrphans = new RegExp(`(${delimStr})?{{[^}]+}}(${delimStr})?`, 'g');
		title = title.replace(reOrphans, '');
		return title
	};

	private readonly handleRename = async (file: TFile, oldPath: string): Promise<void> => {
		// console.log(`file: ${oldPath} renamed to: ${file.path}`);
		// the method below also works, but should not be used
		// await new Promise(f => setTimeout(f, 3000));
		if (file instanceof TFile && file === this.app.workspace.getActiveFile()) {
			this.app.metadataCache.onCleanCache(() => { this.refreshTitle(file); });
		}
	};

	private readonly handleDelete = async (file: TFile): Promise<void> => {
		if (this.app.workspace.getActiveFile() === null || this.app.workspace.getActiveFile() === undefined) {
			this.refreshTitle();
		}
	};

	private readonly handleOpen = async (file: TFile): Promise<void> => {
		if (file instanceof TFile) {
			this.refreshTitle(file);
		} else {
			this.refreshTitle();
		}
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
	titleTemplate: "{{basename}}%%{{vault}}%%Obsidian v{{version}}",
	titleTemplateEmpty: "{{vault}} - Obsidian v{{version}}",
	titleSeparator: " - ",
	delimStr: "%%"
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
		containerEl.createEl('p', {text: 'These two templates override the window title of the Obsidian window. This is useful for example when you use tracking software that works with window titles. You can use the format `%%{{placeholder}}` or `{{placeholder}}%%` if you want the placeholder to be completely omitted when blank, otherwise whitespace and other characters will be preserved.'});

		new Setting(containerEl)
			.setName('Default template for window title (applicable when no file is open)')
			.setDesc('You can use the following placeholders: {{vault}}, {{workspace}}')
			.addTextArea(text => {
				text.inputEl.style.fontFamily = 'monospace';
				text.inputEl.cols = 40;
				text.inputEl.rows = 1;
				text
					.setPlaceholder("{{vault}} - Obsidian v{{version}}")
					.setValue(this.plugin.settings.titleTemplateEmpty)
					.onChange((value) => {
						this.plugin.settings.titleTemplateEmpty = value;
						this.plugin.saveData(this.plugin.settings);
						this.plugin.refreshTitle();
					});
				});

		desc = document.createDocumentFragment();
		desc.append("You can use the following placeholders:")
		let placeholders = [
			"vault",
			"workspace",
			"filename",
			"basename",
			"extension",
			"filepath",
			"version",
			"frontmatter.<any_frontmatter_key>"
		]
		placeholders.forEach( key => {
			desc.createEl("br")
			desc.append(`{{${key}}}`)
		});

		new Setting(containerEl)
			.setName('Template for window title when a file is opened or changed')
			.setDesc(desc)
			.addTextArea(text => {
				text.inputEl.style.fontFamily = 'monospace';
				text.inputEl.cols = 40;
				text.inputEl.rows = 3;
				text
					.setPlaceholder('{{basename}} - {{vault}} - Obsidian v{{version}}')
					.setValue(this.plugin.settings.titleTemplate)
					.onChange((value) => {
						this.plugin.settings.titleTemplate = value;
						this.plugin.saveData(this.plugin.settings);
						this.plugin.refreshTitle();
					});
			});

		new Setting(containerEl)
			.setName('Separator to insert between placeholder elements')
			.setDesc('Replaces delimiter string between placeholders, as long as they are not empty.')
			.addTextArea(text => {
				text.inputEl.style.fontFamily = 'monospace';
				text.inputEl.cols = 40;
				text.inputEl.rows = 1;
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
				dropdown.addOption('%%', '%% (Default)');
				dropdown.addOption('##', '##');
				dropdown.addOption('~~', '~~');
				dropdown.addOption('__', '__');
				dropdown.setValue(this.plugin.settings.delimStr);
				dropdown.onChange((option) => {
					this.plugin.settings.delimStr = option;
					this.plugin.saveData(this.plugin.settings);
					this.plugin.refreshTitle();
				})
			})

	}
}
