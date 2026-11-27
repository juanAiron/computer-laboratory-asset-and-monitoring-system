// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { getThemePreference } from './theme'

afterEach(() => {
  localStorage.clear()
})

describe('theme preference defaults', () => {
  it('uses Light when no theme has been saved', () => {
    expect(getThemePreference()).toBe('light')
    expect(localStorage.getItem('profile_theme')).toBe('light')
  })

  it('migrates the previous System default to Light once', () => {
    localStorage.setItem('profile_theme', 'system')

    expect(getThemePreference()).toBe('light')

    localStorage.setItem('profile_theme', 'system')
    expect(getThemePreference()).toBe('system')
  })

  it('preserves an existing explicit Light or Dark preference', () => {
    localStorage.setItem('profile_theme', 'dark')

    expect(getThemePreference()).toBe('dark')
  })
})
