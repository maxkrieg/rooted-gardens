import { createSerwistRoute } from '@serwist/turbopack'

/**
 * Serves the compiled service worker at `/serwist/sw.js`.
 *
 * Turbopack doesn't support build plugins, so Serwist compiles `app/sw.ts` with
 * esbuild inside a Route Handler instead of at bundle time. This runs at build
 * time (`dynamic: 'force-static'`), so a broken worker or a bad option fails
 * `npm run build` rather than shipping silently.
 *
 * The segment is `[path]`, not `[...path]` — esbuild is configured with flat
 * output names and the package can't resolve anything deeper than one level.
 *
 * The handler sets `Service-Worker-Allowed: /`, which is what lets
 * `ServiceWorkerRegistration` claim root scope from this non-root URL.
 *
 * Options are validated by a zod `strictObject`: an unrecognised key throws
 * `SerwistConfigError` at build. Notably there is no `swDest`.
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: 'app/sw.ts',
    injectionPoint: 'self.__SW_MANIFEST',
    // Native esbuild rather than the esbuild-wasm default (non-Windows default
    // is `false`); it's markedly faster and works on Vercel's Linux builders.
    useNativeEsbuild: true,
  })
