import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface Props {
    currentHp: number;
    maxHp: number;
    stress: number;
    wounds: number;
    isDead: boolean;
}

export function HeartRateMonitor({ currentHp, maxHp, stress, wounds, isDead }: Props) {
    const [soundEnabled, setSoundEnabled] = useState(false);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // 1. STRESS (E): Frequência - O multiplicador de tempo
    // BPM Base: BPM = 60 + (E * 6)
    const bpm = 60 + (stress * 6);
    // Tempo final em segundos de um ciclo (60s / BPM)
    const finalSpeed = 60 / bpm;

    // 2. SAÚDE (S): Amplitude e Cor 
    // Mapeamento visual com base na vitalidade da criatura
    let colorClass = "stroke-emerald-500 shadow-emerald-500";
    let glowClass = "shadow-[0_0_8px_rgba(16,185,129,0.8)]"; // default emerald glow

    if (currentHp <= 3) {
        // Estado Crítico: Baixa amplitude ("arrastando"), cor vermelha/âmbar opaco
        colorClass = "stroke-red-500 opacity-80";
        glowClass = "shadow-[0_0_4px_rgba(239,68,68,0.5)]";
    } else if (currentHp <= 6) {
        // Estado de Alerta: Amplitude média, cor âmbar
        colorClass = "stroke-amber-500";
        glowClass = "shadow-[0_0_8px_rgba(245,158,11,0.6)]";
    }

    // 3. FERIDAS (F): Entropia e Ruído
    // Adiciona classes adicionais ao container principal para simular o "jitter" ou oscilação base
    let containerAnimationClass = "";
    if (wounds === 1) {
        containerAnimationClass = "animate-[slight-jitter_2s_infinite]";
    } else if (wounds === 2) {
        containerAnimationClass = "animate-[moderate-jitter_1s_infinite]";
    } else if (wounds >= 3) {
        containerAnimationClass = "animate-[heavy-oscillation_0.5s_infinite]";
    }

    // Audio Synthetic Engine
    useEffect(() => {
        if (!soundEnabled || isDead) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (audioCtxRef.current) {
                audioCtxRef.current.close().catch(console.error);
                audioCtxRef.current = null;
            }
            return;
        }

        // Initialize Context
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const playBeep = () => {
            if (!audioCtxRef.current) return;
            const ctx = audioCtxRef.current;

            // Se as feridas introduzirem "dropped beats", temos uma chance de pular este som
            // F=2 (10% de chance), F>=3 (25% de chance)
            if (wounds === 2 && Math.random() < 0.10) return;
            if (wounds >= 3 && Math.random() < 0.25) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            // PITCH: Ditado pelo estresse e pela saúde
            // Base pitch + freq scale based on Stress
            const stressFactor = Math.min(stress / 20, 1);
            osc.frequency.value = 400 + (stressFactor * 600); // 400Hz to 1000Hz

            if (currentHp <= 3) {
                // Grave distortion for dying state
                osc.type = 'triangle';
                osc.frequency.value *= 0.8;
            } else {
                osc.type = 'sine';
            }

            // Envelope
            gain.gain.setValueAtTime(0, ctx.currentTime);
            // Ataque rápido para dar impressão de sístole
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
            // Decay baseado no intervalo de batimento - fica mais curto com estresse alto
            const decayTime = Math.min(0.2, finalSpeed * 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + decayTime);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + decayTime);
        };

        // Every time finalSpeed changes, we reset the interval to match the CSS animation loop
        // finalSpeed is in SECONDS. Interval works in ms.
        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            playBeep();
        }, finalSpeed * 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [soundEnabled, isDead, finalSpeed, stress, currentHp, wounds]);

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

    // --- WAVEFORM ALGORITHM ---
    // The visual waveform path represents 1 heartbeat cycle in a standard 0 to 100 timeline constraint (X-axis).
    // The Y-axis is from 0 to 32 (where 16 is the baseline/middle).
    let peakY1 = 4;   // Overshoot (r-wave peak)
    let peakY2 = 28;  // Undershoot (s-wave depth)
    let baseline = 18;

    if (currentHp <= 3) {
        // Achata a onda, quase "arrastando" no fundo
        peakY1 = 12;
        peakY2 = 22;
        baseline = 18;
    } else if (currentHp <= 6) {
        // Reduz a amplitude suavemente
        peakY1 = 8;
        peakY2 = 25;
    }

    // A ferida introduz artefato na onda P ou T (aqui na ponta inicial/final do ciclo x=10 e x=40)
    let artifactY1 = baseline;
    let artifactY2 = baseline;

    if (wounds >= 1) {
        // Add random artifact bumps dynamically
        artifactY1 = baseline - (Math.random() * 4);
        artifactY2 = baseline + (Math.random() * 4);
    }

    // Feridas 2 e 3 geram batidas ectópicas aleatórias (espasmos largos - QRS deformado)
    let pathD = `M 0 ${baseline} L 15 ${artifactY1} L 20 ${peakY1} L 25 ${peakY2} L 30 ${baseline} L 40 ${artifactY2} L 50 ${baseline} L 100 ${baseline}`;
    let pathD2 = `M 100 ${baseline} L 115 ${artifactY1} L 120 ${peakY1} L 125 ${peakY2} L 130 ${baseline} L 140 ${artifactY2} L 150 ${baseline} L 200 ${baseline}`;

    // Dropped beats logic for heavy wounds (visual representation)
    // We statically compile the string for React, but we simulate a "dropped beat" randomly if wound >= 2.
    // For React, we must pick it per render. So 10% or 25% of the time, the second cycle (pathD2) turns into a flatline.
    const isDroppedBeat = (wounds === 2 && Math.random() < 0.1) || (wounds >= 3 && Math.random() < 0.25);
    if (isDroppedBeat) {
        pathD2 = `M 100 ${baseline} L 200 ${baseline}`;
    }

    return (
        <div className={`w-full h-8 bg-zinc-950/80 border border-emerald-900/30 flex items-center relative overflow-hidden ${containerAnimationClass}`} title={`BPM Estimado: ${bpm}`}>
            {/* Scanline passing by */}
            <div className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent -left-1/4 animate-[scanline_3s_linear_infinite]"></div>

            {/* SVG EKG Line */}
            <svg
                className="w-[200%] h-full flex-shrink-0 origin-left"
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
                        @keyframes slight-jitter {
                            0% { transform: translateY(0px); }
                            25% { transform: translateY(1px); }
                            75% { transform: translateY(-1px); }
                            100% { transform: translateY(0px); }
                        }
                        @keyframes moderate-jitter {
                            0%, 100% { transform: translateY(0px); }
                            20% { transform: translateY(2px); }
                            40% { transform: translateY(-2px); }
                            60% { transform: translateY(1px); }
                            80% { transform: translateY(-1px); }
                        }
                        @keyframes heavy-oscillation {
                            0% { transform: translateY(-4px); }
                            25% { transform: translateY(3px); }
                            50% { transform: translateY(-5px); }
                            75% { transform: translateY(6px); }
                            100% { transform: translateY(-4px); }
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

            {/* Audio Toggle Button - Absolute Floating */}
            <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors z-10 ${soundEnabled ? 'text-emerald-500 bg-emerald-950/50 hover:bg-emerald-900' : 'text-zinc-600 bg-zinc-950/80 hover:bg-zinc-800'}`}
                title="Alternar Bip Cardíaco"
            >
                {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            </button>
        </div>
    );
}
