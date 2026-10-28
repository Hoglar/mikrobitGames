import { createAdapter } from './adapter.js';

/** One page-owned adapter. Importing this module never touches Web Serial. */
export const microbit = createAdapter();
export { MicrobitError } from './errors.js';
