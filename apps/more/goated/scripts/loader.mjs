// Tiny Node ESM loader that appends ".js" to bare relative imports so the
// project's Vite-style "./gameConstants" imports resolve in plain Node.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export async function resolve(specifier, context, defaultResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier)) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const candidate = path.resolve(path.dirname(parent), specifier + '.js');
    if (existsSync(candidate)) {
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }
  return defaultResolve(specifier, context);
}
