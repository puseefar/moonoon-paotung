import { appSettingsService } from './appSettingsService';

export type PackageId =
  | 'pkg-02-budget'
  | 'pkg-03-bills'
  | 'pkg-07-goals'
  | 'pkg-14-estimator'
  | 'pkg-16-category'
  | 'pkg-17-taxbox'
  | 'pkg-01-diary'
  | 'pkg-05-marketplace'
  | 'pkg-13-social'
  | 'pkg-15-payment';

const PACKAGE_DEFAULTS: Record<PackageId, boolean> = {
  'pkg-02-budget': true,
  'pkg-03-bills': true,
  'pkg-07-goals': true,
  'pkg-14-estimator': true,
  'pkg-16-category': true,
  'pkg-17-taxbox': true,
  'pkg-01-diary': false,
  'pkg-05-marketplace': false,
  'pkg-13-social': false,
  'pkg-15-payment': false,
};

export const entitlementService = {
  async isPackageEnabled(pkg: PackageId): Promise<boolean> {
    try {
      const val = await appSettingsService.get(`entitlement.${pkg}`);
      if (val === null) return PACKAGE_DEFAULTS[pkg];
      return val === 'true';
    } catch {
      return PACKAGE_DEFAULTS[pkg];
    }
  },

  async setPackageEnabled(pkg: PackageId, enabled: boolean): Promise<void> {
    await appSettingsService.set(`entitlement.${pkg}`, String(enabled));
  },

  async getAllPackageStates(): Promise<Record<PackageId, boolean>> {
    const ids = Object.keys(PACKAGE_DEFAULTS) as PackageId[];
    const entries = await Promise.all(
      ids.map(async (id) => [id, await this.isPackageEnabled(id)] as const)
    );
    return Object.fromEntries(entries) as Record<PackageId, boolean>;
  },
};
