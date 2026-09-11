import type { ReactNode } from 'react';

/** The signed-in user shown in the account affordance. `null` hides it. */
export type Account = {
  name: string;
  email?: string;
  avatarUrl?: string;
  /** Menu contents (sign out, settings…). Rendered inside a dropdown. */
  menu?: ReactNode;
} | null;
