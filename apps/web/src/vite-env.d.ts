/// <reference types="vite/client" />

// Declaration-merges with Vite's own ImportMetaEnv (vite/client.d.ts) to
// give import.meta.env.VITE_API_BASE_URL a real type instead of `any`, and
// to document in one place which env vars this app actually reads.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}
