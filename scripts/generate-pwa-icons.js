/**
 * Script pour générer les icônes PWA aux bonnes tailles
 * Utilise sharp pour redimensionner
 * 
 * Usage: node scripts/generate-pwa-icons.js
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_ICON_PRIMARY = path.join(__dirname, '../public/logo-224solutions.png');
const SOURCE_ICON_FALLBACK = path.join(__dirname, '../public/icon-512.png');
const PUBLIC_DIR = path.join(__dirname, '../public');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  console.log('🎨 Génération des icônes PWA...\n');

  const sourceIcon = fs.existsSync(SOURCE_ICON_PRIMARY) ? SOURCE_ICON_PRIMARY : SOURCE_ICON_FALLBACK;

  // Vérifier si le fichier source existe
  if (!fs.existsSync(sourceIcon)) {
    console.error('❌ Fichier source non trouvé:', sourceIcon);
    console.log('💡 Veuillez placer une image source dans public/logo-224solutions.png ou public/icon-512.png');
    process.exit(1);
  }

  const sourceStats = fs.statSync(sourceIcon);
  console.log(`📁 Source: ${sourceIcon} (${(sourceStats.size / 1024).toFixed(1)} KB)\n`);

  for (const size of SIZES) {
    const outputPath = path.join(PUBLIC_DIR, `icon-${size}.png`);
    
    try {
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png({ 
          compressionLevel: 9,
          quality: 80
        })
        .toFile(outputPath);

      const stats = fs.statSync(outputPath);
      console.log(`✅ icon-${size}.png - ${(stats.size / 1024).toFixed(1)} KB`);
    } catch (error) {
      console.error(`❌ Erreur pour ${size}x${size}:`, error.message);
    }
  }

  // Générer aussi apple-touch-icon (180x180)
  try {
    const appleIconPath = path.join(PUBLIC_DIR, 'apple-touch-icon.png');
    await sharp(sourceIcon)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png({ compressionLevel: 9 })
      .toFile(appleIconPath);

    const stats = fs.statSync(appleIconPath);
    console.log(`✅ apple-touch-icon.png (180x180) - ${(stats.size / 1024).toFixed(1)} KB`);
  } catch (error) {
    console.error('❌ Erreur apple-touch-icon:', error.message);
  }

  // Générer favicon (32x32)
  try {
    const faviconPath = path.join(PUBLIC_DIR, 'favicon.png');
    await sharp(sourceIcon)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png({ compressionLevel: 9 })
      .toFile(faviconPath);

    const stats = fs.statSync(faviconPath);
    console.log(`✅ favicon.png (32x32) - ${(stats.size / 1024).toFixed(1)} KB`);
  } catch (error) {
    console.error('❌ Erreur favicon:', error.message);
  }

  console.log('\n✨ Génération terminée!');
  console.log('💡 N\'oubliez pas de commit les nouveaux icônes.');
}

generateIcons().catch(console.error);
