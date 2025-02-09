import * as vscode from "vscode"

export default function openFileAtLine(file: string, line: number) {
    const fileUri = vscode.Uri.file(file)
    vscode.workspace.openTextDocument(fileUri).then((document) => {
        vscode.window.showTextDocument(document).then((editor) => {
            const range = new vscode.Range(line - 1, 0, line - 1, 0)
            editor.selection = new vscode.Selection(range.start, range.end)
            editor.revealRange(range)
        })
    })
}