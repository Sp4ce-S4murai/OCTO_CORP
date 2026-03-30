"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Dice5 } from "lucide-react";
import { subscribeToPlayer, createEmptyCharacter, createPlayer } from "@/lib/database";
import { CharacterSheet } from "@/types/character";
import CombatHUD from "@/components/TacticalMap/CombatHUD";
import { MiniSheet } from "@/components/MiniSheet";
import { DiceCalculator } from "@/components/DiceCalculator";

export default function PlayerTacticalClient({ roomId, playerId }: { roomId: string; playerId: string }) {
    const [character, setCharacter] = useState<CharacterSheet | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToPlayer(roomId, playerId, (data) => {
            if (data) {
                setCharacter(data);
            } else {
                // Auto-create if not exists based on URL parameter topology constraint
                const newChar = createEmptyCharacter(playerId, playerId);
                createPlayer(roomId, newChar).then(() => {
                    setCharacter(newChar);
                });
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [roomId, playerId]);

    if (loading) {
        return <div className="animate-pulse flex p-4 text-emerald-500/50 justify-center items-center h-full">Carregando Interface Tática...</div>;
    }

    if (!character) return null;

    return (
        <div className="flex flex-col h-screen w-full relative">
            {/* Header Navbar */}
            <header className="bg-zinc-950/90 border-b border-emerald-900/50 p-4 flex items-center justify-between z-10 shrink-0 select-none">
                <Link href={`/sala/${roomId}/jogador/${playerId}`} className="flex items-center gap-2 text-emerald-600 hover:text-emerald-400 font-bold uppercase tracking-widest transition-colors z-[150] relative bg-zinc-950/80 p-2">
                    <ArrowLeft size={18} /> Voltar à Ficha
                </Link>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold uppercase tracking-widest text-emerald-400">
                        SISTEMA TÁTICO // {character.name}
                    </span>
                </div>
                <div className="w-[150px]"></div>
            </header>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden relative">
                
                {/* Left Side: Combat Map */}
                <main className="flex-1 relative bg-black border-r border-emerald-900/50 overflow-hidden">
                    <CombatHUD roomId={roomId} playerId={playerId} isWarden={false} />
                </main>

                {/* Right Side: Player Data Panel */}
                <aside className="w-96 flex flex-col bg-zinc-950 overflow-y-auto shrink-0 z-10">
                    <div className="p-4 bg-zinc-900/50 border-b border-emerald-900/50 flex flex-col gap-4 sticky top-0 z-20">
                        {/* Read-Only MiniSheet */}
                        <MiniSheet character={character} readOnly={true} />
                    </div>

                    <div className="p-4 flex-1 mt-4">
                        <div className="flex items-center gap-2 text-emerald-500 border-b border-emerald-900/50 pb-2 mb-4 font-bold uppercase tracking-widest">
                            <Dice5 size={18} />
                            Calculadora de Dados
                        </div>
                        {/* Dice Calculator Box */}
                        <div className="bg-zinc-900/50 border border-emerald-900/50 rounded-sm">
                            <DiceCalculator roomId={roomId} playerName={character.name || "UNIDADE"} playerId={playerId} />
                        </div>
                    </div>
                </aside>
                
            </div>
        </div>
    );
}
