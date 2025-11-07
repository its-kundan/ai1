import { useState, useRef, useEffect } from 'react'
import {
  FileText,
  Search,
  Phone,
  Network,
  Receipt,
  ChevronDown,
  Check,
  X
} from 'lucide-react'

/**
 * Premium FeaturesDropdown Component
 * 
 * @param {Object} props
 * @param {Object} props.features - Current feature states {ocr, search, cdr, ipdr, bank}
 * @param {Function} props.onFeatureChange - Callback when features change
 * @param {string} props.placement - 'bottom-right' | 'top-right' (default: 'bottom-right')
 */
const FeaturesDropdown = ({ features = {}, onFeatureChange, placement = 'bottom-right' }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [localFeatures, setLocalFeatures] = useState({
    ocr: features.ocr ?? true, // Default enabled
    search: features.search ?? true, // Default enabled
    cdr: features.cdr ?? false,
    ipdr: features.ipdr ?? false,
    bank: features.bank ?? false,
    ...features
  })
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const dropdownRef = useRef(null)
  const triggerRef = useRef(null)
  const itemRefs = useRef([])

  // Sync with external features prop
  useEffect(() => {
    setLocalFeatures(prev => ({ ...prev, ...features }))
  }, [features])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false)
        setFocusedIndex(-1)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setIsOpen(true)
        }
        return
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          triggerRef.current?.focus()
          break
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((prev) => {
            const next = prev < featureItems.length - 1 ? prev + 1 : 0
            itemRefs.current[next]?.focus()
            return next
          })
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((prev) => {
            const next = prev > 0 ? prev - 1 : featureItems.length - 1
            itemRefs.current[next]?.focus()
            return next
          })
          break
        case 'Enter':
        case ' ':
          if (focusedIndex >= 0 && focusedIndex < featureItems.length) {
            e.preventDefault()
            toggleFeature(featureItems[focusedIndex].key)
          }
          break
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, focusedIndex, localFeatures])

  const featureItems = [
    {
      key: 'ocr',
      icon: FileText,
      title: 'OCR',
      description: 'Extract text & layout from uploaded documents.',
      tooltip: 'Optical Character Recognition extracts text and preserves document structure from images and PDFs.'
    },
    {
      key: 'search',
      icon: Search,
      title: 'Search',
      description: 'Semantic search across indexed documents.',
      tooltip: 'Intelligent search that understands context and meaning, not just keywords.'
    },
    {
      key: 'cdr',
      icon: Phone,
      title: 'CDR',
      description: 'Parse Call Detail Records (telecom).',
      tooltip: 'Extract and analyze call detail records from telecom providers.'
    },
    {
      key: 'ipdr',
      icon: Network,
      title: 'IPDR',
      description: 'Parse IP Data Records.',
      tooltip: 'Process IP Data Records for network traffic analysis.'
    },
    {
      key: 'bank',
      icon: Receipt,
      title: 'Bank statement',
      description: 'Extract transactions & balances.',
      tooltip: 'Automatically extract transaction details, dates, and account balances from bank statements.'
    }
  ]

  const toggleFeature = (key) => {
    const newFeatures = {
      ...localFeatures,
      [key]: !localFeatures[key]
    }
    setLocalFeatures(newFeatures)
    onFeatureChange?.(newFeatures)
    
    // Show toast notification
    const feature = featureItems.find(f => f.key === key)
    showToast(`${feature.title} ${newFeatures[key] ? 'enabled' : 'disabled'} for this chat.`)
  }

  const selectAll = () => {
    const newFeatures = Object.keys(localFeatures).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})
    setLocalFeatures(newFeatures)
    onFeatureChange?.(newFeatures)
    showToast('All features enabled.')
  }

  const deselectAll = () => {
    const newFeatures = Object.keys(localFeatures).reduce((acc, key) => {
      acc[key] = false
      return acc
    }, {})
    setLocalFeatures(newFeatures)
    onFeatureChange?.(newFeatures)
    showToast('All features disabled.')
  }

  const showToast = (message) => {
    // Create toast element
    const toast = document.createElement('div')
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    toast.className = 'fixed bottom-4 right-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in'
    toast.textContent = message
    document.body.appendChild(toast)
    
    setTimeout(() => {
      toast.classList.add('animate-fade-out')
      setTimeout(() => toast.remove(), 300)
    }, 2000)
  }

  const placementClasses = {
    'bottom-right': 'top-full right-0 mt-2',
    'top-right': 'bottom-full right-0 mb-2'
  }

  const enabledCount = Object.values(localFeatures).filter(Boolean).length

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Features menu"
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition-all duration-200 hover:scale-105 active:scale-95"
      >
        <span>Features</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
        {enabledCount > 0 && (
          <span className="px-1.5 py-0.5 text-xs font-semibold bg-cyan-500 text-white rounded-full">
            {enabledCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          role="menu"
          className={`absolute ${placementClasses[placement]} w-80 max-w-[calc(100vw-2rem)] sm:w-80 z-50 glass rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/50 p-2 animate-fade-in`}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200/50 dark:border-gray-700/50">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Features</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Select which augmentations should apply to this chat.
            </p>
          </div>

          {/* Feature Items */}
          <div className="py-2 max-h-96 overflow-y-auto">
            {featureItems.map((item, index) => {
              const Icon = item.icon
              const isEnabled = localFeatures[item.key]
              
              return (
                <div
                  key={item.key}
                  ref={(el) => (itemRefs.current[index] = el)}
                  role="menuitemcheckbox"
                  aria-checked={isEnabled}
                  tabIndex={focusedIndex === index ? 0 : -1}
                  onClick={() => toggleFeature(item.key)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className="group flex items-center gap-3 px-4 py-3 mx-1 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/50 dark:hover:bg-gray-700/50 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1"
                  title={item.tooltip}
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    isEnabled
                      ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {item.description}
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex-shrink-0">
                    <div
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                        isEnabled
                          ? 'bg-cyan-500 dark:bg-cyan-600'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                          isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer Actions */}
          <div className="px-4 py-3 border-t border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Select all
              </button>
              <button
                onClick={deselectAll}
                className="text-xs px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Deselect all
              </button>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-1.5 text-sm font-medium bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
            >
              Apply
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

export default FeaturesDropdown

