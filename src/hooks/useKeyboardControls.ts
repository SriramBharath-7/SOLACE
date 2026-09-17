import { useEffect, useRef } from 'react'
import { gameplayInput } from './useMouseOrbit'

export interface InputState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  sprint: boolean
}

const KEY_MAP: Record<string, keyof Omit<InputState, 'sprint'>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
}

/** Lightweight keyboard state ref — read inside useFrame, never triggers
 * React re-renders. */
export function useKeyboardControls() {
  const state = useRef<InputState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!gameplayInput.active) return
      if (KEY_MAP[e.code] || e.code === 'ShiftLeft' || e.code === 'ShiftRight') e.preventDefault()
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') state.current.sprint = true
      const key = KEY_MAP[e.code]
      if (key) state.current[key] = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') state.current.sprint = false
      const key = KEY_MAP[e.code]
      if (key) state.current[key] = false
    }
    const onBlur = () => {
      state.current = { forward: false, backward: false, left: false, right: false, sprint: false }
    }
    const onControlChange = () => {
      if (!gameplayInput.active) onBlur()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('solace-controlchange', onControlChange)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('solace-controlchange', onControlChange)
    }
  }, [])

  return state
}
