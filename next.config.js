/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['oaidalleapiprodscus.blob.core.windows.net'], // DALL-E画像のドメインを許可
  },
  // Next.js 14での正しいサーバー設定
  serverRuntimeConfig: {
    port: 4000,
    hostname: '0.0.0.0',
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // esbuildディレクトリ全体を完全に除外
    config.externals = config.externals || []
    if (typeof config.externals === 'function') {
      const originalExternals = config.externals
      config.externals = (context, request, callback) => {
        if (request.includes('esbuild')) {
          return callback(null, 'commonjs ' + request)
        }
        return originalExternals(context, request, callback)
      }
    } else {
      config.externals.push(function(context, request, callback) {
        if (request.includes('esbuild')) {
          return callback(null, 'commonjs ' + request)
        }
        callback()
      })
    }
    
    // esbuildファイルを無視するルール追加
    config.module.rules.push({
      test: /node_modules[\/\\]esbuild[\/\\]/,
      use: 'ignore-loader'
    })
    
    // ignore-loaderが存在しない場合の代替
    config.resolve.alias = {
      ...config.resolve.alias,
      'esbuild': false,
      'esbuild/lib/main.d.ts': false,
      'esbuild/lib/main.js': false,
      'esbuild/package.json': false
    }
    
    return config
  },
}

module.exports = nextConfig


