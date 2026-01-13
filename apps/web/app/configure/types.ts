export type AddToCartSuccessPayload = {
  note?: string;
  [key: string]: unknown;
};

export type AddToCartState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: AddToCartSuccessPayload };

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;
