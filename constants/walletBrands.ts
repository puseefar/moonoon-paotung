import type { ImageSourcePropType } from 'react-native';

export const BRAND_ICON_PREFIX = 'brand:';

export type WalletBrandKey =
  | 'krungthai'
  | 'kbank'
  | 'krungsri'
  | 'scb'
  | 'bangkok-bank'
  | 'gsb'
  | 'baac';

export type WalletBrandPreset = {
  key: WalletBrandKey;
  name: string;
  shortName: string;
  color: string;
  backgroundColor: string;
  icon?: ImageSourcePropType;
  fallbackEmoji: string;
};

export const GENERIC_WALLET_ICONS = ['💵', '👛', '🏦', '💳', '🪙', '🐷', '👜', '📌', '🎯', '🧾'];

export const WALLET_BRAND_PRESETS: WalletBrandPreset[] = [
  {
    key: 'krungthai',
    name: 'ธนาคารกรุงไทย',
    shortName: 'กรุงไทย',
    color: '#12A7F5',
    backgroundColor: '#E1F5FE',
    icon: require('../assets/bank-icons/krungthai.png'),
    fallbackEmoji: '🏦',
  },
  {
    key: 'kbank',
    name: 'ธนาคารกสิกรไทย',
    shortName: 'กสิกร',
    color: '#138A63',
    backgroundColor: '#E3F5EE',
    icon: require('../assets/bank-icons/kbank.png'),
    fallbackEmoji: '🏦',
  },
  {
    key: 'krungsri',
    name: 'ธนาคารกรุงศรีอยุธยา',
    shortName: 'กรุงศรี',
    color: '#8C775D',
    backgroundColor: '#F5EFE6',
    icon: require('../assets/bank-icons/krungsri.png'),
    fallbackEmoji: '🏦',
  },
  {
    key: 'scb',
    name: 'ธนาคารไทยพาณิชย์',
    shortName: 'SCB',
    color: '#5D2FB9',
    backgroundColor: '#F0E9FF',
    icon: require('../assets/bank-icons/scb.png'),
    fallbackEmoji: '🏦',
  },
  {
    key: 'bangkok-bank',
    name: 'ธนาคารกรุงเทพ',
    shortName: 'BBL',
    color: '#1460F2',
    backgroundColor: '#E8F0FF',
    icon: require('../assets/bank-icons/bangkok-bank.png'),
    fallbackEmoji: '🏦',
  },
  {
    key: 'gsb',
    name: 'ธนาคารออมสิน',
    shortName: 'GSB',
    color: '#E61B84',
    backgroundColor: '#FFE7F3',
    icon: require('../assets/bank-icons/gsb.png'),
    fallbackEmoji: '🏦',
  },
  {
    key: 'baac',
    name: 'ธ.ก.ส.',
    shortName: 'ธ.ก.ส.',
    color: '#2E8B57',
    backgroundColor: '#E5F5EC',
    icon: require('../assets/bank-icons/baac.png'),
    fallbackEmoji: '🌾',
  },
];

export function makeWalletBrandIcon(key: WalletBrandKey) {
  return `${BRAND_ICON_PREFIX}${key}`;
}

export function getWalletBrandKey(icon?: string | null): WalletBrandKey | null {
  if (!icon || !icon.startsWith(BRAND_ICON_PREFIX)) {
    return null;
  }

  const key = icon.slice(BRAND_ICON_PREFIX.length) as WalletBrandKey;
  return WALLET_BRAND_PRESETS.some((brand) => brand.key === key) ? key : null;
}

export function getWalletBrandPreset(icon?: string | null): WalletBrandPreset | null {
  const key = getWalletBrandKey(icon);
  if (!key) {
    return null;
  }

  return WALLET_BRAND_PRESETS.find((brand) => brand.key === key) ?? null;
}

export function getWalletDisplayType(icon?: string | null) {
  return getWalletBrandKey(icon) ? 'บัญชีธนาคาร' : 'กระเป๋าเงิน';
}
