import * as vscode from "vscode";
import { initializeCache, RouteCache } from "./utils/cache";
import { setupFileWatcher } from "./utils/fileWatcher";
import OctAPIWebviewProvider from "./webview/OctAPIWebviewProvider";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log("It is game ON!");

	// Create the OctAPIWebviewProvider and register it as a Webview View
	const provider = new OctAPIWebviewProvider(context);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider("OctAPISideBar", provider));

	// Setup file watcher to monitor changes in the specified path
	setupFileWatcher(provider, context).initialize();

	// Initialize the cache with the current routes
	initializeCache(provider);

	// Command to refresh the webview content
	const refresh = vscode.commands.registerCommand("octapi.refreshEntry", async () => {
		try {
			// Clear the route cache
			RouteCache.getInstance().clear();

			// Update the webview
			provider.updateWebview(true);

			// Reinitialize the cache
			await initializeCache(provider);

			// Update the webview again
			provider.updateWebview();
		} catch (error) {
			console.error("Refresh failed:", error);
		}
	});
	context.subscriptions.push(refresh);

	// Command to open extension settings
	const openSettings = vscode.commands.registerCommand("octapi.openSettings", () => {
		vscode.commands.executeCommand("workbench.action.openSettings", "OctAPI");
	});
	context.subscriptions.push(openSettings);

	// Command to open feedback form
	const openFeedbackForm = vscode.commands.registerCommand("octapi.feedback", () => {
		const feedbackFormUrl = "https://forms.gle/5bimyt7Y1UAJvEB39";
		vscode.env.openExternal(vscode.Uri.parse(feedbackFormUrl));
	});
	context.subscriptions.push(openFeedbackForm);

	// Listen for configuration changes and refresh the webview if needed
	vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration("OctAPI.path") || event.affectsConfiguration("OctAPI.framework")) {
			provider.updateWebview();
		}
	});

	// Command to clear favorite routes
	const clearFavorites = vscode.commands.registerCommand("octapi.clearFavs", () => {
		provider.starredRoutes.clear();
		provider.persistStarredRoutes();
		provider.updateWebview();
	});
	context.subscriptions.push(clearFavorites);

	// Command to download routes
	const postmanExport = vscode.commands.registerCommand("octapi.postmanExport", () => {
		provider.postmanExport();
	});
	context.subscriptions.push(postmanExport);
}

// This method is called when your extension is deactivated
export function deactivate() { }