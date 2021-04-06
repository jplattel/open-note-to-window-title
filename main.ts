import { Plugin, TFile } from 'obsidian';

export default class ActiveNoteTitlePlugin extends Plugin {
	// Get the window title
	baseTitle = document.title;

	async onload() {
		console.log('loading ActiveNoteTitlePlugin plugin');
		// When opening, renaming or deleting a file, update the window title
		this.registerEvent(this.app.workspace.on('file-open', this.handleOpen));
		this.registerEvent(this.app.vault.on('rename', this.handleRename));
		this.registerEvent(this.app.vault.on('delete', this.handleDelete));
	}

	// Restore original title on unload.
	onunload() { 
		document.title = this.baseTitle;
	}

	private readonly handleRename = async (file: TFile): Promise<void> => {
		if (file instanceof TFile && file === this.app.workspace.getActiveFile()) {
			document.title = this.baseTitle + ' - ' + file.path;
		}
	};

	private readonly handleDelete = async (file: TFile): Promise<void> => {
		if (this.app.workspace.getActiveFile() === null || this.app.workspace.getActiveFile() === undefined) {
			document.title = this.baseTitle;
		}
	};

	private readonly handleOpen = async (file: TFile): Promise<void> => {
		if (file instanceof TFile) {
			document.title = this.baseTitle + ' - ' + file.path;
		} else {
			document.title = this.baseTitle;
		}
	};

}
