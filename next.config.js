/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  
  // Disable image optimization for Electron
  images: {
    unoptimized: true,
  },

  // Webpack config for Electron compatibility
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.target = 'electron-renderer';
    }

    config.externals = [
      ...(config.externals || []),
      {
        '@journeyapps/sqlcipher': 'commonjs @journeyapps/sqlcipher',
        'better-sqlite3': 'commonjs better-sqlite3',
        'sodium-native': 'commonjs sodium-native',
      },
    ];

    return config;
  },
};

module.exports = nextConfig;