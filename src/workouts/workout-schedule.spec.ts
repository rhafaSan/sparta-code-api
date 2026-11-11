import { localWorkoutDay } from './workout-schedule.service.js';

describe('Workout day in the client time zone', () => {
  it.each([
    ['2026-11-09T02:59:59Z', 'America/Sao_Paulo', '2026-11-08', 7],
    ['2026-11-09T03:00:00Z', 'America/Sao_Paulo', '2026-11-09', 1],
    ['2026-11-09T02:59:59Z', 'UTC', '2026-11-09', 1],
    ['2027-01-01T01:00:00Z', 'America/Sao_Paulo', '2026-12-31', 4],
    ['2026-03-08T06:59:59Z', 'America/New_York', '2026-03-08', 7],
    ['2026-03-08T07:00:00Z', 'America/New_York', '2026-03-08', 7],
    ['2026-11-08T15:00:00Z', 'Asia/Tokyo', '2026-11-09', 1],
  ])('resolves %s in %s', (instant, zone, date, dayOfWeek) => {
    expect(localWorkoutDay(new Date(instant), zone)).toEqual({
      date,
      dayOfWeek,
    });
  });
});
