import { create } from 'zustand'
import { themes, getStoredTheme, setTheme as applyTheme } from '../utils/theme'

export const useThemeStore = create((set) => ({
  theme: getStoredTheme(),
  
  toggleTheme: () => {
    set((state) => {
      const newTheme = state.theme === themes.dark ? themes.light : themes.dark
      applyTheme(newTheme)
      return { theme: newTheme }
    })
  },
  
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
  
  initialize: () => {
    const currentTheme = getStoredTheme()
    applyTheme(currentTheme)
    set({ theme: currentTheme })
  }
}))

