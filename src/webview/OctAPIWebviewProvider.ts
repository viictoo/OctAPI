import * as fs from 'fs';
import * as path from 'path';
import * as vscode from "vscode";
import { openFileAtLine } from "../utils/fileUtils";
import frameworkMiddleware from '../languages';
import { Route } from '../types';

export default class OctAPIWebviewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView
    private updateCounter = 0 // Counter to track the latest update call
    routes: Route[] = []
    starredRoutes: Set<string>

    constructor(private context: vscode.ExtensionContext) {
        // Initialize starred routes from persistent storage
        const stored = context.globalState.get<string[]>('starredRoutes') || []
        this.starredRoutes = new Set(stored)
    }

    persistStarredRoutes() {
        this.context.globalState.update('starredRoutes', Array.from(this.starredRoutes))
    }

    async postmanExport() {
        if (this.routes.length === 0) {
            vscode.window.showErrorMessage('No routes found to export');
            return;
        }
    
        // Helper function to detect and convert path parameters
        const convertPathParams = (path: string) => {
            // Handle FastAPI format: /users/{username}/post/{id}
            path = path.replace(/{(\w+)}/g, '{{$1}}');
            
            // Handle Express/NestJS/Koa format: /users/:id
            path = path.replace(/\/:(\w+)/g, '/{{$1}}');
            
            // Handle Flask format: /users/<int:user_id>
            path = path.replace(/<[^>]+>/g, (match) => {
                const param = match.slice(1, -1).split(':').pop()!;
                return `{{${param}}}`;
            });
            
            return path;
        };
    
        // Generate Postman collection structure
        const postmanCollection: any = {
            info: {
                name: "API Routes",
                schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            item: this.routes.map(route => {
                const fullPath = `${route.basePath}${route.path}`;
                const postmanPath = convertPathParams(fullPath);
                
                // Extract parameter names for Postman variables
                const params = postmanPath.match(/\/:(\w+)/g)?.map(p => p.slice(2)) || [];
    
                return {
                    name: `${route.method} ${fullPath}`,
                    request: {
                        method: route.method.toUpperCase(),
                        header: [],
                        url: {
                            raw: `{{baseUrl}}${postmanPath}`,
                            host: ["{{baseUrl}}"],
                            path: postmanPath.split('/').filter(p => p),
                            variable: params.map(param => ({
                                key: param,
                                value: `example_${param}`,
                                description: `Path parameter: ${param}`
                            }))
                        }
                    }
                };
            }),
            variable: []
        };
    
        // Get URL prefix from configuration
        const config = vscode.workspace.getConfiguration("OctAPI");
        const urlPrefix = config.get<string>("urlPrefix", "");
        
        // Add base URL variable if prefix exists
        if (urlPrefix) {
            postmanCollection.variable.push({
                key: "baseUrl",
                value: urlPrefix,
                type: "string"
            });
        }
    
        const collectionJson = JSON.stringify(postmanCollection, null, 2);
    
        // Set default filename
        const defaultFileName = 'Postman_Collection.json';
    
        // Get workspace path for default save location
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let defaultUri = workspaceFolders?.[0]?.uri;
        if (defaultUri) {
            defaultUri = defaultUri.with({ path: path.join(defaultUri.path, defaultFileName) });
        }
    
        // Show save dialog
        const uri = await vscode.window.showSaveDialog({
            filters: { 'Postman Collections': ['json'] },
            title: 'Export Postman Collection',
            defaultUri: defaultUri
        });
    
        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(collectionJson));
            const openFileButton = 'Open File';
            vscode.window.showInformationMessage('Postman collection exported successfully!', openFileButton).then(selection => {
                if (selection === openFileButton) {
                    vscode.commands.executeCommand('vscode.open', uri);
                }
            });
        }
    }

    private toggleRouteStar(routeId: string) {
        if (this.starredRoutes.has(routeId)) {
            this.starredRoutes.delete(routeId)
        } else {
            this.starredRoutes.add(routeId)
        }
        this.persistStarredRoutes()
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView
        webviewView.webview.options = { enableScripts: true }
        this._view.webview.html = this.getLoading()
        // Initial load of routes
        this.updateWebview()

        // Listen for messages from the webview (e.g. refresh or open file)
        webviewView.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case "refresh":
                    if (this._view) this._view.webview.html = this.getLoading()
                    this.updateWebview()
                    break
                case "openFile":
                    openFileAtLine(message.file, message.line)
                    break
                case "openSettings":
                    vscode.commands.executeCommand("workbench.action.openSettings", "OctAPI")
                    break
                case "vscodeFile":
                    vscode.commands.executeCommand('workbench.action.files.openFolder');
                    break
                case 'copyRoute':
                    const config = vscode.workspace.getConfiguration("OctAPI");
                    let urlPrefix = config.get<string>("urlPrefix", "");
                    urlPrefix = urlPrefix.replace(/\/+$/, ""); // Remove trailing slashes
                    vscode.env.clipboard.writeText(`${urlPrefix}${message.route}`);
                    break;
                case 'toggleFavorite':
                    this.toggleRouteStar(message.routeId)
                    // Send updated state back to webview
                    this._view?.webview.postMessage({
                        command: 'updateFavorite',
                        routeId: message.routeId,
                        isStarred: this.starredRoutes.has(message.routeId)
                    })
                    break
            }
        })
    }

    // Re-extract routes and update the HTML content of the webview
    async updateWebview() {
        const currentUpdate = ++this.updateCounter // Increment the counter for the current update
        if (this._view) this._view.webview.html = this.getLoading()
        const routes = await frameworkMiddleware()
        this.routes = routes

        // Pass enhanced routes to the view
        // const html = this.getHtmlContent(processedRoutes)
        if (currentUpdate !== this.updateCounter) {
            // If the current update is not the latest, ignore the result
            return
        }
        if (routes.length === 0) {
            const html = this.getWelcomeContent()
            if (this._view) {
                console.log('No routes found, displaying welcome message.')
                this._view.webview.html = html
            }
            return
        }
        // Add starred status to routes
        const processedRoutes = routes.map(route => ({
            ...route,
            routeId: `${route.method}-${route.path}-${route.file}`, // Unique ID
            isStarred: this.starredRoutes.has(`${route.method}-${route.path}-${route.file}`)
        }))

        const html = this.getHtmlContent(processedRoutes)
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
                        .method-patch { color: var(--patch-color, #a855f7); } 
                        .method-other { color: var(--other-color, #50e3c2); }
                    \`;
                    document.head.appendChild(style);
                </script>
                </head>`,
            );
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

    private getLoading(): string {
        const htmlFilePath = path.join(__dirname, '..', 'webview', 'templates', 'loading.html');
        let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
        return htmlContent;
    }
}