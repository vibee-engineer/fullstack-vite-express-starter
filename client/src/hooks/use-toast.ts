/**
 * use-toast.ts — thin re-export over sonner so components can import a
 * single hook / helper regardless of the underlying toast library. Swap
 * the impl here if you replace sonner.
 */
import { toast as sonnerToast } from 'sonner';

export const toast = sonnerToast;
export function useToast() {
  return { toast: sonnerToast };
}
