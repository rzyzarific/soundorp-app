/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  // Optional, non-secret: when set, activation rejects keys from other stores/products.
  readonly VITE_LEMONSQUEEZY_STORE_ID?: string
  readonly VITE_LEMONSQUEEZY_PRODUCT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
