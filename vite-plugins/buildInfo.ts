/**
 * Plugin Vite pour injecter les informations de build
 * 224Solutions - Vista-Flows
 */

import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

function generateBuildId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `VF-${timestamp}-${random}`.toUpperCase();
}

export function buildInfoPlugin(): Plugin {
  const buildId = generateBuildId();
  const buildDate = new Date().toISOString();

  return {
    name: 'vite-plugin-build-info',
    config(config, { mode }) {
      return {
        define: {
          __BUILD_ID__: JSON.stringify(buildId),
          __BUILD_DATE__: JSON.stringify(buildDate),
          __BUILD_ENV__: JSON.stringify(mode)
        }
      };
    },
    transformIndexHtml(html) {
      const comment = `<!-- 224Solutions Vista-Flows | Build: ${buildId} | ${buildDate} -->`;
      return html.replace('<head>', `<head>\n    ${comment}`);
    },
    closeBundle() {
      // Injecter la version de build dans service-worker.js
      // Cela garantit que le fichier change à chaque déploiement → le navigateur détecte la mise à jour
      const swPath = path.resolve('dist', 'service-worker.js');
      if (fs.existsSync(swPath)) {
        let content = fs.readFileSync(swPath, 'utf-8');
        content = content.replace(/__SW_VERSION__/g, buildId);
        fs.writeFileSync(swPath, content, 'utf-8');
        console.log(`[buildInfo] SW version injected: ${buildId}`);
      }
    }
  };
}

export default buildInfoPlugin;
