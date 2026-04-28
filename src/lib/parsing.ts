export function parseValgrindPid(line: string): string | null {
  const match = /^==(\d+)==/.exec(line);
  return match?.[1] ?? null;
}

export function isVgdbReady(line: string): boolean {
  return /TO DEBUG THIS PROCESS/.test(line);
}
