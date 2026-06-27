import { createContext, useContext, useState, type ReactNode } from 'react';

export interface CartItem {
  productId: string;
  variantId?: string;     // variant value ที่เลือก — แยกบรรทัดต่อ variant
  variantLabel?: string;  // snapshot label เช่น "ชมพู"
  name: string;
  price: number;
  unitCost?: number;      // ต้นทุน variant/สินค้า — snapshot ลง order (PKG-05.1)
  comparePrice?: number;  // ราคาก่อนลด — ใช้คำนวณส่วนลดใน Place Order
  image?: string;
  qty: number;
}

// สินค้าเดียวกันแต่ต่าง variant = คนละบรรทัด → เทียบด้วย productId + variantId
function sameLine(a: { productId: string; variantId?: string }, b: { productId: string; variantId?: string }) {
  return a.productId === b.productId && (a.variantId ?? '') === (b.variantId ?? '');
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQty: (productId: string, qty: number, variantId?: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  function addItem(item: Omit<CartItem, 'qty'>, qty = 1) {
    setItems(prev => {
      const existing = prev.find(i => sameLine(i, item));
      if (existing) {
        return prev.map(i =>
          sameLine(i, item) ? { ...i, qty: i.qty + qty } : i
        );
      }
      return [...prev, { ...item, qty }];
    });
  }

  function removeItem(productId: string, variantId?: string) {
    setItems(prev => prev.filter(i => !sameLine(i, { productId, variantId })));
  }

  function updateQty(productId: string, qty: number, variantId?: string) {
    if (qty <= 0) { removeItem(productId, variantId); return; }
    setItems(prev => prev.map(i => sameLine(i, { productId, variantId }) ? { ...i, qty } : i));
  }

  function clearCart() { setItems([]); }

  const totalItems = items.reduce((s, i) => s + i.qty, 0);
  const totalPrice = items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
