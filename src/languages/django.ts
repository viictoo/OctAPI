import * as path from "path"
import * as vscode from "vscode"
import { Route } from "../types"
import getFilesRecursively from "../utils/fileUtils"
const Parser = require("tree-sitter")
const Python = require("tree-sitter-python")

export default async function extractDjangoRoutes() {
    const config = vscode.workspace.getConfiguration("apiMan")
    const routePath = config.get<string>("path", "./")
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) return []
    
    const workspaceRoot = workspaceFolders[0].uri.fsPath
    const absoluteRoutePath = path.resolve(workspaceRoot, routePath)
    const directoryUri = vscode.Uri.file(absoluteRoutePath)
    const fileUris = await getFilesRecursively(directoryUri)
    const urlsFileUris = fileUris.filter(uri => uri.fsPath.endsWith("urls.py"))

    const routesList: Route[] = []
    const parser = new Parser()
    parser.setLanguage(Python)

    for (const fileUri of urlsFileUris) {
        const document = await vscode.workspace.openTextDocument(fileUri)
        const code = document.getText()
        const tree = parser.parse(code)
        const rootNode = tree.rootNode

        const traverseTree = (node: any) => {
            if (node.type === "assignment_statement") {
                const left = node.childForFieldName("left")
                const right = node.childForFieldName("right")
                
                if (left?.text === "urlpatterns" && right?.type === "list") {
                    right.namedChildren.forEach((listItem: any) => {
                        const callNode = listItem.namedChildren.find((d: any) => 
                            d.type === "call" && ["path", "re_path"].includes(d.childForFieldName("function")?.text)
                        )

                        if (callNode) {
                            const functionName = callNode.childForFieldName("function")?.text
                            const argsNode = callNode.childForFieldName("arguments")
                            
                            const routeNode = argsNode?.namedChildren[0]
                            const handlerNode = argsNode?.namedChildren[1]
                            
                            if (routeNode?.type === "string" && handlerNode) {
                                const route = routeNode.text.slice(1, -1) // Remove quotes
                                let include = ""
                                let view = ""
                                
                                // Check for include() calls
                                if (handlerNode.type === "call" && 
                                    handlerNode.childForFieldName("function")?.text === "include") {
                                    const includeArg = handlerNode.childForFieldName("arguments")?.namedChildren[0]
                                    if (includeArg?.type === "string") {
                                        include = includeArg.text.slice(1, -1)
                                    }
                                } else {
                                    view = handlerNode.text
                                }

                                routesList.push({
                                    path: route,
                                    method: functionName.toUpperCase(),
                                    // include,
                                    // view,
                                    basePath: path.dirname(fileUri.fsPath),
                                    file: fileUri.fsPath,
                                    fileLine: callNode.startPosition.row + 1,
                                })
                            }
                        }
                    })
                }
            }

            node.namedChildren.forEach(traverseTree)
        }

        traverseTree(rootNode)
    }

    console.log("Django routes:", routesList)
    return routesList
}