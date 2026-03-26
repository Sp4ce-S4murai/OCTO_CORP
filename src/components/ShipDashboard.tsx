"use client";

import { ShipState, AlertSeverity } from "@/types/ship";
import { AlertTriangle, Shield, Crosshair, Radio, Heart, Fuel, Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface ShipDashboardProps {
    ship: ShipState;
}

const SYSTEM_LABELS: Record<string, string> = {
    propulsion:  'PROPULSÃO',
    lifeSupport: 'SUPORTE DE VIDA',
    weapons:     'ARMAMENTO',
    sensors:     'SENSORES',
};

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
    info:         'border-blue-800 bg-blue-950/30 text-blue-400',
    warning:      'border-amber-800 bg-amber-950/30 text-amber-400',
    critical:     'border-red-800 bg-red-950/50 text-red-400 animate-pulse',
    catastrophic: 'border-red-500 bg-red-900/80 text-red-100 animate-pulse',
};

// FTL-style ship segment shapes — a simple schematic using SVG-like CSS borders
const STATION_SEGMENTS: Record<string, {
    label: string;
    color: string;
    borderColor: string;
    gridArea: string;
    system: string;
    icon: string;
}> = {
    bridge:      { label: 'PONTE',      color: 'blue',   borderColor: 'border-blue-700',   gridArea: 'bridge',      system: 'sensors',     icon: '🔭' },
    tactical:    { label: 'TÁTICO',     color: 'red',    borderColor: 'border-red-700',    gridArea: 'tactical',    system: 'weapons',     icon: '🎯' },
    engineering: { label: 'ENGENHARIA', color: 'amber',  borderColor: 'border-amber-700',  gridArea: 'engineering', system: 'propulsion',  icon: '⚙️' },
    science:     { label: 'CIÊNCIA',    color: 'purple', borderColor: 'border-purple-700', gridArea: 'science',     system: 'lifeSupport', icon: '🔬' },
};

const COLOR_MAP: Record<string, { text: string; bg: string; border: string; glow: string }> = {
    blue:   { text: 'text-blue-300',   bg: 'bg-blue-950/40',   border: 'border-blue-700',   glow: 'shadow-blue-900/40' },
    red:    { text: 'text-red-300',    bg: 'bg-red-950/40',    border: 'border-red-700',    glow: 'shadow-red-900/40' },
    amber:  { text: 'text-amber-300',  bg: 'bg-amber-950/40',  border: 'border-amber-700',  glow: 'shadow-amber-900/40' },
    purple: { text: 'text-purple-300', bg: 'bg-purple-950/40', border: 'border-purple-700', glow: 'shadow-purple-900/40' },
};

export function ShipDashboard({ ship }: ShipDashboardProps) {
    const hpPercent = ship.hp.max > 0 ? (ship.hp.current / ship.hp.max) * 100 : 0;
    const [flashDamage, setFlashDamage] = useState(false);
    const [prevHp, setPrevHp] = useState(ship.hp.current);

    useEffect(() => {
        if (ship.hp.current < prevHp) {
            setFlashDamage(true);
            const timer = setTimeout(() => setFlashDamage(false), 900);
            return () => clearTimeout(timer);
        }
        setPrevHp(ship.hp.current);
    }, [ship.hp.current]);

    const hpColor = hpPercent <= 25 ? 'bg-red-600' : hpPercent <= 50 ? 'bg-amber-500' : 'bg-emerald-500';
    const alerts = ship.alerts
        ? Object.values(ship.alerts).sort((a, b) => b.timestamp - a.timestamp).slice(0, 3)
        : [];

    return (
        <section className={`border-2 ${hpPercent <= 25 ? 'border-red-600' : hpPercent <= 50 ? 'border-amber-700' : 'border-cyan-900'} bg-zinc-950/95 transition-all duration-300 relative overflow-hidden ${flashDamage ? 'ring-4 ring-red-500/60' : ''}`}>
            {flashDamage && <div className="absolute inset-0 bg-red-900/30 pointer-events-none z-10 animate-pulse" />}

            {/* TOP HEADER BAR */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-900/50 bg-zinc-900/60">
                <div className="flex items-center gap-2">
                    <Shield size={16} className="text-cyan-500" />
                    <span className="text-xs font-bold tracking-[0.25em] text-cyan-400 uppercase">{ship.name}</span>
                    <span className="text-[10px] tracking-widest text-cyan-700 uppercase">// {ship.class}</span>
                </div>
                <div className="flex items-center gap-4">
                    {ship.combat?.isActive && (
                        <div className="flex items-center gap-2 border border-red-900/50 bg-red-950/20 px-3 py-1">
                            <Crosshair size={11} className="text-red-500 animate-pulse" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-red-400">
                                COMBATE — R{ship.combat.round} — {ship.combat.phase === 'stations' ? 'AÇÕES' : ship.combat.phase === 'resolution' ? 'RESOLUÇÃO' : 'DANO'}
                            </span>
                        </div>
                    )}
                    <span className={`text-[11px] font-bold font-mono ${hpPercent <= 25 ? 'text-red-400 animate-pulse' : hpPercent <= 50 ? 'text-amber-400' : 'text-cyan-400'}`}>
                        HP {ship.hp.current}/{ship.hp.max}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-0">
                {/* LEFT: FTL SHIP DIAGRAM */}
                <div className="p-4 flex flex-col gap-3">
                    {/* Hull bar */}
                    <div>
                        <div className="flex justify-between text-[9px] font-bold tracking-widest uppercase mb-1">
                            <span className={hpPercent <= 25 ? 'text-red-500' : hpPercent <= 50 ? 'text-amber-500' : 'text-cyan-600'}>INTEGRIDADE DO CASCO</span>
                            <span className={hpPercent <= 25 ? 'text-red-500' : hpPercent <= 50 ? 'text-amber-400' : 'text-cyan-600'}>{Math.round(hpPercent)}%</span>
                        </div>
                        <div className={`h-2.5 bg-zinc-900 border ${hpPercent <= 25 ? 'border-red-800' : 'border-cyan-900/40'} overflow-hidden`}>
                            <div className={`h-full ${hpColor} transition-all duration-700 relative`} style={{ width: `${hpPercent}%` }}>
                                {hpPercent <= 50 && <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_3px,rgba(0,0,0,0.25)_3px,rgba(0,0,0,0.25)_6px)]" />}
                            </div>
                        </div>
                    </div>

                    {/* FTL SHIP DIAGRAM — 4 compartments in a stylised hull shape */}
                    <div className="relative">
                        {/* Ship outline decoration */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                            <div className="w-full h-0.5 bg-cyan-400" />
                        </div>

                        <div className="grid grid-cols-2 gap-2 relative">
                            {Object.entries(STATION_SEGMENTS).map(([key, seg]) => {
                                const station = ship.stations[key];
                                const cm = COLOR_MAP[seg.color];
                                const sysState = ship.systems[seg.system as keyof typeof ship.systems];
                                const occupants = station?.occupants ? Object.values(station.occupants) : [];
                                const hasAnyActed = occupants.some(o => o.hasActed);
                                const allActed = occupants.length > 0 && occupants.every(o => o.hasActed);
                                const crewBonus = occupants.length >= 3 ? '+++ TRIPULAÇÃO COMPLETA' : occupants.length === 2 ? '++ SUPORTE ADICIONAL' : '';

                                return (
                                    <div
                                        key={key}
                                        className={`relative border ${cm.border} ${cm.bg} p-3 shadow-lg ${cm.glow} flex flex-col gap-2 min-h-[100px]`}
                                    >
                                        {/* Corner labels */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm">{seg.icon}</span>
                                                <span className={`text-[10px] font-bold tracking-widest uppercase ${cm.text}`}>{seg.label}</span>
                                            </div>
                                            {/* System status LED */}
                                            <div
                                                className={`w-2 h-2 rounded-full ${sysState?.status === 'online' ? 'bg-emerald-500' : sysState?.status === 'damaged' ? 'bg-amber-500 animate-pulse' : 'bg-red-600 animate-pulse'}`}
                                                title={`${SYSTEM_LABELS[seg.system]}: ${sysState?.integrity}%`}
                                            />
                                        </div>

                                        {/* Occupants list */}
                                        <div className="flex flex-col gap-1 flex-1">
                                            {occupants.length === 0 ? (
                                                <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">— VAGO —</span>
                                            ) : (
                                                occupants.map(occ => (
                                                    <div key={occ.playerId} className="flex items-center gap-1.5">
                                                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${occ.hasActed ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
                                                        <span className={`text-[9px] font-bold uppercase truncate ${occ.hasActed ? 'text-emerald-500 line-through' : cm.text}`}>
                                                            {occ.playerName}
                                                        </span>
                                                        {occ.hasActed && <span className="text-[8px] text-emerald-700 ml-auto">✓</span>}
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Crew bonus badge */}
                                        {crewBonus && (
                                            <div className={`text-[8px] font-bold uppercase tracking-widest ${cm.text} opacity-70`}>
                                                {crewBonus}
                                            </div>
                                        )}

                                        {/* Combat action indicator */}
                                        {ship.combat?.isActive && allActed && (
                                            <div className="absolute top-1 right-1 bg-emerald-900/80 border border-emerald-700 px-1 py-0.5">
                                                <span className="text-[8px] font-bold text-emerald-400 uppercase">PRONTO</span>
                                            </div>
                                        )}

                                        {/* System offline overlay */}
                                        {sysState?.status === 'offline' && (
                                            <div className="absolute inset-0 bg-red-950/60 flex items-center justify-center border border-red-800">
                                                <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest animate-pulse">OFFLINE</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Ship hull connector lines */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-cyan-900/20 pointer-events-none" />
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-cyan-900/20 pointer-events-none" />
                    </div>
                </div>

                {/* RIGHT: STATS + SYSTEMS + RESOURCES */}
                <div className="border-l border-cyan-900/30 bg-zinc-900/30 p-4 flex flex-col gap-4 min-w-[220px]">
                    {/* Ship Stats */}
                    <div>
                        <h4 className="text-[9px] font-bold tracking-[0.2em] uppercase text-cyan-700 mb-2">ATRIBUTOS DA NAVE</h4>
                        <div className="grid grid-cols-2 gap-1.5">
                            {[
                                { label: 'ARMADURA', key: 'armor', color: 'text-cyan-400' },
                                { label: 'COMBATE', key: 'combat', color: 'text-red-400' },
                                { label: 'VELOCIDADE', key: 'speed', color: 'text-blue-400' },
                                { label: 'SENSORES', key: 'sensors', color: 'text-purple-400' },
                            ].map(s => (
                                <div key={s.key} className="flex flex-col bg-zinc-950 border border-zinc-800 p-2">
                                    <span className="text-[8px] text-zinc-600 uppercase tracking-widest">{s.label}</span>
                                    <span className={`text-xl font-bold font-mono ${s.color}`}>
                                        {ship.stats[s.key as keyof typeof ship.stats]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Systems */}
                    <div>
                        <h4 className="text-[9px] font-bold tracking-[0.2em] uppercase text-cyan-700 mb-2">SUBSISTEMAS</h4>
                        <div className="flex flex-col gap-1">
                            {Object.entries(ship.systems).map(([key, sys]) => (
                                <div key={key} className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sys.status === 'online' ? 'bg-emerald-500' : sys.status === 'damaged' ? 'bg-amber-500 animate-pulse' : 'bg-red-600 animate-pulse'}`} />
                                        <span className="text-[9px] uppercase tracking-wider truncate text-zinc-400">{SYSTEM_LABELS[key]}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <div className="w-16 h-1 bg-zinc-800 overflow-hidden">
                                            <div className={`h-full transition-all ${sys.status === 'online' ? 'bg-emerald-500' : sys.status === 'damaged' ? 'bg-amber-500' : 'bg-red-600'}`} style={{ width: `${sys.integrity}%` }} />
                                        </div>
                                        <span className={`text-[9px] font-mono w-7 text-right ${sys.status === 'offline' ? 'text-red-500' : sys.status === 'damaged' ? 'text-amber-500' : 'text-zinc-500'}`}>{sys.integrity}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="text-[9px] font-bold tracking-[0.2em] uppercase text-cyan-700 mb-2">RECURSOS</h4>
                        <div className="flex flex-col gap-1.5">
                            {[
                                { label: 'COMBUSTÍVEL', key: 'fuel', color: 'bg-amber-500', textColor: 'text-amber-400' },
                                { label: 'OXIGÊNIO', key: 'oxygen', color: 'bg-cyan-500', textColor: 'text-cyan-400' },
                                { label: 'MUNIÇÃO', key: 'ammo', color: 'bg-red-500', textColor: 'text-red-400' },
                            ].map(r => {
                                const res = ship.resources[r.key as keyof typeof ship.resources];
                                const pct = res.max > 0 ? (res.current / res.max) * 100 : 0;
                                return (
                                    <div key={r.key}>
                                        <div className="flex justify-between text-[9px] mb-0.5">
                                            <span className="text-zinc-600 uppercase tracking-widest">{r.label}</span>
                                            <span className={`font-mono ${pct <= 20 ? 'text-red-500 animate-pulse' : r.textColor}`}>{res.current}/{res.max}</span>
                                        </div>
                                        <div className="h-1 bg-zinc-900 border border-zinc-800 overflow-hidden">
                                            <div className={`h-full ${pct <= 20 ? 'bg-red-600' : r.color} transition-all`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ALERT BANNER */}
            {alerts.length > 0 && (
                <div className="border-t border-zinc-800 flex flex-col gap-px">
                    {alerts.map(alert => (
                        <div key={alert.id} className={`flex items-center gap-2 px-4 py-1.5 border-b border-zinc-900 text-[10px] font-bold tracking-widest uppercase ${SEVERITY_STYLES[alert.severity]}`}>
                            <AlertTriangle size={11} className="flex-shrink-0" />
                            <span className="truncate">{alert.message}</span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
