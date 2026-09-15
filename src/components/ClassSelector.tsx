"use client";

import { useEffect, useState } from "react";
import { CharacterSheet, CharacterClass, Stats } from "@/types/character";
import { updatePlayer } from "@/lib/database";
import { CLASS_LABELS } from "@/lib/itemsDictionary";
import { applyClassToCharacter } from "@/lib/characterClass";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
    roomId: string;
    character: CharacterSheet;
}

export function ClassSelector({ roomId, character }: Props) {
    const [selectedClass, setSelectedClass] = useState<CharacterClass>(character.characterClass);
    // States purely for Android and Scientist dynamics
    const [androidMinusStat, setAndroidMinusStat] = useState<keyof Stats>('strength');
    const [scientistPlusStat, setScientistPlusStat] = useState<keyof Stats>('strength');
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setSelectedClass(character.characterClass);
    }, [character.characterClass]);

    const applyClassMutations = async (cls: CharacterClass, minusAndroid?: keyof Stats, plusScientist?: keyof Stats) => {
        // As mutacoes de genoma vivem em lib/characterClass.ts para poderem ser
        // reaproveitadas fora da UI (ex: semear as fichas da Sala Teste).
        const payload = applyClassToCharacter(character, cls, {
            androidPenaltyStat: minusAndroid,
            scientistBonusStat: plusScientist,
        });
        await updatePlayer(roomId, character.id, payload);
    };

    const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newClass = e.target.value as CharacterClass;
        setSelectedClass(newClass);
        applyClassMutations(newClass, androidMinusStat, scientistPlusStat);
    };

    const handleAndroidChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value as keyof Stats;
        setAndroidMinusStat(val);
        applyClassMutations('Android', val, scientistPlusStat);
    };

    const handleScientistChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value as keyof Stats;
        setScientistPlusStat(val);
        applyClassMutations('Scientist', androidMinusStat, val);
    };

    return (
        <div className="bg-zinc-900 border border-emerald-900 mb-6">
            <button
                className="w-full text-left p-4 flex items-center gap-2 hover:bg-emerald-950/20 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <ChevronDown size={20} className="text-emerald-600" /> : <ChevronRight size={20} className="text-emerald-600" />}
                <h3 className="text-emerald-500 font-bold uppercase text-lg">
                    Genoma da Classe (Mutação de Status)
                </h3>
            </button>

            {isOpen && (
                <div className="p-4 border-t border-emerald-900 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col md:flex-row gap-4">
                        <label className="flex flex-col flex-1">
                            <span className="text-sm text-emerald-700 mb-1">CLASSE</span>
                            <select
                                value={selectedClass}
                                onChange={handleClassChange}
                                className="bg-zinc-950 border border-emerald-800 text-emerald-300 p-2 outline-none focus:border-emerald-500"
                            >
                                {(Object.keys(CLASS_LABELS) as CharacterClass[]).map(cls => (
                                    <option key={cls} value={cls}>{CLASS_LABELS[cls]}</option>
                                ))}
                            </select>
                        </label>

                        {selectedClass === 'Android' && (
                            <label className="flex flex-col flex-1 animate-pulse">
                                <span className="text-sm text-amber-500 mb-1">Falha de Sistema (-10)</span>
                                <select
                                    value={androidMinusStat}
                                    onChange={handleAndroidChange}
                                    className="bg-amber-950/20 border border-amber-800 text-amber-300 p-2 outline-none focus:border-amber-500"
                                >
                                    <option value="strength">Força</option>
                                    <option value="speed">Rapidez</option>
                                    <option value="intellect">Intelecto</option>
                                    <option value="combat">Combate</option>
                                </select>
                            </label>
                        )}

                        {selectedClass === 'Scientist' && (
                            <label className="flex flex-col flex-1">
                                <span className="text-sm text-emerald-400 mb-1">Especialização (+5)</span>
                                <select
                                    value={scientistPlusStat}
                                    onChange={handleScientistChange}
                                    className="bg-emerald-900/20 border border-emerald-600 text-emerald-300 p-2 outline-none focus:border-emerald-400"
                                >
                                    <option value="strength">Força</option>
                                    <option value="speed">Rapidez</option>
                                    <option value="intellect">Intelecto</option>
                                    <option value="combat">Combate</option>
                                </select>
                            </label>
                        )}
                    </div>

                    {/* Helper text explaining mutations */}
                    <div className="mt-4 text-xs text-emerald-600/70">
                        {selectedClass === 'Teamster' && "Recebe +5 em todos Atributos e +10 em todas Resistências."}
                        {selectedClass === 'Soldier' && "Recebe +10 Combate e Corpo, +20 Medo, +1 Ferida Máxima."}
                        {selectedClass === 'Scientist' && "Recebe +10 Intelecto, +30 Sanidade e +5 em Atributo bônus."}
                        {selectedClass === 'Android' && "Recebe +20 Intelecto, +60 Medo, +1 Ferida Máxima, e padece de -10 em um Atributo."}
                    </div>
                </div>
            )}
        </div>
    );
}
