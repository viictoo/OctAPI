import * as fs from 'fs';
import * as path from 'path';
import * as vscode from "vscode";
import openFileAtLine from "../commands/openRouteCommand";
import frameworkMiddleware from '../languages';
import { Route } from '../types';

export default class ApiManagerWebviewProvider implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView

	constructor(private context: vscode.ExtensionContext) { }

	resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView
		webviewView.webview.options = { enableScripts: true }

		// Initial load of routes
		this.updateWebview()

		// Listen for messages from the webview (e.g. refresh or open file)
		webviewView.webview.onDidReceiveMessage((message) => {
			switch (message.command) {
				case "refresh":
					this.updateWebview()
					break
				case "openFile":
					openFileAtLine(message.file, message.line)
					break
				case "openSettings":
					vscode.commands.executeCommand("workbench.action.openSettings", "apiMan")
					break
				case "vscodeFile":
					vscode.commands.executeCommand('workbench.action.files.openFolder');
					break
			}
		})
	}

	// Re-extract routes and update the HTML content of the webview
	async updateWebview() {
		const routes = await frameworkMiddleware()
		if (routes.length === 0) {
			const html = this.getWelcomeContent()
			if (this._view) {
				console.log('No routes found, displaying welcome message.')
				this._view.webview.html = html
			}
			return
		}
		const html = this.getHtmlContent(routes)
		if (this._view) {
			// Inject the VS Code API script and our custom styles
			this._view.webview.html = html.replace(
				"</head>",
				`<script>
					const vscode = acquireVsCodeApi();
					// Add custom styles for method colors
					const style = document.createElement('style');
					style.textContent = \`
						.method-get { color: var(--get-color, #61affe); }
						.method-post { color: var(--post-color, #49cc90); }
						.method-put { color: var(--put-color, #fca130); }
						.method-delete { color: var(--delete-color, #f93e3e); }
						.method-other { color: var(--other-color, #50e3c2); }
					\`;
					document.head.appendChild(style);
				</script>
				</head>`,
			)
		}
	}

	// Update the getHtmlContent method to include the new SVG icon logic
	private getHtmlContent(routes: Route[]): string {
		const htmlFilePath = path.join(__dirname, '..', 'webview', 'templates', 'apiManager.html');
		let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
		const routesJson = JSON.stringify(routes);
		htmlContent = htmlContent.replace('^routes^', routesJson);
		return htmlContent;
	}

	private getWelcomeContent(): string {
		const htmlFilePath = path.join(__dirname, '..', 'webview', 'templates', 'welcome.html');
		let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
		return htmlContent;
	}
}