import * as vscode from 'vscode';
import { loadStorage, saveStorage, removeEntry } from './storage';

export function activate(ctx: vscode.ExtensionContext): void {
  ctx.subscriptions.push(
    vscode.commands.registerCommand('persistFileSettings.toggleWordWrap', async () => {
      // wired in wrapHandler task
      await vscode.commands.executeCommand('editor.action.toggleWordWrap');
    }),

    vscode.commands.registerCommand('persistFileSettings.clearForFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const key = editor.document.uri.toString();
      const storage = removeEntry(loadStorage(ctx.globalState), key);
      await saveStorage(ctx.globalState, storage);
      vscode.window.showInformationMessage('Cleared persisted settings for this file.');
    }),

    vscode.commands.registerCommand('persistFileSettings.clearAll', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear all persisted per-file settings?',
        { modal: true },
        'Clear',
      );
      if (confirm !== 'Clear') return;
      await saveStorage(ctx.globalState, {});
      vscode.window.showInformationMessage('Cleared all persisted per-file settings.');
    }),
  );
}

export function deactivate(): void {
  // nothing to do
}
