import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JulesApiClient } from '../julesApiClient.js';

/**
 * These are hermetic unit tests: `fetch` is stubbed, so the suite never needs a
 * JULES_TOKEN, network access or an existing session. The previous version
 * called the real API, which made the CI gate fail with 401 for every run
 * without secrets.
 */
const BASE = 'https://jules.googleapis.com/v1alpha';

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => payload,
  } as unknown as Response;
}

function makeClient(token = 'test-key'): JulesApiClient {
  const contextMock = {
    secrets: { get: async (key: string) => (key === 'jules.apiKey' ? token : undefined) },
  } as any;
  return new JulesApiClient(contextMock);
}

describe('JulesApiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lists sources sending the api key header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { sources: [{ name: 'sources/1' }] }));
    const client = makeClient('abc');
    await client.waitForInit();

    const response = await client.listSources();

    expect(response.sources).toHaveLength(1);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE}/sources`);
    expect(options.method).toBe('GET');
    expect(options.headers['X-Goog-Api-Key']).toBe('abc');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('encodes pagination tokens', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { sources: [], nextPageToken: 'n' }));
    const client = makeClient();

    await client.listSources('a/b c');
    await client.listTasks('tok', 25);
    await client.listActivities('sessions/1', 'next');

    const urls = fetchMock.mock.calls.map((call) => call[0]);
    expect(urls[0]).toBe(`${BASE}/sources?pageToken=a%2Fb%20c`);
    expect(urls[1]).toBe(`${BASE}/sessions?pageToken=tok&pageSize=25`);
    expect(urls[2]).toBe(`${BASE}/sessions/1/activities?pageToken=next`);
  });

  it('creates a task posting the request body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { name: 'sessions/9' }));
    const client = makeClient();
    const request = { prompt: 'hi', title: 'T' } as any;

    const task = await client.createTask(request);

    expect(task.name).toBe('sessions/9');
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE}/sessions`);
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(request);
  });

  it('normalizes session ids without the sessions/ prefix', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const client = makeClient();

    await client.getTask('abc');
    await client.approvePlan('abc');
    await client.sendMessageToSession('abc', 'oi');
    await client.cancelTask('abc');
    await client.deleteTask('abc');

    const calls = fetchMock.mock.calls.map((call) => [call[0], call[1].method]);
    expect(calls).toEqual([
      [`${BASE}/sessions/abc`, 'GET'],
      [`${BASE}/sessions/abc:approvePlan`, 'POST'],
      [`${BASE}/sessions/abc:sendMessage`, 'POST'],
      [`${BASE}/sessions/abc:cancel`, 'POST'],
      [`${BASE}/sessions/abc`, 'DELETE'],
    ]);
    const sendBody = JSON.parse(fetchMock.mock.calls[2]![1].body);
    expect(sendBody).toEqual({ prompt: 'oi' });
  });

  it('keeps the already-qualified session path untouched', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { name: 'sessions/7' }));
    const client = makeClient();

    await client.getTask('sessions/7');
    await client.listActivities('sessions/7');

    const urls = fetchMock.mock.calls.map((call) => call[0]);
    expect(urls[0]).toBe(`${BASE}/sessions/7`);
    expect(urls[1]).toBe(`${BASE}/sessions/7/activities`);
  });

  it('returns undefined for 204 responses', async () => {
    fetchMock.mockResolvedValue(jsonResponse(204, null));
    const client = makeClient();

    await expect(client.deleteTask('abc')).resolves.toBeUndefined();
  });

  it.each([
    [401, 'Invalid API key. Please configure a valid Jules API key.'],
    [403, 'Access denied. Check your Jules API key permissions.'],
    [429, 'Rate limit exceeded. Please wait before making more requests.'],
  ])('maps HTTP %i to a helpful error', async (status, message) => {
    fetchMock.mockResolvedValue(
      jsonResponse(status, { error: { message: 'upstream detail' } }),
    );
    const client = makeClient();

    await expect(client.listTasks()).rejects.toThrow(message);
  });

  it('uses the server message for other failures', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: { message: 'boom' } }));
    const client = makeClient();

    await expect(client.listTasks()).rejects.toThrow('boom');
  });

  it('falls back to the HTTP status when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);
    const client = makeClient();

    await expect(client.listTasks()).rejects.toThrow('HTTP 502: Bad Gateway');
  });

  it('reports whether an api key is configured', async () => {
    const client = makeClient('');
    await client.waitForInit();
    expect(client.hasApiKey()).toBe(false);
    client.setApiKey('later');
    expect(client.hasApiKey()).toBe(true);
  });
});
