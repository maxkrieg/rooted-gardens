import { createSerwistRoute } from '@serwist/turbopack'

/**
 * Serves the compiled worker at /serwist/sw.js. Turbopack has no build plugins, so Serwist
 * compiles app/sw.ts here at build time; a broken worker fails the build. `[path]`, not
 * `[...path]`. Sets `Service-Worker-Allowed: /` for root scope. Unknown options throw.
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: 'app/sw.ts',
    injectionPoint: 'self.__SW_MANIFEST',
    // Native esbuild rather than the esbuild-wasm default (non-Windows default
    // is `false`); it's markedly faster and works on Vercel's Linux builders.
    useNativeEsbuild: true,
  })
