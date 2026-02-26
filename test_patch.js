const { SkinGenerator } = require('./dist-electron/services/skinGenerator');
const path = require('path');
const fs = require('fs');

async function main() {
  const gen = new SkinGenerator('C:\\Users\\n3tgg\\AppData\\Roaming\\riftchanger\\test-patched');
  
  gen.setGamePath('C:\\Riot Games\\League of Legends\\Game');
  gen.setToolsDir('C:\\Users\\n3tgg\\AppData\\Roaming\\riftchanger\\cslol-manager\\cslol-manager\\cslol-tools');
  
  try {
    const result = await gen.generateSkin('Darius', 14, 'Dreadnova Darius');
    console.log(JSON.stringify(result));
    
    if (result.success) {
      // Copy to desktop
      const dest = 'C:\\Users\\n3tgg\\Desktop\\Dreadnova_Darius_RESOURCES_PATCH.zip';
      fs.copyFileSync(result.outputPath, dest);
      console.log('Copied to:', dest);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
