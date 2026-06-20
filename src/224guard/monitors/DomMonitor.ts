/**
 * 224Guard — surveillance du DOM.
 * Détecte les clés injectées dans le DOM : attributs `data-*`/`content`/`value`,
 * scripts inline (`<script>…</script>`, `<script type="application/json">`).
 * Limite documentée (cf. LOGIC_AUDIT attaque #3) : un ajout+retrait dans le même
 * microtask peut échapper à l'observer (risque résiduel accepté).
 */

import type { AlertManager } from '../pipeline/AlertManager';
import type { DisposableRegistry } from '../core/DisposableRegistry';
import type { DetectionContext } from '../core/types';
import { ENV_CAPS } from '../config';

const SUSPECT_ATTRS = ['content', 'value', 'data-key', 'data-token', 'data-secret', 'data-config'];

export class DomMonitor {
  private observer: MutationObserver | null = null;

  constructor(
    private alerts: AlertManager,
    private registry: DisposableRegistry,
    private doc: Document = typeof document !== 'undefined' ? document : (undefined as unknown as Document),
  ) {}

  install(): void {
    if (!ENV_CAPS.hasMutationObserver || !this.doc?.documentElement) return; // feature-detect
    this.scanElement(this.doc.documentElement);

    this.observer = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        if (mut.type === 'attributes' && mut.target instanceof Element) {
          this.scanAttributes(mut.target);
        }
        mut.addedNodes.forEach((n) => { if (n instanceof Element) this.scanElement(n); });
      }
    });
    this.observer.observe(this.doc.documentElement, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: [...SUSPECT_ATTRS, 'data-config', 'data-env'],
    });
    this.registry.add(() => this.observer?.disconnect());
  }

  private ctx(location: string): DetectionContext {
    return { source: 'dom', location };
  }

  private scanElement(el: Element): void {
    this.scanAttributes(el);
    // Scripts inline (config injectée, JSON public…).
    const tag = el.tagName?.toLowerCase();
    if (tag === 'script' && el.textContent && el.textContent.length > 8) {
      void this.alerts.analyzeText(el.textContent, this.ctx('script'));
    }
    // Descendants suspects (l'observer ne livre que la racine ajoutée).
    try {
      el.querySelectorAll?.('[content],[data-key],[data-token],[data-secret],script').forEach((c) => {
        this.scanAttributes(c);
        if (c.tagName?.toLowerCase() === 'script' && c.textContent && c.textContent.length > 8) {
          void this.alerts.analyzeText(c.textContent, this.ctx('script'));
        }
      });
    } catch { /* noop */ }
  }

  private scanAttributes(el: Element): void {
    for (const name of SUSPECT_ATTRS) {
      const v = el.getAttribute?.(name);
      if (v) void this.alerts.analyzeValue(v, this.ctx(`${el.tagName?.toLowerCase()}[${name}]`));
    }
  }
}
