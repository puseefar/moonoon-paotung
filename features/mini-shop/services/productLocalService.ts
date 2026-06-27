// ── productLocalService ────────────────────────────────────────────────────
// เก็บ stock + images + variants + category + shipping + threshold + hide ใน SQLite ของเครื่อง
// เพื่อ override ค่าจาก backend เก่าที่ยังไม่มี field เหล่านี้
import * as FileSystem from 'expo-file-system/legacy';
import { appSettingsService } from '@/services/appSettingsService';
import type { VariantOptionGroup, ShopCategory, ShippingOptions } from '@/lib/api/contract';

const IMG_DIR = (FileSystem.documentDirectory ?? '') + 'shop_images/';

export const productLocalService = {

  // ── Stock ────────────────────────────────────────────────
  async saveStock(productId: string, stock: number): Promise<void> {
    await appSettingsService.set(`shop.stock.${productId}`, String(stock));
  },

  async getStock(productId: string): Promise<number | null> {
    const val = await appSettingsService.get(`shop.stock.${productId}`);
    return val !== null ? parseInt(val, 10) : null;
  },

  // ── Images ───────────────────────────────────────────────
  async saveImages(productId: string, uris: string[]): Promise<string[]> {
    if (!uris.length) {
      await appSettingsService.set(`shop.images.${productId}`, '[]');
      return [];
    }
    try {
      await FileSystem.makeDirectoryAsync(IMG_DIR, { intermediates: true });
    } catch { /* dir already exists */ }

    const stable: string[] = [];
    for (let i = 0; i < uris.length; i++) {
      const src = uris[i];
      if (!src) continue;
      const dest = `${IMG_DIR}${productId}_${i}.jpg`;
      try {
        if (src.startsWith('file://') || src.startsWith('/')) {
          await FileSystem.copyAsync({ from: src, to: dest });
          stable.push(dest);
        } else {
          stable.push(src);
        }
      } catch {
        stable.push(src);
      }
    }
    await appSettingsService.set(`shop.images.${productId}`, JSON.stringify(stable));
    return stable;
  },

  async getImages(productId: string): Promise<string[] | null> {
    return appSettingsService.getJson<string[]>(`shop.images.${productId}`);
  },

  // ── Variants ─────────────────────────────────────────────
  async saveVariants(productId: string, variants: VariantOptionGroup[]): Promise<void> {
    await appSettingsService.set(`shop.variants.${productId}`, JSON.stringify(variants));
  },

  async getVariants(productId: string): Promise<VariantOptionGroup[] | null> {
    return appSettingsService.getJson<VariantOptionGroup[]>(`shop.variants.${productId}`);
  },

  // ── Category ─────────────────────────────────────────────
  // backend เก่าไม่เก็บ / ไม่ส่ง category → ต้องเก็บ local
  async saveCategory(productId: string, category: ShopCategory): Promise<void> {
    await appSettingsService.set(`shop.category.${productId}`, category);
  },

  async getCategory(productId: string): Promise<ShopCategory | null> {
    const val = await appSettingsService.get(`shop.category.${productId}`);
    return val as ShopCategory | null;
  },

  // ── Custom Category Label ─────────────────────────────────
  async saveCustomCategoryLabel(productId: string, label: string): Promise<void> {
    await appSettingsService.set(`shop.customCat.${productId}`, label);
  },

  async getCustomCategoryLabel(productId: string): Promise<string | null> {
    return appSettingsService.get(`shop.customCat.${productId}`);
  },

  // ── Wholesale Price ───────────────────────────────────────
  async saveWholesalePrice(productId: string, price: number): Promise<void> {
    await appSettingsService.set(`shop.wholesale.${productId}`, String(price));
  },

  async getWholesalePrice(productId: string): Promise<number | null> {
    const val = await appSettingsService.get(`shop.wholesale.${productId}`);
    return val !== null ? parseFloat(val) : null;
  },

  // ── Cost Price ────────────────────────────────────────────
  // backend เก่าไม่เก็บ costPrice → ค่าหายตอน reload (กลายเป็น placeholder)
  // เก็บ local เพื่อ rehydrate ค่าจริงกลับเข้าฟอร์ม (PKG-05 ข้อ 3.1)
  async saveCostPrice(productId: string, price: number): Promise<void> {
    await appSettingsService.set(`shop.cost.${productId}`, String(price));
  },

  async getCostPrice(productId: string): Promise<number | null> {
    const val = await appSettingsService.get(`shop.cost.${productId}`);
    return val !== null ? parseFloat(val) : null;
  },

  // ── Compare Price (ราคาก่อนลด) ────────────────────────────
  async saveComparePrice(productId: string, price: number): Promise<void> {
    await appSettingsService.set(`shop.compare.${productId}`, String(price));
  },

  async getComparePrice(productId: string): Promise<number | null> {
    const val = await appSettingsService.get(`shop.compare.${productId}`);
    return val !== null ? parseFloat(val) : null;
  },

  // ── Shipping ─────────────────────────────────────────────
  // backend เก่าไม่เก็บ shipping → ต้องเก็บ local เพื่อ restore ตอน edit
  async saveShipping(productId: string, shipping: ShippingOptions): Promise<void> {
    await appSettingsService.set(`shop.shipping.${productId}`, JSON.stringify(shipping));
  },

  async getShipping(productId: string): Promise<ShippingOptions | null> {
    return appSettingsService.getJson<ShippingOptions>(`shop.shipping.${productId}`);
  },

  // ── Low Stock Threshold ───────────────────────────────────
  async saveThreshold(productId: string, threshold: number): Promise<void> {
    await appSettingsService.set(`shop.threshold.${productId}`, String(threshold));
  },

  async getThreshold(productId: string): Promise<number | null> {
    const val = await appSettingsService.get(`shop.threshold.${productId}`);
    return val !== null ? parseInt(val, 10) : null;
  },

  // ── Hide When Out Of Stock ────────────────────────────────
  async saveHideWhenOut(productId: string, hide: boolean): Promise<void> {
    await appSettingsService.set(`shop.hideWhenOut.${productId}`, hide ? '1' : '0');
  },

  async getHideWhenOut(productId: string): Promise<boolean | null> {
    const val = await appSettingsService.get(`shop.hideWhenOut.${productId}`);
    return val !== null ? val === '1' : null;
  },

  // ── Merge: backend product + local overrides ──────────────
  async mergeProduct<T extends {
    productId: string;
    stock: number;
    images: string[];
    hasVariants: boolean;
    variants?: VariantOptionGroup[];
    category: ShopCategory;
    customCategoryLabel?: string;
    costPrice: number;
    comparePrice?: number;
    wholesalePrice?: number;
    shipping: ShippingOptions;
    lowStockThreshold: number;
    hideWhenOutOfStock: boolean;
  }>(product: T): Promise<T> {
    const [
      localStock, localImages, localVariants,
      localCategory, localCustomCat, localWholesale,
      localCost, localCompare,
      localShipping, localThreshold, localHide,
    ] = await Promise.all([
      this.getStock(product.productId),
      this.getImages(product.productId),
      this.getVariants(product.productId),
      this.getCategory(product.productId),
      this.getCustomCategoryLabel(product.productId),
      this.getWholesalePrice(product.productId),
      this.getCostPrice(product.productId),
      this.getComparePrice(product.productId),
      this.getShipping(product.productId),
      this.getThreshold(product.productId),
      this.getHideWhenOut(product.productId),
    ]);

    // รวม stock จาก variant values ถ้ามี local variants
    const variantTotalStock = localVariants?.length
      ? localVariants.flatMap(g => g.values).reduce((s, v) => s + (v.stock ?? 0), 0)
      : null;

    return {
      ...product,
      stock: variantTotalStock !== null
        ? variantTotalStock
        : (localStock !== null ? localStock : product.stock),
      images: localImages !== null && localImages.length > 0
        ? localImages : product.images,
      hasVariants: localVariants !== null
        ? localVariants.length > 0 : product.hasVariants,
      variants: localVariants !== null && localVariants.length > 0
        ? localVariants : product.variants,
      category: localCategory !== null ? localCategory : product.category,
      customCategoryLabel: localCustomCat !== null ? localCustomCat : product.customCategoryLabel,
      wholesalePrice: localWholesale !== null ? localWholesale : product.wholesalePrice,
      costPrice: localCost !== null ? localCost : product.costPrice,
      comparePrice: localCompare !== null ? localCompare : product.comparePrice,
      shipping: localShipping !== null ? localShipping : product.shipping,
      lowStockThreshold: localThreshold !== null ? localThreshold : product.lowStockThreshold,
      hideWhenOutOfStock: localHide !== null ? localHide : product.hideWhenOutOfStock,
    };
  },

  async mergeProducts<T extends {
    productId: string;
    stock: number;
    images: string[];
    hasVariants: boolean;
    variants?: VariantOptionGroup[];
    category: ShopCategory;
    customCategoryLabel?: string;
    costPrice: number;
    comparePrice?: number;
    wholesalePrice?: number;
    shipping: ShippingOptions;
    lowStockThreshold: number;
    hideWhenOutOfStock: boolean;
  }>(products: T[]): Promise<T[]> {
    return Promise.all(products.map(p => this.mergeProduct(p)));
  },
};
