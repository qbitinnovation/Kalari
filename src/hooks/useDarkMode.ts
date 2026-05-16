import { useState, useEffect } from 'react'

export const useDarkMode = () => {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const checkDarkMode = () => {
      setDarkMode(document.documentElement.classList.contains('dark'))
    }
    
    checkDarkMode()
    
    // Listen for changes
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    
    return () => observer.disconnect()
  }, [])

  return darkMode
}
