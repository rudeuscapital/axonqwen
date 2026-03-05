module.exports = {
  apps: [{
    name: 'axonqwen',
    cwd: '/root/axonqwen',
    script: 'npx',
    args: 'tsx server/index.ts',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }],
};
