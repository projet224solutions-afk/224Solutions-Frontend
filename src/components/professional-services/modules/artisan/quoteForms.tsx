/**
 * Formulaires de devis par métier (vitrerie/menuiserie/plomberie/soudure).
 * Chacun s'appuie sur le moteur partagé `calculator.ts` + `quotePdf.ts`.
 */

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/Money';
import { FileDown, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  GLASS_TYPES, GLASS_INTERVENTION_TYPES, METAL_TYPES, PLUMBING_CATALOG, WOOD_TYPES, WOOD_FINISHES,
  CARPENTRY_PHASES, WELD_PROCESSES, URGENCY_SURCHARGE,
  computeGlassPrice, computeQuoteTotals, computeWeldingQuote, weldPassesForThickness, metalWeightKg, type QuoteItem,
} from '@/lib/artisan/calculator';
import { generateQuotePdf } from '@/lib/artisan/quotePdf';

type CreateFn = (q: any) => Promise<any>;

function Totals({ ht, tax, ttc }: { ht: number; tax: number; ttc: number }) {
  return (
    <div className="rounded-xl bg-muted p-3 text-sm">
      <div className="flex justify-between"><span>Total HT</span><b><Money amount={ht} /></b></div>
      <div className="flex justify-between"><span>TVA 18%</span><span><Money amount={tax} /></span></div>
      <div className="flex justify-between text-base text-[#ff4000]"><span>Total TTC</span><b><Money amount={ttc} /></b></div>
    </div>
  );
}

async function submitQuote(onCreate: CreateFn, serviceType: string, serviceLabel: string, items: QuoteItem[], totals: { total_ht: number; tax: number; total_ttc: number }) {
  const created = await onCreate({ service_type: serviceType, status: 'sent', items, total_ht: totals.total_ht, tax_rate: 18, total_ttc: totals.total_ttc });
  if (created) {
    generateQuotePdf({ serviceLabel, items, ...totals, reference: created.id?.slice(0, 8) });
    toast.success('Devis créé + PDF');
  }
}

// ── VITRERIE ─────────────────────────────────────────────────────────────────
export function GlassQuote({ onCreate }: { onCreate: CreateFn }) {
  const [intervention, setIntervention] = useState(GLASS_INTERVENTION_TYPES[0].code);
  const [h, setH] = useState(120); const [w, setW] = useState(80);
  const [type, setType] = useState(GLASS_TYPES[1].code);
  const [install, setInstall] = useState(true); const [joints, setJoints] = useState(true); const [urgent, setUrgent] = useState(false);
  const r = useMemo(() => computeGlassPrice(h, w, type, { withInstall: install, withJoints: joints, urgency: urgent }), [h, w, type, install, joints, urgent]);
  const interventionLabel = GLASS_INTERVENTION_TYPES.find((i) => i.code === intervention)?.label ?? '';
  const items: QuoteItem[] = [{ label: `${interventionLabel} — ${GLASS_TYPES.find(g => g.code === type)?.label} ${r.areaM2.toFixed(2)} m²`, qty: 1, unit_price_material: r.total_ht, unit_price_labor: 0 }];

  return (
    <Card><CardContent className="space-y-3 pt-4">
      <div><Label>Type d'intervention</Label>
        <select className="w-full rounded-md border px-2 py-2 text-sm" value={intervention} onChange={(e) => setIntervention(e.target.value)}>
          {GLASS_INTERVENTION_TYPES.map((i) => <option key={i.code} value={i.code}>{i.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Hauteur (cm)</Label><Input type="number" value={h} onChange={(e) => setH(+e.target.value || 0)} /></div>
        <div><Label>Largeur (cm)</Label><Input type="number" value={w} onChange={(e) => setW(+e.target.value || 0)} /></div>
      </div>
      <div><Label>Type de verre</Label>
        <select className="w-full rounded-md border px-2 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          {GLASS_TYPES.map((g) => <option key={g.code} value={g.code}>{g.label} — {g.pricePerM2.toLocaleString()} GNF/m²</option>)}
        </select>
      </div>
      <div className="text-sm text-muted-foreground">Surface : <b>{r.areaM2.toFixed(2)} m²</b></div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1"><input type="checkbox" checked={install} onChange={(e) => setInstall(e.target.checked)} />Pose incluse</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={joints} onChange={(e) => setJoints(e.target.checked)} />Joints</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />Urgence (+30%)</label>
      </div>
      <Totals ht={r.total_ht} tax={r.tax} ttc={r.total_ttc} />
      <Button onClick={() => submitQuote(onCreate, 'vitrerie', 'Vitrerie', items, r)}><FileDown className="h-4 w-4 mr-1" />Créer + PDF</Button>
    </CardContent></Card>
  );
}

// ── SOUDURE / MÉTALLERIE (calculateur cordon — signature QuoteIQ) ─────────────
export function MetalQuote({ onCreate }: { onCreate: CreateFn }) {
  // Section matière (poids du métal de base)
  const [metal, setMetal] = useState(METAL_TYPES[0].code);
  const [h, setH] = useState(2000); const [w, setW] = useState(1000); const [thick, setThick] = useState(3); const [qty, setQty] = useState(1);
  // Section soudure (cordon)
  const [process, setProcess] = useState<'mig' | 'tig' | 'arc'>('mig');
  const [cordLength, setCordLength] = useState(4);
  const [autoPasses, setAutoPasses] = useState(true);
  const [passes, setPasses] = useState(1);

  const m = METAL_TYPES.find((x) => x.code === metal)!;
  const weight = useMemo(() => metalWeightKg(h, w, thick, m.density) * qty, [h, w, thick, qty, m.density]);
  const baseMaterialCost = Math.round(weight * m.pricePerKg);
  const effectivePasses = autoPasses ? weldPassesForThickness(thick) : Math.max(1, passes);

  const est = useMemo(() => computeWeldingQuote({ process, cordLengthM: cordLength, thicknessMm: thick, passes: effectivePasses, baseMaterialCost }),
    [process, cordLength, thick, effectivePasses, baseMaterialCost]);

  return (
    <Card><CardContent className="space-y-3 pt-4">
      <div className="text-xs font-semibold uppercase text-muted-foreground">Matière</div>
      <div><Label>Métal de base</Label>
        <select className="w-full rounded-md border px-2 py-2 text-sm" value={metal} onChange={(e) => setMetal(e.target.value)}>
          {METAL_TYPES.map((x) => <option key={x.code} value={x.code}>{x.label} — {x.pricePerKg.toLocaleString()} GNF/kg</option>)}
        </select>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div><Label>H (mm)</Label><Input type="number" value={h} onChange={(e) => setH(+e.target.value || 0)} /></div>
        <div><Label>L (mm)</Label><Input type="number" value={w} onChange={(e) => setW(+e.target.value || 0)} /></div>
        <div><Label>Ép. (mm)</Label><Input type="number" value={thick} onChange={(e) => setThick(+e.target.value || 0)} /></div>
        <div><Label>Qté</Label><Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value || 1))} /></div>
      </div>
      <div className="text-sm text-muted-foreground">Poids estimé : <b>{weight.toFixed(1)} kg</b> · Matière : <b>{baseMaterialCost.toLocaleString()} GNF</b></div>

      <div className="text-xs font-semibold uppercase text-muted-foreground">Soudure</div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Procédé</Label>
          <select className="w-full rounded-md border px-2 py-2 text-sm" value={process} onChange={(e) => setProcess(e.target.value as any)}>
            {WELD_PROCESSES.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </div>
        <div><Label>Longueur de cordon (m)</Label><Input type="number" step="0.1" value={cordLength} onChange={(e) => setCordLength(+e.target.value || 0)} /></div>
      </div>
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={autoPasses} onChange={(e) => setAutoPasses(e.target.checked)} />Passes auto (selon épaisseur)</label>
      {!autoPasses && <div><Label>Nombre de passes</Label><Input type="number" min={1} value={passes} onChange={(e) => setPasses(Math.max(1, +e.target.value || 1))} /></div>}
      <div className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
        Passes : <b>{est.passes}</b> · Cordon effectif : <b>{est.effectiveLengthM.toFixed(1)} m</b> · Consommable : <b>{est.consumableQty.toFixed(2)} {est.consumableUnit}</b> · Temps : <b>{Math.round(est.timeMin)} min</b>{est.gasCost > 0 ? <> · Gaz : <b>{Math.round(est.gasCost).toLocaleString()} GNF</b></> : null}
      </div>

      <Totals ht={est.totals.total_ht} tax={est.totals.tax} ttc={est.totals.total_ttc} />
      <Button onClick={() => submitQuote(onCreate, 'soudure', 'Soudure / Métallerie', est.items, est.totals)}><FileDown className="h-4 w-4 mr-1" />Créer + PDF</Button>
    </CardContent></Card>
  );
}

// ── PLOMBERIE ────────────────────────────────────────────────────────────────
export function PlumbingQuote({ onCreate }: { onCreate: CreateFn }) {
  const [lines, setLines] = useState<{ code: string; qty: number }[]>([{ code: PLUMBING_CATALOG[0].code, qty: 1 }]);
  const [urgency, setUrgency] = useState<'normal' | 'urgent' | 'immediate'>('normal');
  const items: QuoteItem[] = lines.map((l) => { const c = PLUMBING_CATALOG.find((x) => x.code === l.code)!; return { label: c.label, qty: l.qty, unit_price_material: c.price, unit_price_labor: 0 }; });
  const totals = useMemo(() => computeQuoteTotals(items, 18, { urgencySurchargePct: URGENCY_SURCHARGE[urgency] }), [JSON.stringify(lines), urgency]);

  return (
    <Card><CardContent className="space-y-3 pt-4">
      {lines.map((l, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <select className="flex-1 rounded-md border px-2 py-2 text-sm" value={l.code} onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, code: e.target.value } : x))}>
            {PLUMBING_CATALOG.map((c) => <option key={c.code} value={c.code}>{c.label} ({c.price.toLocaleString()} GNF)</option>)}
          </select>
          <Input type="number" min={1} className="w-20" value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, qty: Math.max(1, +e.target.value || 1) } : x))} />
          <Button size="icon" variant="ghost" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setLines((l) => [...l, { code: PLUMBING_CATALOG[0].code, qty: 1 }])}><Plus className="h-4 w-4 mr-1" />Ligne</Button>
      <div className="flex items-center gap-2 text-sm"><span>Urgence :</span>
        <select className="rounded-md border px-2 py-1" value={urgency} onChange={(e) => setUrgency(e.target.value as any)}>
          <option value="normal">Normal</option><option value="urgent">Urgent (+20%)</option><option value="immediate">Urgence (+50%)</option>
        </select>
      </div>
      <Totals ht={totals.total_ht} tax={totals.tax} ttc={totals.total_ttc} />
      <Button onClick={() => submitQuote(onCreate, 'plomberie', 'Plomberie', items, totals)}><FileDown className="h-4 w-4 mr-1" />Créer + PDF</Button>
    </CardContent></Card>
  );
}

// ── MENUISERIE (devis sur mesure, lignes d'ouvrages) ─────────────────────────
export function CarpentryQuote({ onCreate }: { onCreate: CreateFn }) {
  const [lines, setLines] = useState<{ label: string; wood: string; finish: string; phase: string; qty: number; material: number; labor: number }[]>(
    [{ label: 'Porte intérieure 83×204', wood: WOOD_TYPES[0].code, finish: WOOD_FINISHES[1].code, phase: CARPENTRY_PHASES[0].code, qty: 1, material: 150000, labor: 80000 }]);
  const phaseLabel = (code: string) => CARPENTRY_PHASES.find((p) => p.code === code)?.label ?? '';
  const items: QuoteItem[] = lines.map((l) => ({ label: `[${phaseLabel(l.phase)}] ${l.label} (${WOOD_TYPES.find(w => w.code === l.wood)?.label}, ${WOOD_FINISHES.find(f => f.code === l.finish)?.label})`, qty: l.qty, unit_price_material: l.material, unit_price_labor: l.labor }));
  const totals = useMemo(() => computeQuoteTotals(items, 18), [JSON.stringify(lines)]);
  const subtotal = (phase: string) => lines.filter((l) => l.phase === phase).reduce((s, l) => s + l.qty * (l.material + l.labor), 0);
  const upd = (idx: number, patch: any) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, ...patch } : x));

  return (
    <Card><CardContent className="space-y-3 pt-4">
      {lines.map((l, idx) => (
        <div key={idx} className="space-y-2 rounded-lg border p-2">
          <Input placeholder="Désignation de l'ouvrage" value={l.label} onChange={(e) => upd(idx, { label: e.target.value })} />
          <div><Label className="text-xs">Phase de chantier</Label>
            <select className="w-full rounded-md border px-2 py-2 text-sm" value={l.phase} onChange={(e) => upd(idx, { phase: e.target.value })}>{CARPENTRY_PHASES.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}</select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="rounded-md border px-2 py-2 text-sm" value={l.wood} onChange={(e) => upd(idx, { wood: e.target.value })}>{WOOD_TYPES.map((w) => <option key={w.code} value={w.code}>{w.label}</option>)}</select>
            <select className="rounded-md border px-2 py-2 text-sm" value={l.finish} onChange={(e) => upd(idx, { finish: e.target.value })}>{WOOD_FINISHES.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}</select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Qté</Label><Input type="number" min={1} value={l.qty} onChange={(e) => upd(idx, { qty: Math.max(1, +e.target.value || 1) })} /></div>
            <div><Label className="text-xs">Matériau</Label><Input type="number" value={l.material} onChange={(e) => upd(idx, { material: +e.target.value || 0 })} /></div>
            <div><Label className="text-xs">Main d'œuvre</Label><Input type="number" value={l.labor} onChange={(e) => upd(idx, { labor: +e.target.value || 0 })} /></div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive mr-1" />Retirer</Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setLines((l) => [...l, { label: '', wood: WOOD_TYPES[0].code, finish: WOOD_FINISHES[0].code, phase: CARPENTRY_PHASES[0].code, qty: 1, material: 0, labor: 0 }])}><Plus className="h-4 w-4 mr-1" />Ouvrage</Button>
      <div className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
        {CARPENTRY_PHASES.map((p) => <div key={p.code} className="flex justify-between"><span>{p.label}</span><b>{subtotal(p.code).toLocaleString()} GNF</b></div>)}
      </div>
      <Totals ht={totals.total_ht} tax={totals.tax} ttc={totals.total_ttc} />
      <Button onClick={() => submitQuote(onCreate, 'menuiserie', 'Menuiserie', items, totals)}><FileDown className="h-4 w-4 mr-1" />Créer + PDF</Button>
    </CardContent></Card>
  );
}
