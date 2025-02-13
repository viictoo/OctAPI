import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import * as path from "path";
import * as vscode from "vscode";
import getFilesRecursively from "../utils/fileUtils";
import { Route } from "../types";

export default async function extractFastifyRoutes() {
    return []
    // const config = vscode.workspace.getConfiguration("OctAPI");
    // const routePath = config.get<string>("path", "./src/");
    // // console.log(`Configured route path: ${routePath}`);

    // const workspaceFolders = vscode.workspace.workspaceFolders;
    // if (!workspaceFolders) {
    //     console.log("No workspace folder is open.");
    //     return [];
    // }

    // const workspaceRoot = workspaceFolders[0].uri.fsPath;
    // const absoluteRoutePath = path.resolve(workspaceRoot, routePath);
    // // console.log(`Absolute route path: ${absoluteRoutePath}`);

    // const directoryUri = vscode.Uri.file(absoluteRoutePath);
    // const fileUris = await getFilesRecursively(directoryUri);
    // const jsFileUris = fileUris.filter((uri) => uri.fsPath.endsWith(".js") || uri.fsPath.endsWith(".ts"));
    // // console.log(
    // //     `Found files:`,
    // //     jsFileUris.map((uri) => uri.fsPath),
    // // );

    // const routesList: Route[] = [];

    // for (const fileUri of jsFileUris) {
    //     const document = await vscode.workspace.openTextDocument(fileUri);
    //     const code = document.getText();
    //     const ast = parse(code, { sourceType: "module", plugins: ["typescript"] });
    //     const filePath = fileUri.fsPath;

    //     traverse(ast, {
    //         CallExpression(path) {
    //             const { node } = path;

    //             // Case 1: Track Direct Routes (fastify.METHOD(path, handler))
    //             if (
    //                 t.isMemberExpression(node.callee) &&
    //                 t.isIdentifier(node.callee.object) &&
    //                 t.isIdentifier(node.callee.property) &&
    //                 ["get", "post", "put", "delete", "patch", "options", "head"].includes(node.callee.property.name)
    //             ) {
    //                 const method = node.callee.property.name.toUpperCase();
    //                 const pathValue = t.isStringLiteral(node.arguments[0]) ? node.arguments[0].value : "";
    //                 console.log(`Detected route: ${method} ${pathValue}`);
    //                 routesList.push({
    //                     method,
    //                     path: pathValue,
    //                     basePath: "",
    //                     file: filePath,
    //                     fileLine: node.loc?.start.line || 0,
    //                 });
    //             }

    //             // Case 2: Track Routes defined with fastify.route({ method, url, handler })
    //             if (
    //                 t.isMemberExpression(node.callee) &&
    //                 t.isIdentifier(node.callee.object) &&
    //                 t.isIdentifier(node.callee.property, { name: "route" }) &&
    //                 node.arguments.length === 1 &&
    //                 t.isObjectExpression(node.arguments[0])
    //             ) {
    //                 const routeObject = node.arguments[0];
    //                 const methodProperty = routeObject.properties.find(
    //                     (prop) => t.isObjectProperty(prop) && t.isIdentifier(prop.key, { name: "method" })
    //                 ) as t.ObjectProperty;
    //                 const urlProperty = routeObject.properties.find(
    //                     (prop) => t.isObjectProperty(prop) && t.isIdentifier(prop.key, { name: "url" })
    //                 ) as t.ObjectProperty;

    //                 if (methodProperty && urlProperty && t.isStringLiteral(urlProperty.value)) {
    //                     const methods = t.isStringLiteral(methodProperty.value)
    //                         ? [methodProperty.value.value.toUpperCase()]
    //                         : t.isArrayExpression(methodProperty.value)
    //                             ? methodProperty.value.elements.map((el) => (t.isStringLiteral(el) ? el.value.toUpperCase() : "")).filter(Boolean)
    //                             : [];
    //                     const pathValue = urlProperty.value.value;

    //                     methods.forEach((method) => {
    //                         console.log(`Detected route: ${method} ${pathValue}`);
    //                         routesList.push({
    //                             method,
    //                             path: pathValue,
    //                             basePath: "",
    //                             file: filePath,
    //                             fileLine: node.loc?.start.line || 0,
    //                         });
    //                     });
    //                 }
    //             }
    //         }
    //     });
    // }
    // console.log(routesList);
    // return routesList;
}