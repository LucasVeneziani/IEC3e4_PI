// Saiba mais em https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Na web, o expo-sqlite usa uma versão em wasm e precisa de SharedArrayBuffer (cabeçalhos COOP/COEP).
config.resolver.assetExts.push('wasm');
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
