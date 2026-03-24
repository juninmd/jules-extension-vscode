import { expect } from 'chai';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

describe('JulesApiClient - Part 1', () => {
  let context: any;
  let configStub: sinon.SinonStub;
  let secretGetStub: sinon.SinonStub;
  let workspaceConfigStub: sinon.SinonStub;
  let JulesApiClient: any;

  beforeEach(() => {
    secretGetStub = sinon.stub().resolves('test-api-key');
    context = {
      secrets: {
        get: secretGetStub
      }
    };

    configStub = sinon.stub();
    configStub.withArgs('apiBaseUrl').returns('https://test.jules.com/v1');

    workspaceConfigStub = sinon.stub();
    workspaceConfigStub.withArgs('jules').returns({
      get: configStub
    });

    const vscodeMock = {
      workspace: {
        getConfiguration: workspaceConfigStub
      }
    };

    JulesApiClient = proxyquire.noCallThru().load('../julesApiClient', {
      'vscode': vscodeMock
    }).JulesApiClient;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should initialize and load config correctly', async () => {
    const client = new JulesApiClient(context);
    await client.waitForInit();

    expect(workspaceConfigStub.calledWith('jules')).to.be.true;
    expect(configStub.calledWith('apiBaseUrl')).to.be.true;
    expect(secretGetStub.calledWith('jules.apiKey')).to.be.true;
    expect(client.hasApiKey()).to.be.true;
  });

  it('should wait for initialization', async () => {
    // Delay the secret loading to ensure waitForInit actually waits
    let resolveSecret: any;
    const secretPromise = new Promise(resolve => {
      resolveSecret = resolve;
    });
    secretGetStub.returns(secretPromise);

    const client = new JulesApiClient(context);

    let initDone = false;
    client.waitForInit().then(() => {
      initDone = true;
    });

    // Need a small timeout to let the event loop process promises
    await new Promise(r => setTimeout(r, 10));
    expect(initDone).to.be.false;

    resolveSecret('delayed-key');
    await client.waitForInit();
    expect(initDone).to.be.true;
  });

  it('should handle missing api key during init', async () => {
    secretGetStub.resolves(undefined);
    const client = new JulesApiClient(context);
    await client.waitForInit();

    expect(client.hasApiKey()).to.be.false;
  });

  it('should set and check API key correctly', async () => {
    const client = new JulesApiClient(context);
    await client.waitForInit();

    client.setApiKey('new-key');
    expect(client.hasApiKey()).to.be.true;

    client.setApiKey('   ');
    expect(client.hasApiKey()).to.be.false;

    client.setApiKey('');
    expect(client.hasApiKey()).to.be.false;
  });

  describe('API Methods', () => {
    let fetchStub: sinon.SinonStub;
    let client: any;

    beforeEach(async () => {
      fetchStub = sinon.stub();

      client = new JulesApiClient(context);
      client.setFetchImpl(fetchStub as any);
      await client.waitForInit();
    });

    afterEach(() => {
      // No global cleanup needed
    });

    it('should create a task', async () => {
      const mockResponse = { id: 'task-123', title: 'Test Task' };
      fetchStub.resolves({
        ok: true,
        json: sinon.stub().resolves(mockResponse)
      });

      const request = { title: 'Test Task', description: 'desc' };
      const result = await client.createTask(request);

      expect(result).to.deep.equal(mockResponse);
      expect(fetchStub.calledOnce).to.be.true;

      const args = fetchStub.firstCall.args;
      expect(args[0]).to.equal('https://test.jules.com/v1/tasks');
      expect(args[1].method).to.equal('POST');
      expect(args[1].headers).to.deep.equal({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-api-key',
        'X-Jules-Client': 'vscode-extension/0.1.0'
      });
      expect(JSON.parse(args[1].body)).to.deep.equal(request);
    });

    it('should get a task', async () => {
      const mockResponse = { id: 'task-123', title: 'Test Task' };
      fetchStub.resolves({
        ok: true,
        json: sinon.stub().resolves(mockResponse)
      });

      const result = await client.getTask('task-123');

      expect(result).to.deep.equal(mockResponse);
      expect(fetchStub.calledOnce).to.be.true;

      const args = fetchStub.firstCall.args;
      expect(args[0]).to.equal('https://test.jules.com/v1/tasks/task-123');
      expect(args[1].method).to.equal('GET');
      expect(args[1].headers).to.deep.equal({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-api-key',
        'X-Jules-Client': 'vscode-extension/0.1.0'
      });
      expect(args[1].body).to.be.undefined;
    });

    it('should list tasks without pagination', async () => {
      const mockResponse = { tasks: [{ id: 'task-1' }] };
      fetchStub.resolves({
        ok: true,
        json: sinon.stub().resolves(mockResponse)
      });

      const result = await client.listTasks();
      expect(result).to.deep.equal(mockResponse);
      expect(fetchStub.firstCall.args[0]).to.equal('https://test.jules.com/v1/tasks');
      expect(fetchStub.firstCall.args[1].method).to.equal('GET');
    });

    it('should list tasks with pagination', async () => {
      const mockResponse = { tasks: [{ id: 'task-1' }], nextPageToken: 'token-abc' };
      fetchStub.resolves({
        ok: true,
        json: sinon.stub().resolves(mockResponse)
      });

      const result = await client.listTasks('token-123');
      expect(result).to.deep.equal(mockResponse);
      expect(fetchStub.firstCall.args[0]).to.equal('https://test.jules.com/v1/tasks?pageToken=token-123');
      expect(fetchStub.firstCall.args[1].method).to.equal('GET');
    });

    it('should cancel a task', async () => {
      fetchStub.resolves({
        ok: true,
        json: sinon.stub().resolves({})
      });

      await client.cancelTask('task-123');
      expect(fetchStub.firstCall.args[0]).to.equal('https://test.jules.com/v1/tasks/task-123:cancel');
      expect(fetchStub.firstCall.args[1].method).to.equal('POST');
    });

    it('should delete a task', async () => {
      fetchStub.resolves({
        ok: true,
        json: sinon.stub().resolves({})
      });

      await client.deleteTask('task-123');
      expect(fetchStub.firstCall.args[0]).to.equal('https://test.jules.com/v1/tasks/task-123');
      expect(fetchStub.firstCall.args[1].method).to.equal('DELETE');
    });

    it('should handle 401 Unauthorized', async () => {
      fetchStub.resolves({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: sinon.stub().rejects(new Error('no json'))
      });

      let error: any;
      try {
        await client.getTask('task-1');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.equal('Invalid API key. Please configure a valid Jules API key.');
    });

    it('should handle 403 Forbidden', async () => {
      fetchStub.resolves({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: sinon.stub().resolves({})
      });

      let error: any;
      try {
        await client.getTask('task-1');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.equal('Access denied. Check your Jules API key permissions.');
    });

    it('should handle 429 Rate Limit', async () => {
      fetchStub.resolves({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: sinon.stub().resolves({})
      });

      let error: any;
      try {
        await client.getTask('task-1');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.equal('Rate limit exceeded. Please wait before making more requests.');
    });

    it('should parse JSON error response', async () => {
      fetchStub.resolves({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: sinon.stub().resolves({ error: { message: 'Invalid input data' } })
      });

      let error: any;
      try {
        await client.getTask('task-1');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.equal('Invalid input data');
    });

    it('should fallback to statusText on generic error without JSON message', async () => {
      fetchStub.resolves({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: sinon.stub().resolves({})
      });

      let error: any;
      try {
        await client.getTask('task-1');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.equal('HTTP 500: Internal Server Error');
    });
  });
});
