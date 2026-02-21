"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { subscribeToPlayer, updatePlayer, updatePlayerNested, createEmptyCharacter, createPlayer } from "@/lib/database";
import { CharacterSheet } from "@/types/character";
import { Lock, Unlock } from "lucide-react";
import { DiceCalculator } from "./DiceCalculator";
import { TerminalLog } from "./TerminalLog";
import { ClassSelector } from "./ClassSelector";
import { SkillTreeSelector } from "./SkillTreeSelector";

export default function PlayerSheetClient({ roomId, playerId }: { roomId: string; playerId: string }) {
    const [character, setCharacter] = useState<CharacterSheet | null>(null);
    const [loading, setLoading] = useState(true);

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

        return () => unsubscribe();
    }, [roomId, playerId]);

    const handleUpdate = (path: string, value: any) => {
        if (!character) return;

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

    return (
        <main className="max-w-4xl mx-auto border-2 border-emerald-900 bg-zinc-950/80 p-6 rounded-sm shadow-2xl shadow-emerald-900/20">
            <header className="border-b-2 border-emerald-900 pb-4 mb-6">
                <h1 className="text-2xl font-bold uppercase tracking-widest text-emerald-400">
                    Terminal MOTHERSHIP // {roomId}
                </h1>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputGroup label="NOME" value={character.name} onChange={(v) => handleUpdate("name", v)} />
                    <InputGroup label="PRONOMES" value={character.pronouns} onChange={(v) => handleUpdate("pronouns", v)} />
                </div>
            </header>

            <ClassSelector roomId={roomId} character={character} />

            {/* STATS & SAVES */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                    <h2 className="text-xl border-b border-emerald-900/50 pb-2 mb-4">ATRIBUTOS</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <StatBox label="FORÇA" value={character.stats.strength} baseValue={character.baseStats.strength} path="baseStats/strength" onUpdate={handleUpdate} />
                        <StatBox label="RAPIDEZ" value={character.stats.speed} baseValue={character.baseStats.speed} path="baseStats/speed" onUpdate={handleUpdate} />
                        <StatBox label="INTELECTO" value={character.stats.intellect} baseValue={character.baseStats.intellect} path="baseStats/intellect" onUpdate={handleUpdate} />
                        <StatBox label="COMBATE" value={character.stats.combat} baseValue={character.baseStats.combat} path="baseStats/combat" onUpdate={handleUpdate} />
                    </div>
                </div>
                <div>
                    <h2 className="text-xl border-b border-emerald-900/50 pb-2 mb-4">RESISTÊNCIAS</h2>
                    <div className="grid grid-cols-1 gap-4">
                        <StatBox label="SANIDADE" value={character.saves.sanity} baseValue={character.baseSaves.sanity} path="baseSaves/sanity" onUpdate={handleUpdate} />
                        <StatBox label="MEDO" value={character.saves.fear} baseValue={character.baseSaves.fear} path="baseSaves/fear" onUpdate={handleUpdate} />
                        <StatBox label="CORPO" value={character.saves.body} baseValue={character.baseSaves.body} path="baseSaves/body" onUpdate={handleUpdate} />
                    </div>
                </div>
            </section>

            {/* VITALS */}
            <section className="mb-8">
                <h2 className="text-xl border-b border-emerald-900/50 pb-2 mb-4">VITAIS</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <VitalBox
                        label="SAÚDE"
                        current={character.vitals.health.current}
                        max={character.vitals.health.max}
                        path="vitals/health"
                        onUpdate={handleUpdate}
                    />
                    <VitalBox
                        label="FERIDAS"
                        current={character.vitals.wounds.current}
                        max={character.vitals.wounds.max}
                        path="vitals/wounds"
                        onUpdate={handleUpdate}
                    />
                    <div className="bg-zinc-900/50 border border-emerald-900/50 p-4">
                        <div className="text-sm text-emerald-600 mb-2">STRESS</div>
                        <div className="flex gap-2 items-center">
                            <input
                                type="number"
                                className="w-16 bg-transparent border-b border-emerald-800 text-xl text-amber-500 outline-none text-center"
                                value={character.vitals.stress.current || 0}
                                onChange={(e) => handleUpdate("vitals/stress/current", Number(e.target.value))}
                            />
                            <span className="text-emerald-800">/ Mão:</span>
                            <input
                                type="number"
                                className="w-16 bg-transparent border-b border-emerald-800 text-xl outline-none text-center"
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
function InputGroup({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
                type="text"
                value={local}
                onChange={handleChange}
                className="bg-transparent border-b border-emerald-800 text-emerald-300 outline-none focus:border-emerald-400 focus:bg-emerald-950/20 px-1 py-1 uppercase"
            />
        </div>
    );
}

function StatBox({ label, value, baseValue, path, onUpdate }: { label: string; value: number; baseValue: number; path: string; onUpdate: (p: string, v: number) => void }) {
    const isModified = value !== baseValue;
    const [isLocked, setIsLocked] = useState(true);

    return (
        <div className="bg-zinc-900/50 border border-emerald-900/50 p-2 flex flex-col group hover:border-emerald-500 transition-colors">
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-emerald-600 group-hover:text-emerald-400">{label}</span>
                <button onClick={() => setIsLocked(!isLocked)} className="text-emerald-800 hover:text-amber-500 transition-colors">
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
                        className={`w-14 bg-zinc-950 border border-emerald-900 text-center text-sm outline-none font-mono focus:border-emerald-500 ${isLocked ? 'text-emerald-800/50 cursor-not-allowed' : 'text-amber-400'}`}
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

function VitalBox({ label, current, max, path, onUpdate }: { label: string; current: number; max: number; path: string; onUpdate: (p: string, v: number) => void }) {
    return (
        <div className="bg-zinc-900/50 border border-emerald-900/50 p-4">
            <div className="text-sm text-emerald-600 mb-2">{label}</div>
            <div className="flex gap-2 items-center">
                <input
                    type="number"
                    className="w-16 bg-transparent border-b border-emerald-800 text-xl outline-none text-center"
                    value={current || 0}
                    onChange={(e) => onUpdate(`${path}/current`, Number(e.target.value))}
                />
                <span className="text-emerald-800">/</span>
                <input
                    type="number"
                    className="w-16 bg-transparent border-b border-emerald-800 text-xl outline-none text-center text-emerald-700"
                    value={max || 0}
                    onChange={(e) => onUpdate(`${path}/max`, Number(e.target.value))}
                />
            </div>
        </div>
    );
}
