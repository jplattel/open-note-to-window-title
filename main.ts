import { App, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

export default class ActiveNoteTitlePlugin extends Plugin {
	// Get the window title
	baseTitle = document.title;

	async onload() {
		// Show the plugin is loading for developers
		console.log('loading ActiveNoteTitlePlugin plugin');

		// When opening, renaming or deleting a file, update the window title
		this.registerEvent(this.app.workspace.on('file-open', this.handleOpen));
		this.registerEvent(this.app.vault.on('rename', this.handleRename));
		this.registerEvent(this.app.vault.on('delete', this.handleDelete));

		// Load the settings
		await this.loadSettings(); 

		// Add the settings tab
		this.addSettingTab(new ActiveNoteTitlePluginSettingsTab(this.app, this));

		// Finally call the refresh title now..
		this.refreshTitle()
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
			'workspace': this.app.internalPlugins.plugins.workspaces.instance.activeWorkspace // Defaults to: '' if not enabled
		}

		if (file) {
			// If a file is open, the filename, path and frontmatter is added 
			let frontmatter = this.app.metadataCache.getFileCache(file).frontmatter
			for (const [frontmatterKey, frontmatterValue] of Object.entries(frontmatter || {})) {
				console.log(frontmatterKey, frontmatterValue)
				template['frontmatter.' + frontmatterKey] = frontmatterValue
			}

			template = {
				'filename': file.name,
				'filepath': file.path,
				...template
			}
			console.log(template)
			document.title = this.templateTitle(template, this.settings.titleTemplate)
		} else {
			document.title = this.templateTitle(template, this.settings.titleTemplateEmpty)
		}
	}

	templateTitle(template, title: String): String {
		// Try each template key
		Object.keys(template).forEach(key => {
			title = title.replace(`{{${key}}}`, template[key] || '')
		})

		// Remove any templates that cannot be filled
		title = title.replace(/{{.*}}/g, '')

		return title
	}
	
	private readonly handleRename = async (file: TFile): Promise<void> => {
		if (file instanceof TFile && file === this.app.workspace.getActiveFile()) {
			this.refreshTitle(file);
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
}

const DEFAULT_SETTINGS: ActiveNoteTitlePluginSettings = { 
	titleTemplate: "Obsidian - {vault} - {filename}",
	titleTemplateEmpty: "Obsidian - {vault} - {filename}",
}

class ActiveNoteTitlePluginSettingsTab extends PluginSettingTab {

	plugin: ActiveNoteTitlePlugin;

	constructor(app: App, plugin: ActiveNoteTitlePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;
		
		containerEl.empty();
		containerEl.createEl('h2', {text: 'Window title templates'});
		containerEl.createEl('p', {text: 'These two templates override the window title of the Obsidian window. This is useful for example when you use tracking software that works with window titles. '});

		new Setting(containerEl)
			.setName('Default template for window title (applicable when no file is open)')
			.setDesc('You can use the following placeholders: {{vault}}, {{workspace}}')
			.addText(text => text.setPlaceholder("Obsidian - {{vault}}")
				.setValue(this.plugin.settings.titleTemplateEmpty || "Obsidian - {{vault}}")
				.onChange((value) => {
					this.plugin.settings.titleTemplateEmpty = value;
					this.plugin.saveData(this.plugin.settings);
					this.plugin.refreshTitle();
				}));

		new Setting(containerEl)
			.setName('Template for window title when a file is opened or changed')
			.setDesc('You can use the following placeholders: {{vault}}, {{workspace}}, {{filename}}, {{filepath}} and {{frontmatter.<any_frontmatter_key>}}')
			.addText(text => text.setPlaceholder("Obsidian - {{vault}} - {{filename}}")
			.setValue(this.plugin.settings.titleTemplate || "Obsidian - {{vault}} - {{filename}}")
			.onChange((value) => {
				this.plugin.settings.titleTemplate = value;
				this.plugin.saveData(this.plugin.settings);
				this.plugin.refreshTitle();
			}));
	}
}
