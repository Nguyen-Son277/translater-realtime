import config from './playwright.config.js';

// Settings UI contract tests mock every relevant API, so no backend is required.
export default { ...config, testMatch: 'admin-settings.spec.js', webServer: config.webServer.slice(1) };
