/**
 * toast.tsx — sonner re-export. Older shadcn generations shipped a bespoke
 * toast primitive; we've standardized on sonner (see toaster.tsx) because
 * it plays nicer with React 19's concurrent renderer.
 */
export { toast } from 'sonner';
export type { ExternalToast } from 'sonner';
