"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { subscribeToCombat, spawnToken, updateCombatState, endTacticalCombat, startTacticalCombat, updateToken, removeToken } from '@/lib/database';
import { CombatState, Token } from '@/types/combat';

const MapBoard = dynamic(() => import('./MapBoard'), { ssr: false });

interface CombatHUDProps {
    roomId: string;
    playerId?: string;
    isWarden: boolean;
}

export default function CombatHUD({ roomId, playerId, isWarden }: CombatHUDProps) {
    const [combatState, setCombatState] = useState<CombatState | null>(null);

    useEffect(() => {
        const unsubscribe = subscribeToCombat(roomId, (data) => {
            setCombatState(data);
        });
        return () => unsubscribe();
    }, [roomId]);

    const handleStartCombat = () => {
        startTacticalCombat(roomId);
    };

    const handleClearMap = () => {
        endTacticalCombat(roomId);
    };

    const handleSpawnEnemy = () => {
        if (!combatState) return;
        const tokenId = `enemy_${Math.random().toString(36).substring(2, 9)}`;
        const yOffset = Object.keys(combatState.tokens || {}).length;
        const enemy: Token = {
            id: tokenId,
            type: 'enemy',
            name: `XENO-${tokenId.substring(0, 3).toUpperCase()}`,
            x: 2,
            y: yOffset % 10,
            hp: 20,
            maxHp: 20,
            speed: 6,
            cover: 'none' // default
        };
        spawnToken(roomId, enemy);
    };

    const handleSpawnPlayer = () => {
        if (!combatState) return;
        
        // Spawn a generic player token or specific player if requested
        const tId = playerId && !isWarden ? playerId : `player_${Math.random().toString(36).substring(2, 9)}`;
        const name = playerId && !isWarden ? "YOU" : `PC-${tId.substring(0, 3).toUpperCase()}`;
        const yOffset = Object.keys(combatState.tokens || {}).length;
        const playerToken: Token = {
            id: tId,
            type: 'player',
            name: name,
            x: 5,
            y: yOffset % 10,
            hp: 10,
            maxHp: 10,
            speed: 5,
            cover: 'none'
        };
        spawnToken(roomId, playerToken);
    };

    const handleNextTurn = () => {
        if (!combatState) return;
        const currentOrder = combatState.initiativeOrder || [];
        if (currentOrder.length === 0) return;
        
        let nextIndex = combatState.currentTurnIndex + 1;
        let nextRound = combatState.round;
        if (nextIndex >= currentOrder.length) {
            nextIndex = 0;
            nextRound += 1;
        }
        updateCombatState(roomId, { currentTurnIndex: nextIndex, round: nextRound });
    };

    const toggleInitiative = (tokenId: string) => {
        if (!combatState) return;
        const order = [...(combatState.initiativeOrder || [])];
        if (order.includes(tokenId)) {
            const newOrder = order.filter(id => id !== tokenId);
            let nextIndex = combatState.currentTurnIndex;
            if (nextIndex >= newOrder.length) nextIndex = 0;
            updateCombatState(roomId, { initiativeOrder: newOrder, currentTurnIndex: nextIndex });
        } else {
            order.push(tokenId);
            updateCombatState(roomId, { initiativeOrder: order });
        }
    };

    const handleDamage = (tokenId: string, amount: number) => {
        if (!combatState || !combatState.tokens || !combatState.tokens[tokenId]) return;
        const token = combatState.tokens[tokenId];
        const newHp = Math.max(0, Math.min(token.maxHp, token.hp + amount));
        if (newHp === 0 && token.type === 'enemy') {
            removeToken(roomId, tokenId);
            
            // Also remove from initiative 
            if (combatState.initiativeOrder?.includes(tokenId)) {
                toggleInitiative(tokenId);
            }
        } else {
            updateToken(roomId, tokenId, { hp: newHp });
        }
    };

    if (!combatState) {
        return (
            <div className="mt-8 border border-zinc-800 bg-black p-6 rounded-sm w-full font-mono relative overflow-hidden group">
                <div className="absolute inset-0 bg-emerald-900/5 transition-opacity group-hover:bg-emerald-900/10 pointer-events-none"></div>
                <div className="flex justify-between items-center text-emerald-500 font-mono relative z-10">
                    <h2 className="text-xl uppercase tracking-widest">[ TACTICAL COMKLINK ]</h2>
                    {isWarden && (
                        <button onClick={handleStartCombat} className="px-4 py-1 border border-emerald-500 hover:bg-emerald-500 hover:text-black transition-colors shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                            &gt; INITIALIZE SYSTEM
                        </button>
                    )}
                </div>
                {!isWarden && <p className="text-emerald-900 mt-2 text-sm italic relative z-10 animate-pulse">Waiting for Director link...</p>}
            </div>
        );
    }

    return (
        <div className="mt-8 flex flex-col md:flex-row gap-4 h-[600px] border-2 border-zinc-800 bg-[#060606] p-4 rounded-sm font-mono shadow-[0_0_30px_rgba(0,0,0,0.8)] relative">
            {/* Left Panel: Initiative Tracker */}
            <div className="w-full md:w-64 flex flex-col border border-zinc-800 bg-[#09090b] p-3 h-full overflow-y-auto shrink-0 relative">
                <div className="uppercase tracking-widest text-emerald-500 mb-4 border-b border-emerald-900/50 pb-2 text-sm drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]">
                    SEQ_ORDER :: <span className="text-amber-500">RND {combatState.round}</span>
                </div>
                <div className="flex flex-col gap-2 relative z-10">
                    {(combatState.initiativeOrder || []).map((id, idx) => {
                        const t = combatState.tokens?.[id];
                        if (!t) return null;
                        const isTurn = combatState.currentTurnIndex === idx;
                        return (
                            <div key={id} className={`flex justify-between items-center px-2 py-2 border text-xs tracking-wider transition-all ${isTurn ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-[inset_0_0_10px_rgba(245,158,11,0.2)]' : 'border-zinc-800 text-zinc-500'}`}>
                                <span className={isTurn ? "animate-pulse" : ""}>{t.name}</span>
                                <span>HP {t.hp}</span>
                            </div>
                        );
                    })}
                </div>
                
                {isWarden && (
                    <div className="mt-auto space-y-2 pt-4 border-t border-zinc-800 relative z-10">
                        <h3 className="text-emerald-700 text-xs mb-2 uppercase tracking-widest">Register Entity:</h3>
                        {Object.values(combatState.tokens || {}).map(t => {
                            if (combatState.initiativeOrder?.includes(t.id)) return null;
                            return (
                                <button key={t.id} onClick={() => toggleInitiative(t.id)} className="w-full text-left text-xs text-zinc-600 hover:text-emerald-500 transition-colors uppercase cursor-pointer">
                                    [+] {t.name}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Center Panel: Map Engine */}
            <div className="flex-grow w-full h-full relative border border-zinc-700 bg-black shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                <MapBoard roomId={roomId} playerId={playerId} isWarden={isWarden} combatState={combatState} />
            </div>

            {/* Right Panel: Warden Controls or Player Info */}
            <div className="w-full md:w-72 flex flex-col gap-4 shrink-0 h-full overflow-y-auto relative z-10">
                <div className="border border-zinc-800 bg-[#09090b] p-3 flex flex-col gap-4 flex-grow relative shadow-inner">
                    <div className="uppercase tracking-widest text-emerald-500 border-b border-emerald-900/50 pb-2 text-sm text-center font-bold">
                        {isWarden ? 'DIRECTOR OVERRIDE' : 'TACTICAL UPLINK'}
                    </div>

                    {isWarden ? (
                        <div className="flex flex-col gap-3 mt-2 h-full">
                            <button onClick={handleNextTurn} className="p-3 border border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-black hover:font-bold transition-all text-xs text-center tracking-widest shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                                &gt; NEXT SEQUENCE
                            </button>
                            
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <button onClick={handleSpawnEnemy} className="p-2 border border-red-900/50 text-red-500 hover:bg-red-900/20 text-xs text-center transition-all bg-black uppercase">
                                    + Xeno
                                </button>
                                <button onClick={handleSpawnPlayer} className="p-2 border border-blue-900/50 text-blue-500 hover:bg-blue-900/20 text-xs text-center transition-all bg-black uppercase">
                                    + Asset
                                </button>
                            </div>
                            
                            <div className="mt-4 flex-grow flex flex-col">
                                <div className="text-[10px] text-zinc-600 uppercase tracking-widest border-b border-zinc-800 pb-1 mb-2">Active Entities Modifier</div>
                                <div className="flex flex-col gap-2 overflow-y-auto break-all pr-1">
                                    {Object.values(combatState.tokens || {}).map(t => (
                                        <div key={t.id} className="flex flex-col bg-black border border-zinc-800 p-2 text-xs group transition-colors hover:border-zinc-700">
                                            <div className="flex justify-between items-center text-zinc-400 group-hover:text-emerald-500 mb-2">
                                                <span className="uppercase font-bold">{t.name}</span>
                                                <span className={t.hp < t.maxHp / 2 ? 'text-red-500' : 'text-emerald-600'}>HP: {t.hp}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => handleDamage(t.id, -1)} className="bg-red-900/10 border border-red-900/30 text-red-500 flex-1 hover:bg-red-900/30 transition-colors py-1">-1 HP</button>
                                                <button onClick={() => updateToken(roomId, t.id, { cover: t.cover === 'full' ? 'none' : 'full'})} className={`flex-1 border transition-colors py-1 ${t.cover === 'full' ? 'bg-amber-900/30 border-amber-500/50 text-amber-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'}`}>CVR</button>
                                                <button onClick={() => removeToken(roomId, t.id)} className="bg-red-950/20 border border-red-900/50 text-red-900 w-8 hover:bg-red-900 hover:text-black transition-colors">X</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button onClick={handleClearMap} className="p-2 border border-red-950 text-red-900 hover:bg-red-900 hover:text-black hover:font-bold mt-auto transition-all text-xs text-center uppercase tracking-widest mt-4">
                                TERMINATE SYSTEM
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col mt-4 text-xs text-zinc-500 space-y-3 font-mono">
                            <p className="border-l-2 border-emerald-900 pl-2 opacity-80 uppercase tracking-wide">» Wait for your turn in the sequence.</p>
                            <p className="border-l-2 border-emerald-900 pl-2 opacity-80 uppercase tracking-wide">» Drag your token to reposition.</p>
                            {!combatState.tokens?.[playerId!] && (
                                <button onClick={handleSpawnPlayer} className="p-3 border border-emerald-500/30 animate-pulse text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500 mt-6 tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all">
                                    [ DEPLOY ASSET TO GRID ]
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Global scanline overlay covering the entire HUD gently */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-emerald-900/5 to-transparent bg-[length:100%_4px] opacity-20"></div>
        </div>
    );
}
