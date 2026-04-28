import { spawn, ChildProcess } from 'child_process';
import { Pseudoterminal, Disposable, Event, TerminalDimensions, EventEmitter } from 'vscode';
import { parseValgrindPid, isVgdbReady } from '../lib/parsing';

export interface ValgrindTerminalOptions {
  valgrindBinary: string;
  valgrindArgs: string[];
  target: string;
  targetArgs?: string[];
  onPid?: (pid: string) => void;
  onReady?: (pid: string) => void;
}

export class ValgrindTaskTerminal implements Pseudoterminal {
  private writeEmitter = new EventEmitter<string>();
  private closeEmitter = new EventEmitter<number>();
  private valgrind?: ChildProcess;
  private outputListener?: Disposable;

  public onDidWrite: Event<string> = this.writeEmitter.event;
  public onDidClose: Event<number> = this.closeEmitter.event;

  constructor(private options: ValgrindTerminalOptions) {}

  public open(_initialDimensions: TerminalDimensions | undefined): void {
    const { valgrindBinary, valgrindArgs, target, targetArgs = [] } = this.options;

    this.writeEmitter.fire(
      `Starting valgrind: ${valgrindBinary} ${[...valgrindArgs, target, ...targetArgs].join(' ')}\r\n`
    );
    this.valgrind = spawn(valgrindBinary, [...valgrindArgs, target, ...targetArgs]);
    this.valgrind.stdout?.on('data', this.forwardOutput.bind(this));
    this.valgrind.stderr?.on('data', this.forwardOutput.bind(this));
    this.valgrind.on('exit', (code) => this.closeEmitter.fire(code ?? 0));

    if (this.options.onReady) {
      this.waitForReady().then(this.options.onReady);
    } else if (this.options.onPid) {
      this.catchPid().then(this.options.onPid);
    }
  }

  public close(): void {
    if (this.valgrind && !this.valgrind.killed) {
      this.valgrind.kill('SIGTERM');
    }
    this.outputListener?.dispose();
    this.writeEmitter.dispose();
    this.closeEmitter.dispose();
  }

  private waitForReady(): Promise<string> {
    let pid: string | null = null;
    return new Promise((resolve) => {
      this.outputListener = this.onDidWrite((line) => {
        if (!pid) pid = parseValgrindPid(line);
        if (pid && isVgdbReady(line)) {
          resolve(pid);
          this.outputListener?.dispose();
        }
      });
    });
  }

  private catchPid(): Promise<string> {
    return new Promise((resolve) => {
      this.outputListener = this.onDidWrite((line) => {
        const pid = parseValgrindPid(line);
        if (pid) {
          resolve(pid);
          this.outputListener?.dispose();
        }
      });
    });
  }

  private forwardOutput(data: Buffer): void {
    data
      .toString()
      .split(/\r?\n/)
      .forEach((line) => this.writeEmitter.fire(`${line}\r\n`));
  }
}
