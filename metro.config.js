// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add polyfill for Node.js core modules
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  events: require.resolve('events'),
};

module.exports = config;
