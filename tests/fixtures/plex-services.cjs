// External services for the authentication integration tests. No network requests leave the process.
const accounts = JSON.parse(process.env.TEST_PLEX_ACCOUNTS);
let nextPin = 0;
global.fetch = async (input, init = {}) => {
  const url = new URL(input);
  const json = (data) => Response.json(data);
  if (url.hostname === 'plex.tv') {
    if (url.pathname === '/api/v2/pins') return json({ id: ++nextPin, code: 'test-pin' });
    if (url.pathname.startsWith('/api/v2/pins/')) return json({ authToken: url.pathname.split('/').pop() });
    if (url.pathname === '/api/v2/user') return json(accounts[Number(init.headers['X-Plex-Token']) - 1]);
    if (url.pathname === '/api/v2/resources') return json([{ clientIdentifier: 'test-server', provides: 'server', owned: true }]);
  }
  if (url.hostname === 'tautulli.test') {
    const commands = {
      get_users: [
        { user_id: 101, username: 'Alice', friendly_name: 'Alice' },
        { user_id: 102, username: 'TautulliBob', friendly_name: 'Bob' },
      ],
      get_server_info: { pms_identifier: 'test-server', pms_name: 'Test Server' },
      get_history: { data: JSON.parse(process.env.TEST_HISTORY || '[]') },
    };
    return json({ response: { result: 'success', data: commands[url.searchParams.get('cmd')] } });
  }
  return new Response('', { status: 404 });
};
