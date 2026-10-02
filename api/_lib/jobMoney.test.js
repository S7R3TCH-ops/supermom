import { describe, it, expect } from 'vitest';
import { buildHoursPatch, computeMoney } from './jobMoney.js';
import { buildFinancialPatch } from '../../src/lib/jobDraftPolicy.js';

// jobMoney.js mirrors the app's single money writer (buildFinancialPatch) for
// the voice duration edit. These cases pin the two together: if the app's math
// changes and this mirror doesn't, this fails.
const biz = (over = {}) => ({ hst_rate: 0.13, tax_enabled: false, hourly_rate: 60, ...over });
const job = (over = {}) => ({
  pricing_type: 'Hourly',
  flat_rate: 60,
  additional_costs_json: [],
  tax_enabled: null,
  ...over,
});

const MONEY = ['subtotal', 'hst_amount', 'total_amount'];
function appPatch(j, b, hours) {
  const taxEnabled = j.tax_enabled ?? b.tax_enabled;
  return buildFinancialPatch(
    {
      pricing_type: j.pricing_type,
      rate: j.flat_rate,
      hours,
      additionalCosts: j.additional_costs_json,
      taxEnabled,
    },
    b,
  );
}

describe('jobMoney parity with buildFinancialPatch', () => {
  const cases = [
    ['hourly, no tax', job(), biz(), 2.5],
    ['hourly, business tax on (inherit)', job(), biz({ tax_enabled: true }), 3],
    ['hourly, per-job tax on over business off', job({ tax_enabled: true }), biz(), 1.75],
    ['hourly, per-job tax off over business on', job({ tax_enabled: false }), biz({ tax_enabled: true }), 4],
    ['hourly with extras and tax', job({ additional_costs_json: [{ amount: 12.5, description: 'supplies' }, { amount: 0, description: 'x' }], tax_enabled: true }), biz(), 2],
    ['hourly odd rate', job({ flat_rate: 47.33 }), biz({ tax_enabled: true }), 2.25],
    ['flat fee, no tax', job({ pricing_type: 'Flat', flat_rate: 150 }), biz(), 5],
    ['flat fee with extras and tax', job({ pricing_type: 'Flat', flat_rate: 150, additional_costs_json: [{ amount: 20 }], tax_enabled: true }), biz(), 0.5],
    ['non-default hst rate', job({ tax_enabled: true }), biz({ hst_rate: 0.15 }), 3],
  ];
  it.each(cases)('%s', (_name, j, b, hours) => {
    const mine = buildHoursPatch(j, b, hours);
    const app = appPatch(j, b, hours);
    for (const k of MONEY) expect(mine[k], k).toBe(app[k]);
    expect(mine.estimated_hours).toBe(app.estimated_hours);
  });

  it('only returns hours + the money triple (never rate, pricing, tax override or costs)', () => {
    expect(Object.keys(buildHoursPatch(job(), biz(), 2)).sort()).toEqual(
      ['estimated_hours', 'hst_amount', 'subtotal', 'total_amount'],
    );
  });

  it('falls back to the legacy scalar additional_cost when no json array exists', () => {
    const m = computeMoney({ pricing_type: 'Hourly', flat_rate: 60, additional_cost: 10, tax_enabled: false }, biz(), 2);
    expect(m.total_amount).toBe(130);
  });
});
