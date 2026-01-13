export type TailwindGroup =
  | 'colors'
  | 'boxShadow'
  | 'borderRadius'
  | 'backdropBlur'
  | 'fontSize'
  | 'spacing'
  | 'zIndex';

export type TailwindMapping = {
  group: TailwindGroup;
  name: string;
  mode?: 'var' | 'raw';
};

export type TokenDefinition = {
  value: string;
  description?: string;
  tailwind?: TailwindMapping[];
};

export type TokenNode = TokenDefinition | TokenTree;

export type TokenTree = {
  [key: string]: TokenNode;
};

export const createToken = (
  value: string,
  options: { description?: string; tailwind?: TailwindMapping[] } = {},
): TokenDefinition => ({
  value,
  ...('description' in options ? { description: options.description } : {}),
  ...('tailwind' in options ? { tailwind: options.tailwind } : {}),
});
