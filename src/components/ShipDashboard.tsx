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

    const statusBorder = isOffline ? 'border-red-800/80' : isDamaged ? 'border-amber-800/80' : 'border-emerald-800/60';
    const statusBg = isOffline ? 'bg-red-950/30' : isDamaged ? 'bg-amber-950/20' : 'bg-emerald-950/10';
    const textTheme = isOffline ? 'text-red-500' : isDamaged ? 'text-amber-500' : 'text-emerald-400';

    return (
        <div className={`relative border ${statusBorder} ${statusBg} p-3 flex flex-col min-h-[110px] backdrop-blur-sm ${className}`}>
            {/* Scanline background overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,255,100,0.03)_50%)] bg-[length:100%_4px] pointer-events-none" />

            <div className={`flex items-start justify-between border-b ${statusBorder} pb-2 mb-3`}>
                <div className={`flex flex-col gap-0.5 ${textTheme}`}>
                    <div className="flex items-center gap-1.5">
                        {seg.icon}
                        <span className="text-[11px] font-bold tracking-[0.2em] uppercase">{seg.label}</span>
                    </div>
                    <span className="text-[7px] tracking-widest uppercase opacity-60 ml-5 font-mono">SYS: {SYSTEM_LABELS[seg.system]}</span>
                </div>
                {!isOffline && (
                    <div className="flex flex-col items-end">
                        <span className={`text-[10px] font-bold font-mono ${isDamaged ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`}>
                            {sysState?.integrity}%
                        </span>
                        <span className="text-[6px] text-emerald-700 tracking-widest">PWR_ROUTE</span>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-1.5 z-10 flex-1">
                {occupants.length === 0 ? (
                    <div className="flex items-center gap-2 opacity-40">
                        <div className="w-1.5 h-1.5 bg-emerald-900 border border-emerald-700" />
                        <span className="text-[9px] text-emerald-600 uppercase tracking-[0.3em] font-mono">[/ VAGO /]</span>
                    </div>
                ) : (
                    occupants.map(occ => (
                        <div key={occ.playerId} className="flex items-center justify-between border-l-2 pl-2 py-0.5 border-emerald-900/50">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 border ${occ.hasActed ? 'bg-emerald-600/50 border-emerald-500' : 'bg-emerald-400 border-emerald-300 animate-pulse'}`} />
                                <span className={`text-[10px] uppercase font-bold font-mono tracking-widest ${occ.hasActed ? 'text-emerald-700' : 'text-emerald-300'}`}>
                                    {occ.playerName}
                                </span>
                            </div>
                            {occ.hasActed && <span className="text-[8px] text-emerald-800 font-mono tracking-widest bg-emerald-950/30 px-1 py-0.5">RDY</span>}
                        </div>
                    ))
                )}
            </div>

            {crewBonus && !isOffline && (
                <div className="mt-2 text-[8px] tracking-[0.3em] font-mono text-emerald-500 bg-emerald-950/50 border border-emerald-900/50 px-2 py-1 uppercase text-center w-full">
                    {crewBonus}
                </div>
            )}

            {isOffline && (
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center bg-red-950/90 py-2 border-y border-red-500/50 z-20 shadow-[0_0_15px_rgba(255,0,0,0.3)]">
                    <span className="text-xs font-bold font-mono tracking-[0.4em] text-red-500 uppercase animate-pulse">
                        <AlertTriangle size={12} className="inline mr-2 -mt-1"/>SISTEMA OFFLINE
                    </span>
                </div>
            )}
            
            {/* Corner deco crosses */}
            <div className={`absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 ${statusBorder}`} />
            <div className={`absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 ${statusBorder}`} />
            <div className={`absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 ${statusBorder}`} />
            <div className={`absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 ${statusBorder}`} />
            
            {/* Inner micro-dots */}
            <div className={`absolute bottom-1 right-1 w-0.5 h-0.5 bg-current opacity-50 ${textTheme}`} />
            <div className={`absolute bottom-1 right-2 w-0.5 h-0.5 bg-current opacity-50 ${textTheme}`} />
            <div className={`absolute bottom-1 right-3 w-0.5 h-0.5 bg-current opacity-50 ${textTheme}`} />
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
                {/* Removed small combat pill, moving it to a centralized banner */}
            </div>

            {/* COMBAT HUD BANNER */}
            {ship.combat?.isActive && (
                <div className="border-b border-red-900/50 bg-red-950/20 p-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        {/* Phase Info */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <Crosshair size={14} className="text-red-500 animate-pulse" />
                                <span className="text-xs font-bold tracking-[0.2em] uppercase text-red-500">
                                    RODADA {ship.combat.round} — {
                                        ship.combat.phase === 'stations' ? 'FASE ESTAÇÕES' :
                                        ship.combat.phase === 'resolution' ? 'FASE RESOLUÇÃO' :
                                        'FASE DE DANO/INIMIGOS'
                                    }
                                </span>
                            </div>
                            <span className="text-[10px] text-red-400/80 tracking-widest pl-5 hidden sm:inline">
                                {ship.combat.phase === 'stations' ? 'Tripulação: Insira ações e rolagens nos terminais' : 
                                 ship.combat.phase === 'resolution' ? 'Diretor: Resolvendo ações e aplicando resultados' : 
                                 'Diretor: Turno inimigo e aplicação de dano final'}
                            </span>
                        </div>

                        {/* Crew Actions Feed */}
                        <div className="flex flex-col flex-1 max-w-[500px] border-l border-red-900/30 pl-4 gap-1.5">
                            <span className="text-[9px] text-red-600 font-bold uppercase tracking-widest mb-1 shadow-sm">
                                [ LOG DE AÇÕES — RODADA ATUAL ]
                            </span>
                            {Object.values(ship.combat.actionsThisRound || {}).length === 0 ? (
                                <span className="text-[10px] text-red-700/50 uppercase tracking-widest font-mono">
                                    Aguardando submissões da tripulação...
                                </span>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {Object.values(ship.combat.actionsThisRound).map(action => {
                                        const resColor = action.result === 'success' || action.result === 'critical_success' 
                                            ? 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20' 
                                            : action.result === 'failure' || action.result === 'critical_failure'
                                            ? 'text-red-500 border-red-900/50 bg-red-950/20' 
                                            : 'text-amber-400 border-amber-900/50 bg-amber-950/20';

                                        const roleMap: Record<string, string> = {
                                            pilot: 'PIL', gunner: 'ART', engineer: 'ENG', science: 'CIE'
                                        };

                                        return (
                                            <div key={action.stationRole} className={`flex flex-col p-1.5 border ${resColor} text-[9px] font-mono tracking-widest`}>
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <span className="font-bold opacity-80 uppercase">[{roleMap[action.stationRole]}] {action.playerName}</span>
                                                    <span className="text-[8px] opacity-60">🎲 {action.roll} vs {action.targetValue}</span>
                                                </div>
                                                <span className="truncate uppercase opacity-90">{action.description || action.result}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-0">
                {/* ---------- LEFT: WIREFRAME HULL SCHEMATIC ---------- */}
                <div className="p-8 relative flex flex-col items-center justify-center min-h-[500px] overflow-hidden">
                    {/* Background Grid */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#00ff66 1px, transparent 1px), linear-gradient(90deg, #00ff66 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                    <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#00ff66 1px, transparent 1px), linear-gradient(90deg, #00ff66 1px, transparent 1px)', backgroundSize: '10px 10px' }} />

                    {/* HUD Overlay Elements (Corners, Crosshairs) */}
                    <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-emerald-900/40" />
                    <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-emerald-900/40" />
                    <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-emerald-900/40" />
                    <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-emerald-900/40" />
                    
                    <div className="absolute top-1/2 left-4 w-4 h-px bg-emerald-900/50" />
                    <div className="absolute top-1/2 right-4 w-4 h-px bg-emerald-900/50" />
                    <div className="absolute top-4 left-1/2 w-px h-4 bg-emerald-900/50" />
                    <div className="absolute bottom-4 left-1/2 w-px h-4 bg-emerald-900/50" />

                    <div className="absolute top-6 left-8 text-[8px] font-mono text-emerald-700/50 tracking-[0.4em] hidden sm:block">AXIS-Y: 44.11</div>
                    <div className="absolute bottom-6 right-8 text-[8px] font-mono text-emerald-700/50 tracking-[0.4em] hidden sm:block">AXIS-X: 88.02</div>

                    {/* Outer Hull Vector Underlay */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                        {/* Main Body */}
                        <polygon 
                            points="50%,10% 70%,30% 70%,70% 60%,90% 40%,90% 30%,70% 30%,30%" 
                            className="fill-emerald-950/10 stroke-emerald-900/30" 
                            strokeWidth="1" 
                            strokeDasharray="4 4"
                        />
                        {/* Armor Plates */}
                        <polygon 
                            points="50%,5% 75%,30% 75%,70% 65%,95% 35%,95% 25%,70% 25%,30%" 
                            className="fill-none stroke-emerald-900/10" 
                            strokeWidth="1" 
                        />
                        {/* Internal skeleton lines */}
                        <line x1="50%" y1="5%" x2="50%" y2="95%" className="stroke-emerald-900/20" strokeWidth="1" strokeDasharray="2 4"/>
                        <line x1="25%" y1="50%" x2="75%" y2="50%" className="stroke-emerald-900/20" strokeWidth="1" strokeDasharray="2 4"/>
                    </svg>

                    <div className="relative w-full max-w-[460px] flex flex-col gap-8 z-10 scale-90 sm:scale-100 mt-4">
                        {/* Upper Hull (Bridge) */}
                        <div className="flex justify-center relative">
                            {/* Fluff text */}
                            <div className="absolute -left-12 sm:left-6 top-0 text-[7px] text-emerald-800/80 font-mono text-right leading-tight hidden lg:block tracking-widest border-r border-emerald-900/30 pr-2">
                                NOSE CONE<br/>FWD SENSORS<br/>[OK]
                            </div>
                            <BlueprintRoom segKey="bridge" seg={STATION_SEGMENTS.bridge} ship={ship} className="w-[200px]" />
                        </div>

                        {/* Mid Hull (Tactical + Science) */}
                        <div className="flex justify-between gap-6 relative px-4">
                            {/* Central reactor core column visual */}
                            <div className="absolute top-[-36px] bottom-[-36px] left-1/2 -translate-x-1/2 w-12 border-x border-emerald-900/30 bg-[linear-gradient(0deg,rgba(0,255,100,0.05)_50%,transparent_50%)] bg-[length:100%_4px] -z-10" />
                            
                            <div className="absolute -left-12 top-1/2 text-[7px] text-emerald-800/80 font-mono text-right leading-tight hidden lg:block tracking-[0.2em] border-r border-emerald-900/30 pr-2">
                                PORT SIDE<br/>WEAPON MOUNT
                            </div>
                            <div className="absolute -right-12 top-1/2 text-[7px] text-emerald-800/80 font-mono text-left leading-tight hidden lg:block tracking-[0.2em] border-l border-emerald-900/30 pl-2">
                                STARBOARD<br/>SCAN ARRAY
                            </div>

                            <BlueprintRoom segKey="tactical" seg={STATION_SEGMENTS.tactical} ship={ship} className="flex-1 max-w-[180px]" />
                            <BlueprintRoom segKey="science" seg={STATION_SEGMENTS.science} ship={ship} className="flex-1 max-w-[180px]" />
                        </div>

                        {/* Lower Hull (Engineering) */}
                        <div className="flex justify-center relative">
                            <div className="absolute -right-12 sm:right-0 bottom-0 text-[7px] text-emerald-800/80 font-mono text-left leading-tight hidden lg:block tracking-[0.2em] border-l border-emerald-900/30 pl-2">
                                MULTI-FUSION<br/>DRIVE ENGINE<br/>[ACTIVE]
                            </div>
                            <BlueprintRoom segKey="engineering" seg={STATION_SEGMENTS.engineering} ship={ship} className="w-[280px]" />
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
