import * as path from "path";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import * as vscode from "vscode";
import { Route } from "../types";
import { getFrameworkFiles } from "../utils/fileUtils";

const VALID_METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);

export default async function extractFastAPIRoutes(): Promise<Route[]> {
    const pyFiles = await getFrameworkFiles(['.py']);
    const parser = createParser();

    return processFiles(pyFiles, parser);
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
    // Track router prefixes
    const routerPrefixes: Map<string, string> = new Map();

    function traverse(node: Parser.SyntaxNode) {
        // Check for APIRouter instantiation to capture prefixes
        if (node.type === "assignment" && node.text.includes("APIRouter(")) {
            const variableName = node.childForFieldName("left")?.text;
            const prefixMatch = node.text.match(/prefix\s*=\s*["']([^"']+)["']/);
            if (variableName && prefixMatch) {
                routerPrefixes.set(variableName, prefixMatch[1]);
            }
        }

        if (node.type === "decorated_definition") {
            const classDef = node.children.find(c => c.type === "class_definition");
            const functionDef = node.children.find(c => c.type === "function_definition");
            
            if (classDef) {
                processClassDefinition(node, "", filePath, routesList, routerPrefixes);
            } else if (functionDef) {
                processFastAPIRoute(node, "", filePath, routesList, routerPrefixes);
            }
        }
        node.children.forEach(child => traverse(child));
    }

    traverse(tree.rootNode);
}

function processClassDefinition(
    node: Parser.SyntaxNode,
    basePath: string,
    filePath: string,
    routesList: Route[],
    routerPrefixes: Map<string, string>
): void {
    const classDef = node.children.find(c => c.type === "class_definition");
    if (!classDef) return;

    const classBasePath = getDecoratedPath(node.children, basePath);
    const classBody = classDef.childForFieldName("body");

    classBody?.children.forEach(methodNode => {
        if (methodNode.type === "function_definition") {
            processClassMethod(methodNode, classBasePath, filePath, routesList, routerPrefixes);
        } else if (methodNode.type === "decorated_definition") {
            const funcDef = methodNode.children.find(c => c.type === "function_definition");
            if (funcDef) processClassMethod(funcDef, classBasePath, filePath, routesList, routerPrefixes);
        }
    });
}

function processFastAPIRoute(
    node: Parser.SyntaxNode,
    basePath: string,
    filePath: string,
    routesList: Route[],
    routerPrefixes: Map<string, string>
): void {
    const decorators = node.children.filter(c => c.type === "decorator");
    
    decorators.forEach(decorator => {
        const decoratorCall = decorator.children[1]?.text;
        if (!decoratorCall) return;

        const [decoratorName, pathArg] = parseDecoratorCall(decoratorCall);
        
        // Check for router reference with prefix
        const routerMatch = decoratorCall.match(/(\w+)\.(get|post|put|delete|patch|head|options|api_route)/);
        let routerPrefix = "";
        if (routerMatch && routerPrefixes.has(routerMatch[1])) {
            routerPrefix = routerPrefixes.get(routerMatch[1])!;
        }

        const fullPath = pathArg 
            ? path.join(routerPrefix, basePath, pathArg).replace(/\\/g, "/").replace(/\/+/g, "/")
            : path.join(routerPrefix, basePath).replace(/\\/g, "/").replace(/\/+/g, "/");

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

function processClassMethod(
    methodNode: Parser.SyntaxNode,
    classBasePath: string,
    filePath: string,
    routesList: Route[],
    routerPrefixes: Map<string, string>
): void {
    const methodNameNode = methodNode.childForFieldName("name");
    if (!methodNameNode) return;

    const methodName = methodNameNode.text.toUpperCase();
    let methods = VALID_METHODS.has(methodName) ? [methodName] : [];

    const decorators = methodNode.children.filter(c => c.type === "decorator");
    decorators.forEach(decorator => {
        const decoratorCall = decorator.children[1]?.text;
        if (!decoratorCall) return;

        const [decoratorName] = parseDecoratorCall(decoratorCall);
        
        // Check for router reference with prefix
        const routerMatch = decoratorCall.match(/(\w+)\.(get|post|put|delete|patch|head|options|api_route)/);
        let routerPrefix = "";
        if (routerMatch && routerPrefixes.has(routerMatch[1])) {
            routerPrefix = routerPrefixes.get(routerMatch[1])!;
        }

        if (VALID_METHODS.has(decoratorName.split(".").pop()?.toUpperCase() || "")) {
            methods.push(decoratorName.split(".").pop()!.toUpperCase());
        }

        const fullPath = path.join(routerPrefix, classBasePath)
            .replace(/\\/g, "/")
            .replace(/\/+/g, "/");

        methods.forEach(method => {
            routesList.push({
                method,
                path: fullPath,
                basePath: "",
                file: filePath,
                fileLine: methodNode.startPosition.row + 1
            });
        });
    });
}

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