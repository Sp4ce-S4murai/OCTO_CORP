"use client";

import { ShipState, AlertSeverity } from "@/types/ship";
import { AlertTriangle, Shield, Gauge, Crosshair, Eye, Fuel, Wind, CircleDot, Zap, Heart, Radio } from "lucide-react";
import { useEffect, useState } from "react";

interface ShipDashboardProps {
    ship: ShipState;
}

const SYSTEM_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
    propulsion:  { label: 'PROPULSÃO',       icon: <Fuel size={12} /> },
    lifeSupport: { label: 'SUPORTE DE VIDA', icon: <Heart size={12} /> },
    weapons:     { label: 'ARMAMENTO',       icon: <Crosshair size={12} /> },
    sensors:     { label: 'SENSORES',        icon: <Radio size={12} /> },
};

const STATUS_COLORS: Record<string, string> = {
    online:  'bg-emerald-500 shadow-emerald-500/50',
    damaged: 'bg-amber-500 shadow-amber-500/50 animate-pulse',
    offline: 'bg-red-600 shadow-red-600/50 animate-pulse',
};

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
    info:         'border-blue-800 bg-blue-950/30 text-blue-400',
    warning:      'border-amber-800 bg-amber-950/30 text-amber-400',
    critical:     'border-red-800 bg-red-950/50 text-red-400 animate-pulse',
    catastrophic: 'border-red-500 bg-red-900/80 text-red-100 animate-pulse',
};

export function ShipDashboard({ ship }: ShipDashboardProps) {
    const hpPercent = ship.hp.max > 0 ? (ship.hp.current / ship.hp.max) * 100 : 0;
    const [flashDamage, setFlashDamage] = useState(false);
    const [prevHp, setPrevHp] = useState(ship.hp.current);

    // Flash effect when HP drops
    useEffect(() => {
        if (ship.hp.current < prevHp) {
            setFlashDamage(true);
            const timer = setTimeout(() => setFlashDamage(false), 800);
            return () => clearTimeout(timer);
        }
        setPrevHp(ship.hp.current);
    }, [ship.hp.current]);

    const hpColor = hpPercent <= 25 ? 'bg-red-600' : hpPercent <= 50 ? 'bg-amber-500' : 'bg-emerald-500';
    const hpGlow = hpPercent <= 25 ? 'shadow-[0_0_20px_rgba(220,38,38,0.6)]' : hpPercent <= 50 ? 'shadow-[0_0_15px_rgba(245,158,11,0.4)]' : '';

    const alerts = ship.alerts ? Object.values(ship.alerts).sort((a, b) => b.timestamp - a.timestamp).slice(0, 3) : [];

    const fuelPct = ship.resources.fuel.max > 0 ? (ship.resources.fuel.current / ship.resources.fuel.max) * 100 : 0;
    const oxyPct = ship.resources.oxygen.max > 0 ? (ship.resources.oxygen.current / ship.resources.oxygen.max) * 100 : 0;
    const ammoPct = ship.resources.ammo.max > 0 ? (ship.resources.ammo.current / ship.resources.ammo.max) * 100 : 0;

    return (
        <section className={`border-2 ${hpPercent <= 25 ? 'border-red-600' : hpPercent <= 50 ? 'border-amber-700' : 'border-cyan-900'} bg-zinc-950/90 p-4 transition-all duration-300 relative overflow-hidden ${flashDamage ? 'ring-4 ring-red-500/50' : ''}`}>
            {/* Full-screen flash on damage */}
            {flashDamage && (
                <div className="absolute inset-0 bg-red-900/30 pointer-events-none z-10 animate-pulse" />
            )}

            {/* Header */}
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                    <Shield size={18} className="text-cyan-500" />
                    <h2 className="text-sm font-bold tracking-[0.2em] text-cyan-400 uppercase">
                        {ship.name} // {ship.class}
                    </h2>
                </div>
                <div className="flex gap-3 text-[10px] font-bold tracking-widest uppercase text-cyan-700">
                    <span>AR:{ship.stats.armor}</span>
                    <span>CBT:{ship.stats.combat}</span>
                    <span>SPD:{ship.stats.speed}</span>
                    <span>SNS:{ship.stats.sensors}</span>
                </div>
            </div>

            {/* Hull Integrity Bar */}
            <div className="mb-3">
                <div className="flex justify-between items-center text-[10px] font-bold tracking-widest uppercase mb-1">
                    <span className={`${hpPercent <= 25 ? 'text-red-500' : hpPercent <= 50 ? 'text-amber-500' : 'text-cyan-600'}`}>
                        INTEGRIDADE DO CASCO
                    </span>
                    <span className={`font-mono text-sm ${hpPercent <= 25 ? 'text-red-400 animate-pulse' : hpPercent <= 50 ? 'text-amber-400' : 'text-cyan-400'}`}>
                        {ship.hp.current} / {ship.hp.max}
                    </span>
                </div>
                <div className={`h-3 bg-zinc-900 border ${hpPercent <= 25 ? 'border-red-800' : 'border-cyan-900/50'} relative overflow-hidden ${hpGlow}`}>
                    <div
                        className={`h-full ${hpColor} transition-all duration-500 relative`}
                        style={{ width: `${hpPercent}%` }}
                    >
                        {hpPercent <= 50 && (
                            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(0,0,0,0.3)_4px,rgba(0,0,0,0.3)_8px)]" />
                        )}
                    </div>
                </div>
            </div>

            {/* Systems + Resources Row */}
            <div className="flex flex-wrap gap-4 mb-3">
                {/* System Status LEDs */}
                <div className="flex gap-3">
                    {Object.entries(ship.systems).map(([key, sys]) => (
                        <div key={key} className="flex items-center gap-1.5" title={`${SYSTEM_LABELS[key]?.label}: ${sys.status} (${sys.integrity}%)`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[sys.status]} shadow-lg`} />
                            <span className={`text-[9px] font-bold tracking-widest uppercase ${sys.status === 'online' ? 'text-emerald-600' : sys.status === 'damaged' ? 'text-amber-500' : 'text-red-500'}`}>
                                {SYSTEM_LABELS[key]?.label || key}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Resource Gauges */}
                <div className="flex gap-3 ml-auto">
                    <ResourceGauge label="COMB" value={ship.resources.fuel.current} max={ship.resources.fuel.max} color="amber" />
                    <ResourceGauge label="O₂" value={ship.resources.oxygen.current} max={ship.resources.oxygen.max} color="cyan" />
                    <ResourceGauge label="MUN" value={ship.resources.ammo.current} max={ship.resources.ammo.max} color="red" />
                </div>
            </div>

            {/* Combat Status */}
            {ship.combat?.isActive && (
                <div className="border border-red-900/50 bg-red-950/20 px-3 py-2 mb-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Crosshair size={14} className="text-red-500 animate-pulse" />
                        <span className="text-[10px] font-bold tracking-widest uppercase text-red-400">
                            COMBATE ATIVO — RODADA {ship.combat.round}
                        </span>
                    </div>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-red-600">
                        FASE: {ship.combat.phase === 'stations' ? 'AÇÕES DE ESTAÇÃO' : ship.combat.phase === 'resolution' ? 'RESOLUÇÃO' : 'DANO'}
                    </span>
                </div>
            )}

            {/* Stations */}
            <div className="flex flex-wrap gap-2 mb-3">
                {Object.entries(ship.stations).map(([key, station]) => (
                    <div
                        key={key}
                        className={`flex items-center gap-1.5 px-2 py-1 border text-[9px] font-bold tracking-widest uppercase ${station.occupantId ? 'border-cyan-700 bg-cyan-950/20 text-cyan-400' : 'border-zinc-800 bg-zinc-900/50 text-zinc-600'}`}
                    >
                        <CircleDot size={10} className={station.occupantId ? 'text-cyan-500' : 'text-zinc-700'} />
                        {key}: {station.occupantName || 'VAGO'}
                    </div>
                ))}
            </div>

            {/* Alert Banner */}
            {alerts.length > 0 && (
                <div className="flex flex-col gap-1">
                    {alerts.map(alert => (
                        <div
                            key={alert.id}
                            className={`flex items-center gap-2 px-3 py-1.5 border text-[10px] font-bold tracking-widest uppercase ${SEVERITY_STYLES[alert.severity]}`}
                        >
                            <AlertTriangle size={12} />
                            <span className="truncate">{alert.message}</span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

// --- Subcomponent: Resource Gauge ---
function ResourceGauge({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    const isEmpty = pct <= 0;
    const isLow = pct <= 25;

    const colorMap: Record<string, { bar: string; text: string; low: string }> = {
        amber: { bar: 'bg-amber-500', text: 'text-amber-500', low: 'text-red-500' },
        cyan:  { bar: 'bg-cyan-500',  text: 'text-cyan-500',  low: 'text-red-500' },
        red:   { bar: 'bg-red-500',   text: 'text-red-400',   low: 'text-red-500' },
    };

    const c = colorMap[color] || colorMap.cyan;

    return (
        <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-bold tracking-widest ${isEmpty ? 'text-red-500 animate-pulse' : isLow ? c.low : c.text}`}>
                {label}
            </span>
            <div className="w-12 h-1.5 bg-zinc-900 border border-zinc-800 relative overflow-hidden">
                <div className={`h-full ${isEmpty ? 'bg-red-800' : isLow ? 'bg-red-500' : c.bar} transition-all duration-300`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-[9px] font-mono ${isEmpty ? 'text-red-500' : isLow ? c.low : 'text-zinc-500'}`}>
                {value}
            </span>
        </div>
    );
}
