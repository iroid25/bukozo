// @ts-ignore
// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   images: {
//     remotePatterns: [
//       {
//         protocol: "https",
//         hostname: "**",
//       },
//     ],
//   },
//   // Externalize canvas for server components (Next.js 15 / Turbopack)
//   // pdfjs-dist imports canvas which is a native module - externalize both
//   serverComponentsExternalPackages: ['canvas', 'pdfjs-dist'],
  
//   webpack: (config, { isServer }) => {
//     // Externalize canvas and pdfjs-dist for both client and server
//     if (!isServer) {
//       config.externals = config.externals || [];
//       config.externals.push({
//         canvas: 'canvas',
//         'pdfjs-dist': 'pdfjs-dist',
//       });
//     }
    
//     // Ignore canvas and pdfjs-dist module resolution
//     config.resolve.alias = {
//       ...config.resolve.alias,
//       canvas: false,
//       'pdfjs-dist/build/pdf.worker.entry': false,
//     };
    
//     // Ignore canvas in module resolution
//     config.module = config.module || {};
//     config.module.noParse = config.module.noParse || [];
//     if (Array.isArray(config.module.noParse)) {
//       config.module.noParse.push(/node_modules\/canvas/);
//     }
    
//     return config;
//   },
// };

// export default nextConfig;
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables the .next/standalone output used by the production Dockerfile
  // (self-contained server.js + traced node_modules, no full node_modules copy needed).
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  webpack: (config) => {
    // Ignore canvas module completely (pdfjs-dist can work without it in browser)
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };

    return config;
  },
  async headers() {
    const isDev = process.env.NODE_ENV === "development";
    // localhost:8000/8001 = fingerprint reader bridge (runs on teller's local machine)
    // ws:// entries are Next.js HMR — dev only
    const connectSrc = [
      "'self'",
      "http://localhost:8000",
      "http://localhost:8001",
      "http://127.0.0.1:8001",
      ...(isDev ? ["ws://localhost:3000", "ws://localhost:3001"] : []),
    ].join(" ");

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `connect-src ${connectSrc};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
