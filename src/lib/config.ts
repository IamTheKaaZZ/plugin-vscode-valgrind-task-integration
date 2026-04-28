export interface SetupCommand {
  text: string;
  description?: string;
  ignoreFailures?: boolean;
}

export interface ValgrindLaunchConfig {
  program: string;
  args?: string[];
  cwd?: string;
  valgrindArgs?: string[];
  valgrindBinary?: string;
  debugger?: string;
  stopAtEntry?: boolean;
  setupCommands?: SetupCommand[];
  name?: string;
}

export interface DebuggerConfig {
  type: string;
  request: string;
  name: string;
  program: string;
  args: string[];
  cwd: string;
  [key: string]: unknown;
}

export function buildValgrindArgs(
  defaultArgs: string[],
  userArgs: string[],
  debug: boolean
): string[] {
  const args = [...defaultArgs, ...userArgs];
  if (debug) args.push('--vgdb-error=0');
  return args;
}

export function buildDebuggerConfig(
  config: ValgrindLaunchConfig,
  debuggerType: string,
  pid: string,
  defaultCwd: string = '.'
): DebuggerConfig {
  const vgdbCommand = `target remote | vgdb --pid=${pid}`;
  const sessionName = config.name ?? `Valgrind: ${config.program}`;

  if (debuggerType === 'cppdbg') {
    return {
      type: 'cppdbg',
      request: 'launch',
      name: sessionName,
      program: config.program,
      args: config.args ?? [],
      cwd: config.cwd ?? defaultCwd,
      stopAtEntry: config.stopAtEntry ?? false,
      MIMode: 'gdb',
      setupCommands: [
        { text: '-enable-pretty-printing', description: 'Enable pretty-printing', ignoreFailures: true },
        ...(config.setupCommands ?? []),
        { text: vgdbCommand, description: 'Connect to Valgrind', ignoreFailures: false },
      ],
    };
  }

  // codelldb
  return {
    type: debuggerType,
    request: 'custom',
    name: sessionName,
    program: config.program,
    args: config.args ?? [],
    cwd: config.cwd ?? defaultCwd,
    targetCreateCommands: [`target create "${config.program}"`],
    processCreateCommands: [`gdb-remote | vgdb --pid=${pid}`],
  };
}
