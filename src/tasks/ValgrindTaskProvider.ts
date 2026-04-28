import { CancellationToken, CustomExecution, Task, TaskDefinition, TaskProvider, TaskScope, workspace } from 'vscode';
import { ValgrindTaskTerminal } from './ValgrindTaskTerminal';
import { buildValgrindArgs } from '../lib/config';

export interface ValgrindTaskDefinition extends TaskDefinition {
  type: 'valgrind';
  target: string;
  args?: string[];
  valgrindArgs?: string[];
}

export class ValgrindTaskProvider implements TaskProvider {
  public static readonly type = 'valgrind';

  provideTasks(_token?: CancellationToken): Task[] {
    return [];
  }

  resolveTask(task: Task, _token?: CancellationToken): Task | undefined {
    const definition = task.definition as ValgrindTaskDefinition;
    if (definition.type !== ValgrindTaskProvider.type || !definition.target) return undefined;

    return this.createTask(definition, task.name);
  }

  private createTask(definition: ValgrindTaskDefinition, name?: string): Task {
    const config = workspace.getConfiguration('valgrind');
    const valgrindBinary = config.get<string>('binary', 'valgrind');
    const defaultArgs = config.get<string[]>('defaultArgs', ['--fullpath-after=']);

    const execution = new CustomExecution(async () => {
      return new ValgrindTaskTerminal({
        valgrindBinary,
        valgrindArgs: buildValgrindArgs(defaultArgs, definition.valgrindArgs ?? [], false),
        target: definition.target,
        targetArgs: definition.args,
      });
    });

    return new Task(
      definition,
      TaskScope.Workspace,
      name ?? `valgrind: ${definition.target}`,
      'valgrind',
      execution,
      '$valgrind'
    );
  }
}
