// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { normalizeLanguage, translateText, useTranslation } from './i18n'

afterEach(() => {
  localStorage.removeItem('profile_language')
  document.documentElement.lang = 'en'
})

describe('language translations', () => {
  it('translates app labels into Tagalog', () => {
    expect(translateText('Preferences', 'Tagalog')).toBe('Mga Kagustuhan')
  })

  it('keeps English labels when English is selected', () => {
    expect(translateText('Preferences', 'English')).toBe('Preferences')
  })

  it('continues to recognize previously saved Filipino preferences', () => {
    expect(normalizeLanguage('Filipino')).toBe('Tagalog')
  })

  it('updates the visible language when the preference changes', () => {
    localStorage.setItem('profile_language', 'English')
    const { result, unmount } = renderHook(() => useTranslation())

    act(() => {
      localStorage.setItem('profile_language', 'Tagalog')
      window.dispatchEvent(new Event('app-language-change'))
    })

    expect(result.current.t('Preferences')).toBe('Mga Kagustuhan')
    expect(document.documentElement.lang).toBe('tl')
    unmount()
  })
})
