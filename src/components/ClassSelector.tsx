"use client";

import { useEffect, useState } from "react";
import { CharacterSheet, CharacterClass, Stats, Saves } from "@/types/character";
import { updatePlayer } from "@/lib/database";
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
        const freshMods: Partial<Stats> = {};
        const freshSaveMods: Partial<Saves> = {};

        // Base derived from the original roll
        const newStats: Stats = { ...character.baseStats };
        const newSaves: Saves = { ...character.baseSaves };
        let maxWounds = 2; // Default

        /*
         * MUTAÇÕES DO GENOMA
         */
        if (cls === 'Soldier') {
            freshMods.combat = 10;
            freshSaveMods.body = 10;
            freshSaveMods.fear = 20;
            maxWounds = 3;
        }
        else if (cls === 'Android') {
            freshMods.intellect = 20;
            freshSaveMods.fear = 60;
            maxWounds = 3;
            if (minusAndroid) {
                freshMods[minusAndroid] = -10;
            }
        }
        else if (cls === 'Scientist') {
            freshMods.intellect = 10;
            freshSaveMods.sanity = 30;
            if (plusScientist) {
                freshMods[plusScientist] = (freshMods[plusScientist] || 0) + 5;
            }
        }
        else if (cls === 'Teamster') {
            freshMods.strength = 5;
            freshMods.speed = 5;
            freshMods.intellect = 5;
            freshMods.combat = 5;
            freshSaveMods.sanity = 10;
            freshSaveMods.fear = 10;
            freshSaveMods.body = 10;
        }

        // Apply Deltas
        for (const key in freshMods) {
            newStats[key as keyof Stats] += freshMods[key as keyof Stats] || 0;
        }
        for (const key in freshSaveMods) {
            newSaves[key as keyof Saves] += freshSaveMods[key as keyof Saves] || 0;
        }

        // Prepare Firebase update
        const updatePayload: Partial<CharacterSheet> = {
            characterClass: cls,
            classMods: freshMods,
            classSaveMods: freshSaveMods,
            stats: newStats,
            saves: newSaves,
            vitals: {
                ...character.vitals,
                wounds: { ...character.vitals.wounds, max: maxWounds }
            }
        };

        await updatePlayer(roomId, character.id, updatePayload);
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
                                <option value="Teamster">Operador (Teamster)</option>
                                <option value="Soldier">Soldado (Soldier)</option>
                                <option value="Scientist">Cientista (Scientist)</option>
                                <option value="Android">Androide (Android)</option>
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
