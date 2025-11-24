/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_ADMIN_CODE?: string;
  readonly VITE_TENANT?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
