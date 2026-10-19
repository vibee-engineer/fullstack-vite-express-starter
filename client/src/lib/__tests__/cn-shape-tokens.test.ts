import { describe, expect, it } from 'vitest';
import { cn } from '../utils';

describe('cn knows the look shape keys', () => {
  it('keeps a shape border width next to a border colour', () => {
    expect(cn('border-control border-input')).toBe('border-control border-input');
    expect(cn('border-card border-border')).toBe('border-card border-border');
  });
  it('lets a page override the shape keys', () => {
    expect(cn('h-control', 'h-12')).toBe('h-12');
    expect(cn('rounded-control', 'rounded-full')).toBe('rounded-full');
    expect(cn('shadow-card', 'shadow-none')).toBe('shadow-none');
    expect(cn('font-control', 'font-bold')).toBe('font-bold');
  });
});
