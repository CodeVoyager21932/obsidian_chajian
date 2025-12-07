/**
 * Mock Obsidian API for testing
 */

export class TFile {
  path: string;
  extension: string;
  basename: string;
  name: string;
  
  constructor(path: string = '', extension: string = 'md') {
    this.path = path;
    this.extension = extension;
    this.basename = path.split('/').pop()?.replace(`.${extension}`, '') || '';
    this.name = path.split('/').pop() || '';
  }
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
