import { execFile } from 'child_process';
import { commands, env, extensions, Uri, window } from 'vscode';

interface CheckResult {
  ok: boolean;
  message?: string;
}

const DEBUGGER_EXTENSIONS: Record<string, { id: string; name: string }> = {
  cppdbg: { id: 'ms-vscode.cpptools', name: 'C/C++ (ms-vscode.cpptools)' },
  codelldb: { id: 'vadimcn.vscode-lldb', name: 'CodeLLDB (vadimcn.vscode-lldb)' },
};

export function checkValgrindInstalled(binary: string): Promise<CheckResult> {
  return new Promise((resolve) => {
    execFile(binary, ['--version'], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        const code = (error as NodeJS.ErrnoException).code;
        const message =
          code === 'ENOENT'
            ? `"${binary}" was not found on PATH. Install valgrind to use this extension.`
            : code === 'EACCES'
              ? `"${binary}" is not executable. Check file permissions.`
              : `"${binary}" failed to run: ${error.message}`;
        resolve({ ok: false, message });
      } else {
        resolve({ ok: true, message: stdout.split('\n')[0] });
      }
    });
  });
}

export function checkDebuggerExtension(debuggerType: string): CheckResult {
  const ext = DEBUGGER_EXTENSIONS[debuggerType];
  if (!ext) return { ok: true };

  const installed = extensions.getExtension(ext.id);
  if (!installed) {
    return {
      ok: false,
      message: `The debugger extension ${ext.name} is required for "${debuggerType}" but is not installed.`,
    };
  }
  return { ok: true };
}

export async function validateDependencies(
  valgrindBinary: string,
  debuggerType: string
): Promise<boolean> {
  const valgrindCheck = await checkValgrindInstalled(valgrindBinary);
  if (!valgrindCheck.ok) {
    const action = await window.showErrorMessage(
      valgrindCheck.message!,
      'Show Install Instructions'
    );
    if (action === 'Show Install Instructions') {
      env.openExternal(Uri.parse('https://valgrind.org/downloads/'));
    }
    return false;
  }

  const debuggerCheck = checkDebuggerExtension(debuggerType);
  if (!debuggerCheck.ok) {
    const ext = DEBUGGER_EXTENSIONS[debuggerType];
    const action = await window.showErrorMessage(
      debuggerCheck.message!,
      'Install Extension'
    );
    if (action === 'Install Extension' && ext) {
      commands.executeCommand('workbench.extensions.installExtension', ext.id);
    }
    return false;
  }

  return true;
}
