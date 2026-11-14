// Ambient type declarations for Supabase Edge Functions (Deno runtime) in VS Code / Expo TypeScript
declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  }
  const env: Env;
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.49.1' {
  export const createClient: typeof import('@supabase/supabase-js').createClient;
}
