import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import * as path from "path";
import * as vscode from "vscode";
import getFilesRecursively from "../utils/fileUtils";
import { Route } from "../types";

export default async function extractNestJSRoutes() {
    const config = vscode.workspace.getConfiguration("apiMan");
    const routePath = config.get<string>("path", "./src/");
    // console.log(`Configured route path: ${routePath}`)

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        console.log("No workspace folder is open.");
        return [];
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const absoluteRoutePath = path.resolve(workspaceRoot, routePath);
    // console.log(`Absolute route path: ${absoluteRoutePath}`)

    const directoryUri = vscode.Uri.file(absoluteRoutePath);
    const fileUris = await getFilesRecursively(directoryUri);
    const tsFileUris = fileUris.filter((uri) => uri.fsPath.endsWith(".ts"));
    // console.log(
    //     `Found files:`,
    //     tsFileUris.map((uri) => uri.fsPath),
    // )

    const routesList: Route[] = [];

    for (const fileUri of tsFileUris) {
        const document = await vscode.workspace.openTextDocument(fileUri);
        const code = document.getText();
        const ast = parse(code, { sourceType: "module", plugins: ["typescript", "decorators-legacy"] });
        const filePath = fileUri.fsPath;

        traverse(ast, {
            // Track route decorators in class methods
            // ClassMethod(path) {
            //     const methodDecorators = path.node.decorators || [];

            //     methodDecorators.forEach((decorator) => {
            //         if (
            //             t.isCallExpression(decorator.expression) &&
            //             t.isIdentifier(decorator.expression.callee) &&
            //             ["Get", "Post", "Put", "Delete", "Patch"].includes(decorator.expression.callee.name)
            //         ) {
            //             const method = decorator.expression.callee.name.toUpperCase();
            //             let pathValue = decorator.expression.arguments.length > 0 && t.isStringLiteral(decorator.expression.arguments[0])
            //                 ? decorator.expression.arguments[0].value
            //                 : "";

            //             if (!pathValue.startsWith("/")) {
            //                 pathValue = `/${pathValue}`;
            //             }

            //             routesList.push({
            //                 method,
            //                 path: pathValue,
            //                 basePath: "", // NestJS routes are typically absolute, so basePath is empty
            //                 file: filePath,
            //                 fileLine: decorator.loc?.start.line || 0,
            //             });
            //         }
            //     });
            // },

            // Track controller decorators to determine base paths
            ClassDeclaration(path) {
                const classDecorators = path.node.decorators || [];
                let basePath = "";

                classDecorators.forEach((decorator) => {
                    if (
                        t.isCallExpression(decorator.expression) &&
                        t.isIdentifier(decorator.expression.callee, { name: "Controller" }) &&
                        decorator.expression.arguments.length > 0 &&
                        t.isStringLiteral(decorator.expression.arguments[0])
                    ) {
                        basePath = decorator.expression.arguments[0].value;
                        if (!basePath.startsWith("/")) {
                            basePath = `/${basePath}`;
                        }
                    }
                });

                // Associate the base path with all routes in this class
                path.traverse({
                    ClassMethod(path) {
                        const methodDecorators = path.node.decorators || [];

                        methodDecorators.forEach((decorator) => {
                            if (
                                t.isCallExpression(decorator.expression) &&
                                t.isIdentifier(decorator.expression.callee) &&
                                ["Get", "Post", "Put", "Delete", "Patch"].includes(decorator.expression.callee.name)
                            ) {
                                const method = decorator.expression.callee.name.toUpperCase();
                                let pathValue = decorator.expression.arguments.length > 0 && t.isStringLiteral(decorator.expression.arguments[0])
                                    ? decorator.expression.arguments[0].value
                                    : "";

                                if (!pathValue.startsWith("/")) {
                                    pathValue = `/${pathValue}`;
                                }

                                routesList.push({
                                    method,
                                    path: pathValue,
                                    basePath: basePath, // Use the controller's base path
                                    file: filePath,
                                    fileLine: decorator.loc?.start.line || 0,
                                });
                            }
                        });
                    },
                });
            },
        });
    }

    console.log(routesList);
    return routesList;
}