"use client";

import { useEffect, useState } from "react";
import { subscribeToRoom, updatePlayerNested, updatePlayer, pushLog } from "@/lib/database";
import { database } from "@/lib/firebase";
import { ref, set } from "firebase/database";
import { RoomData, CharacterSheet, RollLog } from "@/types/character";
import { User, Activity, Lock, Unlock } from "lucide-react";
import { TerminalLog } from "./TerminalLog";
import { HeartRateMonitor } from "./HeartRateMonitor";

export default function WardenClient({ roomId }: { roomId: string }) {
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(true);
    const [wardenMessage, setWardenMessage] = useState("");

    useEffect(() => {
        const unsubscribe = subscribeToRoom(roomId, (data) => {
            setRoomData(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [roomId]);

    const handleUpdate = (playerId: string, path: string, value: any) => {
        updatePlayerNested(roomId, playerId, path, value);
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
                <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </main>
    );
}

function MiniSheet({ character, onUpdate, onDamage, onStress }: { character: CharacterSheet, onUpdate: (path: string, val: any) => void, onDamage: (val: number) => void, onStress: (val: number) => void }) {
    const isDead = character.vitals.wounds.current >= character.vitals.wounds.max;

    return (
        <div className={`border p-4 shadow-lg flex flex-col gap-4 group ${isDead ? 'bg-red-950/20 border-red-900' : 'bg-zinc-950/80 border-emerald-800'}`}>
            <div className={`flex justify-between items-center border-b pb-2 ${isDead ? 'border-red-900/50' : 'border-emerald-900/50'}`}>
                <input
                    type="text"
                    value={character.name || "NOME INDISPONÍVEL"}
                    onChange={(e) => onUpdate("name", e.target.value)}
                    className={`bg-transparent font-bold uppercase outline-none w-full ${isDead ? 'text-red-500' : 'text-emerald-300 focus:bg-emerald-950/50'}`}
                />
                <span className={`text-xs px-2 py-1 uppercase ml-2 whitespace-nowrap ${isDead ? 'text-red-800 bg-red-950/50' : 'text-emerald-700 bg-emerald-950/30'}`}>{character.characterClass}</span>
            </div>

            <div className="flex gap-4">
                {/* 3x4 Avatar Miniature */}
                <div className={`w-20 h-28 shrink-0 border ${isDead ? 'border-red-900 bg-red-950/20' : 'border-emerald-900 bg-zinc-950'} flex items-center justify-center p-0.5 overflow-hidden`}>
                    {character.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={character.avatarUrl} alt="Avatar" className={`w-full h-full object-cover ${isDead ? 'grayscale opacity-50' : ''}`} />
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
