import { lstatSync, readFileSync } from 'fs';
import { dirname } from 'path';
import * as vscode from 'vscode';

const Write = require('bemg/lib/generate/Write');
const TaskInit = require('bemg/lib/TaskInit');
const getConfigPaths = require('bemg/lib/getConfigPaths');
const { join, resolve } = require("path");
const bemNaming = require('bem-naming');
const getBemRoot = require('bemg/lib/generate/getBemRoot');
const getBemStringByPath = require('bemg/lib/generate/getBemStringByPath');

export function activate(context: vscode.ExtensionContext) {
    const init = vscode.commands.registerCommand('vs-bem-generate.bemInit',
        async () => {
            try {
                const src = join(resolve(__dirname, ".."), "node_modules", "bemg", "bemg");
                const dest = join(vscode.workspace.rootPath, "bemg");

                new TaskInit().copy(src, dest);

                vscode.window.showInformationMessage("BEMG initialized successfully.");
            } catch (error) {
                vscode.window.showErrorMessage(error.message);
            }
        });

    const generate = vscode.commands.registerCommand('vs-bem-generate.bemGenerate',
        async (uri: vscode.Uri) => {
            const { configPath, templatesPath } = getConfigPaths(uri.path);
            const bemgConfig = JSON.parse(readFileSync(configPath, { encoding: 'utf8' }));

            const stats = lstatSync(uri.path);
            const directoryPath = stats.isDirectory() ? uri.path : dirname(uri.path);

            const bemString = getBemStringByPath(directoryPath, bemgConfig.naming);

            const bemgWrite = new Write(
                getBemRoot(
                    directoryPath,
                    bemNaming.typeOf(bemString)
                ),
                bemgConfig,
                templatesPath
            );

            const bemgTemplates = bemgWrite._templates;
            const bemgAlliases: { [key: string]: string } = bemgWrite._config.aliases;

            let selectedTypes: readonly vscode.QuickPickItem[] = [];

            const itemsOptions = { prompt: "Enter item names separated by space or comma (__elem, __elem2 _mod_val ...etc). Leave input empty or use one space for the block scope." };
            const itemsInput = await vscode.window.showInputBox(itemsOptions) ?? '';

            const bemgTemplatesNames = Object.keys(bemgTemplates);
            let availableTypes: string[] = [];

            itemsInput.split(' ').forEach(item => {
                const bemType = bemNaming.typeOf(bemString + item);
                bemgTemplatesNames.forEach(type => {
                    // проверяем, доступен ли шаблон для типа сущности
                    if (bemgTemplates[bemgAlliases[type] ?? type]?.[bemType]) {
                        // добавляем в опции алиас или название шаблона
                        availableTypes.push(Object.entries(bemgAlliases).find(([_key, value]) => value === type)?.[0] ?? type);
                    }
                });
            });

            // настраиваем QuickPick
            const typesQuickPick = vscode.window.createQuickPick();
            typesQuickPick.title = "Select entity types:";
            typesQuickPick.items = [...new Set(availableTypes)].sort((a, b) => a.localeCompare(b)).map(template => ({ label: template, alwaysShow: true }));
            typesQuickPick.canSelectMany = true;
            typesQuickPick.onDidChangeSelection(selection => {
                selectedTypes = selection;
            });
            typesQuickPick.onDidChangeValue(value => {
                if (value === '') {
                    return;
                }

                // если ввод совпадает с label одной из опций - отмечаем такую опцию как selected
                let newItems: vscode.QuickPickItem[] = [];
                value.split(/[ ,]+/).forEach(item => {
                    const newItem = typesQuickPick.items.find(qpItem => qpItem.label === item);
                    newItem && newItems.push(newItem);
                });

                if (typesQuickPick.selectedItems.length !== newItems.length) {
                    typesQuickPick.selectedItems = newItems;
                }
            });
            typesQuickPick.onDidAccept(() => {
                typesQuickPick.hide();

                if (!selectedTypes?.length) {
                    return;
                }

                try {
                    const items = itemsInput.split(/[ ,]+/).map(item => bemString + item);
                    items.forEach(item => bemgWrite.write(item, selectedTypes.map(item => item.label)));
                } catch (error) {
                    vscode.window.showErrorMessage(error.message);
                }
            });
            typesQuickPick.onDidHide(() => typesQuickPick.dispose());
            typesQuickPick.show();
        });

    context.subscriptions.push(init);
    context.subscriptions.push(generate);
}

export function deactivate() { }
