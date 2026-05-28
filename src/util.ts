import type * as vscode from 'vscode';

export function docKey(doc: vscode.TextDocument): string {
  return doc.uri.toString();
}

export function isPersistable(doc: vscode.TextDocument): boolean {
  return doc.uri.scheme === 'file' && !doc.isUntitled;
}
