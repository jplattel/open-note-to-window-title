import { Plugin, TFile } from 'obsidian';

export default class ActiveNoteTitlePlugin extends Plugin {
	// Get the window title
	baseTitle = document.title

	onload() {
		// When opening a file, update the window title
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				// Only update on files (not folder or blank)
				if (file instanceof TFile) {
					document.title = this.baseTitle + ' - ' + file.path
				} else {
					document.title = this.baseTitle
				}
			})
		);
	}

	// Restore original title on unload.
	onunload() { 
		document.title = this.baseTitle
	}
}

