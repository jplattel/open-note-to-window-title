import { App, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

export default class ActiveNoteTitlePlugin extends Plugin {
	// Get the window title
	readonly baseTitle = document.title;
	settings: ActiveNoteTitlePluginSettings;

	async onload() {
		console.log('loading ActiveNoteTitlePlugin plugin');
		// When opening, renaming or deleting a file, update the window title
		this.registerEvent(this.app.workspace.on('file-open', this.handleOpen));
		this.registerEvent(this.app.vault.on('rename', this.handleRename));
		this.registerEvent(this.app.vault.on('delete', this.handleDelete));
		await this.loadSettings();
		this.addSettingTab(new ActiveNoteTitlePluginSettingsTab(this.app, this));
		this.refreshTitle()
	}

	refreshTitle(file?: TFile) {
		if (this.settings.vaultOnly) {
			document.title = this.app.vault.getName();
		}
		else {
			document.title = file ? (this.baseTitle + ' - ' + file.path) : this.baseTitle;
		}
	}

	// Restore original title on unload.
	onunload() {
		document.title = this.baseTitle;
	}

	private readonly handleRename = async (file: TFile): Promise<void> => {
		if (file instanceof TFile && file === this.app.workspace.getActiveFile()) {
			this.refreshTitle(file);
		}
	};

	private readonly handleDelete = async (): Promise<void> => {
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
	vaultOnly: boolean,
}

const DEFAULT_SETTINGS: ActiveNoteTitlePluginSettings = { vaultOnly: false, }

class ActiveNoteTitlePluginSettingsTab extends PluginSettingTab {

	plugin: ActiveNoteTitlePlugin;

	constructor(app: App, plugin: ActiveNoteTitlePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Vault name only')
			.setDesc('Display only the vault\'s name in the window title')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.vaultOnly)
				.onChange((value) => {
					this.plugin.settings.vaultOnly = value;
					this.plugin.saveSettings();
					this.plugin.refreshTitle();
				})
			)
	}

}
