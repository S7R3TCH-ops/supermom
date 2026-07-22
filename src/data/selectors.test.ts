import { describe, it, expect } from 'vitest';
import { toDisplayJob } from './selectors';

// toDisplayJob no longer does its own worker lookup — jobsRepo's decorateJob
// already attaches `workers` (job_workers rows) plus derived `worker_id` /
// `worker_name` / `worker_pay` / `worker_paid` / `assignee_type` onto the raw
// job row before it reaches here. These tests lock that pass-through contract.

describe('toDisplayJob — worker fields', () => {
  it('defaults to empty/null worker fields when no workers are assigned', () => {
    const d = toDisplayJob({ id: 'j1', workers: [] })!;
    expect(d.workers).toEqual([]);
    expect(d.worker_id).toBeNull();
    expect(d.worker_name).toBeNull();
    expect(d.worker_pay).toBeNull();
    expect(d.worker_paid).toBe(false);
    expect(d.assignee_type).toBeNull();
  });

  it('passes through the assigned worker fields already attached to the job row', () => {
    const d = toDisplayJob({
      id: 'j1',
      worker_id: 'w1',
      worker_name: 'Jane',
      worker_pay: 75,
      worker_paid: true,
      assignee_type: 'worker',
      workers: [{ id: 'jw1', worker_id: 'w1', name: 'Jane', person_type: 'worker', pay: 75, paid: true, paid_at: '2026-07-20' }],
    })!;
    expect(d.worker_id).toBe('w1');
    expect(d.worker_name).toBe('Jane');
    expect(d.worker_pay).toBe(75);
    expect(d.worker_paid).toBe(true);
    expect(d.assignee_type).toBe('worker');
    expect(d.workers).toHaveLength(1);
    expect(d.workers[0].name).toBe('Jane');
  });

  it('handles a job row with no workers field at all (defensive default)', () => {
    const d = toDisplayJob({ id: 'j1' })!;
    expect(d.workers).toEqual([]);
    expect(d.worker_paid).toBe(false);
  });
});
