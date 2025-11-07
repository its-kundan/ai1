import { useEffect } from 'react'
import { Sun, Moon, Settings } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'

const TopBar = () => {
  const { theme, toggleTheme } = useThemeStore()
  
  // Ensure theme is initialized on mount
  useEffect(() => {
    useThemeStore.getState().initialize()
  }, [])

  return (
    <div className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 shadow-sm">
      {/* Left: App Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          ChatGPT Local Demo
        </h1>
      </div>

      {/* Center: Optional breadcrumb (empty for now) */}
      <div className="flex-1"></div>

      {/* Right: Theme Toggle + Settings */}
      <div className="flex items-center gap-2">
        {/* Dark Theme Toggle */}
        <button
          onClick={(e) => {
            e.preventDefault()
            toggleTheme()
          }}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
          type="button"
        >
          <div className="relative w-10 h-6">
            {/* Toggle Track */}
            <div
              className={`absolute inset-0 rounded-full transition-colors duration-300 ${
                theme === 'dark'
                  ? 'bg-cyan-500 dark:bg-cyan-600'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
            
            {/* Toggle Thumb */}
            <div
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 flex items-center justify-center ${
                theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
              }`}
            >
              {theme === 'dark' ? (
                <Moon className="w-3 h-3 text-cyan-600" />
              ) : (
                <Sun className="w-3 h-3 text-gray-400" />
              )}
            </div>
          </div>
        </button>

        {/* Settings Icon */}
        <button
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    </div>
  )
}

export default TopBar
