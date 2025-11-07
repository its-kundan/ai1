// Theme management utilities

const THEME_STORAGE_KEY = 'chatgpt-local-theme'

export const themes = {
  light: 'light',
  dark: 'dark'
}

export const getStoredTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored && (stored === themes.light || stored === themes.dark)) {
      return stored
    }
  } catch (error) {
    console.error('Error reading theme from storage:', error)
  }
  
  // Fallback to system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return themes.dark
  }
  
  return themes.light
}

export const setTheme = (theme) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
    document.documentElement.setAttribute('data-theme', theme)
    
    // Remove dark class if it exists
    if (theme === themes.dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  } catch (error) {
    console.error('Error saving theme to storage:', error)
  }
}

export const initTheme = () => {
  const theme = getStoredTheme()
  setTheme(theme)
  
  // Listen for system theme changes
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      // Only auto-switch if user hasn't manually set a preference
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (!stored) {
        setTheme(e.matches ? themes.dark : themes.light)
      }
    })
  }
}

