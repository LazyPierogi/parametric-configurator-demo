import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokens } from '../tokens/src/tokens';
import type { TokenDefinition, TokenNode } from '../tokens/src/types';

type FlattenedToken = {
  path: string[];
  definition: TokenDefinition;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.resolve(__dirname, '../tokens/generated');

const toKebab = (input: string): string =>
  input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();

const buildVarName = (segments: string[]): string =>
  `--cw-${segments.map(toKebab).join('-')}`;

const flattenTokens = (node: TokenNode, pathSegments: string[] = []): FlattenedToken[] => {
  if (typeof node === 'object' && node !== null && 'value' in node) {
    return [{ path: pathSegments, definition: node as TokenDefinition }];
  }

  return Object.entries(node as Record<string, TokenNode>).flatMap(([key, child]) =>
    flattenTokens(child, [...pathSegments, key]),
  );
};

const assignNestedValue = (target: Record<string, any>, keyPath: string[], value: string) => {
  const [head, ...rest] = keyPath;
  if (!head) return;

  if (rest.length === 0) {
    target[head] = value;
    return;
  }

  if (typeof target[head] !== 'object' || target[head] === null) {
    target[head] = {};
  }

  assignNestedValue(target[head], rest, value);
};

const sortObject = (obj: Record<string, any>): Record<string, any> =>
  Object.keys(obj)
    .sort()
    .reduce<Record<string, any>>((acc, key) => {
      const value = obj[key];
      acc[key] =
        typeof value === 'object' && value !== null && !Array.isArray(value)
          ? sortObject(value)
          : value;
      return acc;
    }, {});

const buildCss = (flatTokens: FlattenedToken[]): string => {
  const lines = flatTokens
    .map(({ path, definition }) => `  ${buildVarName(path)}: ${definition.value};`)
    .sort();

  return [
    '/* Auto-generated via packages/ui/scripts/generate-tokens.ts */',
    ':root {',
    ...lines,
    '}',
    '',
  ].join('\n');
};

const buildJson = (flatTokens: FlattenedToken[]): string => {
  const payload = flatTokens
    .map(({ path, definition }) => ({
      name: path.join('.'),
      value: definition.value,
      description: definition.description ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return `${JSON.stringify(payload, null, 2)}\n`;
};

const buildTailwindExtend = (flatTokens: FlattenedToken[]): string => {
  const extend: Record<string, Record<string, unknown>> = {};

  flatTokens.forEach(({ path, definition }) => {
    if (!definition.tailwind) return;
    const varValue = `var(${buildVarName(path)})`;

    definition.tailwind.forEach(mapping => {
      const group = extend[mapping.group] ?? (extend[mapping.group] = {});
      const segments = mapping.name.split('.');
      const value = mapping.mode === 'raw' ? definition.value : varValue;
      assignNestedValue(group, segments, value);
    });
  });

  const sortedExtend = sortObject(extend);
  const serialized = JSON.stringify(sortedExtend, null, 2);

  return [
    '// Auto-generated via packages/ui/scripts/generate-tokens.ts',
    'export const tailwindExtend = ',
    `${serialized} as const;`,
    '',
  ].join('\n');
};

const main = async () => {
  const flatTokens = flattenTokens(tokens);
  await mkdir(GENERATED_DIR, { recursive: true });

  await Promise.all([
    writeFile(path.join(GENERATED_DIR, 'tokens.css'), buildCss(flatTokens), 'utf-8'),
    writeFile(path.join(GENERATED_DIR, 'tokens.json'), buildJson(flatTokens), 'utf-8'),
    writeFile(path.join(GENERATED_DIR, 'tailwind.extend.ts'), buildTailwindExtend(flatTokens), 'utf-8'),
  ]);
};

main().catch(error => {
  console.error('[tokens] generation failed', error);
  process.exit(1);
});
