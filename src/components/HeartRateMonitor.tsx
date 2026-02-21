import React from 'react';

interface Props {
    currentHp: number;
    maxHp: number;
    stress: number;
    isDead: boolean;
}

export function HeartRateMonitor({ currentHp, maxHp, stress, isDead }: Props) {
    if (isDead) {
        return (
            <div className="w-full h-8 bg-red-950/20 border border-red-900/50 flex items-center justify-center relative overflow-hidden group">
                {/* Flatline effect */}
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-[2px] bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)] opacity-80"></div>
                </div>
                {/* Visual noise/static effect */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-50 mix-blend-overlay pointer-events-none"></div>
                {/* Scanline passing by */}
                <div className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-red-500/20 to-transparent -left-1/4 animate-[scanline_3s_linear_infinite]"></div>
            </div>
        );
    }

    const ratio = currentHp / maxHp;

    let colorClass = "stroke-emerald-500 shadow-emerald-500";
    let baseSpeed = 3; // default slow
    let glowClass = "shadow-[0_0_8px_rgba(16,185,129,0.8)]"; // default emerald glow

    if (currentHp <= 3) {
        colorClass = "stroke-red-500";
        baseSpeed = 0.8;
        glowClass = "shadow-[0_0_12px_rgba(239,68,68,0.9)]"; // red
    } else if (currentHp <= 6) {
        colorClass = "stroke-amber-500";
        baseSpeed = 1.5;
        glowClass = "shadow-[0_0_10px_rgba(245,158,11,0.8)]"; // amber
    }

    // Stress Modifier (0 to 20)
    // The higher the stress, the faster the base speed gets multiplied, up to 3x faster at stress 20.
    const stressFactor = Math.min(stress / 20, 1); // 0.0 to 1.0
    const finalSpeed = Math.max(0.4, baseSpeed - (baseSpeed * 0.7 * stressFactor));

    // Choose SVG Path complexity based on stress
    // Low stress = normal EKG
    // Medium stress (>8) = double beat / slight arrhythmia
    // High stress (>15) = erratic tachycardia spikes
    let pathD = "M 0 20 L 20 20 L 25 10 L 30 28 L 35 5 L 45 25 L 50 20 L 100 20";
    let pathD2 = "M 100 20 L 120 20 L 125 10 L 130 28 L 135 5 L 145 25 L 150 20 L 200 20";

    if (stress >= 15) {
        // High Erratic
        pathD = "M 0 20 L 10 20 L 15 5 L 20 30 L 25 0 L 30 35 L 35 15 L 40 25 L 45 10 L 50 20 L 100 20";
        pathD2 = "M 100 20 L 110 20 L 115 5 L 120 30 L 125 0 L 130 35 L 135 15 L 140 25 L 145 10 L 150 20 L 200 20";
    } else if (stress >= 8) {
        // Medium Arrhythmia
        pathD = "M 0 20 L 15 20 L 20 10 L 25 30 L 30 5 L 35 25 L 40 20 L 45 15 L 50 25 L 55 20 L 100 20";
        pathD2 = "M 100 20 L 115 20 L 120 10 L 125 30 L 130 5 L 135 25 L 140 20 L 145 15 L 150 25 L 155 20 L 200 20";
    }

    return (
        <div className="w-full h-8 bg-zinc-950/80 border border-emerald-900/30 flex items-center relative overflow-hidden" title={`Stress Factor: ${(stressFactor * 100).toFixed(0)}%`}>
            {/* Scanline passing by */}
            <div className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent -left-1/4 animate-[scanline_3s_linear_infinite]"></div>

            {/* SVG EKG Line */}
            <svg
                className={`w-[200%] h-full flex-shrink-0 origin-left`}
                style={{ animation: `ekg ${finalSpeed}s linear infinite` }}
                viewBox="0 0 200 32"
                preserveAspectRatio="none"
            >
                <style>
                    {`
                        @keyframes ekg {
                            0% { transform: translateX(0); }
                            100% { transform: translateX(-50%); }
                        }
                        @keyframes scanline {
                            0% { left: -25%; }
                            100% { left: 125%; }
                        }
                    `}
                </style>
                {/* 
                  Draw two identical peaks so when it translates -50% to left
                  it loops perfectly (0 to 100, then 100 to 200).
                */}
                <g className={`${colorClass}`} strokeWidth="1.5" fill="none" style={{ filter: `drop-shadow(0px 0px 4px var(--tw-shadow-color))` }}>
                    <path d={pathD} />
                    <path d={pathD2} />
                </g>
            </svg>
        </div>
    );
}
