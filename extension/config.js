// Where this build talks to. For production, point both at the live origins and
// put the API origin in manifest.json's host_permissions as well.
globalThis.SN_CONFIG = {
  API_URL: 'http://localhost:8080',
  WEB_ORIGIN: 'http://localhost:3000',
};
