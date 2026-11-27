const THEME_MIGRATION_KEY = 'profile_theme_light_default_migrated'

export function getThemePreference() {
  const savedTheme = localStorage.getItem('profile_theme')

  if (localStorage.getItem(THEME_MIGRATION_KEY) !== 'true') {
    if (!savedTheme || savedTheme === 'system') {
      localStorage.setItem('profile_theme', 'light')
    }
    localStorage.setItem(THEME_MIGRATION_KEY, 'true')
  }

  return localStorage.getItem('profile_theme') || 'light'
}
