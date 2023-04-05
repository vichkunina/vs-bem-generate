import { lstatSync, readFileSync } from 'fs';
import { dirname } from 'path';
import * as vscode from 'vscode';

import { LANGUAGES } from './constants';
import { Snippet } from './types';

const bemGenerate = require('bemg/lib/generate');
const TaskInit = require('bemg/lib/TaskInit');
const getConfigPaths = require('bemg/lib/getConfigPaths');
const { join, resolve } = require("path");
const bemNaming = require('bem-naming');
const getBemRoot = require('bemg/lib/generate/getBemRoot');
const getBemStringByPath = require('bemg/lib/generate/getBemStringByPath');
const getTemplatesPaths = require('bemg/lib/templates/getTemplatesPaths');

export function activate(context: vscode.ExtensionContext) {
    const init = vscode.commands.registerCommand('vs-bem-generate.bemInit',
        async () => {
            try {
                const src = join(resolve(__dirname, ".."), "node_modules", "bemg", "bemg");
                const dest = join(vscode.workspace.rootPath, "bemg");

                new TaskInit().copy(src, dest);

                vscode.window.showInformationMessage("BEMG initialized successfully.");
            } catch (error) {
                vscode.window.showErrorMessage((error as Error).message);
            }
        });

    const generate = vscode.commands.registerCommand('vs-bem-generate.bemGenerate',
        async (uri: vscode.Uri) => {

            if (!uri?.path) { return; };

            const stats = lstatSync(uri.path);
            const directoryPath = stats.isDirectory() ? uri.path : dirname(uri.path);

            const {
                configPath,
                templatesPath
            } = getConfigPaths(uri.path);


            const bemgTemplates = getTemplatesPaths(templatesPath);
            const bemgConfig = JSON.parse(readFileSync(configPath, { encoding: 'utf8' }));
            const bemString = getBemStringByPath(directoryPath, bemgConfig.naming);
            const bemgAliases: { [key: string]: string } = bemgConfig.aliases || {};
            
            

            let selectedTypes: readonly vscode.QuickPickItem[] = [];

            const itemsOptions = { prompt: "Enter item names separated by space or comma (__elem, __elem2 _mod_val ...etc). Leave input empty or use one space for the block scope." };
            const itemsInput = await vscode.window.showInputBox(itemsOptions) ?? '';

            const bemgTemplatesNames = Object.keys(bemgTemplates);
            let availableTypes: string[] = [];

            itemsInput.split(' ').forEach(item => {
                const bemType = bemNaming.typeOf(bemString + item);
                bemgTemplatesNames.forEach(type => {
                    // проверяем, доступен ли шаблон для типа сущности
                    if (bemgTemplates[bemgAliases[type] ?? type]?.[bemType]) {
                        // добавляем в опции алиас или название шаблона
                        availableTypes.push(Object.entries(bemgAliases).find(([_key, value]) => value === type)?.[0] ?? type);
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
                    bemGenerate({
                        targetPath: directoryPath,
                        types: selectedTypes.map(item => item.label),
                        items: itemsInput.split(/[ ,]+/)
                    });
                } catch (error) {
                    vscode.window.showErrorMessage((error as Error).message);
                }
            });
            typesQuickPick.onDidHide(() => typesQuickPick.dispose());
            typesQuickPick.show();
        });

    const insertSnippet = vscode.commands.registerCommand('vs-bem-generate.bemInsertSnippet',
        async () => {
            const activeTextEditor = vscode.window.activeTextEditor;
            if (!activeTextEditor) { return; };

            const currentFilePath = activeTextEditor.document.uri.path;
            const { configPath } = getConfigPaths(currentFilePath);
            const bemgConfig = JSON.parse(readFileSync(configPath, { encoding: 'utf8' }));
            const { snippets }: { snippets: Snippet } = bemgConfig;

            const languageId = activeTextEditor.document.languageId as LANGUAGES;
            const currentLanguageSnippets = Object.values(snippets[languageId]);

            const quickPickItems = currentLanguageSnippets.map(snippet => ({ label: snippet.prefix.join(', '), detail: snippet.description, value: snippet.body }));

            const snippetsQuickPick = vscode.window.createQuickPick();
            snippetsQuickPick.title = "Select snippet:";
            snippetsQuickPick.items = quickPickItems;
            snippetsQuickPick.onDidHide(() => snippetsQuickPick.dispose());


            snippetsQuickPick.onDidAccept((e) => {
                snippetsQuickPick.hide();
                const snippet = quickPickItems.find(item => item.label === snippetsQuickPick.activeItems?.[0].label)?.value;

                snippet && vscode.commands.executeCommand("editor.action.insertSnippet", { snippet: snippet.join('\n') });

            });
            snippetsQuickPick.show();

        });

    const rootPath = vscode.workspace.rootPath;
    const providers: vscode.Disposable[] = [];

    if (rootPath) {
        const { configPath } = getConfigPaths(rootPath);
        const bemgConfig = JSON.parse(readFileSync(configPath, { encoding: 'utf8' }));
        const { snippets }: { snippets: Snippet } = bemgConfig;

        const langs = Object.keys(snippets) as LANGUAGES[];

        langs.forEach(lang => {
            const curentLangSnippets = snippets[lang];
            const provider = vscode.languages.registerCompletionItemProvider(lang, {
                provideCompletionItems() {
                    return Object.values(curentLangSnippets).map((snippet: any) => {
                        return snippet.prefix.map((prefix: string) => {
                            const label = {
                                label: prefix,
                                description: snippet.description,
                            };
                            const snippetCompletion = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
                            const snippetBody = new vscode.SnippetString(snippet.body.join('\n'));
                            snippetCompletion.insertText = snippetBody;
                            snippetCompletion.detail = snippet.description;
                            snippetCompletion.documentation = new vscode.MarkdownString('').appendCodeblock(snippet.body.join('\n').replace(/\$\{[^\s]+\/\}/g, '<computedValue>'));
                            return snippetCompletion;
                        });
                    }).reduce((acc, val) => acc.concat(val), []);
                },
            });
            providers.push(provider);
        });
    }

    context.subscriptions.push(init);
    context.subscriptions.push(generate);
    context.subscriptions.push(insertSnippet);
    context.subscriptions.push(...providers);
}

export function deactivate() { }
