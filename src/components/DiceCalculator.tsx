"use client";

import { useState } from "react";
import { pushLog, updatePlayerNested } from "@/lib/database";
import { CharacterSheet, RollLog } from "@/types/character";

interface Props {
    roomId: string;
    character: CharacterSheet;
}

const SKILL_TREE = {
    "Básicas (+10)": [
        "Linguística", "Zoologia", "Botânica", "Geologia", "Maquinário", "Reparos",
        "Química", "Computação", "Gravidade Zero", "Matemática", "Arte", "Arqueologia",
        "Teologia", "Treino Militar", "Malandragem", "Atletismo"
    ],
    "Expertises (+15)": [
        "Psicologia", "Patologia", "Medicina", "Ecologia", "Mineração", "Mecânica",
        "Explosivos", "Farmacologia", "Hacking", "Pilotagem", "Física", "Misticismo",
        "Tática", "Sobrevivência", "Armas de Fogo", "Briga"
    ],
    "Maestrias (+20)": [
        "Sofontologia", "Exobiologia", "Cirurgia", "Planetologia", "Robótica",
        "Engenharia", "Cibernética", "Inteligência Artificial", "Especialização em Veículo",
        "Hiperespaço", "Xenoesoterismo", "Comando", "Especialização em Combate"
    ]
};

const getSkillBonus = (skillName: string) => {
    if (SKILL_TREE["Básicas (+10)"].includes(skillName)) return 10;
    if (SKILL_TREE["Expertises (+15)"].includes(skillName)) return 15;
    if (SKILL_TREE["Maestrias (+20)"].includes(skillName)) return 20;
    return 0;
};

export function DiceCalculator({ roomId, character }: Props) {
    const [rollStr, setRollStr] = useState("");
    const [selectedStatPath, setSelectedStatPath] = useState("stats.strength");
    const [selectedSkillName, setSelectedSkillName] = useState("Nenhuma (+0)");

    // States for Panic
    const [panicMode, setPanicMode] = useState(false);
    const [panicRollStr, setPanicRollStr] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const handleRoll = async (isVirtualRoll: boolean = false) => {
        if (isProcessing) return;
        setIsProcessing(true);

        let rawRoll = 0;

        if (isVirtualRoll) {
            // RNG D100 (0-99)
            rawRoll = Math.floor(Math.random() * 100);
            setRollStr(rawRoll.toString().padStart(2, '0'));
        } else {
            rawRoll = parseInt(rollStr, 10);
            if (isNaN(rawRoll) || rawRoll < 0 || rawRoll > 99) {
                alert("Por favor, insira um valor numérico entre 0 e 99 (use 00 para 0).");
                setIsProcessing(false);
                return;
            }
        }

        // Parse path
        const [category, stat] = selectedStatPath.split('.');
        const statName = stat.toUpperCase();
        let statValue = 0;

        if (category === 'stats') {
            statValue = character.stats[stat as keyof typeof character.stats];
        } else {
            statValue = character.saves[stat as keyof typeof character.saves];
        }

        // Resolve rules
        const rollString = rawRoll.toString().padStart(2, '0');
        const isDouble = rollString[0] === rollString[1];
        const isAutoFail = rawRoll >= 90 && rawRoll <= 99;

        const modifierValue = getSkillBonus(selectedSkillName);
        const targetValue = statValue + modifierValue;

        let resolveResult: RollLog['result'] = 'Failure';

        if (isAutoFail) {
            resolveResult = isDouble ? 'Critical Failure' : 'Failure';
        } else if (rawRoll <= targetValue) {
            resolveResult = isDouble ? 'Critical Success' : 'Success';
        } else {
            resolveResult = isDouble ? 'Critical Failure' : 'Failure';
        }

        const logPayload: any = {
            timestamp: Date.now(),
            playerName: character.name || "UNIDADE",
            playerId: character.id,
            statName,
            statValue,
            roll: rawRoll,
            result: resolveResult,
        };

        if (modifierValue > 0) {
            logPayload.modifier = { name: selectedSkillName, value: modifierValue };
        }

        try {
            // push to firebase
            await pushLog(roomId, logPayload);

            // Handle Stress and Panic Triggers
            if (resolveResult === 'Failure' || resolveResult === 'Critical Failure') {
                const currentStress = character.vitals.stress.current || 0;
                await updatePlayerNested(roomId, character.id, "vitals/stress/current", currentStress + 1);

                if (resolveResult === 'Critical Failure') {
                    setPanicMode(true);
                }
            }

            if (!isVirtualRoll) setRollStr("");
        } catch (e) {
            console.error(e);
            alert("Falha na Rede Neural/Firebase: As Regras do Banco de Dados rejeitaram a gravação ou a conexão caiu. Verifique se as Permissões do RTDB estão liberadas como '.write': true no console do Firebase.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePanicRoll = async (isVirtualRoll: boolean = false) => {
        if (isProcessing) return;
        setIsProcessing(true);

        let rawRoll = 0;

        if (isVirtualRoll) {
            // RNG D20 (1-20)
            rawRoll = Math.floor(Math.random() * 20) + 1;
            setPanicRollStr(rawRoll.toString());
        } else {
            rawRoll = parseInt(panicRollStr, 10);
            if (isNaN(rawRoll) || rawRoll < 1 || rawRoll > 20) {
                alert("Por favor, insira um valor entre 1 e 20 para o D20.");
                setIsProcessing(false);
                return;
            }
        }

        const currentStress = character.vitals.stress.current || 0;

        // Panic Rule: Roll > Stress Current
        const passed = rawRoll > currentStress;
        const resolveResult: RollLog['result'] = passed ? 'Panic Success' : 'Panic Fail';

        try {
            await pushLog(roomId, {
                timestamp: Date.now(),
                playerName: character.name || "UNIDADE",
                playerId: character.id,
                statName: 'STRESS',
                statValue: currentStress,
                roll: rawRoll,
                result: resolveResult,
            });

            setPanicMode(false);
            setPanicRollStr("");
        } catch (e) {
            console.error(e);
            alert("A conexão com a nuvem caiu antes que o log pudesse ser gravado. Cheque as permissões do banco.");
        } finally {
            setIsProcessing(false);
        }
    };

    if (panicMode) {
        return (
            <div className="bg-amber-950 border-2 border-amber-600 p-4 shadow-xl shadow-amber-900/50 animate-pulse">
                <h3 className="text-amber-500 font-bold mb-2 uppercase text-xl border-b border-amber-600 pb-2">
                    ⚠️ ALERTA DE PÂNICO DETECTADO
                </h3>
                <p className="text-amber-200 text-sm mb-4">
                    O sistema nervoso central excedeu o limite seguro. Teste contra <span className="font-bold">Stress Atual ({character.vitals.stress.current})</span> rolando 1d20.
                    É necessário rolar um valor <span className="font-bold underline">MAIOR</span> que o Stress.
                </p>

                <div className="flex flex-wrap gap-4 items-end">
                    <label className="flex flex-col w-24">
                        <span className="text-sm text-amber-500 mb-1">D20</span>
                        <input
                            type="number"
                            min="1" max="20"
                            value={panicRollStr}
                            onChange={(e) => setPanicRollStr(e.target.value)}
                            className="bg-amber-900/50 border border-amber-600 text-amber-100 p-2 outline-none focus:border-amber-400 text-center text-xl font-bold"
                            placeholder="1-20"
                        />
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => handlePanicRoll(true)}
                            disabled={isProcessing}
                            className="bg-amber-700 hover:bg-amber-600 text-amber-50 px-4 py-2 uppercase font-bold tracking-widest border border-amber-500 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                            RNG D20
                        </button>
                        <button
                            onClick={() => handlePanicRoll(false)}
                            disabled={!panicRollStr || isProcessing}
                            className="bg-zinc-900 hover:bg-zinc-800 text-amber-500 p-2 uppercase font-bold tracking-widest border border-amber-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                            RESOLVER MANUAL
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900 border border-emerald-900 p-4">
            <h3 className="text-emerald-500 font-bold mb-4 uppercase text-lg border-b border-emerald-900 pb-2 flex justify-between items-center">
                <span>Calculador de Teste</span>
                <span className="text-xs font-normal text-emerald-700">D100 MÓDULO</span>
            </h3>

            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <label className="flex flex-col flex-1">
                        <span className="text-sm text-emerald-700 mb-1">ATRIBUTO/RESISTÊNCIA</span>
                        <select
                            value={selectedStatPath}
                            onChange={(e) => setSelectedStatPath(e.target.value)}
                            className="bg-zinc-950 border border-emerald-800 text-emerald-300 p-2 outline-none focus:border-emerald-500"
                        >
                            <optgroup label="Atributos">
                                <option value="stats.strength">Força ({character.stats.strength})</option>
                                <option value="stats.speed">Rapidez ({character.stats.speed})</option>
                                <option value="stats.intellect">Intelecto ({character.stats.intellect})</option>
                                <option value="stats.combat">Combate ({character.stats.combat})</option>
                            </optgroup>
                            <optgroup label="Resistências">
                                <option value="saves.sanity">Sanidade ({character.saves.sanity})</option>
                                <option value="saves.fear">Medo ({character.saves.fear})</option>
                                <option value="saves.body">Corpo ({character.saves.body})</option>
                            </optgroup>
                        </select>
                    </label>

                    <label className="flex flex-col flex-1">
                        <span className="text-sm text-emerald-700 mb-1">PERÍCIA APLICADA</span>
                        <select
                            value={selectedSkillName}
                            onChange={(e) => setSelectedSkillName(e.target.value)}
                            className="bg-zinc-950 border border-emerald-800 text-emerald-300 p-2 outline-none focus:border-emerald-500"
                        >
                            <option value="Nenhuma (+0)">Nenhuma (+0)</option>
                            <optgroup label="Básicas (+10)">
                                {Object.values(character.skills?.trained || {})
                                    .filter(s => s && s.isActive)
                                    .map(skill => (
                                        <option key={skill.name} value={skill.name}>{skill.name}</option>
                                    ))}
                            </optgroup>
                            <optgroup label="Expertises (+15)">
                                {Object.values(character.skills?.expert || {})
                                    .filter(s => s && s.isActive)
                                    .map(skill => (
                                        <option key={skill.name} value={skill.name}>{skill.name}</option>
                                    ))}
                            </optgroup>
                            <optgroup label="Maestrias (+20)">
                                {Object.values(character.skills?.master || {})
                                    .filter(s => s && s.isActive)
                                    .map(skill => (
                                        <option key={skill.name} value={skill.name}>{skill.name}</option>
                                    ))}
                            </optgroup>
                        </select>
                    </label>
                </div>

                <div className="flex flex-wrap items-end gap-4 mt-2 border-t border-emerald-900/30 pt-4">
                    <label className="flex flex-col w-24">
                        <span className="text-sm text-emerald-700 mb-1">D100 MANUAL</span>
                        <input
                            type="number"
                            min="0" max="99"
                            value={rollStr}
                            onChange={(e) => setRollStr(e.target.value)}
                            className="bg-zinc-950 border border-emerald-800 text-emerald-300 p-2 outline-none focus:border-emerald-500 text-center text-xl font-bold"
                            placeholder="00"
                        />
                    </label>

                    <button
                        onClick={() => handleRoll(false)}
                        disabled={!rollStr || isProcessing}
                        className="bg-zinc-800 hover:bg-zinc-700 text-emerald-500 px-4 py-2 uppercase font-bold tracking-widest border border-emerald-900 disabled:opacity-50 transition-colors h-[46px] whitespace-nowrap"
                    >
                        RESOLVER MANUAL
                    </button>

                    <div className="flex-1 flex sm:justify-end min-w-[200px]">
                        <button
                            onClick={() => handleRoll(true)}
                            disabled={isProcessing}
                            className="w-full sm:w-auto bg-emerald-900/80 hover:bg-emerald-700 text-emerald-100 px-6 py-2 uppercase font-bold tracking-widest border border-emerald-500 disabled:opacity-50 transition-colors h-[46px] shadow-lg shadow-emerald-900/50 whitespace-nowrap"
                        >
                            RNG VIRTUAL (D100)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
