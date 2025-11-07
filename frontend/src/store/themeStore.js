import { create } from 'zustand'
import { themes, getStoredTheme, setTheme as applyTheme } from '../utils/theme'

export const useThemeStore = create((set, get) => ({
  theme: getStoredTheme(),
  
  toggleTheme: () => {
    const currentTheme = get().theme
    const newTheme = currentTheme === themes.dark ? themes.light : themes.dark
    
    // Apply theme to DOM immediately
    applyTheme(newTheme)
    
    // Update store state
    set({ theme: newTheme })
  },
  
  setTheme: (theme) => {
    // Apply theme to DOM immediately
    applyTheme(theme)
    
    // Update store state
    set({ theme })
  },
  
  initialize: () => {
    const currentTheme = getStoredTheme()
    
    // Apply theme to DOM immediately
    applyTheme(currentTheme)
    
    // Update store state
    set({ theme: currentTheme })
  }
}))

