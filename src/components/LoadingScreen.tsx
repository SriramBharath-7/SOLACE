import { useProgress } from '@react-three/drei'

export default function LoadingScreen() {
  const { active, progress } = useProgress()

  if (!active) return null

  return (
    <div className="solace-loading">
      <div className="mark">SOLACE</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
