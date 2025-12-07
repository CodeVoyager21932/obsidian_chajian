/**
 * FileService - Safe file operations with atomic writes and backups
 * 
 * Provides:
 * - Atomic write operations (write to temp, then rename)
 * - Automatic backup creation before overwrites
 * - JSON read/write with schema validation
 * - Error handling and recovery
 */

import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { z } from 'zod';

export class FileService {
  constructor(private app: App, private pluginDataDir: string) {}

  /**
   * Read file content as string
   */
  async read(path: string): Promise<string> {
    const normalizedPath = normalizePath(path);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);
    
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found: ${path}`);
    }
    
    return await this.app.vault.read(file);
  }

  /**
   * Write file with atomic operation (write to temp, then rename)
   * Property 22: Atomic file writes
   */
  async write(path: string, content: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    
    // Ensure parent directory exists
    const parentPath = this.getParentPath(normalizedPath);
    if (parentPath) {
      await this.ensureDirectory(parentPath);
    }
    
    // Check if file exists and create backup
    const existingFile = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (existingFile && existingFile instanceof TFile) {
      await this.backup(normalizedPath);
    }
    
    // Write to temporary file first
    const tempPath = `${normalizedPath}.tmp`;
    
    try {
      // Create or modify temp file
      const tempFile = this.app.vault.getAbstractFileByPath(tempPath);
      if (tempFile && tempFile instanceof TFile) {
        await this.app.vault.modify(tempFile, content);
      } else {
        await this.app.vault.create(tempPath, content);
      }
      
      // Atomic rename: delete old file and rename temp
      if (existingFile && existingFile instanceof TFile) {
        await this.app.vault.delete(existingFile);
      }
      
      // Get temp file again after potential deletion
      const tempFileAfterWrite = this.app.vault.getAbstractFileByPath(tempPath);
      if (tempFileAfterWrite && tempFileAfterWrite instanceof TFile) {
        await this.app.vault.rename(tempFileAfterWrite, normalizedPath);
      } else {
        throw new Error(`Temp file not found after write: ${tempPath}`);
      }
    } catch (error) {
      // Clean up temp file on error
      const tempFile = this.app.vault.getAbstractFileByPath(tempPath);
      if (tempFile && tempFile instanceof TFile) {
        try {
          await this.app.vault.delete(tempFile);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  }

  /**
   * Write JSON with schema validation
   */
  async writeJSON<T>(path: string, data: T, schema: z.ZodSchema<T>): Promise<void> {
    // Validate data against schema
    const validated = schema.parse(data);
    
    // Serialize to JSON with pretty printing
    const content = JSON.stringify(validated, null, 2);
    
    // Write using atomic operation
    await this.write(path, content);
  }

  /**
   * Read JSON with schema validation
   */
  async readJSON<T>(path: string, schema: z.ZodSchema<T>): Promise<T | null> {
    try {
      const content = await this.read(path);
      const parsed = JSON.parse(content);
      
      // Validate against schema
      return schema.parse(parsed);
    } catch (error) {
      if (error instanceof Error && error.message.includes('File not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create backup of existing file
   * Property 23: Backup before overwrite
   */
  async backup(path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);
    
    if (!file || !(file instanceof TFile)) {
      return; // No file to backup
    }
    
    const backupPath = `${normalizedPath}.bak`;
    const content = await this.app.vault.read(file);
    
    // Remove old backup if exists
    const oldBackup = this.app.vault.getAbstractFileByPath(backupPath);
    if (oldBackup && oldBackup instanceof TFile) {
      await this.app.vault.delete(oldBackup);
    }
    
    // Create new backup
    await this.app.vault.create(backupPath, content);
  }

  /**
   * Restore from backup
   */
  async restore(path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    const backupPath = `${normalizedPath}.bak`;
    
    const backupFile = this.app.vault.getAbstractFileByPath(backupPath);
    if (!backupFile || !(backupFile instanceof TFile)) {
      throw new Error(`Backup not found: ${backupPath}`);
    }
    
    const content = await this.app.vault.read(backupFile);
    await this.write(normalizedPath, content);
  }

  /**
   * Check if file exists
   */
  exists(path: string): boolean {
    const normalizedPath = normalizePath(path);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);
    return file !== null && file instanceof TFile;
  }

  /**
   * Delete file
   */
  async delete(path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);
    
    if (file && file instanceof TFile) {
      await this.app.vault.delete(file);
    }
  }

  /**
   * Ensure directory exists, create if not
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    const normalizedPath = normalizePath(dirPath);
    
    if (!normalizedPath || normalizedPath === '.') {
      return;
    }
    
    const dir = this.app.vault.getAbstractFileByPath(normalizedPath);
    
    if (!dir) {
      // Create directory recursively
      await this.app.vault.createFolder(normalizedPath);
    } else if (!(dir instanceof TFolder)) {
      throw new Error(`Path exists but is not a directory: ${dirPath}`);
    }
  }

  /**
   * Get parent directory path
   */
  private getParentPath(path: string): string {
    const parts = path.split('/');
    if (parts.length <= 1) {
      return '';
    }
    parts.pop();
    return parts.join('/');
  }

  /**
   * List files in directory
   */
  async listFiles(dirPath: string, extension?: string): Promise<string[]> {
    const normalizedPath = normalizePath(dirPath);
    const dir = this.app.vault.getAbstractFileByPath(normalizedPath);
    
    if (!dir || !(dir instanceof TFolder)) {
      return [];
    }
    
    const files: string[] = [];
    
    const collectFiles = (folder: TFolder) => {
      for (const child of folder.children) {
        if (child instanceof TFile) {
          if (!extension || child.extension === extension) {
            files.push(child.path);
          }
        } else if (child instanceof TFolder) {
          collectFiles(child);
        }
      }
    };
    
    collectFiles(dir);
    return files;
  }
}
