import { describe, it, expect } from 'vitest';
import { partitionProfile, STANDARD_FIELDS } from '../src/shared/profile.js';

describe('partitionProfile', () => {
  it('separates standard keys from custom keys', () => {
    const { standard, custom } = partitionProfile({
      fullName: 'Arthur',
      email: 'a@b.com',
      linkedin: 'arthur',
      favouriteColour: 'blue',
    });
    expect(standard).toEqual({ fullName: 'Arthur', email: 'a@b.com' });
    expect(custom).toEqual({ linkedin: 'arthur', favouriteColour: 'blue' });
  });

  it('handles an empty profile', () => {
    expect(partitionProfile()).toEqual({ standard: {}, custom: {} });
  });

  it('exposes a stable set of standard fields', () => {
    expect(STANDARD_FIELDS.find((f) => f.key === 'email')).toBeTruthy();
  });
});
