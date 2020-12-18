import * as vscode from 'vscode';

const Task = require('bemg/lib/Task');

export function activate(context: vscode.ExtensionContext) {
    const generate = vscode.commands.registerCommand('vs-bem-generate.bemGenerate',
    async (uri: vscode.Uri) => {
        const itemsOptions = { prompt: "Enter item names separated by space (__elem _mod_val ...etc)" };
        const typesOptions = { prompt: "Enter types names separated by space (css tsx ...etc)" };
        
        const itemsInput = await vscode.window.showInputBox(itemsOptions) || '';
        const typesInput = await vscode.window.showInputBox(typesOptions);

        if(!typesInput) {
            return;
        }

        try {
            const task = new Task(uri.path);

            task.write(typesInput.split(' '), itemsInput.split(' '));
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }

    });

    context.subscriptions.push(generate);
}

export function deactivate() {}
