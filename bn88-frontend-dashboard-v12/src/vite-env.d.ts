/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_ADMIN_API_BASE?: string;
  readonly VITE_TENANT?: string;
  readonly VITE_DEFAULT_TENANT?: string;
  readonly VITE_ADMIN_CODE?: string;
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
