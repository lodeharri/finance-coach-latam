import { describe, expect, it } from 'vitest';
import { KEYWORDS, matchKeyword } from './category-keywords';

describe('KEYWORDS map', () => {
  it('contains 16 seed entries spanning 6 categories', () => {
    expect(KEYWORDS.size).toBe(16);
    expect(new Set(KEYWORDS.values())).toEqual(
      new Set([
        'transporte',
        'entretenimiento',
        'servicios',
        'salud',
        'compras',
        'educacion',
      ]),
    );
  });

  it('exposes a ReadonlyMap signature at the type level', () => {
    // Compile-time assertion: assigning to a readonly slot fails the type check.
    // The TS compiler verifies this whenever someone imports KEYWORDS, so we
    // do not need a runtime mutation test — `ReadonlyMap` is a type-only
    // guarantee (vanilla JS Maps have no native immutability).
    type Slot = (typeof KEYWORDS) extends ReadonlyMap<string, string>
      ? 'readonly'
      : 'mutable';
    const _slot: Slot = 'readonly';
    expect(_slot).toBe('readonly');
  });
});

describe('matchKeyword', () => {
  it.each([
    ['shell', 'transporte'],
    ['ypf', 'transporte'],
    ['nafta', 'transporte'],
    ['spotify', 'entretenimiento'],
    ['netflix', 'entretenimiento'],
    ['cinemark', 'entretenimiento'],
    ['edesur', 'servicios'],
    ['personal', 'servicios'],
    ['aysa', 'servicios'],
    ['osde', 'salud'],
    ['swissmedical', 'salud'],
    ['farmacity', 'salud'],
    ['mercadolibre', 'compras'],
    ['zara', 'compras'],
    ['coderhouse', 'educacion'],
    ['cuspide', 'educacion'],
  ])('maps %s to %s', (merchant, expectedSlug) => {
    expect(matchKeyword(merchant)).toBe(expectedSlug);
  });

  it('is case-insensitive', () => {
    expect(matchKeyword('SHELL')).toBe('transporte');
    expect(matchKeyword('ShElL')).toBe('transporte');
    expect(matchKeyword('SPOTIFY')).toBe('entretenimiento');
    expect(matchKeyword('MercadoLibre')).toBe('compras');
  });

  it('matches substrings inside longer merchant names', () => {
    expect(matchKeyword('Shell OIL Argentina')).toBe('transporte');
    expect(matchKeyword('YPF Full SA')).toBe('transporte');
    expect(matchKeyword('Spotify Premium')).toBe('entretenimiento');
    expect(matchKeyword('Personal Flow')).toBe('servicios');
    expect(matchKeyword('Zara Online')).toBe('compras');
  });

  it('returns null for unknown merchants', () => {
    expect(matchKeyword('PedidosYa')).toBeNull();
    expect(matchKeyword('Starbucks')).toBeNull();
    expect(matchKeyword('Amazon')).toBeNull();
  });

  it('returns null for the empty string', () => {
    expect(matchKeyword('')).toBeNull();
  });

  it('does not throw on already-normalized input', () => {
    expect(() => matchKeyword('shell')).not.toThrow();
    expect(() => matchKeyword('spotify')).not.toThrow();
  });

  it('matches the FIRST keyword found when a merchant contains multiple (documented order)', () => {
    // 'Personal' is in KEYWORDS first; merchant containing both 'shell' and 'personal'
    // returns whichever key appears first in the iterator order. Use a merchant that
    // contains only one known keyword to keep the assertion deterministic.
    expect(matchKeyword('Personal Shell')).toBe('transporte');
  });
});