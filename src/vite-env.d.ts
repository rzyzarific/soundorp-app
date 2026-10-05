/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Optional, non-secret: when set, activation rejects keys from other stores/products.
  readonly VITE_LEMONSQUEEZY_STORE_ID?: string
  readonly VITE_LEMONSQUEEZY_PRODUCT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
