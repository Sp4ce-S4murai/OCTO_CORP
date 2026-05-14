"use client";

import { useState, useEffect } from "react";
import { subscribeToRoom, updateTokenPosition, removeTokenFromGrid, deductTokenMovement, updatePlayerNested } from "@/lib/database";
import { RoomData, EncounterState, Weapon } from "@/types/character";
import { ArrowLeft, GripHorizontal, Move, Trash2, Target } from "lucide-react";
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

    const activeTokenId = isWarden ? selectedTokenId : playerId;
    const activeToken = activeTokenId ? tokens[activeTokenId] : null;

    const getTokenMaxRange = (tId: string) => {
        const char = roomData?.players?.[tId];
        if (!char || !char.inventory) return 0;
        const weapons = char.inventory.filter(i => i.type === 'weapon') as Weapon[];
        if (weapons.length === 0) return 1; // Default melee
        return Math.max(...weapons.map(w => w.range));
    };

    const handleCellClick = (x: number, y: number) => {
        if (!isWarden) {
            // Player moving their own token
            const myToken = Object.entries(tokens).find(([id, t]) => id === playerId);
            if (myToken) {
                const dist = Math.max(Math.abs(myToken[1].x - x), Math.abs(myToken[1].y - y));
                if (dist <= myToken[1].movementPoints.current) {
                    updateTokenPosition(roomId, playerId!, x, y, myToken[1].color);
                    deductTokenMovement(roomId, playerId!, dist);
                }
            } else {
                // If player doesn't have a token, create one
                const playerColor = 'bg-emerald-500';
                const maxMp = roomData?.players?.[playerId!]?.movementPoints?.max || 6;
                updateTokenPosition(roomId, playerId!, x, y, playerColor, maxMp);
            }
            return;
        }

        // Warden logic
        if (selectedTokenId) {
            // Move selected token (Warden ignores limits)
            const color = tokens[selectedTokenId]?.color || 'bg-red-500';
            updateTokenPosition(roomId, selectedTokenId, x, y, color);
            setSelectedTokenId(null);
        } else {
            // Warden clicks empty cell, spawn NPC token
            const newTokenId = `npc_${Date.now()}`;
            updateTokenPosition(roomId, newTokenId, x, y, 'bg-red-500', 6);
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
        } else {
            // Player logic: Target selection
            if (tokenId !== playerId && playerId) {
                const currentTarget = roomData?.players?.[playerId]?.selectedTargetId;
                if (currentTarget === tokenId) {
                    updatePlayerNested(roomId, playerId, "selectedTargetId", null);
                } else {
                    updatePlayerNested(roomId, playerId, "selectedTargetId", tokenId);
                }
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

                        let isMovable = false;
                        let isAttackable = false;

                        if (activeToken) {
                            const dist = Math.max(Math.abs(activeToken.x - x), Math.abs(activeToken.y - y));
                            if (dist > 0 && dist <= activeToken.movementPoints.current) {
                                isMovable = true;
                            }
                            const maxRange = getTokenMaxRange(activeTokenId!);
                            if (dist > 0 && dist <= maxRange) {
                                isAttackable = true;
                            }
                        }

                        let bgClass = "border-emerald-900/20 hover:bg-emerald-900/40";
                        if (isMovable) bgClass = "border-emerald-500/30 bg-emerald-950/30 hover:bg-emerald-900/60";
                        else if (isAttackable) bgClass = "border-red-900/30 bg-red-950/20 hover:bg-red-900/40";

                        return (
                            <div 
                                key={i}
                                onClick={() => handleCellClick(x, y)}
                                className={`border transition-colors flex items-center justify-center relative cursor-crosshair ${bgClass}`}
                                style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
                            >
                                <div className={`w-1 h-1 rounded-full pointer-events-none ${isMovable ? 'bg-emerald-500/50' : (isAttackable ? 'bg-red-500/30' : 'bg-emerald-900/30')}`}></div>
                            </div>
                        );
                    })}

                    {/* Render Tokens */}
                    {Object.entries(tokens).map(([id, token]) => {
                        const isSelectedByWarden = selectedTokenId === id;
                        const isPlayerToken = !!roomData.players?.[id];
                        const isTargeted = !isWarden && playerId && roomData.players?.[playerId]?.selectedTargetId === id;
                        const label = isPlayerToken ? roomData.players[id].name.substring(0, 2).toUpperCase() : '👾';
                        
                        // Current Turn Indicator
                        const isTurn = encounter?.turnOrder?.[encounter.currentTurnIndex] === id;

                        return (
                            <div
                                key={id}
                                onClick={(e) => handleTokenClick(e, id)}
                                className={`absolute flex flex-col items-center justify-center font-bold text-sm uppercase tracking-tighter shadow-lg cursor-pointer transition-all duration-300 rounded z-10 
                                ${isPlayerToken ? 'bg-emerald-500 text-zinc-950' : 'bg-red-500 text-zinc-950'} 
                                ${(isSelectedByWarden || isTargeted) ? 'ring-4 ring-white scale-110 z-20 shadow-[0_0_20px_rgba(255,255,255,0.5)]' : 'hover:scale-105'}
                                ${isTurn ? 'ring-2 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.8)]' : ''}
                                `}
                                style={{
                                    left: `${token.x * CELL_SIZE}px`,
                                    top: `${token.y * CELL_SIZE}px`,
                                    width: `${CELL_SIZE}px`,
                                    height: `${CELL_SIZE}px`
                                }}
                            >
                                {isTargeted && <Target size={24} className="absolute text-red-500 scale-150 opacity-80 animate-pulse pointer-events-none" />}
                                <span className="z-10">{label}</span>
                                <div className="absolute -bottom-2 bg-black text-[9px] px-1 text-emerald-400 border border-emerald-900">
                                    {token.movementPoints.current}/{token.movementPoints.max}
                                </div>

                                {isSelectedByWarden && isWarden && (
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
