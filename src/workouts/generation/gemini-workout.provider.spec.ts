import { jest } from '@jest/globals';
import { HttpException } from '@nestjs/common';
import { GeminiWorkoutProvider } from './gemini-workout.provider.js';
import { validateGeneratedWorkout } from './generated-workout.js';

describe('Gemini workout provider', () => {
  const provider = new GeminiWorkoutProvider();
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  const plan = {
    name: 'Pernas',
    notes: '',
    exercises: [
      {
        exerciseId: '123e4567-e89b-42d3-a456-426614174000',
        plannedSets: 3,
        plannedReps: 10,
        restSeconds: 60,
        notes: '',
      },
    ],
  };
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-only-key';
    delete process.env.GEMINI_MODEL;
    fetchMock.mockReset();
  });
  afterAll(() => {
    fetchMock.mockRestore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
  });
  const response = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), { status });
  const envelope = (text: string, finishReason = 'STOP') => ({
    candidates: [{ finishReason, content: { parts: [{ text }] } }],
  });
  it('sends structured JSON with a server-side key and parses the response', async () => {
    fetchMock.mockResolvedValue(response(envelope(JSON.stringify(plan))));
    expect(await provider.generate('Pernas', [])).toEqual(plan);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('gemini-3.1-flash-lite:generateContent');
    expect(url).not.toContain('test-only-key');
    expect(options?.headers).toEqual({
      'Content-Type': 'application/json',
      'x-goog-api-key': 'test-only-key',
    });
    expect(JSON.parse(options?.body as string)).toMatchObject({
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
      },
    });
  });
  it('does not call the provider without configuration', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(provider.generate('Treino', [])).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([429, 401, 403, 500])(
    'maps HTTP %s without leaking the response',
    async (status) => {
      fetchMock.mockResolvedValue(
        response({ secret: 'private provider detail' }, status),
      );
      await expect(provider.generate('Treino', [])).rejects.toMatchObject({
        status: status === 429 ? 429 : 503,
      });
    },
  );
  it.each([envelope('not json'), envelope('{}', 'MAX_TOKENS'), {}])(
    'rejects malformed or incomplete responses',
    async (payload) => {
      fetchMock.mockResolvedValue(response(payload));
      await expect(provider.generate('Treino', [])).rejects.toMatchObject({
        status: 502,
      });
    },
  );
  it('maps a safety refusal to 422', async () => {
    fetchMock.mockResolvedValue(
      response({ promptFeedback: { blockReason: 'SAFETY' } }),
    );
    await expect(provider.generate('Treino', [])).rejects.toMatchObject({
      status: 422,
    });
  });
  it('maps a network failure to 502', async () => {
    fetchMock.mockRejectedValue(new Error('private network detail'));
    await expect(provider.generate('Treino', [])).rejects.toMatchObject({
      status: 502,
    });
  });
  it('maps the request timeout to 504', async () => {
    const timeout = jest
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(AbortSignal.abort());
    fetchMock.mockRejectedValue(new Error('aborted'));
    try {
      await expect(provider.generate('Treino', [])).rejects.toMatchObject({
        status: 504,
      });
    } finally {
      timeout.mockRestore();
    }
  });
  it('validates nested output independently of provider schema enforcement', () => {
    expect(validateGeneratedWorkout(plan)).toMatchObject(plan);
    for (const invalid of [
      null,
      [],
      {},
      { ...plan, userId: 'injected' },
      { ...plan, name: '  ' },
      { ...plan, exercises: [] },
      { ...plan, exercises: [null] },
      ...[
        { plannedSets: 0 },
        { plannedSets: 11 },
        { plannedReps: '10' },
        { restSeconds: -1 },
        { completed: true },
        { exerciseId: 'invalid' },
      ].map((fields) => ({
        ...plan,
        exercises: [{ ...plan.exercises[0], ...fields }],
      })),
    ]) {
      expect(() => validateGeneratedWorkout(invalid)).toThrow(HttpException);
    }
  });
});
