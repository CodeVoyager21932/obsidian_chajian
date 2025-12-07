/**
 * Mock Obsidian API for testing
 */

export class TFile {
  constructor(public path: string, public extension: string) {}
}

export class TFolder {
  constructor(public path: string, public children: any[] = []) {}
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export class App {
  vault: any;
}
