import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import * as path from 'path';
import * as vscode from 'vscode';
import getFilesRecursively from '../utils/fileUtils';
import { Route } from '../types';

export default async function extractKoaRoutes() {
    const config = vscode.workspace.getConfiguration('apiMan');
    const routePath = config.get<string>('path', './src/');
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        console.log('No workspace folder is open.');
        return [];
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const absoluteRoutePath = path.resolve(workspaceRoot, routePath);

    const directoryUri = vscode.Uri.file(absoluteRoutePath);
    const fileUris = await getFilesRecursively(directoryUri);
    const jsFileUris = fileUris.filter((uri) => uri.fsPath.endsWith('.js') || uri.fsPath.endsWith('.ts'));

    const routesList: Route[] = [];
    const routerPrefixes = new Map<string, string>(); // Stores router variables and their prefixes

    for (const fileUri of jsFileUris) {
        const document = await vscode.workspace.openTextDocument(fileUri);
        const code = document.getText();
        const ast = parse(code, { sourceType: 'module', plugins: ['typescript'] });
        const filePath = fileUri.fsPath;

        traverse(ast, {
            // Detect prefix setting (router.prefix('/base'))
            CallExpression(path) {
                if (
                    t.isMemberExpression(path.node.callee) &&
                    t.isIdentifier(path.node.callee.object) &&
                    t.isIdentifier(path.node.callee.property, { name: 'prefix' }) &&
                    t.isStringLiteral(path.node.arguments[0])
                ) {
                    const routerVarName = path.node.callee.object.name;
                    const prefixValue = path.node.arguments[0].value;
                    if (routerPrefixes.has(routerVarName)) {
                        routerPrefixes.set(routerVarName, prefixValue);
                    } else {
                        routerPrefixes.set(routerVarName, prefixValue); // Initialize with prefix if not already set
                    }
                }

                // Detecting route methods (get, post, etc.)
                if (
                    t.isMemberExpression(path.node.callee) &&
                    t.isIdentifier(path.node.callee.object) && // Checking if it's a router method (e.g., router.post)
                    t.isIdentifier(path.node.callee.property) && // Ensure property is an identifier
                    ['get', 'post', 'put', 'delete', 'patch'].includes(path.node.callee.property.name) // HTTP methods
                ) {
                    const method = path.node.callee.property.name.toUpperCase();
                    const routePathValue = t.isStringLiteral(path.node.arguments[0]) ? path.node.arguments[0].value : '';
                    const routerVarName = path.node.callee.object.name;
                    const routerPrefix = routerPrefixes.get(routerVarName) || '';

                    // Adding the detected route to the list
                    routesList.push({
                        method,
                        path: routePathValue, // Full path including basePath
                        file: filePath,
                        fileLine: path.node.loc?.start.line || 0,
                        basePath: routerPrefix || '', // Ensure basePath is set properly
                    });
                }
            },
        });
    }

    console.log(routesList); // You can comment this out once you're confident it's working
    return routesList;
}