// Bundles the CLI into one file inside the plugin, so installing the plugin needs no npm install.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/cli.ts'],
  outfile: '../../plugins/stormm/scripts/stormm.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  conditions: ['source'],
  // yaml ships CommonJS for Node; give its require() calls something to call.
  banner: { js: "#!/usr/bin/env node\n// Built from packages/cli by `pnpm --filter @stormm/cli build`. Do not edit.\nimport { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  legalComments: 'none',
})
