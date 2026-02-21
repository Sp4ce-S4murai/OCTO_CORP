"use client";

import { useEffect, useState } from "react";
import { subscribeToRoom, updatePlayerNested } from "@/lib/database";
import { RoomData, CharacterSheet } from "@/types/character";
import { TerminalLog } from "./TerminalLog";

export default function WardenClient({ roomId }: { roomId: string }) {
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return <div className="animate-pulse flex p-4 text-emerald-500/50">Sincronizando feed de vídeo...</div>;
    }

    const players = roomData?.players ? Object.values(roomData.players) : [];

    return (
        <main className="max-w-7xl mx-auto flex flex-col gap-8">
            <header className="border-b-2 border-emerald-900 pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-widest text-emerald-400">
                    PAINEL DO DIRETOR // SETOR {roomId}
                </h1>
                <p className="text-emerald-700 mt-2">Nível de Acesso: Máximo (Sobrescrita Remota Autorizada)</p>
            </header>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {players.length === 0 && (
                        <div className="text-emerald-800 p-8 border border-emerald-900/50 bg-emerald-950/10">
                            Nenhuma assinatura vital detectada neste setor.
                        </div>
                    )}
                    {players.map(player => (
                        <MiniSheet key={player.id} character={player} onUpdate={(path, val) => handleUpdate(player.id, path, val)} />
                    ))}
                </div>

                <div className="xl:col-span-1 border-l-2 border-emerald-900/50 pl-0 xl:pl-8">
                    <h2 className="text-xl text-emerald-500 mb-4 tracking-widest">FEED DE EVENTOS</h2>
                    <TerminalLog roomId={roomId} />
                </div>
            </section>
        </main>
    );
}

function MiniSheet({ character, onUpdate }: { character: CharacterSheet, onUpdate: (path: string, val: any) => void }) {
    return (
        <div className="bg-zinc-950/80 border border-emerald-800 p-4 shadow-lg flex flex-col gap-4 group">
            <div className="flex justify-between items-center border-b border-emerald-900/50 pb-2">
                <input
                    type="text"
                    value={character.name || "NOME INDISPONÍVEL"}
                    onChange={(e) => onUpdate("name", e.target.value)}
                    className="bg-transparent text-emerald-300 font-bold uppercase outline-none focus:bg-emerald-950/50 w-full"
                />
                <span className="text-xs text-emerald-700 bg-emerald-950/30 px-2 py-1 uppercase ml-2">{character.characterClass}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Vitals Summary */}
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center bg-zinc-900/50 p-1 px-2 border border-emerald-900">
                        <span className="text-xs text-emerald-600">SAÚDE</span>
                        <div className="flex items-center text-sm">
                            <input type="number" className="w-8 bg-transparent text-right outline-none text-emerald-300 focus:bg-emerald-900/50" value={character.vitals.health.current || 0} onChange={(e) => onUpdate("vitals/health/current", Number(e.target.value))} />
                            <span className="text-emerald-800 mx-1">/</span>
                            <span className="text-emerald-700">{character.vitals.health.max}</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center bg-zinc-900/50 p-1 px-2 border border-emerald-900">
                        <span className="text-xs text-emerald-600">FERIDAS</span>
                        <div className="flex items-center text-sm">
                            <input type="number" className="w-8 bg-transparent text-right outline-none text-emerald-300 focus:bg-emerald-900/50" value={character.vitals.wounds.current || 0} onChange={(e) => onUpdate("vitals/wounds/current", Number(e.target.value))} />
                            <span className="text-emerald-800 mx-1">/</span>
                            <span className="text-emerald-700">{character.vitals.wounds.max}</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center bg-amber-950/20 p-1 px-2 border border-amber-900/50">
                        <span className="text-xs text-amber-600">STRESS</span>
                        <div className="flex items-center text-sm">
                            <input type="number" className="w-8 bg-transparent text-right outline-none text-amber-400 focus:bg-amber-900/50 font-bold" value={character.vitals.stress.current || 0} onChange={(e) => onUpdate("vitals/stress/current", Number(e.target.value))} />
                            <span className="text-amber-800/50 mx-1">/</span>
                            <span className="text-amber-700/50">{character.vitals.stress.min}</span>
                        </div>
                    </div>
                </div>

                {/* Stats Summary - Fast View */}
                <div className="grid grid-cols-2 gap-1 text-xs">
                    <StatMini label="FOR" value={character.stats.strength} />
                    <StatMini label="RAP" value={character.stats.speed} />
                    <StatMini label="INT" value={character.stats.intellect} />
                    <StatMini label="CMB" value={character.stats.combat} />
                    <StatMini label="SAN" value={character.saves.sanity} isSave />
                    <StatMini label="MED" value={character.saves.fear} isSave />
                    <StatMini label="COR" value={character.saves.body} isSave />
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
