import * as vscode from 'vscode';
import { RouteCache } from './cache';
import OctAPIWebviewProvider from '../webview/OctAPIWebviewProvider';
import { parseSingleFile } from './fileUtils';

// Debounce function to limit the rate at which a function can fire
const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

// Function to setup the file watcher
export function setupFileWatcher(provider: OctAPIWebviewProvider, context: vscode.ExtensionContext) {
    const routeCache = RouteCache.getInstance();
    let fileWatcher: vscode.FileSystemWatcher;

    // Function to create the file watcher
    const createWatcher = () => {
        const config = vscode.workspace.getConfiguration("OctAPI");
        const routePath = config.get<string>("path", "./src/");

        // Dispose of the existing watcher if it exists
        if (fileWatcher) fileWatcher.dispose();

        // Check if workspace folders and route path are available
        if (vscode.workspace.workspaceFolders && routePath) {
            const baseUri = vscode.Uri.joinPath(
                vscode.workspace.workspaceFolders[0].uri,
                routePath
            );

            // Create a new file system watcher
            fileWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(baseUri, "**/*.{js,ts,py}")
            );

            // Debounced function to update the webview
            const debouncedUpdate = debounce(() => provider.updateWebview(), 300);

            // Handle file updates (change and create)
            const handleFileUpdate = async (uri: vscode.Uri) => {
                try {
                    console.log("File changed:", uri.fsPath);
                    const routes = await parseSingleFile(uri);
                    routeCache.updateFile(uri, routes);
                    debouncedUpdate();
                } catch (error) {
                    console.error(`Error processing ${uri.fsPath}:`, error);
                }
            };

            // Register event handlers for file changes, creations, and deletions
            fileWatcher.onDidChange(handleFileUpdate);
            fileWatcher.onDidCreate(handleFileUpdate);
            fileWatcher.onDidDelete(uri => {
                routeCache.deleteFile(uri);
                debouncedUpdate();
            });

            // Add the file watcher to the context's subscriptions
            context.subscriptions.push(fileWatcher);
            console.log("Watching path:", baseUri.fsPath);
        }
    };

    // Return an object with initialize and refresh methods
    return {
        initialize: () => {
            createWatcher();
            return {
                refresh: () => {
                    routeCache.clear();
                    createWatcher();
                }
            };
        }
    };
}