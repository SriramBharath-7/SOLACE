import { useEffect, useRef } from 'react'
import { CAMERA } from '../constants'
import { playerState } from '../utils/playerState'

export const gameplayInput = { active: false }

export function useMouseOrbit(canvas: HTMLCanvasElement) {
  const orbit = useRef({ yaw: playerState.cameraAzimuth, pitch: -0.12 })

  useEffect(() => {
    const supportsPointerLock = typeof canvas.requestPointerLock === 'function'
    let dragging = false
    let previousX = 0
    let previousY = 0

    const setActive = (active: boolean) => {
      if (gameplayInput.active === active) return
      gameplayInput.active = active
      window.dispatchEvent(new CustomEvent('solace-controlchange', { detail: active }))
    }
    const rotate = (dx: number, dy: number) => {
      orbit.current.yaw -= dx * CAMERA.azimuthSensitivity
      orbit.current.pitch = Math.max(
        CAMERA.minPitch,
        Math.min(CAMERA.maxPitch, orbit.current.pitch - dy * CAMERA.pitchSensitivity),
      )
      // Publish input before Explorer's frame callback, as in the reference.
      playerState.cameraAzimuth = orbit.current.yaw
    }
    const onClick = () => {
      if (!supportsPointerLock) {
        setActive(true)
        return
      }
      if (document.pointerLockElement === canvas) return
      void Promise.resolve(canvas.requestPointerLock()).catch(() => setActive(false))
    }
    const onLockChange = () => setActive(document.pointerLockElement === canvas)
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement === canvas) rotate(event.movementX, event.movementY)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (supportsPointerLock || event.button !== 0) return
      setActive(true)
      dragging = true
      previousX = event.clientX
      previousY = event.clientY
      canvas.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return
      rotate(event.clientX - previousX, event.clientY - previousY)
      previousX = event.clientX
      previousY = event.clientY
    }
    const onPointerUp = () => { dragging = false }
    const pause = () => {
      dragging = false
      setActive(false)
      if (document.pointerLockElement === canvas) document.exitPointerLock()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') pause()
    }

    canvas.addEventListener('click', onClick)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('pointerlockchange', onLockChange)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', pause)
    return () => {
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onLockChange)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', pause)
      pause()
    }
  }, [canvas])

  return orbit
}
