"use client";

import { CharacterSheet } from "@/types/character";
import { User, Eye, ChevronUp, ChevronDown, Activity } from "lucide-react";
import { HeartRateMonitor } from "./HeartRateMonitor";

interface MiniSheetProps {
    character: CharacterSheet;
    onUpdate?: (path: string, val: string | number | boolean) => void;
    onDamage?: (val: number) => void;
    onStress?: (val: number) => void;
    onInspect?: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    isFirst?: boolean;
    isLast?: boolean;
    readOnly?: boolean;
}

export function MiniSheet({ character, onUpdate, onDamage, onStress, onInspect, onMoveUp, onMoveDown, isFirst, isLast, readOnly = false }: MiniSheetProps) {
    const isDead = character.vitals.wounds.current >= character.vitals.wounds.max;

    const getAvatarFilterState = () => {
        if (isDead) return 'avatar-filter-critical grayscale opacity-50';
        if (character.vitals.health.current <= 3) return 'avatar-filter-critical';
        if (character.vitals.health.current <= 6) return 'avatar-filter-warning';
        return 'avatar-filter-normal';
    };

    return (
        <div className={`border p-4 shadow-lg flex flex-col gap-4 group relative ${isDead ? 'bg-red-950/20 border-red-900' : 'bg-zinc-950/80 border-emerald-800'}`}>
            <div className={`flex justify-between items-center border-b pb-2 ${isDead ? 'border-red-900/50' : 'border-emerald-900/50'}`}>
                {!readOnly && onMoveUp && onMoveDown && (
                    <div className="flex flex-col items-center mr-2 gap-0.5 bg-emerald-950/30 p-1">
                        <button onClick={onMoveUp} disabled={isFirst} className={`p-0.5 rounded transition-colors ${isFirst ? 'opacity-30 cursor-not-allowed text-emerald-900' : 'text-emerald-600 hover:bg-emerald-800 hover:text-emerald-300'}`}>
                            <ChevronUp size={16} />
                        </button>
                        <button onClick={onMoveDown} disabled={isLast} className={`p-0.5 rounded transition-colors ${isLast ? 'opacity-30 cursor-not-allowed text-emerald-900' : 'text-emerald-600 hover:bg-emerald-800 hover:text-emerald-300'}`}>
                            <ChevronDown size={16} />
                        </button>
                    </div>
                )}
                {readOnly ? (
                    <span className={`w-full font-bold px-2 py-1 uppercase tracking-widest ${isDead ? 'text-red-500' : 'text-emerald-300'}`}>
                        {character.name || "NOME INDISPONÍVEL"}
                    </span>
                ) : (
                    <input
                        type="text"
                        value={character.name || "NOME INDISPONÍVEL"}
                        onChange={(e) => onUpdate?.("name", e.target.value)}
                        className={`bg-transparent font-bold outline-none w-full ${isDead ? 'text-red-500' : 'text-emerald-300 focus:bg-emerald-950/50'}`}
                    />
                )}
                <div className="flex items-center shrink-0">
                    <span className={`text-[10px] px-2 py-1 uppercase ml-2 whitespace-nowrap ${isDead ? 'text-red-800 bg-red-950/50' : 'text-emerald-700 bg-emerald-950/30'}`}>{character.characterClass}</span>
                    {!readOnly && onInspect && (
                        <button onClick={onInspect} className="text-[10px] px-2 py-1 uppercase ml-2 whitespace-nowrap bg-teal-950/80 text-teal-400 hover:bg-teal-900 border border-teal-900/50 transition-colors flex items-center gap-1 font-bold">
                            <Eye size={12} /> VER
                        </button>
                    )}
                </div>
            </div>

            <div className="flex gap-4">
                {/* 3x4 Avatar Miniature */}
                <div className={`w-20 h-28 shrink-0 border ${isDead ? 'border-red-900 bg-red-950/20' : 'border-emerald-900 bg-zinc-950'} flex items-center justify-center p-0.5 overflow-hidden scanline-overlay`}>
                    {character.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={character.avatarUrl} alt="Avatar" className={`w-full h-full object-cover ${getAvatarFilterState()}`} />
                    ) : (
                        <User size={32} className={`opacity-20 ${isDead ? 'text-red-500' : 'text-emerald-500'}`} />
                    )}
                </div>

                <div className="flex-1 flex flex-col justify-between">
                    <div className="grid grid-cols-1 gap-2">
                        {/* SAÚDE E EKG COMPARTILHADOS */}
                        <div className="relative border border-emerald-900 overflow-hidden bg-zinc-900/50">
                            {/* EKG Fundo */}
                            <div className="absolute inset-x-0 bottom-0 h-8 opacity-40 z-0">
                                <HeartRateMonitor currentHp={character.vitals.health.current} maxHp={character.vitals.health.max} stress={character.vitals.stress.current} wounds={character.vitals.wounds.current} isDead={isDead} />
                            </div>

                            {/* Valores de Saúde Frente */}
                            <div className="relative z-10 flex justify-between items-center p-1">
                                <span className={`text-[10px] pl-1 font-bold ${isDead ? 'text-red-600' : 'text-emerald-500'} bg-zinc-950/80 px-1`}>SAÚDE</span>
                                <div className="flex items-center text-xs gap-1 bg-zinc-950/80 px-1 rounded">
                                    <div className="flex items-center text-[10px] font-mono mx-2">
                                        <span className={`${isDead ? 'text-red-500' : 'text-emerald-400'}`}>{character.vitals.health.current}</span>
                                        <span className="text-emerald-800 mx-1">/</span>
                                        <span className="text-emerald-600">{character.vitals.health.max}</span>
                                    </div>

                                    {!isDead && !readOnly && onDamage && (
                                        <div className="flex ml-1 border border-emerald-800 bg-zinc-950">
                                            <input
                                                type="number"
                                                id={`dmg-${character.id}`}
                                                className="w-6 bg-transparent text-center text-red-400 outline-none text-[10px]"
                                                placeholder="0"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = Number(e.currentTarget.value);
                                                        if (val > 0) onDamage(val);
                                                        e.currentTarget.value = "";
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={() => {
                                                    const el = document.getElementById(`dmg-${character.id}`) as HTMLInputElement;
                                                    const val = Number(el.value);
                                                    if (val > 0) onDamage(val);
                                                    el.value = "";
                                                }}
                                                className="bg-red-950/80 hover:bg-red-900 text-red-300 text-[9px] px-1 font-bold border-l border-emerald-800 transition-colors"
                                            >
                                                DMG
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {/* FERIDAS */}
                        <div className={`flex justify-between items-center bg-zinc-900/50 p-1 border ${isDead ? 'border-red-900' : 'border-emerald-900'}`}>
                            <span className={`text-[10px] pl-1 ${isDead ? 'text-red-600' : 'text-emerald-600'}`}>FERIDAS</span>
                            <div className="flex items-center text-xs pr-1 flex-1 justify-end">
                                {readOnly ? (
                                    <span className={`px-2 text-right ${isDead ? 'text-red-500 font-bold' : 'text-emerald-300'}`}>{character.vitals.wounds.current || 0}</span>
                                ) : (
                                    <input disabled={isDead} type="number" className={`w-6 bg-transparent text-right outline-none focus:bg-emerald-900/50 ${isDead ? 'text-red-500 font-bold' : 'text-emerald-300'}`} value={character.vitals.wounds.current || 0} onChange={(e) => onUpdate?.("vitals/wounds/current", Number(e.target.value))} />
                                )}
                                <span className={isDead ? 'text-red-800 mx-1' : 'text-emerald-800 mx-1'}>/</span>
                                <span className={isDead ? 'text-red-700 font-bold' : 'text-emerald-700'}>{character.vitals.wounds.max}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center bg-amber-950/20 p-1 border border-amber-900/50">
                            <span className="text-[10px] pl-1 text-amber-600">STRESS</span>
                            <div className="flex items-center text-xs pr-1 group/stress flex-1 justify-end">
                                {readOnly ? (
                                    <span className="px-2 text-right text-amber-400 font-bold">{character.vitals.stress.current || 0}</span>
                                ) : (
                                    <input type="number" className="w-6 bg-transparent text-right outline-none text-amber-400 focus:bg-amber-900/50 font-bold" value={character.vitals.stress.current || 0} onChange={(e) => onUpdate?.("vitals/stress/current", Number(e.target.value))} />
                                )}
                                <span className="text-amber-800/50 mx-1">/</span>
                                <span className="text-amber-700/50">{character.vitals.stress.min}</span>
                                {!readOnly && onStress && (
                                    <button
                                        onClick={() => onStress(1)}
                                        className="ml-2 bg-amber-950/80 hover:bg-amber-900 text-amber-300 text-[10px] px-1 font-bold border-l border-amber-800 transition-colors"
                                        title="Pânico Diretor (+1 Stress)"
                                    >
                                        +1
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Summary - Fast View */}
            <div className="grid grid-cols-4 gap-1 text-[10px]">
                <StatMini label="FOR" value={character.stats.strength} />
                <StatMini label="RAP" value={character.stats.speed} />
                <StatMini label="INT" value={character.stats.intellect} />
                <StatMini label="CMB" value={character.stats.combat} />
                <StatMini label="SAN" value={character.saves.sanity} isSave />
                <StatMini label="MED" value={character.saves.fear} isSave />
                <StatMini label="COR" value={character.saves.body} isSave />
                <div className="flex justify-center items-center border border-emerald-900/50 bg-emerald-950/10 opacity-50">
                    <Activity size={10} className="text-emerald-500" />
                </div>
            </div>
        </div>
    );
}

function StatMini({ label, value, isSave }: { label: string, value: number, isSave?: boolean }) {
    return (
        <div className={`flex justify-between items-center p-1 border ${isSave ? 'border-emerald-800/30' : 'border-emerald-900/50 bg-emerald-950/10'}`}>
            <span className={isSave ? 'text-emerald-700' : 'text-emerald-600'}>{label}</span>
            <span className={isSave ? 'text-emerald-500' : 'text-emerald-400'}>{value}</span>
        </div>
    );
}
