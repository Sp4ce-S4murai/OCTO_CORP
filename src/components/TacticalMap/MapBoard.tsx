"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Stage, Layer, Rect, Circle, Text, Line } from 'react-konva';
import { CombatState, Token } from '@/types/combat';
import { updateToken } from '@/lib/database';

interface MapBoardProps {
    roomId: string;
    playerId?: string;
    isWarden: boolean;
    combatState: CombatState;
}

export default function MapBoard({ roomId, playerId, isWarden, combatState }: MapBoardProps) {
    const stageRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    
    // Grid settings
    const CELL_SIZE = combatState.gridSize || 50;

    useEffect(() => {
        // Simple resize observer
        const updateDims = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };
        updateDims();
        window.addEventListener('resize', updateDims);
        return () => window.removeEventListener('resize', updateDims);
    }, []);

    // Helper math: Chebyshev Distance
    const getChebyshevDistance = (x1: number, y1: number, x2: number, y2: number) => {
        return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
    };

    const handleDragMove = (e: any, tokenId: string) => {
        // Optimistic reposition, Konva handles it internally via the event
    };

    const handleDragEnd = (e: any, tokenId: string) => {
        const node = e.target;
        // Snap to grid
        const newX = Math.round(node.x() / CELL_SIZE) * CELL_SIZE;
        const newY = Math.round(node.y() / CELL_SIZE) * CELL_SIZE;
        
        node.position({ x: newX, y: newY });

        // Update exact grid coordinate to firebase
        updateToken(roomId, tokenId, {
            x: newX / CELL_SIZE,
            y: newY / CELL_SIZE
        });
    };

    // Draw Grid
    const renderGrid = () => {
        const lines = [];
        for (let i = 0; i < dimensions.width / CELL_SIZE; i++) {
            lines.push(
                <Line
                    key={`v${i}`}
                    points={[Math.round(i * CELL_SIZE) + 0.5, 0, Math.round(i * CELL_SIZE) + 0.5, dimensions.height]}
                    stroke="#10b981" // emerald-500
                    strokeWidth={1}
                    opacity={0.2}
                />
            );
        }
        for (let j = 0; j < dimensions.height / CELL_SIZE; j++) {
            lines.push(
                <Line
                    key={`h${j}`}
                    points={[0, Math.round(j * CELL_SIZE) + 0.5, dimensions.width, Math.round(j * CELL_SIZE) + 0.5]}
                    stroke="#10b981"
                    strokeWidth={1}
                    opacity={0.2}
                />
            );
        }
        return lines;
    };

    // Current turn logic
    const currentTurnTokenId = combatState.initiativeOrder?.[combatState.currentTurnIndex];

    const isTokenDraggable = (token: Token) => {
        if (isWarden) return true;
        // Players can only drag their token on their turn
        return token.id === playerId && currentTurnTokenId === token.id;
    };

    const renderTokens = () => {
        return Object.values(combatState.tokens || {}).map((token) => {
            const pixelX = token.x * CELL_SIZE;
            const pixelY = token.y * CELL_SIZE;
            const draggable = isTokenDraggable(token);

            let strokeColor = "#10b981"; // player (emerald-500)
            if (token.type === 'enemy') strokeColor = "#ef4444"; // red-500
            if (token.type === 'npc') strokeColor = "#f59e0b"; // amber-500

            // Highlight if it's their turn
            const isTurn = currentTurnTokenId === token.id;
            const fill = isTurn ? `${strokeColor}40` : "#09090b"; // zinc-950

            return (
                <React.Fragment key={token.id}>
                    <Circle
                        x={pixelX}
                        y={pixelY}
                        width={CELL_SIZE * 0.8}
                        height={CELL_SIZE * 0.8}
                        offset={{ x: -CELL_SIZE / 2, y: -CELL_SIZE / 2 }}
                        fill={fill}
                        stroke={strokeColor}
                        strokeWidth={isTurn ? 3 : 1}
                        draggable={draggable}
                        onDragMove={(e) => handleDragMove(e, token.id)}
                        onDragEnd={(e) => handleDragEnd(e, token.id)}
                        shadowColor={strokeColor}
                        shadowBlur={isTurn ? 10 : 0}
                        shadowOpacity={0.8}
                    />
                    {token.cover !== 'none' && (
                        <Rect
                            x={pixelX + CELL_SIZE * 0.1}
                            y={pixelY + CELL_SIZE * 0.1}
                            width={CELL_SIZE * 0.8}
                            height={CELL_SIZE * 0.8}
                            stroke={strokeColor}
                            strokeWidth={2}
                            dash={token.cover === 'half' ? [4, 4] : undefined}
                            fill="transparent"
                            listening={false}
                        />
                    )}
                    <Text
                        text={token.name.substring(0, 3).toUpperCase()}
                        x={pixelX}
                        y={pixelY + CELL_SIZE / 2 - 6}
                        width={CELL_SIZE}
                        align="center"
                        fontSize={12}
                        fontFamily="monospace"
                        fill={strokeColor}
                        listening={false} // pass through clicks
                    />
                    {token.hp < token.maxHp && (
                        <Rect
                            x={pixelX + 4}
                            y={pixelY + CELL_SIZE - 4}
                            width={CELL_SIZE - 8}
                            height={4}
                            fill="#09090b"
                            stroke="#ef4444"
                            strokeWidth={1}
                            listening={false}
                        />
                    )}
                    {token.hp < token.maxHp && (
                        <Rect
                            x={pixelX + 4}
                            y={pixelY + CELL_SIZE - 4}
                            width={(CELL_SIZE - 8) * (token.hp / token.maxHp)}
                            height={4}
                            fill="#ef4444"
                            listening={false}
                        />
                    )}
                </React.Fragment>
            );
        });
    };

    return (
        <div ref={containerRef} className="w-full h-full bg-zinc-950 border border-emerald-500/30 overflow-hidden relative shadow-[inset_0_0_50px_rgba(16,185,129,0.05)] cursor-crosshair">
            <Stage width={dimensions.width} height={dimensions.height} ref={stageRef}>
                <Layer>
                    {renderGrid()}
                </Layer>
                <Layer>
                    {renderTokens()}
                </Layer>
            </Stage>
            
            {/* CRT overlay effect */}
            <div className="absolute inset-0 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJ0cmFuc3BhcmVudCIvPgo8bGluZSB4MT0iMCIgeTE9IjAiIHgyPSI0IiB5Mj0iMCIgc3Ryb2tlPSJyZ2JhKDAsMCwwLDAuMSkiLz4KPC9zdmc+')] opacity-50 mix-blend-overlay"></div>
        </div>
    );
}
