import { describe, it, expect } from 'vitest';
import {
  deriveJobStage,
  getFieldPolicy,
  getPolicyMessage,
  validateJobDraft,
  validatePaymentAmount,
  buildFinancialPatch,
  MONEY_FIELDS,
} from './jobDraftPolicy';

describe('deriveJobStage', () => {
  it('scheduled job with no payments and no invoice', () => {
    const s = deriveJobStage({ job_status: 'Scheduled', payment_status: '' });
    expect(s).toEqual({ stage: 'scheduled', hasInvoice: false, paidSum: 0 });
  });

  it('scheduled job with a prepayment', () => {
    const s = deriveJobStage({ job_status: 'Scheduled', payment_status: 'Partial' }, [{ amount: 50 }]);
    expect(s.stage).toBe('scheduled_prepaid');
    expect(s.paidSum).toBe(50);
  });

  it('ignores voided payments', () => {
    const s = deriveJobStage({ job_status: 'Scheduled', payment_status: '' }, [{ amount: 50, is_void: true }]);
    expect(s.stage).toBe('scheduled');
    expect(s.paidSum).toBe(0);
  });

  it('completed but not fully paid', () => {
    const s = deriveJobStage({ job_status: 'Completed', payment_status: 'Partial' }, [{ amount: 20 }]);
    expect(s.stage).toBe('completed_owing');
  });

  it('paid wins over completed', () => {
    const s = deriveJobStage({ job_status: 'Completed', payment_status: 'Paid' }, [{ amount: 100 }]);
    expect(s.stage).toBe('paid');
  });

  it('cancelled wins over everything', () => {
    const s = deriveJobStage({ job_status: 'Cancelled', payment_status: 'Paid' });
    expect(s.stage).toBe('cancelled');
  });

  it('unwraps display-object .raw like financialMath does', () => {
    const s = deriveJobStage({ raw: { job_status: 'Completed', payment_status: 'Paid' } });
    expect(s.stage).toBe('paid');
  });

  it('flags hasInvoice from invoiceId', () => {
    const s = deriveJobStage({ job_status: 'Scheduled' }, [], 'inv-1');
    expect(s.hasInvoice).toBe(true);
  });
});

describe('getFieldPolicy', () => {
  it('scheduled: everything editable except identity/completion', () => {
    expect(getFieldPolicy('scheduled')).toEqual({
      identity: 'locked', schedule: 'open', financial: 'open', completion: 'locked', notes: 'open',
    });
  });

  it('paid: financial and completion need override, schedule stays open (Joel #3)', () => {
    const p = getFieldPolicy('paid');
    expect(p.financial).toBe('override');
    expect(p.completion).toBe('override');
    expect(p.schedule).toBe('open');
  });

  it('cancelled: locked except notes', () => {
    const p = getFieldPolicy('cancelled');
    expect(p.schedule).toBe('locked');
    expect(p.financial).toBe('locked');
    expect(p.notes).toBe('open');
  });

  it('an invoice escalates financial open → warn', () => {
    expect(getFieldPolicy('scheduled', true).financial).toBe('warn');
    expect(getFieldPolicy('completed_owing', true).financial).toBe('warn');
  });

  it('an invoice never downgrades override or locked', () => {
    expect(getFieldPolicy('paid', true).financial).toBe('override');
    expect(getFieldPolicy('cancelled', true).financial).toBe('locked');
  });
});

describe('getPolicyMessage', () => {
  it('null when nothing to warn about', () => {
    expect(getPolicyMessage('scheduled')).toBeNull();
  });
  it('mentions the paid amount on prepaid warn', () => {
    expect(getPolicyMessage('scheduled_prepaid', false, 50)).toContain('$50.00');
  });
  it('mentions the invoice on paid override', () => {
    expect(getPolicyMessage('paid', true)).toContain('invoice');
  });
});

describe('validateJobDraft', () => {
  const valid = {
    client_id: 'c1', service_id: 's1',
    scheduled_date: '2026-07-14', scheduled_time: '10:00',
    hours: 2, rate: 60,
    additionalCosts: [{ amount: '10', description: 'Parking' }],
  };

  it('passes a complete draft', () => {
    expect(validateJobDraft(valid).ok).toBe(true);
  });

  it('requires client, service, date, time, duration', () => {
    const { ok, errors } = validateJobDraft({});
    expect(ok).toBe(false);
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(['client_id', 'service_id', 'scheduled_date', 'scheduled_time', 'hours'])
    );
  });

  it('can exempt client/service for the completion sheet', () => {
    const { errors } = validateJobDraft(
      { scheduled_date: '2026-07-14', scheduled_time: '10:00', hours: 1 },
      { requireClient: false, requireService: false }
    );
    expect(errors).toEqual({});
  });

  it('rejects zero or negative duration', () => {
    expect(validateJobDraft({ ...valid, hours: 0 }).errors.hours).toBeTruthy();
    expect(validateJobDraft({ ...valid, hours: -1 }).errors.hours).toBeTruthy();
  });

  it('rejects a negative rate but allows $0', () => {
    expect(validateJobDraft({ ...valid, rate: -5 }).errors.rate).toBeTruthy();
    expect(validateJobDraft({ ...valid, rate: 0 }).ok).toBe(true);
  });

  it('ignores blank cost rows, rejects negative ones', () => {
    expect(validateJobDraft({ ...valid, additionalCosts: [{ amount: '', description: '' }] }).ok).toBe(true);
    expect(validateJobDraft({ ...valid, additionalCosts: [{ amount: '-3' }] }).errors.additionalCosts).toBeTruthy();
  });
});

describe('validatePaymentAmount', () => {
  it('rejects zero, negative, and non-numeric', () => {
    expect(validatePaymentAmount(0, 100).ok).toBe(false);
    expect(validatePaymentAmount(-5, 100).ok).toBe(false);
    expect(validatePaymentAmount('abc', 100).ok).toBe(false);
  });

  it('allows overpayment and reports the amount over (tips — Joel #2)', () => {
    const r = validatePaymentAmount(120, 100);
    expect(r.ok).toBe(true);
    expect(r.overpay).toBe(20);
  });

  it('no overpay flag at or below the balance', () => {
    expect(validatePaymentAmount(100, 100).overpay).toBe(0);
    expect(validatePaymentAmount(40, 100).overpay).toBe(0);
  });
});

describe('buildFinancialPatch', () => {
  const business = { hst_rate: 0.13, tax_enabled: true };

  it('hourly: total is always rate × hours + costs + HST — never free-typed (Joel #1)', () => {
    const p = buildFinancialPatch({
      pricing_type: 'Hourly', rate: 60, hours: 2,
      additionalCosts: [{ amount: '10', description: 'Supplies' }],
      taxEnabled: true,
    }, business);
    expect(p.flat_rate).toBe(60);          // $/hr convention (CLAUDE.md)
    expect(p.estimated_hours).toBe(2);
    expect(p.subtotal).toBe(120);          // base labor only
    expect(p.additional_cost).toBe(10);
    expect(p.hst_amount).toBe(16.9);       // (120 + 10) × 0.13
    expect(p.total_amount).toBe(146.9);
  });

  it('flat: rate is the fee, total = fee + costs + HST', () => {
    const p = buildFinancialPatch({
      pricing_type: 'Flat', rate: 200, hours: 3, additionalCosts: [], taxEnabled: true,
    }, business);
    expect(p.subtotal).toBe(200);
    expect(p.hst_amount).toBe(26);
    expect(p.total_amount).toBe(226);
  });

  it('tax off: hst_amount 0, total = subtotal + costs', () => {
    const p = buildFinancialPatch({
      pricing_type: 'Hourly', rate: 50, hours: 2,
      additionalCosts: [{ amount: 5, description: '' }],
      taxEnabled: false,
    }, business);
    expect(p.hst_amount).toBe(0);
    expect(p.total_amount).toBe(105);
  });

  it('completed jobs bill actualHours while estimated_hours keeps the form value', () => {
    const p = buildFinancialPatch({
      pricing_type: 'Hourly', rate: 60, hours: 2, actualHours: 3,
      additionalCosts: [], taxEnabled: false,
    }, business);
    expect(p.estimated_hours).toBe(2);
    expect(p.subtotal).toBe(180);          // billed on actual 3h
    expect(p.total_amount).toBe(180);
  });

  it('drops blank/zero cost rows and joins descriptions into notes', () => {
    const p = buildFinancialPatch({
      pricing_type: 'Flat', rate: 100, hours: 1, taxEnabled: false,
      additionalCosts: [
        { amount: '', description: 'blank' },
        { amount: '0', description: 'zero' },
        { amount: '12.5', description: 'Parking' },
        { amount: 7, description: 'Tolls' },
      ],
    }, business);
    expect(p.additional_costs_json).toHaveLength(2);
    expect(p.additional_cost).toBe(19.5);
    expect(p.additional_cost_notes).toBe('Parking; Tolls');
    expect(p.total_amount).toBe(119.5);
  });

  it('no business defaults to 13% HST when tax is on', () => {
    const p = buildFinancialPatch({ pricing_type: 'Flat', rate: 100, hours: 1, taxEnabled: true }, null);
    expect(p.hst_amount).toBe(13);
  });

  it('MONEY_FIELDS covers every column the patch writes that affects totals', () => {
    const p = buildFinancialPatch({ pricing_type: 'Flat', rate: 1, hours: 1, taxEnabled: false }, null);
    for (const k of Object.keys(p)) {
      if (k === 'additional_cost_notes') continue; // display-only
      expect(MONEY_FIELDS).toContain(k);
    }
  });
});
