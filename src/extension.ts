import * as vscode from 'vscode';

const BemTask = require('bemg/lib/Task');


export function activate(context: vscode.ExtensionContext) {
    const generate = vscode.commands.registerCommand('vs-bem-generate.bemGenerate',
    async (uri: vscode.Uri) => {
        const itemsOptions = { prompt: "Enter item names separated by space" };
        const typesOptions = { prompt: "Enter types names separated by space" };
        const itemsInput = await vscode.window.showInputBox(itemsOptions);

        if(!itemsInput) {
            return
        }

        const typesInput = await vscode.window.showInputBox(typesOptions);

        if(!typesInput) {
            return
        }

        try {
            const task = new BemTask(uri.path);

            task.write(typesInput.split(' '), itemsInput.split(' '));
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }

    })

    context.subscriptions.push(generate);
}

export function deactivate() {}
