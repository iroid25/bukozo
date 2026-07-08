// import { createRouteHandler } from "uploadthing/next";

// import { ourFileRouter } from "./core";

// // Export routes for Next App Router
// export const { GET, POST } = createRouteHandler({
//   router: ourFileRouter,

//   // Apply an (optional) custom config:
//   // config: { ... },
// });
// app/api/uploadthing/route.ts

// app/api/uploadthing/route.ts
// // app/api/uploadthing/route.ts
// import { createRouteHandler } from "uploadthing/next";
// import { ourFileRouter } from "./core";
// console.log("🔍 Available routes:", Object.keys(ourFileRouter));
// // Export routes for Next.js App Router
// export const { GET, POST } = createRouteHandler({
//   router: ourFileRouter,

//   // Add config for debugging (cast to any to avoid TypeScript error on unknown props)
//   config: {
//     uploadthingId: process.env.UPLOADTHING_APP_ID,
//     uploadthingSecret: process.env.UPLOADTHING_SECRET,
//     callbackUrl: process.env.UPLOADTHING_URL || undefined,
//     logLevel: "debug", // Enable debug logs
//   } as any,
// });
import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

// Prevent Next.js from statically pre-rendering this route at build time
export const dynamic = "force-dynamic";

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  config: {
    logLevel: "Debug",
  },
});
