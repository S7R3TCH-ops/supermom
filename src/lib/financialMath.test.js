import { describe, it, expect } from 'vitest';
import { computeJobFinancials, computeJobTotal, computeJobSubtotal } from './financialMath';

// Field conventions under test (CLAUDE.md): flat_rate stores $/hr for Hourly
// jobs; tax_enabled is nullable (null = inherit from business); completed jobs
// bill actual_duration, scheduled jobs bill estimated_hours.

describe('computeJobFinancials — hourly jobs', () => {
  it('bills actual_duration × flat_rate ($/hr) for completed jobs', () => {
    const f = computeJobFinancials({
      pricing_type: 'Hourly', job_status: 'Completed',
      actual_duration: 3, estimated_hours: 2, flat_rate: 50,
    });
    expect(f.isHourly).toBe(true);
    expect(f.hours).toBe(3);
    expect(f.rate).toBe(50);
    expect(f.subtotal).toBe(150);
  });

  it('bills estimated_hours for jobs not yet completed', () => {
    const f = computeJobFinancials({
      pricing_type: 'Hourly', job_status: 'Scheduled',
      estimated_hours: 2, flat_rate: 60,
    });
    expect(f.subtotal).toBe(120);
  });

  it('falls back to estimated_hours when a completed job never recorded actual_duration', () => {
    const f = computeJobFinancials({
      pricing_type: 'Hourly', job_status: 'Completed',
      actual_duration: null, estimated_hours: 2.5, flat_rate: 40,
    });
    expect(f.subtotal).toBe(100);
  });

  it('falls back to business hourly_rate, then to 60, when the job has no rate', () => {
    const withBiz = computeJobFinancials(
      { pricing_type: 'Hourly', estimated_hours: 2 },
      { hourly_rate: 80 }
    );
    expect(withBiz.subtotal).toBe(160);

    const bare = computeJobFinancials({ pricing_type: 'Hourly', estimated_hours: 2 });
    expect(bare.rate).toBe(60);
    expect(bare.subtotal).toBe(120);
  });

  it('coerces numeric strings and treats garbage as 0/default', () => {
    const strings = computeJobFinancials({
      pricing_type: 'Hourly', estimated_hours: '2', flat_rate: '55',
    });
    expect(strings.subtotal).toBe(110);

    const garbage = computeJobFinancials({
      pricing_type: 'Hourly', estimated_hours: 'abc', flat_rate: 'xyz',
    });
    expect(garbage.hours).toBe(0);
    expect(garbage.rate).toBe(60);
    expect(garbage.subtotal).toBe(0);
  });

  it('unwraps display objects via job.raw (toDisplayJob shape)', () => {
    const f = computeJobFinancials({
      raw: { pricing_type: 'Hourly', job_status: 'Completed', actual_duration: 4, flat_rate: 45 },
    });
    expect(f.subtotal).toBe(180);
  });
});

describe('computeJobFinancials — flat jobs', () => {
  it('uses flat_rate as the flat fee, ignoring hours', () => {
    const f = computeJobFinancials({
      pricing_type: 'Flat', estimated_hours: 5, flat_rate: 200,
    });
    expect(f.isHourly).toBe(false);
    expect(f.subtotal).toBe(200);
  });

  it('falls back to stored subtotal when flat_rate is missing', () => {
    const f = computeJobFinancials({ pricing_type: 'Flat', subtotal: 175 });
    expect(f.subtotal).toBe(175);
  });
});

describe('computeJobFinancials — additional costs', () => {
  it('sums additional_costs_json items', () => {
    const f = computeJobFinancials({
      pricing_type: 'Flat', flat_rate: 100,
      additional_costs_json: [{ amount: 12.5 }, { amount: '7.5', description: 'supplies' }],
    });
    expect(f.additionalTotal).toBe(20);
    expect(f.total).toBe(120);
  });

  it('falls back to the legacy additional_cost scalar', () => {
    const f = computeJobFinancials({
      pricing_type: 'Flat', flat_rate: 100,
      additional_cost: 15, additional_cost_notes: 'parking',
    });
    expect(f.additionalTotal).toBe(15);
    expect(f.activeCosts).toEqual([{ amount: 15, description: 'parking' }]);
  });

  it('ignores non-numeric cost amounts', () => {
    const f = computeJobFinancials({
      pricing_type: 'Flat', flat_rate: 100,
      additional_costs_json: [{ amount: 'oops' }, { amount: 10 }],
    });
    expect(f.additionalTotal).toBe(10);
  });
});

describe('computeJobFinancials — tax resolution', () => {
  const biz = { hst_rate: 0.13, tax_enabled: true };

  it('per-job tax_enabled=true applies HST on subtotal + additional costs', () => {
    const f = computeJobFinancials(
      { pricing_type: 'Flat', flat_rate: 100, additional_costs_json: [{ amount: 20 }], tax_enabled: true },
      { hst_rate: 0.13 }
    );
    expect(f.taxEnabled).toBe(true);
    expect(f.taxAmount).toBeCloseTo(15.6, 10); // (100+20) * 0.13
    expect(f.total).toBeCloseTo(135.6, 10);
  });

  it('null tax_enabled inherits from the business', () => {
    const f = computeJobFinancials({ pricing_type: 'Flat', flat_rate: 100, tax_enabled: null }, biz);
    expect(f.taxEnabled).toBe(true);
    expect(f.taxAmount).toBeCloseTo(13, 10);
  });

  it('per-job tax_enabled=false overrides a tax-enabled business', () => {
    const f = computeJobFinancials({ pricing_type: 'Flat', flat_rate: 100, tax_enabled: false }, biz);
    expect(f.taxEnabled).toBe(false);
    expect(f.taxAmount).toBe(0);
    expect(f.total).toBe(100);
  });

  it('with no business and no override, uses the stored hst_amount (legacy completed jobs)', () => {
    const f = computeJobFinancials({ pricing_type: 'Flat', flat_rate: 100, hst_amount: 13 });
    expect(f.taxEnabled).toBe(true);
    expect(f.taxAmount).toBe(13);
    expect(f.total).toBe(113);
  });

  it('defaults the HST rate to 0.13 when the business has none', () => {
    const f = computeJobFinancials({ pricing_type: 'Flat', flat_rate: 100, tax_enabled: true }, {});
    expect(f.taxRate).toBe(0.13);
  });
});

describe('convenience wrappers', () => {
  const job = {
    pricing_type: 'Hourly', job_status: 'Completed',
    actual_duration: 2, flat_rate: 50,
    additional_costs_json: [{ amount: 10 }],
    hst_amount: 14.3, // legacy stored HST — applies with no business context
  };

  it('computeJobTotal includes HST', () => {
    expect(computeJobTotal(job)).toBeCloseTo(124.3, 10); // 100 + 10 + 14.30
  });

  it('computeJobSubtotal excludes HST', () => {
    expect(computeJobSubtotal(job)).toBe(110);
  });

  it('workers[].pay is informational only — never added to the client total', () => {
    const f = computeJobFinancials({ ...job, workers: [{ pay: 40 }] });
    expect(f.workerCost).toBe(40);
    expect(f.total).toBeCloseTo(124.3, 10);
  });

  it('sums pay across multiple assigned workers', () => {
    const f = computeJobFinancials({ ...job, workers: [{ pay: 40 }, { pay: 25 }] });
    expect(f.workerCost).toBe(65);
  });

  it('workerCost is 0 when no workers are assigned', () => {
    const f = computeJobFinancials({ ...job, workers: [] });
    expect(f.workerCost).toBe(0);
    const noField = computeJobFinancials(job);
    expect(noField.workerCost).toBe(0);
  });

  it('ignores non-numeric worker pay entries', () => {
    const f = computeJobFinancials({ ...job, workers: [{ pay: 'oops' }, { pay: 30 }] });
    expect(f.workerCost).toBe(30);
  });
});
