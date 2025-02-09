import * as vscode from "vscode"
import { parse } from "@babel/parser"
import traverse from "@babel/traverse"
import * as t from "@babel/types"
import * as path from "path"

interface Route {
	method: string
	path: string
	basePath: string
	file: string
	fileLine: number
}
function transformRoutesToTreeItems(routesList: Route[]): vscode.TreeItem[] {
	const rootItems: Map<string, vscode.TreeItem> = new Map()

	for (const route of routesList) {
		const fullPath = `${route.basePath}${route.path}`
		const label = `${route.method} ${fullPath}`
		const pathComponents = route.file.split("/")
		const description = pathComponents.slice(-2).join("/") // Show the last two elements of the path as description

		const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None)
		treeItem.tooltip = `Defined in: ${route.file}\n`
		treeItem.description = description
		treeItem.command = {
			command: "api-man.openRouteInFile",
			title: "Open File at Line",
			arguments: [route.file, route.fileLine],
		}
		switch (route.method.toUpperCase()) {
			case "GET":
				treeItem.iconPath = new vscode.ThemeIcon("eye", new vscode.ThemeColor("charts.green"))
				break
			case "POST":
				treeItem.iconPath = new vscode.ThemeIcon("diff-added", new vscode.ThemeColor("charts.blue"))
				break
			case "DELETE":
				treeItem.iconPath = new vscode.ThemeIcon("trash", new vscode.ThemeColor("charts.red"))
				break
			case "PUT":
				treeItem.iconPath = new vscode.ThemeIcon("edit", new vscode.ThemeColor("charts.yellow"))
				break
			default:
				treeItem.iconPath = new vscode.ThemeIcon("symbol-method")
				break
		}
		// Add all routes directly to rootItems
		rootItems.set(label, treeItem)
	}

	return Array.from(rootItems.values())
}

async function getFilesRecursively(directoryUri: vscode.Uri): Promise<vscode.Uri[]> {
	const fileUris: vscode.Uri[] = []
	const directoryUris: vscode.Uri[] = []

	try {
		const entries = await vscode.workspace.fs.readDirectory(directoryUri)

		for (const [name, type] of entries) {
			const fileUri = vscode.Uri.joinPath(directoryUri, name)
			const isDirectory = type === vscode.FileType.Directory

			if (isDirectory) {
				// Exclude directories that start and end with __
				if (!name.startsWith("__") && !name.endsWith("__")) {
					directoryUris.push(fileUri) // Collect directory URIs
				}
			} else {
				fileUris.push(fileUri) // Collect file URIs
			}
		}

		// Recursively get files from subdirectories
		for (const dirUri of directoryUris) {
			fileUris.push(...(await getFilesRecursively(dirUri)))
		}
	} catch (error) {
		console.error(`Error reading directory ${directoryUri.fsPath}:`, error)
	}

	return fileUris
}

async function extractExpressRoutes() {
	const config = vscode.workspace.getConfiguration("apiMan")
	const routePath = config.get<string>("path", "./src/")
	console.log(`Configured route path: ${routePath}`)

	const workspaceFolders = vscode.workspace.workspaceFolders
	if (!workspaceFolders) {
		console.log("No workspace folder is open.")
		return []
	}

	const workspaceRoot = workspaceFolders[0].uri.fsPath
	const absoluteRoutePath = path.resolve(workspaceRoot, routePath)
	console.log(`Absolute route path: ${absoluteRoutePath}`)

	const directoryUri = vscode.Uri.file(absoluteRoutePath)
	const fileUris = await getFilesRecursively(directoryUri)
	const jsFileUris = fileUris.filter((uri) => uri.fsPath.endsWith(".js") || uri.fsPath.endsWith(".ts"))
	console.log(
		`Found files:`,
		jsFileUris.map((uri) => uri.fsPath),
	)

	const routesList: Route[] = []
	const routerVariables = new Set<string>()
	const nestedRouters = new Map<string, string>() // Stores mounted routers and their base paths

	for (const fileUri of jsFileUris) {
		const document = await vscode.workspace.openTextDocument(fileUri)
		const code = document.getText()
		const ast = parse(code, { sourceType: "module" })
		const filePath = fileUri.fsPath

		traverse(ast, {
			// Track all router variables (const router = express.Router();)
			VariableDeclarator(path) {
				if (
					t.isCallExpression(path.node.init) &&
					t.isMemberExpression(path.node.init.callee) &&
					t.isIdentifier(path.node.init.callee.property, { name: "Router" })
				) {
					if (t.isIdentifier(path.node.id)) {
						routerVariables.add(path.node.id.name)
					}
				}
			},

			// Track `app.use('/basepath', someRouter)` to determine nested routers
			CallExpression(path) {
				const { node } = path

				// Case 1: Track `app.use('/basepath', router)`
				if (
					t.isMemberExpression(node.callee) &&
					// t.isIdentifier(node.callee.object, { name: 'app' }) &&
					t.isIdentifier(node.callee.property, { name: "use" }) &&
					node.arguments.length >= 2 &&
					t.isStringLiteral(node.arguments[0]) &&
					t.isIdentifier(node.arguments[1])
				) {
					nestedRouters.set(node.arguments[1].name, node.arguments[0].value)
					console.log(`Detected mounted router: ${node.arguments[1].name} at ${node.arguments[0].value}`)
				}

				// Case 2: Track Direct Routes (app.METHOD(path, handler))
				if (
					t.isMemberExpression(node.callee) &&
					t.isIdentifier(node.callee.object, { name: "app" }) &&
					t.isIdentifier(node.callee.property) &&
					["get", "post", "put", "delete", "patch"].includes(node.callee.property.name)
				) {
					const method = node.callee.property.name.toUpperCase()
					const pathValue = t.isStringLiteral(node.arguments[0]) ? node.arguments[0].value : ""

					routesList.push({
						method,
						path: pathValue,
						basePath: "",
						file: filePath,
						fileLine: node.loc?.start.line || 0,
					})
				}

				// Case 3: Track Router-based Routes (router.get(), router.post(), etc.)
				if (
					t.isMemberExpression(node.callee) &&
					t.isIdentifier(node.callee.object) &&
					routerVariables.has(node.callee.object.name) && // Ensure it's a known Router variable
					t.isIdentifier(node.callee.property) &&
					["get", "post", "put", "delete", "patch"].includes(node.callee.property.name)
				) {
					const method = node.callee.property.name.toUpperCase()
					const pathValue = t.isStringLiteral(node.arguments[0]) ? node.arguments[0].value : ""
					const parentRouter = node.callee.object.name
					const detectedBasePath = nestedRouters.get(parentRouter) || ""
					console.log(`Detected nested route: ${method} ${detectedBasePath}${pathValue}`)

					routesList.push({
						method,
						path: pathValue,
						basePath: detectedBasePath,
						file: filePath,
						fileLine: node.loc?.start.line || 0,
					})
				}
			},
		})
	}
	console.log(routesList)
	return routesList
}

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
	const openRouteInFile = vscode.commands.registerCommand("api-man.openRouteInFile", (file: string, line: number) => {
		const fileUri = vscode.Uri.file(file)
		vscode.workspace.openTextDocument(fileUri).then((document) => {
			vscode.window.showTextDocument(document).then((editor) => {
				const range = new vscode.Range(line - 1, 0, line - 1, 0)
				editor.selection = new vscode.Selection(range.start, range.end)
				editor.revealRange(range)
			})
		})
	})
	context.subscriptions.push(openRouteInFile)

	// Listen for configuration changes and refresh the webview if needed
	vscode.workspace.onDidChangeConfiguration((event) => {
		console.log("Configuration changed:", event)
		if (event.affectsConfiguration("apiMan.path") || event.affectsConfiguration("apiMan.groupBy")) {
			provider.updateWebview()
		}
	})
}

class ApiManagerWebviewProvider implements vscode.WebviewViewProvider {
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
					this.openFileAtLine(message.file, message.line)
					break
			}
		})
	}

	// Re-extract routes and update the HTML content of the webview
	async updateWebview() {
		const routes = await extractExpressRoutes()
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
		return `
	  <!DOCTYPE html>
	  <html lang="en">
	  <head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>API Routes</title>
		<style>
		  :root {
			--background-color: var(--vscode-editor-background, #ffffff);
			--text-color: var(--vscode-editor-foreground, #333333);
			--list-hover-background: var(--vscode-list-hoverBackground, rgba(0, 0, 0, 0.05));
		  }
		  body { 
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
			padding: 16px; 
			background-color: var(--background-color);
			color: var(--text-color);
			font-size: 13px;
			line-height: 1.4;
		  }
		  ul {
			list-style-type: none;
			padding: 0;
			margin: 0;
		  }
		  li { 
			cursor: pointer; 
			padding: 8px 12px;
			border-radius: 3px;
			transition: background-color 0.2s;
			display: flex;
			align-items: center;
		  }
		  li:hover { 
			background-color: var(--list-hover-background);
		  }
		  .method {
			font-weight: bold;
			margin-right: 8px;
			display: flex;
			align-items: center;
		  }
		  .method svg {
			margin-right: 4px;
		  }
		.path {
		  color: white;
		}
		  .file {
			opacity: 0.7;
			font-size: 12px;
			margin-left: auto;
		  }
		  .controls {
			margin-bottom: 8px;
		  }
		  .group-select {
			width: 100%;
			padding: 4px;
			background: var(--vscode-dropdown-background);
			color: var(--vscode-dropdown-foreground);
			border: 1px solid var(--vscode-dropdown-border);
			border-radius: 2px;
		  }
		  .group-header {
			padding: 4px 12px;
			font-weight: 600;
			font-size: 11px;
			text-transform: uppercase;
			opacity: 0.8;
			margin-top: 8px;
		  }
		</style>
	  </head>
	  <body>
<div class="controls">
  <span class="group-text">
    Group by:
    <button onclick="handleGrouping('basePath', this)">Basepath</button>
    <button onclick="handleGrouping('method', this)">Method</button>
  </span>
</div>

<style>
  .controls {
    margin-bottom: 20px; /* More space below the controls */
  }
  .group-text {
    font-size: 13px;
    color: #94a3b8;
  }
  .group-text button {
    background: transparent;
    border: 1px solid transparent;
    padding: 4px 8px;   /* Increased padding for a more clickable area */
    margin: 0 4px;      /* Horizontal spacing between buttons */
    border-radius: 4px;
    color: #64748b;
    cursor: pointer;
    font-size: inherit;
    font-family: inherit;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  }
  .group-text button:hover {
    background: #334155;
    border-color: #334155;
    color: #e2e8f0;
  }
  .group-text button.active {
    background: #475569;
    border-color: #475569;
    color: #f8fafc;
  }
</style>

<script>
  function handleGrouping(value, element) {
    // If already active, turn it off and revert grouping
    if (element.classList.contains('active')) {
      element.classList.remove('active');
      changeGrouping('none');  // changeGrouping should be defined elsewhere
      return;
    }
    
    // Remove active class from all buttons
    document.querySelectorAll('.group-text button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Activate the clicked button and update grouping
    element.classList.add('active');
    changeGrouping(value);  // changeGrouping should be defined elsewhere
  }
</script>

		<ul id="routesList"></ul>
		<script>
		  let currentGrouping = 'none';
		  let routes = ${JSON.stringify(routes)};
		  
		  function getMethodIcon(method) {
			const iconSize = 16;
			switch (method.toUpperCase()) {
			  case "GET":
				return \`<svg width="\${iconSize}" height="\${iconSize}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>\`;
			  case "POST":
				return \`<svg width="\${iconSize}" height="\${iconSize}" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>\`;
			  case "PUT":
				return \`<svg width="\${iconSize}" height="\${iconSize}" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>\`;
			  case "DELETE":
				return \`<svg width="\${iconSize}" height="\${iconSize}" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>\`;
			  default:
				return \`<svg width="\${iconSize}" height="\${iconSize}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>\`;
			}
		  }

		  function renderRoute(route) {
			const fullPath = \`\${route.basePath}\${route.path}\`;
			const methodIcon = getMethodIcon(route.method);
			const pathComponents = route.file.split('/');
			const description = pathComponents.slice(-2).join('/');
			const methodClass = \`method-\${route.method.toLowerCase()}\`;
			
			return \`
			  <li onclick="openRoute('\${route.file}', \${route.fileLine})">
				<span class="method \${methodClass}">
				  \${methodIcon}
				  \${route.method}
				</span>
				<span class="path">\${fullPath}</span>
				<span class="file">- \${description}</span>
			  </li>
			\`;
		  }

		  function changeGrouping(value) {
			currentGrouping = value;
			renderRoutes();
		  }

		 		function renderRoutes() {
		  const list = document.getElementById('routesList');
		  
		  if (currentGrouping === 'none') {
			list.innerHTML = routes.map(route => renderRoute(route)).join('');
			return;
		  }
		
		  const groups = {};
		  routes.forEach(route => {
			const key = currentGrouping === 'method' ? route.method : (route.basePath || '/');
			if (!groups[key]) groups[key] = [];
			groups[key].push(route);
		  });
		
		  const desiredOrder = currentGrouping === 'method' ? ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] : [];
		
		  list.innerHTML = Object.entries(groups)
			.sort(([a], [b]) => {
			  const indexA = desiredOrder.indexOf(a);
			  const indexB = desiredOrder.indexOf(b);
			  if (indexA === -1 && indexB === -1) return a.localeCompare(b);
			  if (indexA === -1) return 1;
			  if (indexB === -1) return -1;
			  return indexA - indexB;
			})
			.map(([group, items]) => \`
			  <div class="group-header">\${group}</div>
			  \${items.map(route => renderRoute(route)).join('')}
			\`).join('');
		}

		  function openRoute(file, line) {
			vscode.postMessage({ command: 'openFile', file: file, line: line });
		  }

		  // Initial render
		  renderRoutes();
		</script>
	  </body>
	  </html>
	`
	}

	// Open the file at a specific line number.
	openFileAtLine(file: string, line: number) {
		const fileUri = vscode.Uri.file(file)
		vscode.workspace.openTextDocument(fileUri).then((document) => {
			vscode.window.showTextDocument(document).then((editor) => {
				const range = new vscode.Range(line - 1, 0, line - 1, 0)
				editor.selection = new vscode.Selection(range.start, range.end)
				editor.revealRange(range)
			})
		})
	}
}

// This method is called when your extension is deactivated
export function deactivate() { }