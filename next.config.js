const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  
  images: {
    unoptimized: true,
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // FIX 1: Change target to 'web'
      // This prevents Webpack from injecting 'require' calls into your frontend bundle
      config.target = 'web';

      // Keep the global polyfill so your P2P and Crypto libraries don't crash
      config.plugins.push(
        new webpack.DefinePlugin({
          global: 'window',
        })
      );
    }

    // FIX 2: Remove the 'commonjs' externals
    // The frontend should NOT try to import these native modules; they live strictly in main.ts
    config.externals = [
      ...(config.externals || []),
    ];

    return config;
  },
};

module.exports = nextConfig;