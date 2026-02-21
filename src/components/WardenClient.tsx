"use client";

import { useEffect, useState } from "react";
import { subscribeToRoom, updatePlayerNested, updatePlayer, pushLog, updateEnvironment } from "@/lib/database";
import { database } from "@/lib/firebase";
import { ref, set } from "firebase/database";
import { RoomData, CharacterSheet, RollLog } from "@/types/character";
import { User, Activity, Lock, Unlock, Eye, X } from "lucide-react";
import { TerminalLog } from "./TerminalLog";
import { HeartRateMonitor } from "./HeartRateMonitor";

export default function WardenClient({ roomId }: { roomId: string }) {
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(true);
    const [wardenMessage, setWardenMessage] = useState("");
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

    const ENVIRONMENT_PRESETS = {
        'Clima Estabilizado': { presetName: 'Clima Estabilizado', temperature: '21', pressure: '1.0', oxygen: '100', luminosity: 'Estável', gravity: '1.0', radiation: '0.1' },
        'Superfície de Magma (Vulcania-9)': { presetName: 'Superfície de Magma', temperature: '480', pressure: '3.5', oxygen: '4', luminosity: 'Ofuscante Vermelho', gravity: '1.2', radiation: '120' },
        'Vácuo Espacial (Exterior)': { presetName: 'Vácuo', temperature: '-270', pressure: '0.0', oxygen: '0', luminosity: 'Escuridão', gravity: '0.0', radiation: '80' },
        'Planeta Glacial (Hoth-Z)': { presetName: 'Planeta Glacial', temperature: '-80', pressure: '1.2', oxygen: '25', luminosity: 'Ofuscante Branco', gravity: '1.5', radiation: '2' },
        'Pântano Ácido (Tóxico)': { presetName: 'Pântano Ácido', temperature: '45', pressure: '2.0', oxygen: '12', luminosity: 'Neblina Verde', gravity: '1.0', radiation: '60' },
        'Estação Abandonada (Falha Energética)': { presetName: 'Estação Abandonada', temperature: '5', pressure: '0.8', oxygen: '15', luminosity: 'Piscando', gravity: '0.1', radiation: '10' },
        'Gigante Gasoso (Queda Livre)': { presetName: 'Atmosfera Densa', temperature: '-120', pressure: '45.0', oxygen: '0', luminosity: 'Tempestade Magnética', gravity: '3.5', radiation: '500' },
        'Zona de Quarentena (Nível 5)': { presetName: 'Quarentena Biológica', temperature: '38', pressure: '1.5', oxygen: 'Corrosivo', luminosity: 'Luz Negra', gravity: '1.0', radiation: '5' }
    };

    const applyEnvironmentPreset = (presetName: keyof typeof ENVIRONMENT_PRESETS) => {
        updateEnvironment(roomId, ENVIRONMENT_PRESETS[presetName]);
        pushLog(roomId, {
            timestamp: Date.now(),
            playerName: "SISTEMA",
            playerId: "SYSTEM",
            statName: `TELEMETRIA AMBIENTAL: ${presetName}`,
            statValue: 0,
            roll: 0,
            result: 'Warden Message'
        });
    };

    useEffect(() => {
        const unsubscribe = subscribeToRoom(roomId, (data) => {
            setRoomData(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [roomId]);

    const handleUpdate = (playerId: string, path: string, value: any) => {
        const character = roomData?.players?.[playerId];
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

    const handleDamage = (playerId: string, damage: number) => {
        const char = roomData?.players?.[playerId];
        if (!char || damage <= 0) return;

        let newHealth = char.vitals.health.current - damage;
        let newWounds = char.vitals.wounds.current;

        // Overflow calculation
        while (newHealth <= 0 && newWounds < char.vitals.wounds.max) {
            newWounds += 1;
            newHealth += char.vitals.health.max; // Rollover the remainder
        }

        // Clamp to death state
        if (newWounds >= char.vitals.wounds.max) {
            newWounds = char.vitals.wounds.max;
            newHealth = 0;
        }

        updatePlayer(roomId, playerId, {
            "vitals/health/current": newHealth,
            "vitals/wounds/current": newWounds,
        } as any);

        pushLog(roomId, {
            timestamp: Date.now(),
            playerName: char.name || "UNIDADE",
            playerId: char.id,
            statName: 'DANO DIRETO',
            statValue: damage,
            roll: 0,
            result: 'Warden Damage'
        });
    };

    const handleStress = (playerId: string, amount: number) => {
        const char = roomData?.players?.[playerId];
        if (!char || amount === 0) return;

        const newStress = Math.max(char.vitals.stress.min, char.vitals.stress.current + amount);
        updatePlayerNested(roomId, playerId, "vitals/stress/current", newStress);

        pushLog(roomId, {
            timestamp: Date.now(),
            playerName: char.name || "UNIDADE",
            playerId: char.id,
            statName: amount > 0 ? 'ACRÉSCIMO DE STRESS' : 'REDUÇÃO DE STRESS',
            statValue: Math.abs(amount),
            roll: 0,
            result: 'Warden Stress'
        });
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!wardenMessage.trim()) return;

        pushLog(roomId, {
            timestamp: Date.now(),
            playerName: "DIRETOR",
            playerId: "SYSTEM",
            statName: wardenMessage.trim(),
            statValue: 0,
            roll: 0,
            result: 'Warden Message'
        });

        setWardenMessage(""); // Clear input
    };

    const toggleLockdown = () => {
        if (!roomData) return;
        const newLockState = !roomData.isLocked;
        set(ref(database, `rooms/${roomId}/isLocked`), newLockState).catch(console.error);

        pushLog(roomId, {
            timestamp: Date.now(),
            playerName: "SISTEMA",
            playerId: "SYSTEM",
            statName: `PROTOCOLO DE SEGURANÇA: ${newLockState ? 'ATIVADO (FICHAS TRAVADAS)' : 'DESATIVADO (EDIÇÃO LIVRE)'}`,
            statValue: 0,
            roll: 0,
            result: 'Warden Message'
        });
    };

    if (loading) {
        return <div className="animate-pulse flex p-4 text-emerald-500/50">Sincronizando feed de vídeo...</div>;
    }

    const players = roomData?.players ? Object.values(roomData.players) : [];

    return (
        <main className="max-w-7xl mx-auto flex flex-col gap-8">
            <header className="border-b-2 border-emerald-900 pb-4 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-widest text-emerald-400">
                        PAINEL DO DIRETOR // SETOR {roomId}
                    </h1>
                    <p className="text-emerald-700 mt-2">Nível de Acesso: Máximo (Sobrescrita Remota Autorizada)</p>
                </div>
                <button
                    onClick={toggleLockdown}
                    className={`flex items-center gap-2 px-4 py-2 border font-bold uppercase tracking-widest transition-colors ${roomData?.isLocked ? 'bg-red-950/80 border-red-900 text-red-500 hover:bg-red-900' : 'bg-emerald-950/30 border-emerald-900 text-emerald-600 hover:bg-emerald-900 hover:text-emerald-300'}`}
                    title={roomData?.isLocked ? "Destravar edição dos jogadores" : "Travar Fichas (Lockdown)"}
                >
                    {roomData?.isLocked ? <><Lock size={18} /> TRAVAMENTO MÁXIMO ATIVADO</> : <><Unlock size={18} /> FICHAS LIVRES (DESTRAVADAS)</>}
                </button>
            </header>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 content-start">

                    {/* ENVIRONMENT PRESET SELECTOR */}
                    <div className="md:col-span-2 border border-emerald-900/50 bg-emerald-950/10 p-4 mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-sm font-bold tracking-widest text-emerald-500 uppercase">CONTROLE DE TELEMETRIA AMBIENTAL</h2>
                            <span className="text-xs text-emerald-700">Painel do Jogador Atual: {roomData?.environment?.presetName || 'Desconhecido'}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(Object.keys(ENVIRONMENT_PRESETS) as Array<keyof typeof ENVIRONMENT_PRESETS>).map(preset => (
                                <button
                                    key={preset}
                                    onClick={() => applyEnvironmentPreset(preset)}
                                    className={`text-xs px-3 py-1 font-bold tracking-wide uppercase border transition-colors ${roomData?.environment?.presetName === preset ? 'bg-emerald-900 text-emerald-400 border-emerald-500' : 'bg-transparent text-emerald-600 border-emerald-900/50 hover:bg-emerald-950/50 hover:text-emerald-300'}`}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    {players.length === 0 && (
                        <div className="text-emerald-800 p-8 border border-emerald-900/50 bg-emerald-950/10">
                            Nenhuma assinatura vital detectada neste setor.
                        </div>
                    )}
                    {players.map(player => (
                        <MiniSheet
                            key={player.id}
                            character={player}
                            onUpdate={(path, val) => handleUpdate(player.id, path, val)}
                            onDamage={(dmg) => handleDamage(player.id, dmg)}
                            onStress={(amount) => handleStress(player.id, amount)}
                            onInspect={() => setSelectedPlayerId(player.id)}
                        />
                    ))}
                </div>

                <div className="xl:col-span-1 border-l-2 border-emerald-900/50 pl-0 xl:pl-8 flex flex-col">
                    <h2 className="text-xl text-emerald-500 mb-4 tracking-widest">FEED DE EVENTOS</h2>
                    <TerminalLog roomId={roomId} heightClass="h-[600px]" />

                    {/* Warden Broadcast Input */}
                    <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
                        <input
                            type="text"
                            value={wardenMessage}
                            onChange={(e) => setWardenMessage(e.target.value)}
                            placeholder="Transmitir mensagem via commlink..."
                            className="flex-1 bg-zinc-950 border border-emerald-900/50 p-2 text-emerald-400 outline-none focus:border-emerald-500 font-mono text-sm placeholder:text-emerald-900"
                        />
                        <button
                            type="submit"
                            disabled={!wardenMessage.trim()}
                            className="bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400 px-4 font-bold border border-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm"
                        >
                            ENVIAR
                        </button>
                    </form>
                </div>
            </section>

            {/* Modal de Inspeção Dinâmica */}
            {selectedPlayerId && roomData?.players?.[selectedPlayerId] && (
                <PlayerModal
                    character={roomData.players[selectedPlayerId]}
                    onClose={() => setSelectedPlayerId(null)}
                    onUpdate={(path, val) => handleUpdate(selectedPlayerId, path, val)}
                />
            )}
        </main>
    );
}

function MiniSheet({ character, onUpdate, onDamage, onStress, onInspect }: { character: CharacterSheet, onUpdate: (path: string, val: any) => void, onDamage: (val: number) => void, onStress: (val: number) => void, onInspect: () => void }) {
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
                <input
                    type="text"
                    value={character.name || "NOME INDISPONÍVEL"}
                    onChange={(e) => onUpdate("name", e.target.value)}
                    className={`bg-transparent font-bold uppercase outline-none w-full ${isDead ? 'text-red-500' : 'text-emerald-300 focus:bg-emerald-950/50'}`}
                />
                <div className="flex items-center">
                    <span className={`text-[10px] px-2 py-1 uppercase ml-2 whitespace-nowrap ${isDead ? 'text-red-800 bg-red-950/50' : 'text-emerald-700 bg-emerald-950/30'}`}>{character.characterClass}</span>
                    <button onClick={onInspect} className="text-[10px] px-2 py-1 uppercase ml-2 whitespace-nowrap bg-teal-950/80 text-teal-400 hover:bg-teal-900 border border-teal-900/50 transition-colors flex items-center gap-1 font-bold">
                        <Eye size={12} /> VER
                    </button>
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
                    {/* EKG Miniature */}
                    <div className="h-4 w-full mb-2 opacity-80">
                        <HeartRateMonitor currentHp={character.vitals.health.current} maxHp={character.vitals.health.max} stress={character.vitals.stress.current} isDead={isDead} />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        {/* SAÚDE */}
                        <div className="flex justify-between items-center bg-zinc-900/50 p-1 border border-emerald-900">
                            <span className={`text-[10px] pl-1 ${isDead ? 'text-red-600' : 'text-emerald-600'}`}>SAÚDE</span>
                            <div className="flex items-center text-xs gap-1">
                                <span className={isDead ? 'text-red-500' : 'text-emerald-300'}>{character.vitals.health.current} <span className="text-emerald-800">/</span> {character.vitals.health.max}</span>

                                {!isDead && (
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
                        {/* FERIDAS */}
                        <div className={`flex justify-between items-center bg-zinc-900/50 p-1 border ${isDead ? 'border-red-900' : 'border-emerald-900'}`}>
                            <span className={`text-[10px] pl-1 ${isDead ? 'text-red-600' : 'text-emerald-600'}`}>FERIDAS</span>
                            <div className="flex items-center text-xs pr-1">
                                <input disabled={isDead} type="number" className={`w-6 bg-transparent text-right outline-none focus:bg-emerald-900/50 ${isDead ? 'text-red-500 font-bold' : 'text-emerald-300'}`} value={character.vitals.wounds.current || 0} onChange={(e) => onUpdate("vitals/wounds/current", Number(e.target.value))} />
                                <span className={isDead ? 'text-red-800 mx-1' : 'text-emerald-800 mx-1'}>/</span>
                                <span className={isDead ? 'text-red-700 font-bold' : 'text-emerald-700'}>{character.vitals.wounds.max}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center bg-amber-950/20 p-1 border border-amber-900/50">
                            <span className="text-[10px] pl-1 text-amber-600">STRESS</span>
                            <div className="flex items-center text-xs pr-1 group/stress">
                                <input type="number" className="w-6 bg-transparent text-right outline-none text-amber-400 focus:bg-amber-900/50 font-bold" value={character.vitals.stress.current || 0} onChange={(e) => onUpdate("vitals/stress/current", Number(e.target.value))} />
                                <span className="text-amber-800/50 mx-1">/</span>
                                <span className="text-amber-700/50">{character.vitals.stress.min}</span>
                                <button
                                    onClick={() => onStress(1)}
                                    className="ml-2 bg-amber-950/80 hover:bg-amber-900 text-amber-300 text-[10px] px-1 font-bold border-l border-amber-800 transition-colors"
                                    title="Pânico Diretor (+1 Stress)"
                                >
                                    +1
                                </button>
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

//
// MÓDULO DE INSPEÇÃO (MODAL DO DIRETOR)
//
function PlayerModal({ character, onClose, onUpdate }: { character: CharacterSheet, onClose: () => void, onUpdate: (path: string, val: any) => void }) {
    const isDead = character.vitals.wounds.current >= character.vitals.wounds.max;

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className={`w-full max-w-4xl border-2 ${isDead ? 'border-red-900 bg-red-950/20' : 'border-emerald-900 bg-zinc-950'} p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-6`} onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-emerald-600 hover:text-emerald-300">
                    <X size={24} />
                </button>

                <h2 className={`text-2xl font-bold tracking-widest border-b pb-4 ${isDead ? 'text-red-500 border-red-900/50' : 'text-emerald-400 border-emerald-900/50'}`}>
                    INSPEÇÃO DE PROTOCOLO // {character.name || "UNIDADE"}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Atributos */}
                    <div>
                        <h3 className="text-xl border-b border-emerald-900/50 pb-2 mb-4 text-emerald-500">ATRIBUTOS</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <WardenStatBox label="FORÇA" value={character.stats.strength} path="baseStats/strength" onUpdate={onUpdate} baseValue={character.baseStats.strength} />
                            <WardenStatBox label="RAPIDEZ" value={character.stats.speed} path="baseStats/speed" onUpdate={onUpdate} baseValue={character.baseStats.speed} />
                            <WardenStatBox label="INTELECTO" value={character.stats.intellect} path="baseStats/intellect" onUpdate={onUpdate} baseValue={character.baseStats.intellect} />
                            <WardenStatBox label="COMBATE" value={character.stats.combat} path="baseStats/combat" onUpdate={onUpdate} baseValue={character.baseStats.combat} />
                        </div>
                    </div>
                    {/* Resistencias */}
                    <div>
                        <h3 className="text-xl border-b border-emerald-900/50 pb-2 mb-4 text-emerald-500">RESISTÊNCIAS</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <WardenStatBox label="SANIDADE" value={character.saves.sanity} path="baseSaves/sanity" onUpdate={onUpdate} baseValue={character.baseSaves.sanity} />
                            <WardenStatBox label="MEDO" value={character.saves.fear} path="baseSaves/fear" onUpdate={onUpdate} baseValue={character.baseSaves.fear} />
                            <WardenStatBox label="CORPO" value={character.saves.body} path="baseSaves/body" onUpdate={onUpdate} baseValue={character.baseSaves.body} />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <WardenVitalBox label="SAÚDE" current={character.vitals.health.current} max={character.vitals.health.max} path="vitals/health" onUpdate={onUpdate} />
                    <WardenVitalBox label="FERIDAS" current={character.vitals.wounds.current} max={character.vitals.wounds.max} path="vitals/wounds" onUpdate={onUpdate} />
                    <div className="border border-emerald-900/50 bg-zinc-900/50 p-4 shrink-0">
                        <div className="text-emerald-600 mb-2 font-bold text-sm tracking-widest">STRESS (ATUAL/MÍNIMO)</div>
                        <div className="flex gap-2 items-center">
                            <input
                                type="number"
                                className="w-16 bg-transparent border-b border-amber-800 text-xl text-amber-500 outline-none text-center font-bold focus:border-amber-400 focus:bg-amber-950/20"
                                value={character.vitals.stress.current || 0}
                                onChange={(e) => onUpdate("vitals/stress/current", Number(e.target.value))}
                            />
                            <span className="text-emerald-800 font-bold">/</span>
                            <input
                                type="number"
                                className="w-16 bg-transparent border-b border-emerald-800 text-xl text-emerald-500 outline-none text-center focus:border-emerald-500 focus:bg-emerald-950/20"
                                value={character.vitals.stress.min || 0}
                                onChange={(e) => onUpdate("vitals/stress/min", Number(e.target.value))}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function WardenStatBox({ label, value, baseValue, path, onUpdate }: { label: string, value: number, baseValue: number, path: string, onUpdate: (p: string, v: number) => void }) {
    return (
        <div className="border border-emerald-900/50 bg-zinc-900/50 p-2 flex flex-col hover:border-emerald-500 transition-colors">
            <span className="text-sm text-emerald-600 font-bold">{label}</span>
            <div className="flex justify-between items-center w-full mt-2">
                <div className="flex flex-col">
                    <span className="text-[10px] text-emerald-700/50 uppercase leading-none mb-1">Base</span>
                    <input
                        type="number"
                        className="w-14 bg-zinc-950 border border-emerald-900 text-center text-sm outline-none font-mono focus:border-emerald-500 text-amber-500 py-1"
                        value={baseValue || 0}
                        onChange={(e) => onUpdate(path, Number(e.target.value))}
                    />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-emerald-700/50 uppercase leading-none mb-1">Total (+Mod)</span>
                    <span className="text-2xl font-bold text-emerald-400">{value || 0}</span>
                </div>
            </div>
        </div>
    );
}

function WardenVitalBox({ label, current, max, path, onUpdate }: { label: string, current: number, max: number, path: string, onUpdate: (p: string, v: number) => void }) {
    return (
        <div className="border border-emerald-900/50 bg-zinc-900/50 p-4">
            <div className="text-emerald-600 mb-2 font-bold text-sm tracking-widest">{label}</div>
            <div className="flex gap-2 items-center">
                <input
                    type="number"
                    className="w-16 bg-transparent border-b border-emerald-800 text-xl text-emerald-400 outline-none text-center font-bold focus:border-emerald-400 focus:bg-emerald-950/20"
                    value={current || 0}
                    onChange={(e) => onUpdate(`${path}/current`, Number(e.target.value))}
                />
                <span className="text-emerald-800 font-bold">/</span>
                <input
                    type="number"
                    className="w-16 bg-transparent border-b border-emerald-800 text-xl text-emerald-600 outline-none text-center focus:border-emerald-600 focus:bg-emerald-950/20"
                    value={max || 0}
                    onChange={(e) => onUpdate(`${path}/max`, Number(e.target.value))}
                />
            </div>
        </div>
    );
}
