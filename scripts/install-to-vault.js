#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function copyFile(src, dest) {
  try {
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied ${path.basename(src)}`);
  } catch (error) {
    console.error(`✗ Failed to copy ${path.basename(src)}: ${error.message}`);
  }
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✓ Created directory: ${dirPath}`);
  }
}

async function main() {
  try {
    console.log("🔌 Obsidian Plugin Installer");
    console.log("============================\n");

    // Prompt for vault path
    const vaultPath = await question(
      "Enter the path to your Obsidian vault: (/Users/A200407315/Documents/NotesOfTheGods)"
    );

    if (!vaultPath.trim()) {
      console.info("❌ Vault path cannot be empty");
      console.info("Using default vault path: /Users/A200407315/Documents/NotesOfTheGods");
      vaultPath = "/Users/A200407315/Documents/NotesOfTheGods";
      // process.exit(1);
    }

    const expandedVaultPath = vaultPath.replace(/^~/, require("os").homedir());

    // Validate vault path exists
    if (!fs.existsSync(expandedVaultPath)) {
      console.error(`❌ Vault path does not exist: ${expandedVaultPath}`);
      process.exit(1);
    }

    // Read plugin manifest to get plugin ID
    const manifestPath = path.join(__dirname, "..", "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      console.error(
        "❌ manifest.json not found. Please build the plugin first."
      );
      process.exit(1);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const pluginId = manifest.id;

    if (!pluginId) {
      console.error("❌ Plugin ID not found in manifest.json");
      process.exit(1);
    }

    // Create plugin directory in vault
    const pluginDir = path.join(
      expandedVaultPath,
      ".obsidian",
      "plugins",
      pluginId
    );
    ensureDirectoryExists(pluginDir);

    console.log(`\n📁 Installing plugin to: ${pluginDir}\n`);

    // Files to copy
    const filesToCopy = [
      { src: "main.js", required: true },
      { src: "manifest.json", required: true },
      { src: "styles.css", required: false },
    ];

    const projectRoot = path.join(__dirname, "..");
    let copyCount = 0;

    for (const file of filesToCopy) {
      const srcPath = path.join(projectRoot, file.src);
      const destPath = path.join(pluginDir, file.src);

      if (fs.existsSync(srcPath)) {
        copyFile(srcPath, destPath);
        copyCount++;
      } else if (file.required) {
        console.error(
          `❌ Required file not found: ${file.src}. Please build the plugin first.`
        );
        process.exit(1);
      } else {
        console.log(`⚠️  Optional file not found: ${file.src} (skipping)`);
      }
    }

    console.log(`\n✅ Successfully installed plugin to vault!`);
    console.log(`📊 ${copyCount} files copied`);
    console.log(`🔧 Plugin ID: ${pluginId}`);
    console.log(`📍 Location: ${pluginDir}`);
    console.log(
      "\n💡 Don't forget to enable the plugin in Obsidian's Community Plugins settings!"
    );
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
