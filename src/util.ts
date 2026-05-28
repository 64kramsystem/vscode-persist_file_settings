import * as vscode from 'vscode';

export function docKey(doc: vscode.TextDocument): string {
  return doc.uri.toString();
}

export function isPersistable(doc: vscode.TextDocument): boolean {
  return doc.uri.scheme === 'file' && !doc.isUntitled;
}

export function defaultWrapForDoc(doc: vscode.TextDocument): 'on' | 'off' {
  const cfg = vscode.workspace.getConfiguration('editor', doc);
  const val = cfg.get<string>('wordWrap', 'off');
  return val === 'off' ? 'off' : 'on';
}
