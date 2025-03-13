import path from "path";
import * as vscode from "vscode"

export async function getFilesRecursively(directoryUri: vscode.Uri): Promise<vscode.Uri[]> {
    const fileUris: vscode.Uri[] = [];
    const directoryUris: vscode.Uri[] = [];
    const blockedDirs = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '__tests__', '__mocks__']);
    const blockedFileExtensions = new Set(['.md', '.txt', '.json', '.lock', '.log', '.map', '.png', '.jpg']);

    try {
        const entries = await vscode.workspace.fs.readDirectory(directoryUri);

        for (const [name, type] of entries) {
            const fileUri = vscode.Uri.joinPath(directoryUri, name);
            const isDirectory = type === vscode.FileType.Directory;
            const ext = path.extname(name).toLowerCase();

            if (isDirectory) {
                // Skip blocked directories and special patterns
                if (!blockedDirs.has(name) &&
                    !name.startsWith("__") && 
                    !name.endsWith("__") &&
                    !name.startsWith('.') // Skip hidden directories
                ) {
                    directoryUris.push(fileUri);
                }
            } else {
                // Skip non-source files and common configs
                if (!blockedFileExtensions.has(ext) &&
                    !name.startsWith('.') && // Skip dotfiles
                    !name.endsWith('.d.ts') && // Skip TypeScript declaration files
                    !name.endsWith('.min.js') && // Skip minified files
                    name !== 'package-lock.json' &&
                    name !== 'yarn.lock' &&
                    name !== '.env'
                ) {
                    fileUris.push(fileUri);
                }
            }
        }

        // Process directories in batches to prevent stack overflows
        while (directoryUris.length > 0) {
            const batch = directoryUris.splice(0, 10); // Process 10 dirs at a time
            const results = await Promise.all(
                batch.map(dir => getFilesRecursively(dir))
            );
            fileUris.push(...results.flat());
        }
    } catch (error) {
        console.error(`Error reading directory ${directoryUri.fsPath}:`, error);
    }

    return fileUris;
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

export async function getFrameworkFiles(extensions: string[]) {
    const config = vscode.workspace.getConfiguration("OctAPI");
    const routePath = config.get<string>("path", "./src/");
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        console.log("No workspace folder is open.");
        return [];
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const absoluteRoutePath = path.resolve(workspaceRoot, routePath);
    const directoryUri = vscode.Uri.file(absoluteRoutePath);

    try {
        const allFiles = await getFilesRecursively(directoryUri);
        return allFiles.filter(uri => 
            extensions.some(ext => uri.fsPath.endsWith(ext))
        );
    } catch (error) {
        console.error("Error retrieving framework files:", error);
        return [];
    }
}