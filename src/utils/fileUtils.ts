import * as vscode from "vscode"

export async function getFilesRecursively(directoryUri: vscode.Uri): Promise<vscode.Uri[]> {
    const fileUris: vscode.Uri[] = []
    const directoryUris: vscode.Uri[] = []

    try {
        const entries = await vscode.workspace.fs.readDirectory(directoryUri)

        for (const [name, type] of entries) {
            const fileUri = vscode.Uri.joinPath(directoryUri, name)
            const isDirectory = type === vscode.FileType.Directory

            if (isDirectory) {
                // Exclude directories that start and end with __
                if (!name.startsWith("__") && !name.endsWith("__")) {
                    directoryUris.push(fileUri) // Collect directory URIs
                }
            } else {
                fileUris.push(fileUri) // Collect file URIs
            }
        }

        // Recursively get files from subdirectories
        for (const dirUri of directoryUris) {
            fileUris.push(...(await getFilesRecursively(dirUri)))
        }
    } catch (error) {
        console.error(`Error reading directory ${directoryUri.fsPath}:`, error)
    }

    return fileUris
}

export function openFileAtLine(file: string, line: number) {
    const fileUri = vscode.Uri.file(file)
    vscode.workspace.openTextDocument(fileUri).then((document) => {
        vscode.window.showTextDocument(document).then((editor) => {
            const range = new vscode.Range(line - 1, 0, line - 1, 0)
            editor.selection = new vscode.Selection(range.start, range.end)
            editor.revealRange(range)
        })
    })
}