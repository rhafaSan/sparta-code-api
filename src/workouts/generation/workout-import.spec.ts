import { jest } from '@jest/globals';
import { workoutImportSource } from './workout-import.controller.js';
import { GeminiWorkoutProvider } from './gemini-workout.provider.js';

describe('Workout sheet input', () => {
  it('accepts pasted text, UTF-8 TXT and PDF', () => {
    expect(workoutImportSource({ text: ' Treino A ' })).toBe('Treino A');
    expect(
      workoutImportSource(
        {},
        {
          originalname: 'ficha.txt',
          mimetype: 'text/plain',
          buffer: Buffer.from('Supino 3x10'),
        },
      ),
    ).toBe('Supino 3x10');
    const pdf = Buffer.from('%PDF-1.7');
    expect(
      workoutImportSource(
        {},
        { originalname: 'ficha.pdf', mimetype: 'application/pdf', buffer: pdf },
      ),
    ).toBe(pdf);
  });
  it('rejects missing, ambiguous, oversized and invalid inputs', () => {
    for (const text of ['', '  ', 'x'.repeat(30001)])
      expect(() => workoutImportSource({ text })).toThrow();
    expect(() => workoutImportSource({})).toThrow();
    const file = {
      originalname: 'ficha.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('invalid'),
    };
    expect(() => workoutImportSource({ text: 'Treino' }, file)).toThrow();
    for (const invalid of [
      file,
      { ...file, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
      { ...file, buffer: Buffer.alloc(0) },
      { ...file, originalname: 'a.exe' },
      {
        originalname: 'a.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from([0xff]),
      },
      {
        originalname: 'a.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from('a\0b'),
      },
    ])
      expect(() => workoutImportSource({}, invalid)).toThrow();
  });
});

describe('Workout sheet provider', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });
  it.each(['Treino A: Supino 3x10', Buffer.from('%PDF-1.7')])(
    'sends sheet data with a multiple-workout response schema',
    async (source) => {
      process.env.GEMINI_API_KEY = 'test-key';
      const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'STOP',
                content: { parts: [{ text: '{"workouts":[]}' }] },
              },
            ],
          }),
        ),
      );
      expect(await new GeminiWorkoutProvider().importSheet(source, [])).toEqual(
        { workouts: [] },
      );
      const body = JSON.parse(fetch.mock.calls[0][1]?.body as string) as {
        contents: { parts: unknown[] }[];
        generationConfig: {
          responseJsonSchema: { properties: { workouts: unknown } };
        };
      };
      expect(
        body.generationConfig.responseJsonSchema.properties.workouts,
      ).toBeDefined();
      if (Buffer.isBuffer(source))
        expect(body.contents[0].parts[1]).toEqual({
          inlineData: {
            mimeType: 'application/pdf',
            data: source.toString('base64'),
          },
        });
      else
        expect(body.contents[0].parts[0]).toEqual({
          text: JSON.stringify({ prompt: source, catalog: [] }),
        });
    },
  );
});
