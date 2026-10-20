import { useEffect } from 'react'

export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · BladderSense` : 'BladderSense: a bladder diary your doctor can use'
  }, [title])
}
