import {
  CancellationToken,
  CustomExecution,
  debug,
  DebugConfiguration,
  DebugConfigurationProvider,
  Disposable,
  Task,
  tasks,
  TaskScope,
  window,
  workspace,
  WorkspaceFolder,
} from 'vscode';
import { buildDebuggerConfig, buildValgrindArgs, ValgrindLaunchConfig } from '../lib/config';
import { validateDependencies } from '../lib/dependencies';
import { ValgrindTaskTerminal } from '../tasks/ValgrindTaskTerminal';

interface ActiveSession {
  terminal: ValgrindTaskTerminal;
  debugSessionName: string;
}

export class ValgrindDebugConfigProvider implements DebugConfigurationProvider, Disposable {
  private activeSessions = new Map<string, ActiveSession>();
  private disposables: Disposable[] = [];

  constructor() {
    this.disposables.push(
      debug.onDidTerminateDebugSession((session) => {
        for (const [key, data] of this.activeSessions) {
          if (data.debugSessionName === session.name) {
            data.terminal.close();
            this.activeSessions.delete(key);
            break;
          }
        }
      })
    );
  }

  resolveDebugConfiguration(
    _folder: WorkspaceFolder | undefined,
    config: DebugConfiguration,
    _token?: CancellationToken
  ): DebugConfiguration | undefined {
    if (!config.type && !config.request && !config.name) {
      config.type = 'valgrind';
      config.request = 'launch';
      config.program = '';
    }

    if (!config.program) {
      window.showErrorMessage('Valgrind: "program" is required in launch configuration.');
      return undefined;
    }

    return config;
  }

  async resolveDebugConfigurationWithSubstitutedVariables(
    folder: WorkspaceFolder | undefined,
    config: DebugConfiguration,
    token?: CancellationToken
  ): Promise<DebugConfiguration | undefined> {
    if (token?.isCancellationRequested) return undefined;

    const valgrindConfig = config as DebugConfiguration & ValgrindLaunchConfig;
    const settings = workspace.getConfiguration('valgrind');

    const valgrindBinary = valgrindConfig.valgrindBinary ?? settings.get<string>('binary', 'valgrind');
    const defaultArgs = settings.get<string[]>('defaultArgs', ['--fullpath-after=']);
    const debuggerType = valgrindConfig.debugger ?? settings.get<string>('debugger', 'cppdbg');
    const pidTimeout = settings.get<number>('pidTimeout', 30000);

    const depsOk = await validateDependencies(valgrindBinary, debuggerType);
    if (!depsOk || token?.isCancellationRequested) return undefined;

    const valgrindArgs = buildValgrindArgs(defaultArgs, valgrindConfig.valgrindArgs ?? [], true);
    const defaultCwd = folder?.uri.fsPath ?? workspace.workspaceFolders?.[0]?.uri.fsPath ?? '.';

    let resolvePid!: (pid: string) => void;
    const pidReady = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Timed out after ${pidTimeout}ms waiting for Valgrind to be ready for GDB`)),
        pidTimeout
      );
      resolvePid = (pid: string) => {
        clearTimeout(timeout);
        resolve(pid);
      };
    });

    let activeTerminal: ValgrindTaskTerminal | undefined;
    const sessionId = `valgrind-${Date.now()}`;

    const execution = new CustomExecution(async () => {
      activeTerminal = new ValgrindTaskTerminal({
        valgrindBinary,
        valgrindArgs,
        target: valgrindConfig.program,
        targetArgs: valgrindConfig.args,
        onReady: resolvePid,
      });
      return activeTerminal;
    });

    const task = new Task(
      { type: 'valgrind-session' },
      folder ?? TaskScope.Workspace,
      'Valgrind',
      'valgrind',
      execution,
      '$valgrind-debug'
    );

    tasks.executeTask(task);

    try {
      const pid = await pidReady;
      const debugConfig = buildDebuggerConfig(valgrindConfig, debuggerType, pid, defaultCwd);

      this.activeSessions.set(sessionId, {
        terminal: activeTerminal!,
        debugSessionName: debugConfig.name,
      });

      // Stop debugger when valgrind exits
      if (activeTerminal?.onDidClose) {
        const closeListener = activeTerminal.onDidClose(() => {
          const session = debug.activeDebugSession;
          if (session?.name === debugConfig.name && this.activeSessions.has(sessionId)) {
            debug.stopDebugging(session);
          }
          this.activeSessions.delete(sessionId);
          closeListener.dispose();
        });
        this.disposables.push(closeListener);
      }

      const started = await debug.startDebugging(folder, debugConfig);
      if (!started) {
        activeTerminal?.close();
        this.activeSessions.delete(sessionId);
        window.showErrorMessage('Valgrind: Failed to start the underlying debugger session.');
      }
    } catch (error: unknown) {
      activeTerminal?.close();
      this.activeSessions.delete(sessionId);
      const message = error instanceof Error ? error.message : String(error);
      window.showErrorMessage(`Valgrind: ${message}`);
    }

    // Cancel the "valgrind" debug session — the real debugger session was started above
    return undefined;
  }

  dispose(): void {
    for (const data of this.activeSessions.values()) {
      data.terminal.close();
    }
    this.activeSessions.clear();
    this.disposables.forEach((d) => d.dispose());
  }
}
