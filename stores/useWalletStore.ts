import { create } from 'zustand';
import { walletService } from '@/services/walletService';
import type { Wallet, NewWallet } from '@/db/schema';

type WalletStore = {
  wallets: Wallet[];
  totalBalance: number;
  selectedWalletId: string | null;
  isLoading: boolean;

  // Actions
  loadWallets: () => Promise<void>;
  addWallet: (data: Omit<NewWallet, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateWallet: (id: string, data: Partial<Omit<NewWallet, 'id' | 'createdAt'>>) => Promise<void>;
  deleteWallet: (id: string) => Promise<void>;
  transfer: (fromId: string, toId: string, amount: number) => Promise<void>;
  selectWallet: (id: string | null) => void;
  refreshTotalBalance: () => Promise<void>;
};

export const useWalletStore = create<WalletStore>((set) => ({
  wallets: [],
  totalBalance: 0,
  selectedWalletId: null,
  isLoading: false,

  loadWallets: async () => {
    set({ isLoading: true });
    try {
      const [allWallets, total] = await Promise.all([
        walletService.getAll(),
        walletService.getTotalBalance(),
      ]);
      set({ wallets: allWallets, totalBalance: total });
    } finally {
      set({ isLoading: false });
    }
  },

  addWallet: async (data) => {
    set({ isLoading: true });
    try {
      const id = await walletService.create(data);
      const [allWallets, total] = await Promise.all([
        walletService.getAll(),
        walletService.getTotalBalance(),
      ]);
      set({ wallets: allWallets, totalBalance: total });
      return id;
    } finally {
      set({ isLoading: false });
    }
  },

  updateWallet: async (id, data) => {
    set({ isLoading: true });
    try {
      await walletService.update(id, data);
      const [allWallets, total] = await Promise.all([
        walletService.getAll(),
        walletService.getTotalBalance(),
      ]);
      set({ wallets: allWallets, totalBalance: total });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteWallet: async (id) => {
    set({ isLoading: true });
    try {
      await walletService.delete(id);
      const [allWallets, total] = await Promise.all([
        walletService.getAll(),
        walletService.getTotalBalance(),
      ]);
      set({ wallets: allWallets, totalBalance: total });
    } finally {
      set({ isLoading: false });
    }
  },

  transfer: async (fromId, toId, amount) => {
    set({ isLoading: true });
    try {
      await walletService.transfer(fromId, toId, amount);
      const [allWallets, total] = await Promise.all([
        walletService.getAll(),
        walletService.getTotalBalance(),
      ]);
      set({ wallets: allWallets, totalBalance: total });
    } finally {
      set({ isLoading: false });
    }
  },

  selectWallet: (id) => set({ selectedWalletId: id }),

  refreshTotalBalance: async () => {
    const total = await walletService.getTotalBalance();
    set({ totalBalance: total });
  },
}));
