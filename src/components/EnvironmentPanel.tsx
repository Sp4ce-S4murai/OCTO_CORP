"use client";

import { useEffect, useState } from "react";
import { EnvironmentState } from "@/types/character";
import { Thermometer, Gauge, Wind, Radiation, Biohazard } from "lucide-react";

export function EnvironmentPanel({ environment }: { environment?: EnvironmentState }) {
    const [coords, setCoords] = useState({ x: "000", y: "000", z: "000" });
    const [fluctuations, setFluctuations] = useState({
        temp: 0,
        pres: 0,
        o2: 0,
        grav: 0,
        rad: 0
    });

    // Animated pseudo-random coordinates and fluctuations
    useEffect(() => {
        const interval = setInterval(() => {
            setCoords({
                x: Math.floor(Math.random() * 999).toString().padStart(3, '0'),
                y: Math.floor(Math.random() * 999).toString().padStart(3, '0'),
                z: Math.floor(Math.random() * 999).toString().padStart(3, '0'),
            });
            // organic jitter values
            setFluctuations({
                temp: (Math.random() * 0.4) - 0.2,
                pres: (Math.random() * 0.04) - 0.02,
                o2: (Math.random() * 0.8) - 0.4,
                grav: (Math.random() * 0.02) - 0.01,
                rad: (Math.random() * 0.4) - 0.2
            });
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    const isMissing = !environment;

    // Parse values or default to ---
    const parseBase = (val: string | undefined, fallback: number) => {
        if (!val || val === '---') return fallback;
        const parsed = parseFloat(val);
        return isNaN(parsed) ? fallback : parsed;
    };

    const baseTemp = parseBase(environment?.temperature, 0);
    const basePres = parseBase(environment?.pressure, 0);
    const baseO2 = parseBase(environment?.oxygen, 0);
    const baseGrav = parseBase(environment?.gravity, 0);
    const baseRad = parseBase(environment?.radiation, 0);

    const temp = isMissing ? "---" : (baseTemp + fluctuations.temp).toFixed(1);
    const pres = isMissing ? "---" : Math.max(0, basePres + fluctuations.pres).toFixed(2);
    let o2Parsed = baseO2 + fluctuations.o2;
    if (environment?.oxygen === 'Corrosivo' || environment?.oxygen === '0%') o2Parsed = 0;
    const o2 = isMissing ? "---" : Math.max(0, o2Parsed).toFixed(1);
    const grav = isMissing ? "---" : Math.max(0, baseGrav + fluctuations.grav).toFixed(2);
    const rad = isMissing ? "---" : Math.max(0, baseRad + fluctuations.rad).toFixed(2);

    // Hazard conditions
    const o2Crit = !isMissing && (o2Parsed < 18 || environment?.oxygen === '0%' || environment?.oxygen === 'Corrosivo');
    const o2Warn = !isMissing && o2Parsed >= 18 && o2Parsed <= 20.9;

    const radCrit = !isMissing && baseRad >= 50;
    const radWarn = !isMissing && baseRad > 0.5 && baseRad < 50;

    const presCrit = !isMissing && (basePres < 0.5 || basePres > 1.5);
    const presWarn = !isMissing && ((basePres >= 0.5 && basePres < 0.8) || (basePres > 1.2 && basePres <= 1.5));

    const tempCrit = !isMissing && (baseTemp < -20 || baseTemp > 50);
    const tempWarn = !isMissing && ((baseTemp >= -20 && baseTemp < 0) || (baseTemp > 35 && baseTemp <= 50));

    // Danger Glow Logic Function
    const getGlow = (crit: boolean, warn: boolean, type: string) => {
        if (isMissing) return 'text-emerald-950'; // Off

        if (crit || warn) {
            let colorClass = 'text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]'; // Default warn
            let pulse = crit ? 'animate-pulse' : '';

            if (type === 'o2') {
                colorClass = `text-fuchsia-500 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)] ${pulse}`;
            } else if (type === 'rad') {
                colorClass = `text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)] ${pulse}`;
            } else if (type === 'temp') {
                if (baseTemp < 0) {
                    colorClass = `text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] ${pulse}`;
                } else {
                    colorClass = `text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] ${pulse}`;
                }
            } else if (type === 'pres') {
                colorClass = crit ? `text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse` : `text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]`;
            }

            return colorClass;
        }

        return 'text-emerald-900 drop-shadow-none'; // Normal (dim)
    };

    const tempColorStr = () => {
        if (isMissing) return "text-emerald-800";
        if (baseTemp <= -80) return "text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.4)]";
        if (baseTemp < 0) return "text-cyan-400";
        if (baseTemp > 30 && baseTemp <= 40) return "text-yellow-400";
        if (baseTemp > 40 && baseTemp <= 60) return "text-orange-500 animate-pulse";
        if (baseTemp > 60) return "text-red-500 animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.6)]";
        return "text-emerald-500";
    };

    return (
        <div className="mb-4 flex flex-row items-center justify-between gap-4 font-mono text-xs border border-emerald-900/50 bg-zinc-950/40 p-2 overflow-x-auto whitespace-nowrap custom-scrollbar">

            {/* PRESET NAME & COORDS */}
            <div className="flex items-center gap-3 shrink-0 pr-4 border-r border-emerald-900/30">
                <div className={`font-bold tracking-widest uppercase ${isMissing ? 'text-red-600 animate-pulse' : 'text-emerald-400'}`}>
                    {environment?.presetName || 'SINAL PERDIDO'}
                </div>
                {!isMissing && (
                    <div className="text-[10px] text-emerald-600 tracking-wider">
                        X:{coords.x} Y:{coords.y}
                    </div>
                )}
            </div>

            {/* ICONS & SENSORS READOUT */}
            <div className="flex-1 flex items-center gap-6 text-[10px] uppercase font-bold tracking-widest shrink-0">
                <div className="flex items-center gap-1.5" title="Temperatura">
                    <Thermometer className={getGlow(tempCrit, tempWarn, 'temp')} size={14} />
                    <span className={tempColorStr()}>{temp} <span className="text-[8px] opacity-70">°C</span></span>
                </div>

                <div className="flex items-center gap-1.5" title="Oxigênio">
                    <Biohazard className={getGlow(o2Crit, o2Warn, 'o2')} size={14} />
                    <span className={o2Crit ? 'text-fuchsia-500' : o2Warn ? 'text-amber-400' : 'text-emerald-500'}>{o2} <span className="text-[8px] opacity-70">%</span></span>
                </div>

                <div className="flex items-center gap-1.5" title="Pressão">
                    <Gauge className={getGlow(presCrit, presWarn, 'pres')} size={14} />
                    <span className={presCrit ? 'text-red-500' : presWarn ? 'text-amber-400' : 'text-emerald-500'}>{pres} <span className="text-[8px] opacity-70">ATM</span></span>
                </div>

                <div className="flex items-center gap-1.5" title="Gravidade">
                    <span className="text-emerald-800">G:</span>
                    <span className="text-emerald-500">{grav}</span>
                </div>

                <div className="flex items-center gap-1.5" title="Radiação">
                    <Radiation className={getGlow(radCrit, radWarn, 'rad')} size={14} />
                    <span className={radCrit ? 'text-green-500' : radWarn ? 'text-amber-400' : 'text-emerald-500'}>{rad} <span className="text-[8px] opacity-70">mSv</span></span>
                </div>
            </div>

        </div>
    );
}
