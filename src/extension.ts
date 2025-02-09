import * as vscode from "vscode"
import openFileAtLine from "./commands/openRouteCommand"
import ApiManagerWebviewProvider from "./webview/apiManagerWebviewProvider"

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log("It is game ON!")

	// Create the ApiManagerWebviewProvider and register it as a Webview View
	const provider = new ApiManagerWebviewProvider(context)
	context.subscriptions.push(vscode.window.registerWebviewViewProvider("apiManagerSideBar", provider))

	// Command to refresh the webview content
	const refresh = vscode.commands.registerCommand("api-man.refreshEntry", () => {
		provider.updateWebview()
	})
	context.subscriptions.push(refresh)

	// Command to open extension settings
	const openSettings = vscode.commands.registerCommand("api-man.openSettings", () => {
		vscode.commands.executeCommand("workbench.action.openSettings", "apiMan")
	})
	context.subscriptions.push(openSettings)

	// Command to open a route in its source file at the specified line
	const openRouteInFile = vscode.commands.registerCommand("api-man.openRouteInFile", (file: string, line: number) => openFileAtLine(file, line));	
	context.subscriptions.push(openRouteInFile)

	// Listen for configuration changes and refresh the webview if needed
	vscode.workspace.onDidChangeConfiguration((event) => {
		console.log("Configuration changed:", event)
		if (event.affectsConfiguration("apiMan.path") || event.affectsConfiguration("apiMan.groupBy")) {
			provider.updateWebview()
		}
	})
}



// This method is called when your extension is deactivated
export function deactivate() { }