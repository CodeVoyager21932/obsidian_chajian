/**
 * Deploy script - Copy built files to Obsidian plugin directory
 */

import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Target plugin directory
const targetDir = 'C:\\Users\\72998\\Documents\\Obsidian Vault\\.obsidian\\plugins\\career-os';

// Files to copy
const files = ['main.js', 'manifest.json'];

// Ensure target directory exists
if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
  console.log(`✅ Created directory: ${targetDir}`);
}

// Copy files
for (const file of files) {
  const src = join(process.cwd(), file);
  const dest = join(targetDir, file);
  
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`✅ Copied: ${file}`);
  } else {
    console.error(`❌ File not found: ${file}`);
  }
}

console.log('\n🎉 Deploy complete! Reload Obsidian plugin to see changes.');
console.log('   Tip: Use Ctrl+P -> "Reload app without saving" or restart Obsidian');
