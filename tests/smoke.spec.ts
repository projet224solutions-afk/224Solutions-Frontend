import { test, expect, type Page } from '@playwright/test';

/**
 * SMOKE-TESTS — chaque route critique doit se charger SANS erreur runtime.
 * Ce test aurait bloqué le crash "t is not defined" (codemod i18n) car cette
 * erreur survient au rendu, là où `tsc` ne voit rien.
 *
 * Règle : on n'exige PAS d'être connecté — une redirection vers /auth est OK.
 * On interdit seulement : ErrorBoundary affiché OU erreur JS non capturée.
 */

// Parcours publics (rendent quelque chose même non connecté ; les routes
// protégées redirigent vers l'auth, ce qui reste un rendu valide sans crash).
const ROUTES = [
  '/',
  '/auth',
  '/marketplace',
  '/proximite',
  '/taxi-moto-client',
];

// Motifs d'erreur fatale à interdire dans la console / les exceptions
const FATAL = /is not defined|cannot read propert|undefined is not|is not a function|Minified React error/i;

async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

for (const route of ROUTES) {
  test(`smoke: ${route} se charge sans crash`, async ({ page }) => {
    const errors = await collectErrors(page);

    // 'domcontentloaded' (pas 'networkidle') : les pages avec temps-réel (Ably)
    // ne sont jamais "idle" réseau → on n'attend pas le silence, juste le DOM.
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    // Laisser React monter + les lazy chunks s'exécuter (un crash surgit ici)
    await page.waitForTimeout(2500);

    // 1) L'ErrorBoundary global ne doit jamais s'afficher
    await expect(
      page.getByText(/Une erreur s'est produite|t is not defined/i),
    ).toHaveCount(0);

    // 2) Aucune erreur JS fatale
    const fatal = errors.filter((e) => FATAL.test(e));
    expect(fatal, `Erreurs fatales sur ${route}:\n${fatal.join('\n')}`).toEqual([]);
  });
}
