import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import * as path from 'path';
import * as vscode from 'vscode';
import { getFilesRecursively } from "../utils/fileUtils"
import { Route } from '../types';

export default async function extractKoaRoutes() {
    const config = vscode.workspace.getConfiguration('OctAPI');
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
    const routerPrefixes = new Map<string, string>();

    for (const fileUri of jsFileUris) {
        const document = await vscode.workspace.openTextDocument(fileUri);
        const code = document.getText();
        try {
            const ast = parse(code, { sourceType: 'module', plugins: ['typescript'] });

            const filePath = fileUri.fsPath;

            traverse(ast, {
                CallExpression(path) {
                    // Improved route method detection
                    if (
                        t.isMemberExpression(path.node.callee) &&
                        t.isIdentifier(path.node.callee.object) &&
                        t.isIdentifier(path.node.callee.property) &&
                        ['get', 'post', 'put', 'delete', 'patch'].includes(path.node.callee.property.name)
                    ) {
                        // Check if the first argument is a string (route path)
                        const firstArg = path.node.arguments[0];
                        if (t.isStringLiteral(firstArg)) {
                            // Check if the method is chained on a likely router-like method
                            const parentPath = path.parentPath;
                            const isLikelyRouterMethod = (
                                // Check for method chaining or direct router method
                                (t.isCallExpression(parentPath.node) && 
                                 t.isMemberExpression(parentPath.node.callee) && 
                                 t.isIdentifier(parentPath.node.callee.property) &&
                                 ['use', 'routes', 'allowedMethods'].includes(parentPath.node.callee.property.name)) ||
                                (t.isVariableDeclarator(parentPath.node) && 
                                 t.isIdentifier(parentPath.node.id)) ||
                                (t.isAssignmentExpression(parentPath.node))
                            );

                            if (isLikelyRouterMethod) {
                                const method = path.node.callee.property.name.toUpperCase();
                                const routePathValue = firstArg.value;
                                const routerVarName = path.node.callee.object.name;
                                const routerPrefix = routerPrefixes.get(routerVarName) || '';

                                // Adding the detected route to the list
                                routesList.push({
                                    method,
                                    path: routePathValue, 
                                    file: filePath,
                                    fileLine: path.node.loc?.start.line || 0,
                                    basePath: routerPrefix || '', 
                                });
                            }
                        }
                    }

                    // Prefix detection remains the same
                    if (
                        t.isMemberExpression(path.node.callee) &&
                        t.isIdentifier(path.node.callee.object) &&
                        t.isIdentifier(path.node.callee.property, { name: 'prefix' }) &&
                        t.isStringLiteral(path.node.arguments[0])
                    ) {
                        const routerVarName = path.node.callee.object.name;
                        const prefixValue = path.node.arguments[0].value;
                        routerPrefixes.set(routerVarName, prefixValue);
                    }
                },
            });
        } catch (error) {
            console.error('Error parsing file:', fileUri.fsPath, error);
            return [];
        }
    }
    
    return routesList;
}