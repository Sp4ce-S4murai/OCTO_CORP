"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { subscribeToPlayer, updatePlayer, updatePlayerNested, createEmptyCharacter, createPlayer } from "@/lib/database";
import { CharacterSheet } from "@/types/character";
import { Lock, Unlock, User } from "lucide-react";
import { DiceCalculator } from "./DiceCalculator";
import { TerminalLog } from "./TerminalLog";
import { ClassSelector } from "./ClassSelector";
import { SkillTreeSelector } from "./SkillTreeSelector";
import { HeartRateMonitor } from "./HeartRateMonitor";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { EnvironmentState } from "@/types/character";

export default function PlayerSheetClient({ roomId, playerId }: { roomId: string; playerId: string }) {
    const [character, setCharacter] = useState<CharacterSheet | null>(null);
    const [isRoomLocked, setIsRoomLocked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [environment, setEnvironment] = useState<EnvironmentState | undefined>(undefined);

    useEffect(() => {
        const unsubscribe = subscribeToPlayer(roomId, playerId, (data) => {
            if (data) {
                setCharacter(data);
            } else {
                // Auto-create if not exists based on URL parameter topology constraint
                const newChar = createEmptyCharacter(playerId, `Jogador ${playerId}`);
                createPlayer(roomId, newChar).then(() => {
                    setCharacter(newChar);
                });
            }
            setLoading(false);
        });

        // Listen for Room Lockdown State & Environment Telemetry
        import("@/lib/firebase").then(({ database }) => {
            import("firebase/database").then(({ ref, onValue }) => {
                onValue(ref(database, `rooms/${roomId}/isLocked`), (snap) => {
                    setIsRoomLocked(snap.val() || false);
                });

                onValue(ref(database, `rooms/${roomId}/environment`), (snap) => {
                    setEnvironment(snap.val());
                });
            });
        });

        return () => unsubscribe();
    }, [roomId, playerId]);

    const handleUpdate = (path: string, value: any) => {
        if (!character || isRoomLocked) return;

        if (path.startsWith("baseStats/") || path.startsWith("baseSaves/")) {
            const updates: any = { [path]: value };

            if (path.startsWith("baseStats/")) {
                const stat = path.split("/")[1] as keyof typeof character.stats;
                updates[`stats/${stat}`] = Number(value) + (character.classMods?.[stat] || 0);
            } else if (path.startsWith("baseSaves/")) {
                const save = path.split("/")[1] as keyof typeof character.saves;
                updates[`saves/${save}`] = Number(value) + (character.classSaveMods?.[save] || 0);
            }

            updatePlayer(roomId, playerId, updates);
        } else {
            updatePlayerNested(roomId, playerId, path, value);
        }
    };

    if (loading || !character) {
        return <div className="animate-pulse flex p-4 text-emerald-500/50">Carregando Conexão Neural...</div>;
    }

    const isDead = character.vitals.wounds.current >= character.vitals.wounds.max;

    return (
        <main className={`max-w-4xl mx-auto border-2 ${isDead ? 'border-red-900 bg-red-950/20' : 'border-emerald-900 bg-zinc-950/80'} p-6 rounded-sm shadow-2xl relative overflow-hidden`}>
            {isDead && (
                <div className="absolute inset-0 bg-red-950/40 z-10 pointer-events-none flex items-center justify-center">
                    <div className="text-red-500 font-bold text-6xl md:text-9xl opacity-20 rotate-[-15deg] uppercase tracking-widest border-y-8 border-red-500/20 py-4 mix-blend-overlay">
                        O B I T O
                    </div>
                </div>
            )}

            {isRoomLocked && !isDead && (
                <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-red-950/80 border border-red-900 text-red-500 px-3 py-1 text-xs font-bold tracking-widest animate-pulse">
                    <Lock size={14} /> FICHAS TRAVADAS PELO DIRETOR
                </div>
            )}

            {!isDead && (
                <EnvironmentPanel environment={environment} vitals={character.vitals} isDead={isDead} />
            )}

            <header className={`border-b-2 ${isDead ? 'border-red-900' : 'border-emerald-900'} pb-4 mb-6 relative z-20`}>
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* AVATAR BOX (3x4 aspect ratio aprox) */}
                    <div className="w-32 h-40 shrink-0 border border-emerald-900 bg-zinc-950 flex flex-col items-center justify-center relative group overflow-hidden">
                        {character.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={character.avatarUrl} alt="Avatar" className={`w-full h-full object-cover ${isDead ? 'grayscale opacity-50' : ''}`} />
                        ) : (
                            <User size={48} className={`opacity-20 ${isDead ? 'text-red-500' : 'text-emerald-500'}`} />
                        )}

                        {/* Hover Overlay for URL input */}
                        <div className="absolute inset-0 bg-zinc-950/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col p-2 justify-center">
                            <label className="text-[10px] text-emerald-500 mb-1 text-center">URL DA FOTO</label>
                            <input
                                type="text"
                                className="w-full bg-zinc-900 border border-emerald-800 text-xs text-emerald-300 p-1 outline-none focus:border-emerald-500 text-center"
                                placeholder="http://..."
                                value={character.avatarUrl || ""}
                                onChange={(e) => handleUpdate("avatarUrl", e.target.value)}
                            />
                        </div>
                    </div>

                    {/* IDENTITY INFO */}
                    <div className="flex-1 w-full">
                        <h1 className={`text-2xl font-bold uppercase tracking-widest ${isDead ? 'text-red-500' : 'text-emerald-400'}`}>
                            Terminal MOTHERSHIP // {roomId} {isDead && "[ SINAL PERDIDO ]"}
                        </h1>
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InputGroup label="NOME" value={character.name} onChange={(v) => handleUpdate("name", v)} disabled={isRoomLocked || isDead} />
                            <InputGroup label="PRONOMES" value={character.pronouns} onChange={(v) => handleUpdate("pronouns", v)} disabled={isRoomLocked || isDead} />
                        </div>
                    </div>
                </div>
            </header>

            <ClassSelector roomId={roomId} character={character} />

            {/* STATS & SAVES */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                    <h2 className="text-xl border-b border-emerald-900/50 pb-2 mb-4">ATRIBUTOS</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <StatBox label="FORÇA" value={character.stats.strength} baseValue={character.baseStats.strength} path="baseStats/strength" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                        <StatBox label="RAPIDEZ" value={character.stats.speed} baseValue={character.baseStats.speed} path="baseStats/speed" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                        <StatBox label="INTELECTO" value={character.stats.intellect} baseValue={character.baseStats.intellect} path="baseStats/intellect" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                        <StatBox label="COMBATE" value={character.stats.combat} baseValue={character.baseStats.combat} path="baseStats/combat" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                    </div>
                </div>
                <div>
                    <h2 className="text-xl border-b border-emerald-900/50 pb-2 mb-4">RESISTÊNCIAS</h2>
                    <div className="grid grid-cols-1 gap-4">
                        <StatBox label="SANIDADE" value={character.saves.sanity} baseValue={character.baseSaves.sanity} path="baseSaves/sanity" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                        <StatBox label="MEDO" value={character.saves.fear} baseValue={character.baseSaves.fear} path="baseSaves/fear" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                        <StatBox label="CORPO" value={character.saves.body} baseValue={character.baseSaves.body} path="baseSaves/body" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                    </div>
                </div>
            </section>

            {/* VITALS */}
            <section className="mb-8 relative z-20">
                <div className="flex justify-between items-end border-b border-emerald-900/50 pb-2 mb-4">
                    <h2 className="text-xl">VITAIS</h2>
                    <div className="w-48 lg:w-64">
                        <HeartRateMonitor currentHp={character.vitals.health.current} maxHp={character.vitals.health.max} stress={character.vitals.stress.current} isDead={isDead} />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <VitalBox
                        label="SAÚDE"
                        current={character.vitals.health.current}
                        max={character.vitals.health.max}
                        path="vitals/health"
                        onUpdate={handleUpdate}
                        type="health"
                        disabled={isRoomLocked || isDead}
                    />
                    <VitalBox
                        label="FERIDAS"
                        current={character.vitals.wounds.current}
                        max={character.vitals.wounds.max}
                        path="vitals/wounds"
                        onUpdate={handleUpdate}
                        type="wounds"
                        disabled={isRoomLocked || isDead}
                    />
                    <div className="bg-zinc-900/50 border border-emerald-900/50 p-4">
                        <div className="text-sm text-emerald-600 mb-2">STRESS</div>
                        <div className="flex gap-2 items-center">
                            <input
                                disabled={isRoomLocked || isDead}
                                type="number"
                                className="w-16 bg-transparent border-b border-emerald-800 text-xl text-amber-500 outline-none text-center disabled:opacity-50"
                                value={character.vitals.stress.current || 0}
                                onChange={(e) => handleUpdate("vitals/stress/current", Number(e.target.value))}
                            />
                            <span className="text-emerald-800">/ Mão:</span>
                            <input
                                disabled={isRoomLocked || isDead}
                                type="number"
                                className="w-16 bg-transparent border-b border-emerald-800 text-xl outline-none text-center disabled:opacity-50"
                                value={character.vitals.stress.min || 0}
                                onChange={(e) => handleUpdate("vitals/stress/min", Number(e.target.value))}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* MODULE: TOOLS & LOGS */}
            <SkillTreeSelector roomId={roomId} character={character} />

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <DiceCalculator roomId={roomId} character={character} />
                <TerminalLog roomId={roomId} />
            </section>
        </main>
    );
}

// Helpers
function InputGroup({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
    const [local, setLocal] = useState(value);
    const timeoutRef = useRef<any>(null);

    useEffect(() => {
        setLocal(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocal(e.target.value);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => onChange(e.target.value), 500);
    };

    return (
        <div className="flex flex-col">
            <label className="text-xs text-emerald-700 mb-1">{label}</label>
            <input
                disabled={disabled}
                type="text"
                value={local}
                onChange={handleChange}
                className="bg-transparent border-b border-emerald-800 text-emerald-300 outline-none focus:border-emerald-400 focus:bg-emerald-950/20 px-1 py-1 uppercase disabled:opacity-50"
            />
        </div>
    );
}

function StatBox({ label, value, baseValue, path, onUpdate, disabled }: { label: string; value: number; baseValue: number; path: string; onUpdate: (p: string, v: number) => void; disabled?: boolean }) {
    const isModified = value !== baseValue;
    const [isComponentLocked, setIsComponentLocked] = useState(true);

    const isLocked = isComponentLocked || disabled;

    return (
        <div className="bg-zinc-900/50 border border-emerald-900/50 p-2 flex flex-col group hover:border-emerald-500 transition-colors relative">
            {disabled && <div className="absolute inset-0 z-10 cursor-not-allowed"></div>}
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-emerald-600 group-hover:text-emerald-400">{label}</span>
                <button onClick={() => setIsComponentLocked(!isComponentLocked)} className={`text-emerald-800 transition-colors ${disabled ? 'opacity-50' : 'hover:text-amber-500'}`} disabled={disabled}>
                    {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
            </div>
            <div className="flex justify-between items-center w-full">
                <div className="flex flex-col">
                    <span className="text-[10px] text-emerald-700/50 uppercase leading-none mb-1">Base</span>
                    <input
                        type="number"
                        value={baseValue || 0}
                        onChange={(e) => onUpdate(path, Number(e.target.value))}
                        disabled={isLocked}
                        className={`w-14 bg-zinc-950 border border-emerald-900 text-center text-sm outline-none font-mono focus:border-emerald-500 ${isLocked ? 'text-emerald-800/50 cursor-not-allowed' : 'text-amber-400'} disabled:bg-zinc-900/10`}
                        title="Atributo Base (S/ Classe)"
                    />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-emerald-700/50 uppercase leading-none mb-1">Total</span>
                    <div className={`text-2xl font-bold pr-2 ${isModified ? 'text-emerald-300' : 'text-emerald-500'}`} title="Resultado Modificado pela Classe">
                        {value || 0}
                    </div>
                </div>
            </div>
        </div>
    );
}

function VitalBox({ label, current, max, path, onUpdate, type, disabled }: { label: string; current: number; max: number; path: string; onUpdate: (p: string, v: number) => void; type?: 'health' | 'wounds'; disabled?: boolean }) {
    // Pulse logic for health
    let pulseClass = "";
    if (type === 'health') {
        if (current <= 3 && current > 0) {
            pulseClass = "animate-pulse border-red-500 bg-red-950/20";
        } else if (current <= 6 && current > 3) {
            pulseClass = "animate-pulse border-amber-500 bg-amber-950/20";
        }
    }

    // Death logic styling
    const isDead = type === 'wounds' && current >= max;
    if (isDead) {
        pulseClass = "border-red-600 bg-red-950/40 text-red-500";
    }

    return (
        <div className={`border p-4 transition-colors relative ${pulseClass ? pulseClass : 'bg-zinc-900/50 border-emerald-900/50'}`}>
            {disabled && <div className="absolute inset-0 z-10 cursor-not-allowed"></div>}
            <div className={`text-sm mb-2 ${pulseClass && type === 'health' ? (current <= 3 ? 'text-red-500 font-bold' : 'text-amber-500 font-bold') : isDead ? 'text-red-500 font-bold' : 'text-emerald-600'}`}>{label} {isDead && "(CRÍTICO)"}</div>
            <div className="flex gap-2 items-center">
                <input
                    disabled={disabled}
                    type="number"
                    className={`w-16 bg-transparent border-b text-xl outline-none text-center disabled:opacity-50 ${pulseClass && type === 'health' ? (current <= 3 ? 'border-red-800 text-red-400' : 'border-amber-800 text-amber-400') : isDead ? 'border-red-800 text-red-400 font-bold' : 'border-emerald-800 text-emerald-400'}`}
                    value={current || 0}
                    onChange={(e) => onUpdate(`${path}/current`, Number(e.target.value))}
                />
                <span className={pulseClass ? (current <= 3 || isDead ? 'text-red-800' : 'text-amber-800') : "text-emerald-800"}>/</span>
                <input
                    disabled={disabled}
                    type="number"
                    className={`w-16 bg-transparent border-b text-xl outline-none text-center disabled:opacity-50 ${pulseClass ? (current <= 3 || isDead ? 'border-red-800 text-red-700' : 'border-amber-800 text-amber-700') : 'border-emerald-800 text-emerald-700'}`}
                    value={max || 0}
                    onChange={(e) => onUpdate(`${path}/max`, Number(e.target.value))}
                />
            </div>
        </div>
    );
}
