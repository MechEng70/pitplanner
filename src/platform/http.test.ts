import { getJson } from './http';

const URL = 'https://api.github.com/repos/MechEng70/pitplanner/releases?per_page=30';
afterEach(() => jest.restoreAllMocks());

function mockFetch(answer: Partial<Response> | Error) {
  return jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    if (answer instanceof Error) throw answer;
    return answer as Response;
  });
}

test('one GET with only the headers given: no credentials, no body', async () => {
  const fetched = mockFetch({ ok: true, json: async () => [{ tag_name: 'v0.4.0' }] });
  await expect(getJson(URL, { Accept: 'application/vnd.github+json' })).resolves.toEqual({
    ok: true,
    json: [{ tag_name: 'v0.4.0' }],
  });
  expect(fetched).toHaveBeenCalledTimes(1);
  const [url, init] = fetched.mock.calls[0]!;
  expect(url).toBe(URL);
  expect(init).toMatchObject({ headers: { Accept: 'application/vnd.github+json' }, credentials: 'omit' });
  expect(init?.method).toBeUndefined();
  expect(init?.body).toBeUndefined();
});

test('an answer that is not ok is not read', async () => {
  const json = jest.fn();
  mockFetch({ ok: false, json });
  await expect(getJson(URL, {})).resolves.toEqual({ ok: false, json: null });
  expect(json).not.toHaveBeenCalled();
});

test('no network rejects, so the caller decides what to do', async () => {
  mockFetch(new TypeError('Network request failed'));
  await expect(getJson(URL, {})).rejects.toThrow('Network request failed');
});
