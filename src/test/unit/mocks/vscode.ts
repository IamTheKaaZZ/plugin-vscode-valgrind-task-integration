import * as sinon from 'sinon';

// Mock VS Code EventEmitter that works outside the extension host
export class MockEventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter((l) => l !== listener); } };
  };

  fire(data: T): void {
    this.listeners.forEach((l) => l(data));
  }

  dispose(): void {
    this.listeners = [];
  }
}

// Workspace configuration mock
export function createMockConfig(values: Record<string, unknown> = {}) {
  return {
    get: <T>(key: string, defaultValue?: T): T => {
      return key in values ? (values[key] as T) : (defaultValue as T);
    },
    has: (key: string) => key in values,
    inspect: () => undefined,
    update: sinon.stub().resolves(),
  };
}

export const mockWorkspace = {
  getConfiguration: sinon.stub().callsFake((_section?: string) => createMockConfig()),
  workspaceFolders: undefined as unknown[] | undefined,
};

export const mockWindow = {
  showErrorMessage: sinon.stub().resolves(undefined),
  showInformationMessage: sinon.stub().resolves(undefined),
  showWarningMessage: sinon.stub().resolves(undefined),
};

export const mockDebug = {
  registerDebugConfigurationProvider: sinon.stub().returns({ dispose: sinon.stub() }),
  startDebugging: sinon.stub().resolves(true),
  stopDebugging: sinon.stub().resolves(),
  onDidTerminateDebugSession: sinon.stub().returns({ dispose: sinon.stub() }),
  activeDebugSession: undefined as unknown,
};

export const mockTasks = {
  registerTaskProvider: sinon.stub().returns({ dispose: sinon.stub() }),
  executeTask: sinon.stub().resolves({ terminate: sinon.stub() }),
};

export const mockCommands = {
  executeCommand: sinon.stub().resolves(),
};

export const mockEnv = {
  openExternal: sinon.stub().resolves(true),
};

export const mockExtensions = {
  getExtension: sinon.stub().returns(undefined),
};

// The full mock module — shape matches the vscode namespace
const vscodeMock = {
  EventEmitter: MockEventEmitter,
  workspace: mockWorkspace,
  window: mockWindow,
  debug: mockDebug,
  tasks: mockTasks,
  commands: mockCommands,
  env: mockEnv,
  extensions: mockExtensions,
  Uri: {
    parse: (s: string) => ({ toString: () => s, fsPath: s }),
    file: (s: string) => ({ toString: () => `file://${s}`, fsPath: s }),
  },
  TaskScope: { Workspace: 1, Global: 2 },
  Task: class MockTask {
    definition: unknown;
    scope: unknown;
    name: string;
    source: string;
    execution: unknown;
    problemMatchers: string[];
    constructor(
      definition: unknown,
      scope: unknown,
      name: string,
      source: string,
      execution: unknown,
      ...problemMatchers: string[]
    ) {
      this.definition = definition;
      this.scope = scope;
      this.name = name;
      this.source = source;
      this.execution = execution;
      this.problemMatchers = problemMatchers;
    }
  },
  CustomExecution: class MockCustomExecution {
    callback: Function;
    constructor(callback: Function) {
      this.callback = callback;
    }
  },
  Disposable: class MockDisposable {
    private fn: Function;
    constructor(fn: Function) {
      this.fn = fn;
    }
    dispose() {
      this.fn();
    }
    static from(...disposables: { dispose: () => unknown }[]) {
      return new MockDisposable(() => disposables.forEach((d) => d.dispose()));
    }
  },
  CancellationTokenSource: class {
    token = { isCancellationRequested: false };
    cancel() {
      this.token.isCancellationRequested = true;
    }
    dispose() {}
  },
};

export default vscodeMock;

// Reset all stubs between tests
export function resetMocks(): void {
  mockWorkspace.getConfiguration = sinon.stub().callsFake((_section?: string) => createMockConfig());
  mockWorkspace.workspaceFolders = undefined;
  mockWindow.showErrorMessage = sinon.stub().resolves(undefined);
  mockWindow.showInformationMessage = sinon.stub().resolves(undefined);
  mockWindow.showWarningMessage = sinon.stub().resolves(undefined);
  mockDebug.registerDebugConfigurationProvider = sinon.stub().returns({ dispose: sinon.stub() });
  mockDebug.startDebugging = sinon.stub().resolves(true);
  mockDebug.stopDebugging = sinon.stub().resolves();
  mockDebug.onDidTerminateDebugSession = sinon.stub().returns({ dispose: sinon.stub() });
  mockDebug.activeDebugSession = undefined;
  mockTasks.registerTaskProvider = sinon.stub().returns({ dispose: sinon.stub() });
  mockTasks.executeTask = sinon.stub().resolves({ terminate: sinon.stub() });
  mockCommands.executeCommand = sinon.stub().resolves();
  mockEnv.openExternal = sinon.stub().resolves(true);
  mockExtensions.getExtension = sinon.stub().returns(undefined);
}
