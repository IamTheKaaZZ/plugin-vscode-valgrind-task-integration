import { ExtensionContext, debug, tasks } from 'vscode';
import { ValgrindTaskProvider } from './tasks/ValgrindTaskProvider';
import { ValgrindDebugConfigProvider } from './debug/ValgrindDebugConfigProvider';

export function activate(context: ExtensionContext) {
  const taskProvider = new ValgrindTaskProvider();
  const debugConfigProvider = new ValgrindDebugConfigProvider();

  context.subscriptions.push(
    tasks.registerTaskProvider(ValgrindTaskProvider.type, taskProvider),
    debug.registerDebugConfigurationProvider('valgrind', debugConfigProvider),
    debugConfigProvider
  );
}

export function deactivate(): void {
  // Cleanup handled by disposables registered in context.subscriptions
}
