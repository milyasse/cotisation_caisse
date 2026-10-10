import React, { useState } from 'react';
import { useStore } from '../../store/store.ts';
import { periodLabel } from '../../domain/dates.ts';
import { formatMAD } from '../../domain/money.ts';
import type { Period } from '../../domain/types.ts';
import { Btn, Card, Empty, PeriodPicker } from '../components/kit.tsx';
import { Donut } from '../components/charts.tsx';
import { categoryColor } from '../colors.ts';
import { ExpenseForm } from '../forms.tsx';
import { OperationRow } from './History.tsx';

export function Expenses({ period, setPeriod }: { period: Period; setPeriod: (p: Period) => void }) {
  const { state: s } = useStore();
  const [adding, setAdding] = useState(false);
  const [cat, setCat] = useState<string>('');
  const list = s.expenses.filter((e) => e.date.startsWith(period) && (!cat || e.categoryId === cat)).sort((a, b) => b.date.localeCompare(a.date));
  const monthValid = s.expenses.filter((e) => e.status === 'valid' && e.date.startsWith(period));
  const total = monthValid.reduce((a, e) => a + e.amount, 0);
  const byCat = s.categories
    .map((c) => ({ c, color: categoryColor(s, c.id), t: monthValid.filter((e) => e.categoryId === c.id).reduce((a, e) => a + e.amount, 0) }))
    .filter((x) => x.t > 0)
    .sort((a, b) => b.t - a.t);

  return (
    <div className="screen">
      <PeriodPicker value={period} onChange={setPeriod} />
      <Card className="hero">
        <div className="hero-l">Total du mois</div>
        <div className="big-num">{formatMAD(total)}</div>
        <div className="hero-s">
          {monthValid.length} dépense{monthValid.length > 1 ? 's' : ''}
        </div>
      </Card>

      {byCat.length > 0 && (
        <Card>
          <div className="card-h">
            <h3>Répartition par catégorie</h3>
          </div>
          <Donut slices={byCat.map(({ c, color, t }) => ({ key: c.id, label: c.name, color, value: t }))} title={periodLabel(period)} />
          <div className="cat-bars" style={{ marginTop: 14 }}>
            {byCat.map(({ c, color, t }) => (
              <button key={c.id} className={cat === c.id ? 'cat-bar on' : 'cat-bar'} onClick={() => setCat(cat === c.id ? '' : c.id)} aria-pressed={cat === c.id}>
                <span>{c.name}</span>
                <b>
                  {Math.round((t / total) * 100)} % · {formatMAD(t)}
                </b>
                <span className="track">
                  <i style={{ width: `${(t / total) * 100}%`, background: color }} />
                </span>
              </button>
            ))}
          </div>
          <p className="note">Touchez une catégorie pour filtrer la liste.</p>
        </Card>
      )}

      <div className="card-h">
        <h3 className="sec">Opérations</h3>
        <Btn kind="soft" onClick={() => setAdding(true)}>
          + Dépense
        </Btn>
      </div>
      {cat && (
        <button className="link" onClick={() => setCat('')}>
          × Retirer le filtre « {s.categories.find((c) => c.id === cat)?.name} »
        </button>
      )}
      <div className="list">
        {list.map((e) => (
          <OperationRow key={e.id} op={{ kind: 'expense', date: e.date, amount: e.amount, item: e }} />
        ))}
      </div>
      {list.length === 0 && <Empty>Aucune dépense ce mois-ci.</Empty>}
      {adding && <ExpenseForm onDone={() => setAdding(false)} />}
    </div>
  );
}
