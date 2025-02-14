import * as vscode from "vscode"
import OctAPIWebviewProvider from "./webview/OctAPIWebviewProvider"
import { openFileAtLine } from "./utils/fileUtils"

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log("It is game ON!")

	// Create the OctAPIWebviewProvider and register it as a Webview View
	const provider = new OctAPIWebviewProvider(context)
	context.subscriptions.push(vscode.window.registerWebviewViewProvider("OctAPISideBar", provider))

	// Command to refresh the webview content
	const refresh = vscode.commands.registerCommand("octapi.refreshEntry", () => {
		provider.updateWebview()
	})
	context.subscriptions.push(refresh)

	// Command to open extension settings
	const openSettings = vscode.commands.registerCommand("octapi.openSettings", () => {
		vscode.commands.executeCommand("workbench.action.openSettings", "OctAPI")
	})
	context.subscriptions.push(openSettings)

	// Command to open a route in its source file at the specified line
	const openRouteInFile = vscode.commands.registerCommand("octapi.openRouteInFile", (file: string, line: number) => openFileAtLine(file, line));
	context.subscriptions.push(openRouteInFile)

	// Listen for configuration changes and refresh the webview if needed
	vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration("OctAPI.path") || event.affectsConfiguration("OctAPI.framework")) {
			provider.updateWebview()
		}
	})

	const config = vscode.workspace.getConfiguration("OctAPI");
	const routePath = config.get<string>("path", "./src/");
	
	if (!vscode.workspace.workspaceFolders) {
		console.error("No workspace folder open!");
	} else if (!routePath) {
		console.error("No path configured for OctAPI.path");
	} else {
		const absolutePath = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, routePath).fsPath;
	
		const watcher = vscode.workspace.createFileSystemWatcher(`${absolutePath}/**/*`);
		const updateView = (uri: vscode.Uri) => {
			provider.updateWebview();
		};
	
		watcher.onDidChange(updateView);
		watcher.onDidCreate(updateView);
		watcher.onDidDelete(updateView);
		context.subscriptions.push(watcher);
	
		// Fallback: Trigger update on file save
		vscode.workspace.onDidSaveTextDocument((doc) => updateView(doc.uri));
	}
	
}



// This method is called when your extension is deactivated
export function deactivate() { }