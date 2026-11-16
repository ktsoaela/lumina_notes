import { describe, expect, it } from 'vitest';
import { compareVersions, isNewer, pickAsset, type ReleaseAsset } from './version';

describe('compareVersions', () => {
  it('orders semver parts numerically', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('v1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('1.2', '1.2.1')).toBeLessThan(0);
    expect(compareVersions('2.0.0-beta', '1.9.0')).toBeGreaterThan(0);
  });

  it('isNewer compares against a given current version', () => {
    expect(isNewer('1.3.0', '1.2.0')).toBe(true);
    expect(isNewer('1.2.0', '1.2.0')).toBe(false);
  });
});

describe('pickAsset', () => {
  const assets: ReleaseAsset[] = [
    { name: 'Lumina-Notes.exe', url: 'w', size: 1 },
    { name: 'LuminaNotes-1.3.0-macOS-x64.dmg', url: 'm', size: 1 },
    { name: 'LuminaNotes-1.3.0-Linux-x86_64.AppImage', url: 'l', size: 1 },
    { name: 'Lumina-Notes-android.apk', url: 'a', size: 1 },
  ];
  it('finds the installer for each platform', () => {
    expect(pickAsset(assets, 'windows')?.url).toBe('w');
    expect(pickAsset(assets, 'mac')?.url).toBe('m');
    expect(pickAsset(assets, 'linux')?.url).toBe('l');
    expect(pickAsset(assets, 'android')?.url).toBe('a');
  });
});
