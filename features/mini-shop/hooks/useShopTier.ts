import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '@/lib/api/client';
import { entitlementService } from '@/services/entitlementService';
import type { ShopTier } from '../config/shopTierConfig';

export interface ShopTierState {
  tier: ShopTier;
  loading: boolean;
}

export function useShopTier(): ShopTierState {
  const [tier, setTier] = useState<ShopTier>('free');
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    async function check() {
      // อ่านค่า SQLite ก่อน (fast path)
      const cached = await entitlementService.isPackageEnabled('pkg-05-marketplace');
      if (cached) {
        setTier('pro');
        setLoading(false);
        return;
      }
      // SQLite ว่าง (install ใหม่) → ดึงจาก API แล้วบันทึก
      try {
        const res = await api.getEntitlement();
        if (res.ok) {
          const enabled = res.data.features.pkg05Shop;
          await entitlementService.setPackageEnabled('pkg-05-marketplace', enabled);
          setTier(enabled ? 'pro' : 'free');
        }
      } catch { /* network ล้มเหลว — ใช้ค่า default */ }
      setLoading(false);
    }
    check();
  }, []));

  return { tier, loading };
}
