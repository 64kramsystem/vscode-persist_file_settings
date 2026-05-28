import * as vscode from 'vscode';
import { loadStorage, saveStorage, removeEntry } from './storage';
import { toggleAndPersist, restoreOnActiveEditor, forgetWrap } from './wrapHandler';
import { handleOpen, handleClose, processAlreadyOpenDocs } from './languageHandler';
import { handleRename } from './renameHandler';

export function activate(ctx: vscode.ExtensionContext): void {
  void processAlreadyOpenDocs(ctx.globalState);

  ctx.subscriptions.push(
    vscode.commands.registerCommand('persistFileSettings.toggleWordWrap', () =>
      toggleAndPersist(ctx.globalState),
    ),

    vscode.commands.registerCommand('persistFileSettings.clearForFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const key = editor.document.uri.toString();
      await saveStorage(ctx.globalState, removeEntry(loadStorage(ctx.globalState), key));
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

    vscode.workspace.onDidOpenTextDocument((doc) => void handleOpen(ctx.globalState, doc)),

    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) void restoreOnActiveEditor(ctx.globalState, editor);
    }),

    vscode.workspace.onDidCloseTextDocument((doc) => {
      const result = handleClose(doc);
      if (result.kind === 'realClose') forgetWrap(result.key);
    }),

    vscode.workspace.onDidRenameFiles((e) => void handleRename(ctx.globalState, e)),
  );

  if (vscode.window.activeTextEditor) {
    void restoreOnActiveEditor(ctx.globalState, vscode.window.activeTextEditor);
  }
}

export function deactivate(): void {
  // nothing to do
}
