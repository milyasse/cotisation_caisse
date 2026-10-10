import React, { useMemo, useState } from 'react';
import { useStore } from '../../store/store.ts';
import { balanceAt, balanceSeries, contributionRows, monthSummary, yearSummary, allOperations, memberTotals } from '../../domain/finance.ts';
import { addMonths, fmtDate, MONTHS_SHORT, periodLabel, periodMonth, periodOf, periodYear, todayISO } from '../../domain/dates.ts';
import { formatMAD } from '../../domain/money.ts';
import type { Period } from '../../domain/types.ts';
import { Card, Icon, Kpi, PeriodPicker } from '../components/kit.tsx';
import { BalanceLine, Donut, MemberProgress, MonthBars } from '../components/charts.tsx';
import { categoryColor, colorOfMember } from '../colors.ts';
import { OperationRow } from './History.tsx';

const mlabel = (p: Period) => MONTHS_SHORT[periodMonth(p) - 1];
/** Montant d'indicateur : chiffre en gras, « MAD » discret (ne se coupe jamais). */
const mad = (c: number) => (
  <>
    {formatMAD(c, false)}
    <small>MAD</small>
  </>
);

export function Dashboard({ period, setPeriod, go }: { period: Period; setPeriod: (p: Period) => void; go: (tab: string) => void }) {
  const { state: s } = useStore();
  const [scope, setScope] = useState<'mois' | 'annee'>('mois');
  const today = todayISO();
  const cur = periodOf(today);
  const m = monthSummary(s, period, today);
  const prev = monthSummary(s, addMonths(period, -1), today);
  const year = periodYear(period);
  const y = yearSummary(s, year, today);
  const ytd = y.months.filter((x) => x.period <= period);
  const ytdReceived = ytd.reduce((a, x) => a + x.received, 0);
  const ytdExpenses = ytd.reduce((a, x) => a + x.expenses, 0);
  const balance = balanceAt(s, today);
  // Fenêtre des graphiques : les 12 derniers mois, sauf si on regarde plus loin
  const end = period <= cur && period > addMonths(cur, -12) ? cur : period;
  const series = useMemo(() => balanceSeries(s, end, 12), [s, end]);
  const lateAll = useMemo(() => {
    const periodsUpTo = [...new Set(s.contributions.filter((c) => c.period <= period).map((c) => c.period))];
    return periodsUpTo.flatMap((p) => contributionRows(s, p, today).filter((r) => r.late));
  }, [s, period, today]);
  const lateTotal = lateAll.reduce((a, r) => a + r.remaining, 0);
  const bigExpenses = s.expenses.filter((e) => e.status === 'valid' && e.date.startsWith(period) && e.amount >= s.settings.largeExpenseThreshold);
  const recent = allOperations(s).filter((o) => o.item.status === 'valid').slice(0, 5);

  // Dépenses par catégorie (mois sélectionné ou année)
  const scoped = s.expenses.filter((e) => e.status === 'valid' && (scope === 'mois' ? e.date.startsWith(period) : e.date.startsWith(String(year))));
  const slices = s.categories
    .map((c) => ({ key: c.id, label: c.name, color: categoryColor(s, c.id), value: scoped.filter((e) => e.categoryId === c.id).reduce((a, e) => a + e.amount, 0) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  // Cotisations de l'année par membre
  const memberRows = useMemo(() => {
    const upTo = year === periodYear(cur) ? today : `${year}-12-31`;
    return memberTotals(s, `${year}-01-01`, upTo, today)
      .rows.filter((r) => r.expected > 0)
      .map((r) => ({ id: r.memberId, name: r.name, color: colorOfMember(s, r.memberId), paid: r.paidForPeriod, expected: r.expected, late: r.lateMonths }));
  }, [s, year, cur, today]);

  return (
    <div className="screen">
      <Card className="hero">
        <div className="hero-safe">
          <Icon name="safe" size={30} />
        </div>
        <div className="hero-l">Solde disponible en caisse</div>
        <div className={balance < 0 ? 'hero-v neg' : 'hero-v'}>
          {formatMAD(balance, false)}
          <small>MAD</small>
        </div>
        <div className="hero-s">au {fmtDate(today)}</div>
      </Card>

      {(lateAll.length > 0 || bigExpenses.length > 0 || m.closure?.matches === false) && (
        <div className="alerts">
          {lateAll.length > 0 && (
            <button className="alert a-bad" onClick={() => go('cotisations')}>
              <span className="alert-ic">
                <Icon name="alertCircle" size={22} />
              </span>
              <span>
                <b>
                  {lateAll.length} cotisation{lateAll.length > 1 ? 's' : ''} en retard — {formatMAD(lateTotal)}
                </b>
                {[...new Set(lateAll.map((r) => r.memberName))].join(', ')}
              </span>
            </button>
          )}
          {bigExpenses.map((e) => (
            <div key={e.id} className="alert a-warn">
              <span className="alert-ic">
                <Icon name="alert" size={20} />
              </span>
              <span>
                <b>Dépense importante : {formatMAD(e.amount)}</b>
                {fmtDate(e.date)} — {e.description}
              </span>
            </div>
          ))}
          {m.closure?.matches === false && (
            <div className="alert a-bad">
              <span className="alert-ic">
                <Icon name="lock" size={20} />
              </span>
              <span>
                <b>Écart sur un mois clôturé</b>Solde figé {formatMAD(m.closure.closingBalance)}, recalculé {formatMAD(m.closing)}.
              </span>
            </div>
          )}
        </div>
      )}

      <Card>
        <div className="card-h">
          <PeriodPicker value={period} onChange={setPeriod} inline />
        </div>
        <div className="kpis">
          <Kpi icon="calendar" tint="green" label="Attendu" value={mad(m.expected)} />
          <Kpi icon="checkCircle" tint="green" label="Encaissé" value={mad(m.received)} hint="reçu ce mois-ci" />
          <Kpi icon="downCircle" tint="red" label="Dépenses" value={mad(m.expenses)} />
          <Kpi icon="clock" tint="orange" label="Reste à encaisser" value={mad(m.remaining)} hint="pas encore en caisse" />
        </div>
        <button className="status-strip" style={{ width: '100%', border: 0, background: 'none', padding: 0, marginTop: 10 }} onClick={() => go('cotisations')} aria-label="Voir les cotisations du mois">
          <div className="bg-green">
            <b>{m.paidCount}</b>
            <span>payé{m.paidCount > 1 ? 's' : ''}</span>
          </div>
          <div className="bg-orange">
            <b>{m.partialCount}</b>
            <span>partiel{m.partialCount > 1 ? 's' : ''}</span>
          </div>
          <div className="bg-red">
            <b>{m.unpaidCount}</b>
            <span>non payé{m.unpaidCount > 1 ? 's' : ''}</span>
          </div>
          <Icon name="right" />
        </button>
      </Card>

      <div className="kpis">
        <Kpi icon="wallet" tint="blue" label="Ouverture" value={mad(m.opening)} hint={`clôture ${mlabel(prev.period).toLowerCase()}. ${formatMAD(prev.closing)}`} />
        <Kpi icon="safe" tint="teal" label="Clôture" value={mad(m.closing)} hint={m.closure ? 'mois clôturé' : 'provisoire'} />
        <Kpi icon="trend" tint="violet" label={`Cotisations ${year}`} value={mad(ytdReceived)} hint="depuis janvier" />
        <Kpi icon="receipt" tint="pink" label={`Dépenses ${year}`} value={mad(ytdExpenses)} hint="depuis janvier" />
      </div>

      <Card>
        <div className="card-h">
          <h3>Encaissé vs Dépenses — 12 mois</h3>
        </div>
        <MonthBars data={series.map((x) => ({ period: x.period, label: mlabel(x.period).slice(0, 4), title: periodLabel(x.period), a: x.received, b: x.expenses }))} selected={period} onSelect={setPeriod} />
        <p className="note">Touchez un mois pour afficher son détail ; touchez la légende pour masquer une série.</p>
      </Card>

      <Card>
        <div className="card-h">
          <h3>Évolution du solde</h3>
        </div>
        <BalanceLine data={series.map((x) => ({ period: x.period, label: mlabel(x.period).slice(0, 4), title: periodLabel(x.period).toLowerCase(), v: x.closing }))} selected={period} onSelect={setPeriod} />
        <p className="note">Faites glisser le doigt sur la courbe pour lire chaque fin de mois.</p>
      </Card>

      {memberRows.length > 0 && (
        <Card>
          <div className="card-h">
            <h3>Cotisations {year} par membre</h3>
            <span className="small muted">versé / attendu</span>
          </div>
          <MemberProgress rows={memberRows} />
        </Card>
      )}

      <Card>
        <div className="card-h">
          <h3>Dépenses par catégorie</h3>
          <div className="chart-tabs" role="tablist">
            <button className={scope === 'mois' ? 'on' : ''} onClick={() => setScope('mois')} role="tab" aria-selected={scope === 'mois'}>
              {mlabel(period)}
            </button>
            <button className={scope === 'annee' ? 'on' : ''} onClick={() => setScope('annee')} role="tab" aria-selected={scope === 'annee'}>
              {year}
            </button>
          </div>
        </div>
        {slices.length ? <Donut slices={slices} title={scope === 'mois' ? periodLabel(period) : String(year)} /> : <p className="empty">Aucune dépense sur la période.</p>}
      </Card>

      <div className="card-h">
        <h3 className="sec">Dernières opérations</h3>
        <button className="link" onClick={() => go('historique')}>
          Tout voir
        </button>
      </div>
      <div className="list">
        {recent.map((o) => (
          <OperationRow key={o.item.id} op={o} />
        ))}
      </div>
    </div>
  );
}
