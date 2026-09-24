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
        
        // Helper to extract a "gatekeeper" string from the selector for speed
        const getGatekeeper = (s: string) => {
            const match = s.match(/[.#]?([a-zA-Z0-9_-]+)/);
            return match ? match[1] : null;
        };

        let foundCount = 0;
        for (const file of uniqueFiles) {
            if (token.isCancellationRequested) return;

            const content = (await vscode.workspace.openTextDocument(file)).getText();
            
            // Fast Pre-check
            const gatekeeper = getGatekeeper(selectors[0]);
            if (gatekeeper && !content.includes(gatekeeper)) continue; 

            // Cheerio native index tracking
            const $ = cheerio.load(content, { xml: { withStartIndices: true } });

            if (selectors.every(s => $(s).length > 0)) {
                if (mode === 'single' || mode === 'text') {
                    $(selectors[0]).each((_, el) => {
                        const element = el as any;
                        const startIndex = element.startIndex ?? 0;
                        const line = content.substring(0, startIndex).split('\n').length;
                        
                        const elementText = $(el).text().replace(/\s+/g, ' ').trim();
                        const matchesText = mode === 'text' ? elementText.toLowerCase().includes(textToFind.toLowerCase()) : true;

                        if (matchesText) {
                            outputChannel.appendLine(`${file.fsPath}:${line}:0 - Found <${element.tagName || 'element'}>${mode === 'text' ? ` containing: "${textToFind}"` : ""}`);
                            foundCount++;
                        }
                    });
                } else {
                    outputChannel.appendLine(`MATCH: ${file.fsPath}`);
                    foundCount++;
                }
            }
        }
        outputChannel.appendLine(`--- Search complete. Found ${foundCount} occurrences. ---`);
    };

    // Commands registration (keep as is)
    context.subscriptions.push(
        vscode.commands.registerCommand('dom-hunt.searchSingle', async () => {
            const sel = await vscode.window.showInputBox({ prompt: "Selector", value: getHistory('sel1')[0] || '' });
            if (sel) { saveToHistory('sel1', sel); runSearch([sel], 'single'); }
        }),
        vscode.commands.registerCommand('dom-hunt.searchDual', async () => {
            const s1 = await vscode.window.showInputBox({ prompt: "1st Selector", value: getHistory('sel1')[0] || '' });
            const s2 = await vscode.window.showInputBox({ prompt: "2nd Selector", value: getHistory('sel2')[0] || '' });
            if (s1 && s2) { saveToHistory('sel1', s1); saveToHistory('sel2', s2); runSearch([s1, s2], 'dual'); }
        }),
        vscode.commands.registerCommand('dom-hunt.searchMulti', async () => {
            const countStr = await vscode.window.showInputBox({ prompt: "How many selectors?" });
            const count = parseInt(countStr || "0");
            if (isNaN(count) || count < 1) return;
            const selectors: string[] = [];
            for (let i = 0; i < count; i++) {
                const s = await vscode.window.showInputBox({ prompt: `Enter Selector #${i + 1}` });
                if (s) selectors.push(s);
            }
            if (selectors.length === count) runSearch(selectors, 'multi');
        }),
        vscode.commands.registerCommand('dom-hunt.searchWithText', async () => {
            const sel = await vscode.window.showInputBox({ prompt: "Selector" });
            const text = await vscode.window.showInputBox({ prompt: "Text to match" });
            if (sel && text) runSearch([sel], 'text', text);
        })
    );
}

export function deactivate() {}