import * as vscode from 'vscode';
import * as cheerio from 'cheerio';

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel("DOM Hunt Results");

    // Helper to handle persistent search history
    const getHistory = (key: string): string[] => context.workspaceState.get<string[]>(key, []);
    const saveToHistory = (key: string, value: string) => {
        let history = getHistory(key);
        history = [value, ...history.filter(i => i !== value)].slice(0, 10);
        context.workspaceState.update(key, history);
    };

    // Helper to get user settings from VS Code config
    const getSearchConfiguration = () => {
        const config = vscode.workspace.getConfiguration('domHunt');
        const include = config.get<string[]>('includeFolders') || ['**/*.html'];
        const exclude = config.get<string[]>('excludeFolders') || ['**/node_modules/**', '**/dist/**'];
        return { include, exclude };
    };

    // Core Search Logic
    // mode: 0 = Single, 1 = Dual, 2 = Text
    const runSearch = async (mode: 0 | 1 | 2) => {
        const { include, exclude } = getSearchConfiguration();

        // Get 1st Selector
        const sel1 = await vscode.window.showInputBox({ 
            prompt: "1st Selector", 
            value: getHistory('sel1')[0] || '' 
        });
        if (!sel1) return;
        saveToHistory('sel1', sel1);

        let sel2 = "";
        let textToFind = "";

        if (mode === 1) { // Dual Selector
            sel2 = await vscode.window.showInputBox({ 
                prompt: "2nd Selector", 
                value: getHistory('sel2')[0] || '' 
            }) || "";
            if (sel2) saveToHistory('sel2', sel2);
        } else if (mode === 2) { // Text Search
            textToFind = await vscode.window.showInputBox({ 
                prompt: "Text content to match" 
            }) || "";
            if (!textToFind) return;
        }

        outputChannel.clear();
        outputChannel.show();
        outputChannel.appendLine(`Searching: ${sel1} ${sel2 ? 'AND ' + sel2 : ''} ${textToFind ? 'with text: ' + textToFind : ''}`);

        let files: vscode.Uri[] = [];
        for (const pattern of include) {
            const found = await vscode.workspace.findFiles(pattern, exclude.join(','));
            files = [...files, ...found];
        }
        
        const uniqueFiles = Array.from(new Set(files.map(f => f.fsPath))).map(path => vscode.Uri.file(path));
        let foundCount = 0;

        for (const file of uniqueFiles) {
            const document = await vscode.workspace.openTextDocument(file);
            const content = document.getText();
            const $ = cheerio.load(content);

            const m1 = $(sel1);
            
            if (mode === 1 && sel2) { // Dual Mode
                if (m1.length > 0 && $(sel2).length > 0) {
                    outputChannel.appendLine(`MATCH: ${file.fsPath}`);
                    foundCount++;
                }
            } else if (mode === 2) { // Text Mode
                m1.each((idx, el) => {
                    const elementText = $(el).text().replace(/\s+/g, ' ').trim();
                    if (elementText.toLowerCase().includes(textToFind.toLowerCase())) {
                        const tagName = (el as any).tagName || 'element';
                        const line = getLineNumber(content, tagName, idx);
                        outputChannel.appendLine(`${file.fsPath}:${line}:0 - Found <${tagName}> containing: "${textToFind}"`);
                        foundCount++;
                    }
                });
            } else { // Single Mode
                m1.each((idx, el) => {
                    const tagName = (el as any).tagName || 'element';
                    const line = getLineNumber(content, tagName, idx);
                    outputChannel.appendLine(`${file.fsPath}:${line}:0 - Found <${tagName}>`);
                    foundCount++;
                });
            }
        }
        outputChannel.appendLine(`--- Search complete. Found in ${foundCount} items. ---`);
    };

    // Register 3 commands
    context.subscriptions.push(
        vscode.commands.registerCommand('dom-hunt.searchSingle', () => runSearch(0)),
        vscode.commands.registerCommand('dom-hunt.searchDual', () => runSearch(1)),
        vscode.commands.registerCommand('dom-hunt.searchWithText', () => runSearch(2))
    );
}

function getLineNumber(content: string, tagName: string, index: number): number {
    const lines = content.split('\n');
    let count = 0;
    const regex = new RegExp(`<${tagName}`, 'i');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(regex)) {
            if (count === index) return i + 1;
            count++;
        }
    }
    return 1;
}

export function deactivate() {}