import * as vscode from 'vscode';
import * as cheerio from 'cheerio';

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel("DOM Hunt Results");
    let currentSearchToken: vscode.CancellationTokenSource | undefined;

    const getHistory = (key: string): string[] => context.workspaceState.get<string[]>(key, []);
    const saveToHistory = (key: string, value: string) => {
        let history = getHistory(key);
        history = [value, ...history.filter(i => i !== value)].slice(0, 10);
        context.workspaceState.update(key, history);
    };

    const getSearchConfiguration = () => {
        const config = vscode.workspace.getConfiguration('domHunt');
        return {
            include: config.get<string[]>('includeFolders') || ['**/*.html'],
            exclude: config.get<string[]>('excludeFolders') || ['**/node_modules/**', '**/dist/**']
        };
    };

    const runSearch = async (selectors: string[], mode: 'single' | 'dual' | 'multi' | 'text', textToFind = "") => {
        if (currentSearchToken) { currentSearchToken.cancel(); currentSearchToken.dispose(); }
        currentSearchToken = new vscode.CancellationTokenSource();
        const token = currentSearchToken.token;

        const { include, exclude } = getSearchConfiguration();
        outputChannel.clear();
        outputChannel.show();
        outputChannel.appendLine(`Searching for: ${selectors.join(' AND ')} ${textToFind ? 'with text: ' + textToFind : ''}`);

        let files: vscode.Uri[] = [];
        for (const pattern of include) {
            const found = await vscode.workspace.findFiles(pattern, exclude.join(','));
            files = [...files, ...found];
        }
        const uniqueFiles = Array.from(new Set(files.map(f => f.fsPath))).map(path => vscode.Uri.file(path));
        
        let foundCount = 0;
        for (const file of uniqueFiles) {
            if (token.isCancellationRequested) return;
            const document = await vscode.workspace.openTextDocument(file);
            const content = document.getText();
            const $ = cheerio.load(content);

            if (selectors.every(s => $(s).length > 0)) {
                if (mode === 'text') {
                    $(selectors[0]).each((idx, el) => {
                        const elementText = $(el).text().replace(/\s+/g, ' ').trim();
                        if (elementText.toLowerCase().includes(textToFind.toLowerCase())) {
                            const line = getLineNumber(content, (el as any).tagName || 'element', idx);
                            outputChannel.appendLine(`${file.fsPath}:${line}:0 - Found with text: "${textToFind}"`);
                            foundCount++;
                        }
                    });
                } else {
                    outputChannel.appendLine(`MATCH: ${file.fsPath}`);
                    foundCount++;
                }
            }
        }
        outputChannel.appendLine(`--- Search complete. Found in ${foundCount} items. ---`);
    };

    // 1. Single
    context.subscriptions.push(vscode.commands.registerCommand('dom-hunt.searchSingle', async () => {
        const sel = await vscode.window.showInputBox({ prompt: "Selector" });
        if (sel) runSearch([sel], 'single');
    }));

    // 2. Dual
    context.subscriptions.push(vscode.commands.registerCommand('dom-hunt.searchDual', async () => {
        const s1 = await vscode.window.showInputBox({ prompt: "1st Selector" });
        const s2 = await vscode.window.showInputBox({ prompt: "2nd Selector" });
        if (s1 && s2) runSearch([s1, s2], 'dual');
    }));

    // 3. Multi (N)
    context.subscriptions.push(vscode.commands.registerCommand('dom-hunt.searchMulti', async () => {
        const countStr = await vscode.window.showInputBox({ prompt: "How many selectors?" });
        const count = parseInt(countStr || "0");
        if (isNaN(count) || count < 1) return;
        const selectors: string[] = [];
        for (let i = 0; i < count; i++) {
            const s = await vscode.window.showInputBox({ prompt: `Enter Selector #${i + 1}` });
            if (s) selectors.push(s);
        }
        if (selectors.length === count) runSearch(selectors, 'multi');
    }));

    // 4. Text
    context.subscriptions.push(vscode.commands.registerCommand('dom-hunt.searchWithText', async () => {
        const sel = await vscode.window.showInputBox({ prompt: "Selector" });
        const text = await vscode.window.showInputBox({ prompt: "Text to match" });
        if (sel && text) runSearch([sel], 'text', text);
    }));
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