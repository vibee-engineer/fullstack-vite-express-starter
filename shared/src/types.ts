/**
 * shared/types.ts — TypeScript types inferred from the zod schemas.
 *
 * Keep this file mechanical — every export is `z.infer<typeof X>`. Widening,
 * transforms, and enum aliasing all belong in schemas.ts.
 */

import type { z } from 'zod';
import type { CreateUserSchema, UserSchema, HealthSchema } from './schemas';

export type CreateUser = z.infer<typeof CreateUserSchema>;
export type User = z.infer<typeof UserSchema>;
export type Health = z.infer<typeof HealthSchema>;
