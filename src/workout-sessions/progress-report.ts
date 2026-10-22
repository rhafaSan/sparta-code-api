import 'temporal-polyfill/global';
import 'temporal-polyfill/types/global';
import { BadRequestException } from '@nestjs/common';
import type {
  ProgressMetrics,
  ProgressPeriod,
  ProgressReport,
  ProgressReportQueryDto,
} from './dto/progress-report.dto.js';

export interface ReportExecution {
  workoutSessionId: string;
  startedAt: Temporal.Instant;
  exerciseId: string;
  exerciseName: string;
  sets: { weight: string | null; reps: number | null; completed: boolean }[];
}

// Weights stay exact: coefficients are integers, scales are decimal places.
interface Decimal {
  coefficient: bigint;
  scale: number;
}

function decimal(value: string): Decimal {
  const [whole, fraction = ''] = value.split('.');
  return { coefficient: BigInt(whole + fraction), scale: fraction.length };
}

function power(scale: number) {
  return 10n ** BigInt(scale);
}

function compare(left: Decimal, right: Decimal) {
  return (
    left.coefficient * power(right.scale) -
    right.coefficient * power(left.scale)
  );
}

// Round only at the HTTP boundary, half away from zero, to two places.
function roundedRatio(numerator: bigint, denominator: bigint): string {
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const rounded = (absolute * 100n + denominator / 2n) / denominator;
  return `${negative && rounded !== 0n ? '-' : ''}${rounded / 100n}.${String(rounded % 100n).padStart(2, '0')}`;
}

interface Metrics {
  sessionIds: Set<string>;
  completedSets: number;
  totalReps: bigint;
  setsWithReps: bigint;
  maxWeight: string | null;
}

function emptyMetrics(): Metrics {
  return {
    sessionIds: new Set(),
    completedSets: 0,
    totalReps: 0n,
    setsWithReps: 0n,
    maxWeight: null,
  };
}

function addSet(
  metrics: Metrics,
  sessionId: string,
  set: ReportExecution['sets'][number],
) {
  metrics.sessionIds.add(sessionId);
  metrics.completedSets++;
  if (set.reps !== null) {
    metrics.totalReps += BigInt(set.reps);
    metrics.setsWithReps++;
  }
  if (
    set.weight !== null &&
    (metrics.maxWeight === null ||
      compare(decimal(set.weight), decimal(metrics.maxWeight)) > 0n)
  ) {
    metrics.maxWeight = set.weight;
  }
}

function serialize(metrics: Metrics): ProgressMetrics {
  return {
    workoutSessions: metrics.sessionIds.size,
    completedSets: metrics.completedSets,
    totalReps: String(metrics.totalReps),
    averageReps: metrics.setsWithReps
      ? roundedRatio(metrics.totalReps, metrics.setsWithReps)
      : null,
    maxWeight: metrics.maxWeight,
  };
}

function progression(first: Metrics | undefined, last: Metrics | undefined) {
  let weightPercent: string | null = null;
  let repsPercent: string | null = null;
  if (first && last && first !== last) {
    if (first.maxWeight !== null && last.maxWeight !== null) {
      const before = decimal(first.maxWeight);
      const after = decimal(last.maxWeight);
      if (before.coefficient > 0n) {
        weightPercent = roundedRatio(
          compare(after, before) * 100n,
          before.coefficient * power(after.scale),
        );
      }
    }
    if (first.totalReps > 0n && first.setsWithReps && last.setsWithReps) {
      repsPercent = roundedRatio(
        (last.totalReps * first.setsWithReps -
          first.totalReps * last.setsWithReps) *
          100n,
        first.totalReps * last.setsWithReps,
      );
    }
  }
  return { weightPercent, repsPercent };
}

export function reportRange(query: ProgressReportQueryDto) {
  try {
    const startDate = Temporal.PlainDate.from(query.startDate);
    const endDate = Temporal.PlainDate.from(query.endDate);
    if (Temporal.PlainDate.compare(startDate, endDate) > 0)
      throw new RangeError('Reversed range');
    // Upper bound is exclusive, so the entire final local date is included.
    const start = startDate.toZonedDateTime(query.timeZone).toInstant();
    const end = endDate
      .add({ days: 1 })
      .toZonedDateTime(query.timeZone)
      .toInstant();
    return { startDate, endDate, start, end };
  } catch {
    throw new BadRequestException('Invalid dates, date range or timeZone');
  }
}

export function buildProgressReport(
  userId: string,
  query: ProgressReportQueryDto,
  executions: ReportExecution[],
): ProgressReport {
  const { startDate, endDate, start, end } = reportRange(query);
  const periods: ProgressPeriod[] = [];
  for (
    let cursor = startDate;
    Temporal.PlainDate.compare(cursor, endDate) <= 0;
  ) {
    const next =
      query.groupBy === 'month'
        ? cursor.with({ day: 1 }).add({ months: 1 })
        : cursor.add({ days: 8 - cursor.dayOfWeek });
    const last = next.subtract({ days: 1 });
    periods.push({
      startDate: cursor.toString(),
      endDate: (Temporal.PlainDate.compare(last, endDate) > 0
        ? endDate
        : last
      ).toString(),
    });
    cursor = next;
  }

  const totals = emptyMetrics();
  const exercises = new Map<
    string,
    {
      exerciseName: string;
      totals: Metrics;
      periods: Metrics[];
    }
  >();
  for (const execution of executions) {
    if (
      Temporal.Instant.compare(execution.startedAt, start) < 0 ||
      Temporal.Instant.compare(execution.startedAt, end) >= 0
    )
      continue;
    const sets = execution.sets.filter((set) => set.completed);
    if (!sets.length) continue;
    const localDate = execution.startedAt
      .toZonedDateTimeISO(query.timeZone)
      .toPlainDate()
      .toString();
    const index = periods.findIndex(
      (period) => localDate >= period.startDate && localDate <= period.endDate,
    );
    let exercise = exercises.get(execution.exerciseId);
    if (!exercise) {
      exercise = {
        exerciseName: execution.exerciseName,
        totals: emptyMetrics(),
        periods: periods.map(emptyMetrics),
      };
      exercises.set(execution.exerciseId, exercise);
    }
    for (const set of sets) {
      addSet(totals, execution.workoutSessionId, set);
      addSet(exercise.totals, execution.workoutSessionId, set);
      addSet(exercise.periods[index], execution.workoutSessionId, set);
    }
  }

  return {
    userId,
    startDate: query.startDate,
    endDate: query.endDate,
    timeZone: query.timeZone,
    groupBy: query.groupBy,
    periods,
    totals: serialize(totals),
    exercises: [...exercises]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([exerciseId, exercise]) => {
        const populated = exercise.periods.flatMap((metrics, index) =>
          metrics.completedSets ? [index] : [],
        );
        const first = populated[0];
        const last = populated.at(-1);
        return {
          exerciseId,
          exerciseName: exercise.exerciseName,
          totals: serialize(exercise.totals),
          periods: periods.map((period, index) => ({
            ...period,
            metrics: serialize(exercise.periods[index]),
          })),
          progression: {
            fromPeriodStart:
              first === undefined ? null : periods[first].startDate,
            toPeriodStart: last === undefined ? null : periods[last].startDate,
            ...progression(
              first === undefined ? undefined : exercise.periods[first],
              last === undefined ? undefined : exercise.periods[last],
            ),
          },
        };
      }),
  };
}
