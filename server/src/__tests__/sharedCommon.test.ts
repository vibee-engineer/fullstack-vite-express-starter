import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import {
  IdParamSchema,
  PaginationQuerySchema,
  TrashQuerySchema,
  makeListResponse,
  TimestampFields,
} from '@shared/schemas/common';

describe('common schemas — IdParamSchema', () => {
  it('accepts a non-empty id and rejects an empty one', () => {
    expect(IdParamSchema.parse({ id: 'abc' })).toEqual({ id: 'abc' });
    expect(IdParamSchema.safeParse({ id: '' }).success).toBe(false);
    expect(IdParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('common schemas — PaginationQuerySchema', () => {
  it('defaults limit to 50 when absent', () => {
    expect(PaginationQuerySchema.parse({})).toEqual({ limit: 50 });
  });

  it('coerces a string limit (query strings are strings) and bounds it', () => {
    expect(PaginationQuerySchema.parse({ limit: '10' }).limit).toBe(10);
    expect(PaginationQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(PaginationQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('accepts an optional cursor but rejects an empty string', () => {
    expect(PaginationQuerySchema.parse({ cursor: 'c1' }).cursor).toBe('c1');
    expect(PaginationQuerySchema.safeParse({ cursor: '' }).success).toBe(false);
  });
});

describe('common schemas — TrashQuerySchema', () => {
  it('defaults scope to active and carries pagination', () => {
    expect(TrashQuerySchema.parse({})).toEqual({ limit: 50, scope: 'active' });
  });

  it('accepts scope=trash and rejects an unknown scope', () => {
    expect(TrashQuerySchema.parse({ scope: 'trash' }).scope).toBe('trash');
    expect(TrashQuerySchema.safeParse({ scope: 'archived' }).success).toBe(false);
  });
});

describe('common schemas — makeListResponse', () => {
  const ItemSchema = z.object({ id: z.string(), ...TimestampFields });
  const ListSchema = makeListResponse(ItemSchema);

  it('validates a well-formed envelope with a nextCursor', () => {
    const value = {
      items: [{ id: 'a', createdAt: 't', updatedAt: 't' }],
      total: 1,
      nextCursor: 'next',
    };
    expect(ListSchema.parse(value)).toEqual(value);
  });

  it('allows a null/absent nextCursor (last page)', () => {
    expect(ListSchema.parse({ items: [], total: 0 }).items).toEqual([]);
    expect(ListSchema.parse({ items: [], total: 0, nextCursor: null }).nextCursor).toBeNull();
  });

  it('rejects a negative total and a non-array items', () => {
    expect(ListSchema.safeParse({ items: [], total: -1 }).success).toBe(false);
    expect(ListSchema.safeParse({ items: {}, total: 0 }).success).toBe(false);
  });
});
