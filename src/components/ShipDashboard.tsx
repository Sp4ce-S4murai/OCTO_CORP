"use client";

import { ShipState, AlertSeverity } from "@/types/ship";
import { AlertTriangle, Shield, Crosshair, Radio, Heart, Fuel, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

interface ShipDashboardProps {
    ship: ShipState;
}

const STATION_META_RADAR: Record<string, {
    label: string; shortLabel: string; color: string; stroke: string;
    angle: number; icon: React.ReactNode;
}> = {
    bridge:      { label: 'PONTE',     shortLabel: 'PIL', color: '#3b82f6', stroke: 'stroke-blue-500',   angle: 315, icon: <ChevronRight size={10} /> },
    tactical:    { label: 'TÁTICA',    shortLabel: 'ART', color: '#ef4444', stroke: 'stroke-red-500',    angle: 45,  icon: <Crosshair size={10} /> },
    engineering: { label: 'ENGENHARIA',shortLabel: 'ENG', color: '#f59e0b', stroke: 'stroke-amber-500',  angle: 135, icon: <Radio size={10} /> },
    science:     { label: 'CIÊNCIA',   shortLabel: 'CIE', color: '#a855f7', stroke: 'stroke-purple-500', angle: 225, icon: <Heart size={10} /> },
};

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
    info:         'border-blue-800 bg-blue-950/30 text-blue-400',
    warning:      'border-amber-800 bg-amber-950/30 text-amber-400',
    critical:     'border-red-800 bg-red-950/50 text-red-400 animate-pulse',
    catastrophic: 'border-red-500 bg-red-900/80 text-red-100 animate-pulse',
};

export function ShipDashboard({ ship }: ShipDashboardProps) {
    const hpPercent = ship.hp.max > 0 ? (ship.hp.current / ship.hp.max) * 100 : 0;
    const [prevHp, setPrevHp] = useState(ship.hp.current);
    const [flashDamage, setFlashDamage] = useState(false);
    const [radarAngle, setRadarAngle] = useState(0);

    useEffect(() => {
        if (ship.hp.current < prevHp) {
            setFlashDamage(true);
            setTimeout(() => setFlashDamage(false), 900);
        }
        setPrevHp(ship.hp.current);
    }, [ship.hp.current]);

    // Spinning radar sweep
    useEffect(() => {
        const interval = setInterval(() => {
            setRadarAngle(a => (a + 1.5) % 360);
        }, 30);
        return () => clearInterval(interval);
    }, []);

    const hpColor = hpPercent <= 25 ? '#dc2626' : hpPercent <= 50 ? '#f59e0b' : '#10b981';
    const alerts = ship.alerts
        ? Object.values(ship.alerts).sort((a, b) => b.timestamp - a.timestamp).slice(0, 2)
        : [];

    const cx = 120, cy = 120, r = 100;

    // Station positions around radar
    const stationKeys = ['bridge', 'tactical', 'engineering', 'science'];

    return (
        <div className={`border-2 bg-zinc-950/95 transition-all duration-300 relative overflow-hidden ${
            hpPercent <= 25 ? 'border-red-600' : hpPercent <= 50 ? 'border-amber-700' : 'border-cyan-900'
        } ${flashDamage ? 'ring-4 ring-red-500/40' : ''}`}>

            {flashDamage && (
                <div className="absolute inset-0 bg-red-900/25 pointer-events-none z-10 animate-pulse" />
            )}

            {/* Top nav bar */}
            <div className="flex items-center justify-between px-5 py-2 border-b border-cyan-900/50 bg-cyan-950/10">
                <div className="flex items-center gap-3">
                    <Shield size={16} className="text-cyan-500" />
                    <span className="text-sm font-bold tracking-[0.2em] text-cyan-400 uppercase">
                        {ship.name}
                    </span>
                    <span className="text-[10px] text-cyan-700 font-mono tracking-widest">// {ship.class}</span>
                </div>
                <div className="flex gap-4 text-[10px] font-bold tracking-widest text-cyan-700">
                    <span className="text-cyan-500">AR<span className="ml-1 text-white">{ship.stats.armor}</span></span>
                    <span className="text-red-500">CBT<span className="ml-1 text-white">{ship.stats.combat}</span></span>
                    <span className="text-blue-500">SPD<span className="ml-1 text-white">{ship.stats.speed}</span></span>
                    <span className="text-purple-500">SNS<span className="ml-1 text-white">{ship.stats.sensors}</span></span>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-0">

                {/* LEFT: Radar SVG */}
                <div className="flex items-center justify-center p-4 md:p-6 flex-shrink-0">
                    <div className="relative">
                        <svg width={240} height={240} viewBox="0 0 240 240" className="overflow-visible">
                            {/* Background circle fill */}
                            <circle cx={cx} cy={cy} r={r + 8} fill="#050a0a" />

                            {/* Concentric rings */}
                            {[25, 50, 75, 100].map(pct => (
                                <circle key={pct} cx={cx} cy={cy} r={r * pct / 100}
                                    fill="none" stroke="#0f4040" strokeWidth={pct === 100 ? 1.5 : 0.75} strokeDasharray="3 4" />
                            ))}

                            {/* Cross hairs */}
                            <line x1={cx} y1={cy - r - 8} x2={cx} y2={cy + r + 8} stroke="#0f4040" strokeWidth={0.75} />
                            <line x1={cx - r - 8} y1={cy} x2={cx + r + 8} y2={cy} stroke="#0f4040" strokeWidth={0.75} />
                            <line x1={cx - r * 0.707 - 5} y1={cy - r * 0.707 - 5} x2={cx + r * 0.707 + 5} y2={cy + r * 0.707 + 5} stroke="#0a3030" strokeWidth={0.5} />
                            <line x1={cx + r * 0.707 + 5} y1={cy - r * 0.707 - 5} x2={cx - r * 0.707 - 5} y2={cy + r * 0.707 + 5} stroke="#0a3030" strokeWidth={0.5} />

                            {/* Radar sweep gradient */}
                            <defs>
                                <radialGradient id="sweep" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor="#00ffaa" stopOpacity="0.15" />
                                    <stop offset="100%" stopColor="#00ffaa" stopOpacity="0" />
                                </radialGradient>
                            </defs>
                            <g transform={`rotate(${radarAngle} ${cx} ${cy})`}>
                                <path
                                    d={`M${cx},${cy} L${cx + r},${cy} A${r},${r} 0 0,1 ${
                                        cx + r * Math.cos(-70 * Math.PI / 180)},${cy + r * Math.sin(-70 * Math.PI / 180)} Z`}
                                    fill="url(#sweep)"
                                />
                                <line x1={cx} y1={cy} x2={cx + r + 6} y2={cy}
                                    stroke="#00ffaa" strokeWidth={1.5} strokeOpacity={0.7} />
                            </g>

                            {/* HP Arc */}
                            {(() => {
                                const arcR = r + 15;
                                const arcAngle = (hpPercent / 100) * 360;
                                const rad = (arcAngle - 90) * Math.PI / 180;
                                const x2 = cx + arcR * Math.cos(rad);
                                const y2 = cy + arcR * Math.sin(rad);
                                const large = arcAngle > 180 ? 1 : 0;
                                return (
                                    <path
                                        d={`M${cx},${cy - arcR} A${arcR},${arcR} 0 ${large},1 ${x2},${y2}`}
                                        fill="none" stroke={hpColor} strokeWidth={3}
                                        strokeLinecap="round" opacity={0.8}
                                    />
                                );
                            })()}

                            {/* Station nodes */}
                            {stationKeys.map(key => {
                                const meta = STATION_META_RADAR[key];
                                const angleRad = (meta.angle - 90) * Math.PI / 180;
                                const nx = cx + r * Math.cos(angleRad);
                                const ny = cy + r * Math.sin(angleRad);
                                const station = ship.stations[key];
                                const occupants = station?.occupants ? Object.values(station.occupants) : [];
                                const hasAction = ship.combat?.isActive &&
                                    ship.combat.actionsThisRound?.[station.role];
                                const isOccupied = occupants.length > 0;
                                const nodeR = isOccupied ? 14 : 10;

                                // Line to center
                                return (
                                    <g key={key}>
                                        <line x1={cx} y1={cy} x2={nx} y2={ny}
                                            stroke={isOccupied ? meta.color : '#1a3030'}
                                            strokeWidth={isOccupied ? 1.5 : 0.75}
                                            strokeDasharray={isOccupied ? '4 2' : '2 4'}
                                            opacity={isOccupied ? 0.8 : 0.4} />
                                        {/* Node circle */}
                                        <circle cx={nx} cy={ny} r={nodeR}
                                            fill={isOccupied ? `${meta.color}22` : '#0a1a1a'}
                                            stroke={isOccupied ? meta.color : '#1f4040'}
                                            strokeWidth={isOccupied ? 2 : 1} />
                                        {/* Occupied pulse ring */}
                                        {isOccupied && (
                                            <circle cx={nx} cy={ny} r={nodeR + 4}
                                                fill="none" stroke={meta.color} strokeWidth={0.5} opacity={0.4} />
                                        )}
                                        {/* Action done checkmark */}
                                        {hasAction && (
                                            <circle cx={nx + 8} cy={ny - 8} r={5} fill="#10b981" />
                                        )}
                                        {/* Station short label */}
                                        <text x={nx} y={cy > ny ? ny - nodeR - 5 : ny + nodeR + 10}
                                            textAnchor="middle" fontSize={8} fontWeight="bold"
                                            fill={isOccupied ? meta.color : '#2a5050'}
                                            fontFamily="monospace" letterSpacing={1}>
                                            {meta.shortLabel}
                                        </text>
                                        {/* Crew count badge */}
                                        {occupants.length > 0 && (
                                            <text x={nx} y={ny + 4} textAnchor="middle"
                                                fontSize={9} fontWeight="bold"
                                                fill={meta.color} fontFamily="monospace">
                                                {occupants.length}▲
                                            </text>
                                        )}
                                    </g>
                                );
                            })}

                            {/* Center dot */}
                            <circle cx={cx} cy={cy} r={4} fill="#00ffaa" opacity={0.6} />
                            <circle cx={cx} cy={cy} r={8} fill="none" stroke="#00ffaa" strokeWidth={0.5} opacity={0.3} />

                            {/* HP text in center */}
                            <text x={cx} y={cy - 8} textAnchor="middle" fontSize={11}
                                fill="#00ffaa" fontFamily="monospace" fontWeight="bold" opacity={0.9}>
                                {Math.round(hpPercent)}%
                            </text>
                            <text x={cx} y={cy + 6} textAnchor="middle" fontSize={8}
                                fill={hpColor} fontFamily="monospace">
                                {ship.hp.current}/{ship.hp.max}
                            </text>
                            <text x={cx} y={cy + 18} textAnchor="middle" fontSize={7}
                                fill="#0a6060" fontFamily="monospace" letterSpacing={2}>
                                HP
                            </text>
                        </svg>
                    </div>
                </div>

                {/* RIGHT: Stats + Systems + Stations + Resources */}
                <div className="flex-1 flex flex-col gap-3 p-4 md:p-5">

                    {/* Hull bar big */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-cyan-700">
                                INTEGRIDADE DO CASCO
                            </span>
                            <span className={`text-lg font-mono font-bold ${hpPercent <= 25 ? 'text-red-500 animate-pulse' : hpPercent <= 50 ? 'text-amber-400' : 'text-cyan-400'}`}>
                                {ship.hp.current}<span className="text-sm opacity-50">/{ship.hp.max}</span>
                            </span>
                        </div>
                        <div className="h-4 bg-zinc-900 border border-cyan-900/40 relative overflow-hidden">
                            <div className="h-full transition-all duration-500 relative"
                                style={{ width: `${hpPercent}%`, backgroundColor: hpColor }}>
                                {hpPercent <= 50 && (
                                    <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_6px,rgba(0,0,0,0.3)_6px,rgba(0,0,0,0.3)_12px)]" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Systems */}
                    <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(ship.systems).map(([key, sys]) => {
                            const sysLabels: Record<string, string> = {
                                propulsion: 'PROPULSÃO', lifeSupport: 'SUPORTE DE VIDA',
                                weapons: 'ARMAMENTO', sensors: 'SENSORES'
                            };
                            const statusColor = sys.status === 'online' ? 'bg-emerald-500' : sys.status === 'damaged' ? 'bg-amber-500 animate-pulse' : 'bg-red-600 animate-pulse';
                            const textColor = sys.status === 'online' ? 'text-emerald-600' : sys.status === 'damaged' ? 'text-amber-500' : 'text-red-400';
                            return (
                                <div key={key} className="flex items-center gap-2 bg-black/30 px-2 py-1.5 border border-zinc-900">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor} shadow-lg`} />
                                    <span className={`text-[9px] font-bold tracking-widest uppercase flex-1 ${textColor}`}>
                                        {sysLabels[key]}
                                    </span>
                                    <span className="text-[9px] font-mono text-zinc-600">{sys.integrity}%</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Stations occupancy */}
                    <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(ship.stations).map(([key, station]) => {
                            const meta = STATION_META_RADAR[key];
                            const occupants = station.occupants ? Object.values(station.occupants) : [];
                            const hasAction = ship.combat?.isActive &&
                                ship.combat.actionsThisRound?.[station.role];
                            return (
                                <div key={key}
                                    className="flex flex-col px-2 py-1.5 border"
                                    style={{ borderColor: occupants.length > 0 ? `${meta.color}60` : '#1a2a2a', background: occupants.length > 0 ? `${meta.color}10` : 'transparent' }}>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: occupants.length > 0 ? meta.color : '#1f4040' }} />
                                        <span className="text-[9px] font-bold tracking-widest uppercase flex-1"
                                            style={{ color: occupants.length > 0 ? meta.color : '#2a5050' }}>
                                            {meta.label}
                                        </span>
                                        {hasAction && (
                                            <span className="text-[9px] text-emerald-500 font-bold">✓</span>
                                        )}
                                        {ship.combat?.isActive && !hasAction && occupants.length > 0 && (
                                            <span className="text-[9px] text-amber-600 font-bold animate-pulse">⏳</span>
                                        )}
                                    </div>
                                    {occupants.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                            {occupants.map(o => (
                                                <span key={o.id} className="text-[8px] text-zinc-400 font-mono truncate max-w-[80px]">{o.name}</span>
                                            ))}
                                            {occupants.length >= 2 && (
                                                <span className="text-[8px] font-bold" style={{ color: meta.color }}>
                                                    +{occupants.length >= 3 ? 'ADV' : '10'}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-[8px] text-zinc-700 font-mono mt-0.5">VAGO</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Resources */}
                    <div className="flex gap-3">
                        <ResourceBar label="COMBUSTÍVEL" value={ship.resources.fuel.current} max={ship.resources.fuel.max} color="#f59e0b" />
                        <ResourceBar label="OXIGÊNIO" value={ship.resources.oxygen.current} max={ship.resources.oxygen.max} color="#06b6d4" />
                        <ResourceBar label="MUNIÇÃO" value={ship.resources.ammo.current} max={ship.resources.ammo.max} color="#ef4444" />
                    </div>

                    {/* Combat status */}
                    {ship.combat?.isActive && (
                        <div className="flex items-center justify-between border border-red-900/50 bg-red-950/20 px-3 py-1.5">
                            <div className="flex items-center gap-2">
                                <Crosshair size={12} className="text-red-500 animate-pulse" />
                                <span className="text-[10px] font-bold tracking-widest uppercase text-red-400">
                                    COMBATE — RODADA {ship.combat.round}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold tracking-widest uppercase text-red-600">
                                {ship.combat.phase === 'stations' ? 'ALOCAÇÃO' : ship.combat.phase === 'resolution' ? 'RESOLUÇÃO' : 'DANO'}
                            </span>
                        </div>
                    )}

                    {/* Alerts */}
                    {alerts.length > 0 && (
                        <div className="flex flex-col gap-1">
                            {alerts.map(alert => (
                                <div key={alert.id}
                                    className={`flex items-center gap-2 px-2 py-1.5 border text-[10px] font-bold tracking-wider uppercase ${SEVERITY_STYLES[alert.severity]}`}>
                                    <AlertTriangle size={11} className="flex-shrink-0" />
                                    <span className="truncate">{alert.message}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ResourceBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    const isEmpty = pct <= 0;
    const isLow = pct <= 25;
    return (
        <div className="flex-1 flex flex-col gap-1">
            <div className="flex justify-between">
                <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: isEmpty ? '#ef4444' : isLow ? '#f59e0b' : color }}>{label}</span>
                <span className="text-[9px] font-mono text-zinc-600">{value}</span>
            </div>
            <div className="h-2 bg-zinc-900 border border-zinc-800 relative overflow-hidden">
                <div className="h-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: isEmpty ? '#7f1d1d' : isLow ? '#f59e0b' : color, opacity: 0.85 }} />
            </div>
        </div>
    );
}
