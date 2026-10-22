import { BadRequestException } from '@nestjs/common';
import { ProgressReportQueryDto } from './dto/progress-report.dto.js';
import {
  buildProgressReport,
  reportRange,
  type ReportExecution,
} from './progress-report.js';

describe('Progress report calculations', () => {
  const query = (values: Partial<ProgressReportQueryDto> = {}) =>
    Object.assign(new ProgressReportQueryDto(), {
      startDate: '2026-09-07',
      endDate: '2026-10-04',
      ...values,
    });
  const execution = (
    date: string,
    weight: string | null,
    reps: number | null,
    sessionId = date,
  ): ReportExecution => ({
    workoutSessionId: sessionId,
    startedAt: Temporal.Instant.from(date),
    exerciseId: 'exercise-a',
    exerciseName: 'Supino',
    sets: [{ weight, reps, completed: true }],
  });

  it('compares exact load and average reps, merges repeated exercises and preserves empty weeks', () => {
    const rows = [
      execution('2026-09-07T03:00:00Z', '80.25', 10, 'first'),
      execution('2026-09-07T03:00:00Z', '70', 8, 'first'),
      execution('2026-10-05T02:59:59.999999999Z', '90.28125', 12),
    ];
    const report = buildProgressReport('user', query(), rows);
    expect(report.exercises).toHaveLength(1);
    expect(report.totals).toEqual({
      workoutSessions: 2,
      completedSets: 3,
      totalReps: '30',
      averageReps: '10.00',
      maxWeight: '90.28125',
    });
    expect(report.periods).toEqual([
      { startDate: '2026-09-07', endDate: '2026-09-13' },
      { startDate: '2026-09-14', endDate: '2026-09-20' },
      { startDate: '2026-09-21', endDate: '2026-09-27' },
      { startDate: '2026-09-28', endDate: '2026-10-04' },
    ]);
    expect(report.exercises[0].periods[1].metrics).toEqual({
      workoutSessions: 0,
      completedSets: 0,
      totalReps: '0',
      averageReps: null,
      maxWeight: null,
    });
    expect(report.exercises[0].progression).toEqual({
      fromPeriodStart: '2026-09-07',
      toPeriodStart: '2026-09-28',
      weightPercent: '12.50',
      repsPercent: '33.33',
    });
  });

  it('handles decreases, very precise weights and rounding without floating point', () => {
    const report = buildProgressReport('user', query(), [
      execution(
        '2026-09-07T12:00Z',
        '100000000000000000000000000000.00000001',
        12,
      ),
      execution(
        '2026-09-28T12:00Z',
        '75000000000000000000000000000.0000000075',
        8,
      ),
    ]);
    expect(report.exercises[0].progression).toMatchObject({
      weightPercent: '-25.00',
      repsPercent: '-33.33',
    });
    expect(report.totals.maxWeight).toBe(
      '100000000000000000000000000000.00000001',
    );
  });

  it('uses unrounded averages in percentage calculations', () => {
    const first = execution('2026-09-07T12:00Z', '1.0', 1);
    first.sets.push(
      { weight: '1', reps: 0, completed: true },
      { weight: '1', reps: 0, completed: true },
    );
    const report = buildProgressReport('user', query(), [
      first,
      execution('2026-09-28T12:00Z', '1.005', 1),
    ]);
    expect(report.exercises[0].periods[0].metrics.averageReps).toBe('0.33');
    expect(report.exercises[0].progression).toMatchObject({
      weightPercent: '0.50',
      repsPercent: '200.00',
    });
  });

  it('does not invent progression for one interval or a zero baseline', () => {
    const first = execution('2026-09-07T12:00Z', '0', 0);
    const single = buildProgressReport('user', query(), [first]);
    expect(single.exercises[0].progression).toMatchObject({
      weightPercent: null,
      repsPercent: null,
    });
    const report = buildProgressReport('user', query(), [
      first,
      execution('2026-09-28T12:00Z', '20', 10),
    ]);
    expect(report.exercises[0].progression).toMatchObject({
      weightPercent: null,
      repsPercent: null,
    });
  });

  it('counts legacy nulls separately, includes zero, and ignores incomplete sets', () => {
    const first = execution('2026-09-07T12:00Z', null, 10);
    first.sets.push(
      { weight: '80', reps: null, completed: true },
      { weight: '999', reps: 999, completed: false },
    );
    const last = execution('2026-09-28T12:00Z', '0', 0);
    const report = buildProgressReport('user', query(), [first, last]);
    expect(report.totals).toMatchObject({
      completedSets: 3,
      totalReps: '10',
      averageReps: '5.00',
      maxWeight: '80',
    });
    expect(report.exercises[0].progression).toMatchObject({
      weightPercent: '-100.00',
      repsPercent: '-100.00',
    });
    const missing = buildProgressReport('user', query(), [
      execution('2026-09-07T12:00Z', null, null),
      last,
    ]);
    expect(missing.exercises[0].progression).toMatchObject({
      weightPercent: null,
      repsPercent: null,
    });
  });

  it('clips calendar months, crosses years and includes a leap day', () => {
    const report = buildProgressReport(
      'user',
      query({
        startDate: '2023-12-20',
        endDate: '2024-03-05',
        groupBy: 'month',
      }),
      [],
    );
    expect(report.periods).toEqual([
      { startDate: '2023-12-20', endDate: '2023-12-31' },
      { startDate: '2024-01-01', endDate: '2024-01-31' },
      { startDate: '2024-02-01', endDate: '2024-02-29' },
      { startDate: '2024-03-01', endDate: '2024-03-05' },
    ]);
    expect(report.exercises).toEqual([]);
    expect(report.totals).toMatchObject({
      completedSets: 0,
      averageReps: null,
      maxWeight: null,
    });
  });

  it('applies local date boundaries and daylight saving, including single-day ranges', () => {
    const settings = query({
      startDate: '2026-03-08',
      endDate: '2026-03-08',
      timeZone: 'America/New_York',
    });
    const range = reportRange(settings);
    expect(range.start.toString()).toBe('2026-03-08T05:00:00Z');
    expect(range.end.toString()).toBe('2026-03-09T04:00:00Z');
    const report = buildProgressReport('user', settings, [
      execution('2026-03-08T04:59:59Z', '999', 999),
      execution('2026-03-08T05:00:00Z', '10', 10),
      execution('2026-03-09T03:59:59Z', '20', 20),
      execution('2026-03-09T04:00:00Z', '999', 999),
    ]);
    expect(report.totals).toMatchObject({
      completedSets: 2,
      totalReps: '30',
      maxWeight: '20',
    });
    expect(report.periods).toEqual([
      { startDate: '2026-03-08', endDate: '2026-03-08' },
    ]);
  });

  it.each([
    { startDate: '2026-09-30', endDate: '2026-09-01' },
    { startDate: '2026-02-30' },
    { timeZone: 'invalid/zone' },
  ])('rejects invalid ranges: %j', (values) => {
    expect(() => reportRange(query(values))).toThrow(BadRequestException);
  });
});
