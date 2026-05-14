"use client";

import { useState, useEffect } from "react";
import { subscribeToRoom, updateTokenPosition, removeTokenFromGrid } from "@/lib/database";
import { RoomData, EncounterState } from "@/types/character";
import { ArrowLeft, GripHorizontal, Move, Trash2 } from "lucide-react";
import Link from "next/link";

interface TacticalGridProps {
    roomId: string;
    playerId?: string;
    isWarden?: boolean;
}

const GRID_SIZE = 20;
const CELL_SIZE = 40; // px

export function TacticalGrid({ roomId, playerId, isWarden }: TacticalGridProps) {
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

    useEffect(() => {
        const unsub = subscribeToRoom(roomId, (data) => setRoomData(data));
        return () => unsub();
    }, [roomId]);

    const encounter = roomData?.encounter;
    const tokens = encounter?.tokens || {};

    const handleCellClick = (x: number, y: number) => {
        if (!isWarden) {
            // Player can only move their own token, if it exists
            const myToken = Object.entries(tokens).find(([id, t]) => id === playerId);
            if (myToken) {
                updateTokenPosition(roomId, playerId!, x, y, myToken[1].color);
            } else {
                // If player doesn't have a token, create one
                const playerColor = 'bg-emerald-500';
                updateTokenPosition(roomId, playerId!, x, y, playerColor);
            }
            return;
        }

        // Warden logic
        if (selectedTokenId) {
            // Move selected token
            const color = tokens[selectedTokenId]?.color || 'bg-red-500';
            updateTokenPosition(roomId, selectedTokenId, x, y, color);
            setSelectedTokenId(null);
        } else {
            // Warden clicks empty cell, could spawn a new generic NPC token
            const newTokenId = `npc_${Date.now()}`;
            updateTokenPosition(roomId, newTokenId, x, y, 'bg-red-500');
        }
    };

    const handleTokenClick = (e: React.MouseEvent, tokenId: string) => {
        e.stopPropagation();
        if (isWarden) {
            if (selectedTokenId === tokenId) {
                setSelectedTokenId(null);
            } else {
                setSelectedTokenId(tokenId);
            }
        }
    };

    const handleRemoveToken = (e: React.MouseEvent, tokenId: string) => {
        e.stopPropagation();
        if (isWarden) {
            removeTokenFromGrid(roomId, tokenId);
            setSelectedTokenId(null);
        }
    };

    if (!roomData) return <div className="text-emerald-500 font-mono p-4">Carregando Malha Tática...</div>;

    const returnUrl = isWarden ? `/sala/${roomId}/diretor` : `/sala/${roomId}/jogador/${playerId}`;

    return (
        <div className="flex-1 w-full h-full overflow-auto p-4 flex items-center justify-center relative scanline-overlay bg-black">
            <div 
                    className="grid bg-zinc-950/50 border-2 border-emerald-900/50 relative shadow-[0_0_50px_rgba(16,185,129,0.1)] mx-auto my-auto"
                    style={{
                        gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
                        gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
                        width: `${GRID_SIZE * CELL_SIZE}px`,
                        height: `${GRID_SIZE * CELL_SIZE}px`
                    }}
                >
                    {/* Render Cells */}
                    {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                        const x = i % GRID_SIZE;
                        const y = Math.floor(i / GRID_SIZE);
                        return (
                            <div 
                                key={i}
                                onClick={() => handleCellClick(x, y)}
                                className="border border-emerald-900/20 hover:bg-emerald-900/40 transition-colors flex items-center justify-center relative cursor-crosshair"
                                style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
                            >
                                <div className="w-1 h-1 bg-emerald-900/30 rounded-full pointer-events-none"></div>
                            </div>
                        );
                    })}

                    {/* Render Tokens */}
                    {Object.entries(tokens).map(([id, token]) => {
                        const isSelected = selectedTokenId === id;
                        const isPlayerToken = !!roomData.players?.[id];
                        const label = isPlayerToken ? roomData.players[id].name.substring(0, 2).toUpperCase() : '👾';

                        return (
                            <div
                                key={id}
                                onClick={(e) => handleTokenClick(e, id)}
                                className={`absolute flex items-center justify-center font-bold text-sm uppercase tracking-tighter shadow-lg cursor-pointer transition-all duration-300 rounded z-10 
                                ${isPlayerToken ? 'bg-emerald-500 text-zinc-950' : 'bg-red-500 text-zinc-950'} 
                                ${isSelected ? 'ring-2 ring-white scale-110 z-20 shadow-[0_0_20px_rgba(255,255,255,0.5)]' : 'hover:scale-105'}
                                `}
                                style={{
                                    left: `${token.x * CELL_SIZE}px`,
                                    top: `${token.y * CELL_SIZE}px`,
                                    width: `${CELL_SIZE}px`,
                                    height: `${CELL_SIZE}px`
                                }}
                            >
                                {label}
                                {isSelected && isWarden && (
                                    <button 
                                        onClick={(e) => handleRemoveToken(e, id)}
                                        className="absolute -top-3 -right-3 bg-red-900 text-white rounded-full p-1 hover:bg-red-600 z-30 shadow-xl border border-red-500"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}

export default TacticalGrid;
