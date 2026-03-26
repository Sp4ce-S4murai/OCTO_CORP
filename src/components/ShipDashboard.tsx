"use client";

import { ShipState, AlertSeverity } from "@/types/ship";
import { AlertTriangle, Shield, Crosshair, Radio, Heart, Fuel, Zap, Navigation, Target, Wrench, Eye, Activity } from "lucide-react";
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
    critical:     'border-red-800 bg-red-950/50 text-red-500 animate-pulse',
    catastrophic: 'border-red-500 bg-red-900/80 text-red-100 animate-pulse',
};

const STATION_SEGMENTS: Record<string, {
    label: string;
    system: string;
    icon: React.ReactNode;
}> = {
    bridge:      { label: 'COMANDO',    system: 'sensors',     icon: <Navigation size={14} /> },
    tactical:    { label: 'TÁTICO',     system: 'weapons',     icon: <Target size={14} /> },
    science:     { label: 'CIÊNCIA',    system: 'lifeSupport', icon: <Eye size={14} /> },
    engineering: { label: 'ENGENHARIA', system: 'propulsion',  icon: <Wrench size={14} /> },
};

function BlueprintRoom({ segKey, seg, ship, className = "" }: { segKey: string; seg: typeof STATION_SEGMENTS[string]; ship: ShipState; className?: string }) {
    const station = (ship.stations || {})[segKey];
    const sysState = ship.systems[seg.system as keyof typeof ship.systems];
    const occupants = station?.occupants ? Object.values(station.occupants) : [];
    const crewBonus = occupants.length >= 3 ? 'EFICIÊNCIA MÁXIMA' : occupants.length === 2 ? 'SUPORTE ATIVO' : '';

    const isOffline = sysState?.status === 'offline';
    const isDamaged = sysState?.status === 'damaged';

    const statusBorder = isOffline ? 'border-red-800' : isDamaged ? 'border-amber-800/80' : 'border-emerald-900/40';
    const statusBg = isOffline ? 'bg-red-950/20' : isDamaged ? 'bg-amber-950/10' : 'bg-transparent';
    const textTheme = isOffline ? 'text-red-500' : isDamaged ? 'text-amber-500' : 'text-emerald-500';

    return (
        <div className={`relative border ${statusBorder} ${statusBg} p-2 flex flex-col min-h-[90px] ${className}`}>
            {/* Scanline background overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,255,100,0.02)_50%)] bg-[length:100%_4px] pointer-events-none" />

            <div className={`flex items-center justify-between border-b ${statusBorder} pb-1 mb-2`}>
                <div className={`flex items-center gap-1.5 ${textTheme}`}>
                    {seg.icon}
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase">{seg.label}</span>
                </div>
                {!isOffline && (
                    <span className={`text-[9px] font-mono ${isDamaged ? 'text-amber-500 animate-pulse' : 'text-emerald-700'}`}>
                        {sysState?.integrity}%
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-1 z-10">
                {occupants.length === 0 ? (
                    <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-mono pt-2 opacity-50">[/ VAGO /]</span>
                ) : (
                    occupants.map(occ => (
                        <div key={occ.playerId} className="flex items-center gap-2">
                            <div className={`w-1 h-2 ${occ.hasActed ? 'bg-emerald-600' : 'bg-zinc-600'}`} />
                            <span className={`text-[10px] uppercase font-mono tracking-wider ${occ.hasActed ? 'text-emerald-700 opacity-60' : 'text-emerald-400'}`}>
                                {occ.playerName}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {crewBonus && !isOffline && (
                <div className="mt-auto pt-2 text-[8px] tracking-[0.3em] font-mono text-emerald-600 uppercase">
                    » {crewBonus}
                </div>
            )}

            {isOffline && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-950/80 pointer-events-none z-20 border border-red-500/50 backdrop-blur-[1px]">
                    <span className="text-xs font-bold font-mono tracking-[0.4em] text-red-500 uppercase animate-pulse">
                        OFFLINE
                    </span>
                </div>
            )}
            
            {/* Corner deco */}
            <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l ${statusBorder} -translate-x-[1px] -translate-y-[1px]`} />
            <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r ${statusBorder} translate-x-[1px] translate-y-[1px]`} />
        </div>
    );
}

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

    const isCritical = hpPercent <= 25;
    const hpColor = isCritical ? 'bg-red-600' : hpPercent <= 50 ? 'bg-amber-500' : 'bg-emerald-500';
    const alerts = ship.alerts
        ? Object.values(ship.alerts).sort((a, b) => b.timestamp - a.timestamp).slice(0, 3)
        : [];

    return (
        <section className={`border border-zinc-800 bg-[#0a0f0d] transition-all duration-300 relative overflow-hidden font-mono ${flashDamage ? 'ring-2 ring-red-500/50' : ''}`}>
            {flashDamage && <div className="absolute inset-0 bg-red-900/20 pointer-events-none z-10 animate-pulse" />}

            {/* HEADER BAR */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-950 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <Activity size={16} className={isCritical ? "text-red-500 animate-pulse" : "text-emerald-500"} />
                    <span className="text-[11px] font-bold tracking-[0.3em] text-emerald-400 uppercase">{ship.name}</span>
                    <span className="text-[9px] tracking-widest text-emerald-800 uppercase hidden sm:inline">| {ship.class}</span>
                </div>
                <div className="flex items-center gap-4">
                    {ship.combat?.isActive && (
                        <div className="flex items-center gap-2 border border-red-900/50 bg-red-950/20 px-3 py-1">
                            <Crosshair size={11} className="text-red-500 animate-pulse" />
                            <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-red-500">
                                COMBATE ACIONADO [ R{ship.combat.round} ]
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-0">
                {/* ---------- LEFT: WIREFRAME HULL SCHEMATIC ---------- */}
                <div className="p-6 relative flex flex-col items-center justify-center min-h-[340px]">
                    {/* Background Grid */}
                    <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'linear-gradient(#00ff66 1px, transparent 1px), linear-gradient(90deg, #00ff66 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                    <div className="relative w-full max-w-[400px] flex flex-col gap-3">
                        {/* Upper Hull (Bridge) */}
                        <div className="flex justify-center">
                            <BlueprintRoom segKey="bridge" seg={STATION_SEGMENTS.bridge} ship={ship} className="w-[180px] border-t-2 border-emerald-900" />
                        </div>

                        {/* Mid Hull (Tactical + Science) */}
                        <div className="flex justify-between gap-3 relative">
                            {/* Connector Line */}
                            <div className="absolute top-1/2 left-0 right-0 h-px bg-emerald-900/30 border-y border-dashed border-emerald-900/20 -z-10" />
                            
                            <BlueprintRoom segKey="tactical" seg={STATION_SEGMENTS.tactical} ship={ship} className="flex-1" />
                            <BlueprintRoom segKey="science" seg={STATION_SEGMENTS.science} ship={ship} className="flex-1" />
                        </div>

                        {/* Lower Hull (Engineering) */}
                        <div className="flex justify-center">
                            <BlueprintRoom segKey="engineering" seg={STATION_SEGMENTS.engineering} ship={ship} className="w-[240px] border-b-2 border-emerald-900" />
                        </div>
                    </div>
                </div>

                {/* ---------- RIGHT: HUD DATA ---------- */}
                <div className="border-l border-zinc-800 bg-[#050806] flex flex-col z-10">
                    
                    {/* HULL INTEGRITY (Top priority) */}
                    <div className="p-4 border-b border-zinc-800 bg-zinc-950">
                        <div className="flex justify-between text-[10px] tracking-[0.2em] uppercase mb-2">
                            <span className="text-zinc-500">CANAL-HULL</span>
                            <span className={isCritical ? 'text-red-500 animate-pulse' : 'text-emerald-500'}>
                                {ship.hp.current}/{ship.hp.max}
                            </span>
                        </div>
                        <div className="h-4 bg-zinc-900 border border-zinc-800 p-0.5">
                            <div className={`h-full ${hpColor} transition-all duration-700 relative`} style={{ width: `${hpPercent}%` }}>
                                <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.3)_4px,rgba(0,0,0,0.3)_8px)]" />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 flex flex-col gap-6 flex-1">
                        {/* NOISE/STATS BLOCK */}
                        <div>
                            <span className="text-[9px] text-zinc-600 tracking-[0.3em] uppercase block mb-3 border-b border-zinc-800 pb-1">/ PARAMETROS BASE</span>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                                {[
                                    { k: 'armor', lbl: 'AR', color: 'text-emerald-400' },
                                    { k: 'combat', lbl: 'CBT', color: 'text-emerald-400' },
                                    { k: 'speed', lbl: 'SPD', color: 'text-emerald-400' },
                                    { k: 'sensors', lbl: 'SNS', color: 'text-emerald-400' }
                                ].map(s => (
                                    <div key={s.k} className="flex justify-between items-end border-b border-dashed border-zinc-800 pb-0.5">
                                        <span className="text-[10px] text-zinc-500">{s.lbl}</span>
                                        <span className={`text-sm ${s.color}`}>{ship.stats[s.k as keyof typeof ship.stats]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* SYSTEMS BLOCK */}
                        <div>
                            <span className="text-[9px] text-zinc-600 tracking-[0.3em] uppercase block mb-3 border-b border-zinc-800 pb-1">/ SUBSISTEMAS PRINC.</span>
                            <div className="flex flex-col gap-2">
                                {Object.entries(ship.systems).map(([key, sys]) => {
                                    const stCol = sys.status === 'online' ? 'text-emerald-500' : sys.status === 'damaged' ? 'text-amber-500' : 'text-red-500';
                                    const barBg = sys.status === 'online' ? 'bg-emerald-600/50' : sys.status === 'damaged' ? 'bg-amber-600/50' : 'bg-red-600/50';
                                    
                                    return (
                                        <div key={key}>
                                            <div className="flex justify-between text-[9px] mb-1">
                                                <span className={`${stCol} opacity-80 uppercase tracking-widest`}>{SYSTEM_LABELS[key]}</span>
                                                <span className={stCol}>{sys.integrity}%</span>
                                            </div>
                                            <div className="w-full h-1 bg-zinc-900">
                                                <div className={`h-full ${barBg} transition-all`} style={{ width: `${sys.integrity}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RESOURCES BLOCK */}
                        <div className="mt-auto">
                            <span className="text-[9px] text-zinc-600 tracking-[0.3em] uppercase block mb-3 border-b border-zinc-800 pb-1">/ SUPRIMENTOS</span>
                            <div className="flex gap-4">
                                {[
                                    { k: 'fuel', lbl: 'FUEL', c: 'text-amber-500' },
                                    { k: 'oxygen', lbl: 'O2', c: 'text-cyan-500' },
                                    { k: 'ammo', lbl: 'AMMO', c: 'text-red-500' }
                                ].map(r => {
                                    const res = ship.resources[r.k as keyof typeof ship.resources];
                                    return (
                                        <div key={r.k} className="flex flex-col">
                                            <span className="text-[9px] text-zinc-500 uppercase tracking-widest">{r.lbl}</span>
                                            <span className={`text-xs ${res.current <= res.max * 0.2 ? 'animate-pulse text-red-500' : r.c}`}>
                                                {res.current}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ALERT BANNER - BOTTOM */}
            {alerts.length > 0 && (
                <div className="border-t border-zinc-800 bg-[#050806]">
                    {alerts.map(alert => (
                        <div key={alert.id} className={`flex items-center gap-3 px-4 py-2 text-[10px] font-bold tracking-[0.2em] border-b border-zinc-900/50 uppercase ${SEVERITY_STYLES[alert.severity]}`}>
                            <AlertTriangle size={12} className="flex-shrink-0" />
                            <span className="truncate">{alert.message}</span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
