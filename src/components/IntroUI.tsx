import { useEffect, useState } from 'react'
import { playerState } from '../utils/playerState'
import { LANDMARKS } from '../constants'
import { pathSamples, trailLength, nearestPath } from '../utils/path'

const mapPoint=(x:number,z:number)=>[28+(x+160)*0.69,36+(z+390)*0.46]
const mapRoute=pathSamples.filter((_,i)=>i%10===0).map(p=>mapPoint(p.x,p.z).join(',')).join(' ')

export default function IntroUI(){
  const [active,setActive]=useState(false),[entered,setEntered]=useState(false)
  const [map,setMap]=useState(false)
  const [location,setLocation]=useState({region:0,altitude:52,x:-94,z:220,progress:0})
  useEffect(()=>{
    const update=()=>{
      const p=playerState.position
      const region=p.z>80?0:p.z>-78?1:p.x<55?2:3
      const near=nearestPath(p.x,p.z)
      setLocation(old=>({region,altitude:Math.round(p.y),x:p.x,z:p.z,progress:Number.isFinite(near.distance)?near.progress:old.progress}))
    }
    const control=(e:Event)=>{const on=(e as CustomEvent<boolean>).detail;setActive(on);if(on)setEntered(true)}
    const key=(e:KeyboardEvent)=>{
      if(e.code==='KeyM')setMap(v=>!v)
      if(e.code==='Escape')setMap(false)
    }
    const timer=window.setInterval(update,350)
    window.addEventListener('solace-controlchange',control)
    window.addEventListener('keydown',key)
    return()=>{clearInterval(timer);window.removeEventListener('solace-controlchange',control);window.removeEventListener('keydown',key)}
  },[])
  const here=LANDMARKS[location.region]
  const point=mapPoint(location.x,location.z)
  return <div className="solace-ui">
    <header className="wordmark"><span>S O L A C E</span><small>A JOURNEY THROUGH SRI</small></header>
    <nav className="journey" aria-label="Journey regions">
      {LANDMARKS.map((l,i)=><span key={l.name} className={i===location.region?'current':''}><i/>{l.name}</span>)}
    </nav>
    <div className="location"><div className="eyebrow">0{location.region+1} / THE VALLEY</div>
      <h1>{here.name}</h1><p>{here.subtitle}</p>
      <div className="elevation"><span>{location.altitude} M ELEVATION</span><span>{Math.round(trailLength*(1-location.progress))} M TO HORIZON</span></div>
    </div>
    {!active&&<div className="enter-panel">
      {!entered&&<p>There is no hurry.<br/>Follow the path. See where it leads.</p>}
      <button onClick={()=>document.querySelector('canvas')?.click()}>{entered?'Continue exploring':'Enter the valley'} <span>↗</span></button>
      <small>Click to look around · Esc to release</small>
    </div>}
    <div className="controls"><span><kbd>W A S D</kbd> walk</span><span><kbd>SHIFT</kbd> wander faster</span><span>Mouse to look</span><span><kbd>M</kbd> trail map</span></div>
    <button className="map-toggle" onClick={()=>setMap(v=>!v)} aria-label={map?'Close trail map':'Open trail map'} aria-expanded={map}>⌁ <span>TRAIL MAP</span></button>
    {map&&<aside className="trail-map" aria-label="Valley trail map">
      <div className="map-heading">THE LONG WAY HOME<button onClick={()=>setMap(false)} aria-label="Close trail map">×</button></div>
      <svg viewBox="0 0 300 350" role="img" aria-label="Trail from Origin through Craft and Curiosity to Horizon">
        <path d="M170 20 Q180 70 150 115 T160 205 T142 330" className="map-river"/>
        <polyline points={mapRoute} className="map-route"/>
        {LANDMARKS.map(l=>{const [x,y]=mapPoint(l.position[0],l.position[2]);return <g key={l.name}><circle cx={x} cy={y} r="3"/><text x={x+9} y={y+4}>{l.name}</text></g>})}
        <circle cx={point[0]} cy={point[1]} r="5" className="map-you"/>
        <text x="22" y="24" className="north">N ↑</text>
      </svg>
      <p>A continuous walk · {Math.round(trailLength)} metres</p>
    </aside>}
  </div>
}

