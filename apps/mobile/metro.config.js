const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// The native package has its own React installation; only framework-free contracts are shared.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../../shared')];
module.exports = config;
