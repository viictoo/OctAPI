import * as vscode from 'vscode';
import { Route } from '../types';
import { getFrameworkFiles, parseSingleFile } from './fileUtils';
import OctAPIWebviewProvider from '../webview/OctAPIWebviewProvider';

// Singleton class to manage route cache
export class RouteCache {
    private static instance: RouteCache;
    private cache = new Map<string, Route[]>();

    private constructor() { }

    // Get the singleton instance of RouteCache
    static getInstance(): RouteCache {
        if (!RouteCache.instance) {
            RouteCache.instance = new RouteCache();
        }
        return RouteCache.instance;
    }

    // Update routes for a single file
    updateFile(uri: vscode.Uri, routes: Route[]) {
        this.cache.set(uri.fsPath, routes);
    }

    // Remove routes for a deleted file
    deleteFile(uri: vscode.Uri) {
        this.cache.delete(uri.fsPath);
    }

    // Get all routes from cache
    getAllRoutes(): Route[] {
        return Array.from(this.cache.values()).flat();
    }

    // Clear cache when configuration changes
    clear() {
        this.cache.clear();
    }
}

// Function to initialize the cache with the current routes
export async function initializeCache(provider: OctAPIWebviewProvider) {
    const routeCache = RouteCache.getInstance();

    try {
        const config = vscode.workspace.getConfiguration("OctAPI");
        const framework = config.get<string>("framework", "Express");
        const files = await getFrameworkFiles(framework);

        // Process each file and update the cache
        const results = await Promise.allSettled(
            files.map(async file => {
                try {
                    const routes = await parseSingleFile(file);
                    routeCache.updateFile(file, routes);
                } catch (error) {
                    console.error(`Error processing ${file.fsPath}:`, error);
                }
            })
        );

        // Log any files that failed to process
        results.forEach((result, index) => {
            if (result.status === "rejected") {
                console.error(`Failed to process ${files[index].fsPath}:`, result.reason);
            }
        });

        // Update the webview with the new routes
        provider.updateWebview();
    } catch (error) {
        console.error("Cache initialization failed:", error);
    }
}