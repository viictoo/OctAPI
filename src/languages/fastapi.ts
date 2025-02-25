import * as vscode from "vscode";
import * as path from "path";
import { Route } from "../types";
import { getFilesRecursively } from "../utils/fileUtils";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";

const VALID_METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);

export default async function extractFastAPIRoutes(): Promise<Route[]> {
    const config = vscode.workspace.getConfiguration("OctAPI");
    const routePath = config.get<string>("path", "./src/");
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceRoot) return [];
    
    const absoluteRoutePath = path.resolve(workspaceRoot, routePath);
    const directoryUri = vscode.Uri.file(absoluteRoutePath);
    const pyFiles = await getPythonFiles(directoryUri);
    const parser = createParser();

    return processFiles(pyFiles, parser);
}

// Shared utility functions remain the same
async function getPythonFiles(directoryUri: vscode.Uri): Promise<vscode.Uri[]> {
    const fileUris = await getFilesRecursively(directoryUri);
    return fileUris.filter(uri => uri.fsPath.endsWith(".py"));
}

function createParser(): Parser {
    const parser = new Parser();
    parser.setLanguage(Python as unknown as Parser.Language);
    return parser;
}

async function processFiles(pyFiles: vscode.Uri[], parser: Parser): Promise<Route[]> {
    const routesList: Route[] = [];

    for (const fileUri of pyFiles) {
        const document = await vscode.workspace.openTextDocument(fileUri);
        const tree = parser.parse(document.getText());
        processTree(tree, fileUri.fsPath, routesList);
    }

    return routesList;
}

function processTree(tree: Parser.Tree, filePath: string, routesList: Route[]): void {
    function traverse(node: Parser.SyntaxNode, basePath = "") {
        if (node.type === "decorated_definition") {
            const classDef = node.children.find(c => c.type === "class_definition");
            const functionDef = node.children.find(c => c.type === "function_definition");
            
            if (classDef) {
                processClassDefinition(node, basePath, filePath, routesList);
            } else if (functionDef) {
                processFastAPIRoute(node, basePath, filePath, routesList);
            }
        }
        node.children.forEach(child => traverse(child, basePath));
    }

    traverse(tree.rootNode);
}

function processClassDefinition(
    node: Parser.SyntaxNode,
    basePath: string,
    filePath: string,
    routesList: Route[]
): void {
    const classDef = node.children.find(c => c.type === "class_definition");
    if (!classDef) return;

    const className = classDef.childForFieldName("name")?.text || "";
    const classBasePath = getDecoratedPath(node.children, basePath);
    const classBody = classDef.childForFieldName("body");

    classBody?.children.forEach(methodNode => {
        if (methodNode.type === "function_definition") {
            processClassMethod(methodNode, classBasePath, className, filePath, routesList);
        } else if (methodNode.type === "decorated_definition") {
            const funcDef = methodNode.children.find(c => c.type === "function_definition");
            if (funcDef) processClassMethod(funcDef, classBasePath, className, filePath, routesList);
        }
    });
}

function processFastAPIRoute(
    node: Parser.SyntaxNode,
    basePath: string,
    filePath: string,
    routesList: Route[]
): void {
    const decorators = node.children.filter(c => c.type === "decorator");
    const functionDef = node.children.find(c => c.type === "function_definition");
    
    decorators.forEach(decorator => {
        const decoratorCall = decorator.children[1]?.text;
        if (!decoratorCall) return;

        const [decoratorName, pathArg] = parseDecoratorCall(decoratorCall);
        const fullPath = pathArg ? path.join(basePath, pathArg).replace(/\\/g, "/") : basePath;

        // Handle both direct methods and api_route
        if (decoratorName.endsWith(".api_route")) {
            const methods = getMethodsFromDecorator(decoratorCall);
            methods.forEach(method => {
                routesList.push(createRoute(method, fullPath, basePath, filePath, decorator));
            });
        } else if (VALID_METHODS.has(decoratorName.split(".").pop()?.toUpperCase() || "")) {
            const method = decoratorName.split(".").pop()!.toUpperCase();
            routesList.push(createRoute(method, fullPath, basePath, filePath, decorator));
        }
    });
}

// Modified method processing for FastAPI conventions
function processClassMethod(
    methodNode: Parser.SyntaxNode,
    classBasePath: string,
    className: string,
    filePath: string,
    routesList: Route[]
): void {
    const methodNameNode = methodNode.childForFieldName("name");
    if (!methodNameNode) return;

    // Check for both method name and decorators
    const methodName = methodNameNode.text.toUpperCase();
    let methods = VALID_METHODS.has(methodName) ? [methodName] : [];

    // Check for decorators on the method
    const decorators = methodNode.children.filter(c => c.type === "decorator");
    decorators.forEach(decorator => {
        const decoratorCall = decorator.children[1]?.text;
        if (!decoratorCall) return;

        const [decoratorName] = parseDecoratorCall(decoratorCall);
        if (VALID_METHODS.has(decoratorName.split(".").pop()?.toUpperCase() || "")) {
            methods.push(decoratorName.split(".").pop()!.toUpperCase());
        }
    });

    methods.forEach(method => {
        routesList.push({
            method,
            path: classBasePath,
            basePath: "",
            file: filePath,
            fileLine: methodNode.startPosition.row + 1
        });
    });
}

// The following utility functions remain similar to Flask version
function getDecoratedPath(decorators: Parser.SyntaxNode[], basePath: string): string {
    return decorators.reduce((currentPath, decorator) => {
        const decoratorCall = decorator.children[1]?.text;
        if (!decoratorCall) return currentPath;

        const [decoratorName, pathArg] = parseDecoratorCall(decoratorCall);
        return (decoratorName.endsWith(".route") || decoratorName.endsWith(".api_route")) && pathArg
            ? path.join(currentPath, pathArg).replace(/\\/g, "/")
            : currentPath;
    }, basePath);
}

function parseDecoratorCall(decoratorCall: string): [string, string?] {
    const decoratorName = decoratorCall.split("(")[0];
    const pathMatch = decoratorCall.match(/['"]([^'"]+)['"]/);
    return [decoratorName, pathMatch?.[1]];
}

function getMethodsFromDecorator(decoratorCall: string): string[] {
    const methodsMatch = decoratorCall.match(/methods\s*=\s*\[([^\]]+)\]/);
    if (!methodsMatch) return ["GET"];

    return methodsMatch[1]
        .split(",")
        .map(m => m.trim().replace(/['"]/g, "").toUpperCase())
        .filter(m => VALID_METHODS.has(m));
}

function createRoute(
    method: string,
    path: string,
    basePath: string,
    filePath: string,
    decorator: Parser.SyntaxNode
): Route {
    return {
        method,
        path,
        basePath,
        file: filePath,
        fileLine: decorator.startPosition.row + 1
    };
}