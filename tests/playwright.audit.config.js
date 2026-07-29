module.exports = {
  testDir: '.',
  respectGitIgnore: false,
  workers: 1,
  webServer: {
    command: 'node static-server.js',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 15000
  },
  use: process.env.CI ? {} : { channel: 'chrome' }
};
