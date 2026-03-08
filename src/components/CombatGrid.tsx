"use client";

import { useState, useEffect } from "react";
import { RoomData, EncounterState } from "@/types/character";
import { updateGridEntity, toggleGridState, updateGridMovementSetting, removeGridEntity } from "@/lib/database";
import { Maximize2, Minimize2, Settings, Users, ArrowUpRight, Skull, Bomb, Crosshair, Globe, Swords, Ghost, Grip, X, ZoomIn, ZoomOut, MousePointer2 } from "lucide-react";
import { subscribeToRoom } from "@/lib/database";

const GRID_SIZE = 15; // 15x15
const ICONS = [
    { label: "Caveira", emoji: "💀" },
    { label: "Bomba", emoji: "💣" },
    { label: "Pistola", emoji: "🔫" },
    { label: "Planeta", emoji: "🪐" },
    { label: "Alienígena", emoji: "👾" },
    { label: "Espadas", emoji: "⚔️" },
    { label: "Fantasma", emoji: "👻" },
    { label: "Alvo", emoji: "🎯" }
];

interface CombatGridProps {
    roomId: string;
    isWarden: boolean;
    playerId?: string;
}

export const CombatGrid = ({ roomId, isWarden, playerId = "" }: CombatGridProps) => {
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [isMinimized, setIsMinimized] = useState(true);
    const [selectedIcon, setSelectedIcon] = useState(ICONS[0].emoji);
    
    // Internal state for dragging/positioning the window
    const [position, setPosition] = useState({ x: 20, y: 20 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    
    // Internal state for Warden Free Move
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

    // Map Zoom and Pan State
    const [mapState, setMapState] = useState({ scale: 1, x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const unsub = subscribeToRoom(roomId, (data) => setRoomData(data));
        return () => unsub();
    }, [roomId]);

    const encounter = roomData?.encounter;
    const grid = encounter?.grid;

    const myEntity = grid?.entities?.[playerId];
    const isMyTurn = encounter?.turnOrder?.[encounter?.currentTurnIndex] === playerId;

    const joinGrid = () => {
        if (!playerId || !roomData?.players?.[playerId]) return;
        
        let startX = Math.floor(GRID_SIZE / 2);
        let startY = Math.floor(GRID_SIZE / 2);

        // Simple spiral search to find empty spot
        let found = false;
        for (let r = 0; r < 5; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    const checkX = startX + dx;
                    const checkY = startY + dy;
                    if (!Object.values(grid?.entities || {}).some(e => e.x === checkX && e.y === checkY)) {
                        startX = checkX;
                        startY = checkY;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (found) break;
        }

        updateGridEntity(roomId, playerId, {
            x: startX,
            y: startY,
            icon: selectedIcon,
            movementRemaining: grid?.movementPerTurn || 5, // use configured value
        });
    };

    const handleTileClick = (targetX: number, targetY: number) => {
        // Player moving themselves
        if (!isWarden && playerId && myEntity && isMyTurn) {
            const distanceX = Math.abs(myEntity.x - targetX);
            const distanceY = Math.abs(myEntity.y - targetY);
            
            // Allow moving horizontally OR vertically (distance == 1 total)
            if ((distanceX === 1 && distanceY === 0) || (distanceX === 0 && distanceY === 1)) {
                // Check if empty
                if (!Object.values(grid?.entities || {}).some(e => e.x === targetX && e.y === targetY)) {
                    if (myEntity.movementRemaining > 0) {
                        updateGridEntity(roomId, playerId, {
                            x: targetX,
                            y: targetY,
                            movementRemaining: myEntity.movementRemaining - 1
                        });
                    }
                }
            }
        }

        // Warden Interaction
        if (isWarden) {
            // Check if clicking on an entity to select it
            const clickedEntityId = Object.entries(grid?.entities || {}).find(([_, e]) => e.x === targetX && e.y === targetY)?.[0];
            
            if (clickedEntityId) {
                // Toggle selection
                setSelectedEntityId(prev => prev === clickedEntityId ? null : clickedEntityId);
            } else if (selectedEntityId) {
                // Clicking an empty tile while having an entity selected -> Teleport
                if (!Object.values(grid?.entities || {}).some(e => e.x === targetX && e.y === targetY)) {
                    updateGridEntity(roomId, selectedEntityId, {
                        x: targetX,
                        y: targetY
                    });
                    setSelectedEntityId(null);
                }
            }
        }
    };

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setDragStart({ x: clientX - position.x, y: clientY - position.y });
    };

    const handleDragMove = (e: MouseEvent | TouchEvent) => {
        if (!isDragging) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        setPosition({
            x: clientX - dragStart.x,
            y: clientY - dragStart.y
        });
    };

    const handleDragEnd = () => setIsDragging(false);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
            window.addEventListener('touchmove', handleDragMove);
            window.addEventListener('touchend', handleDragEnd);
        } else {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('touchend', handleDragEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [isDragging, dragStart]);

    // Map Pan specific listeners
    const handlePanStart = (e: React.MouseEvent | React.TouchEvent) => {
        setIsPanning(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setPanStart({ x: clientX - mapState.x, y: clientY - mapState.y });
    };

    const handlePanMove = (e: MouseEvent | TouchEvent) => {
        if (!isPanning) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        setMapState(prev => ({ ...prev, x: clientX - panStart.x, y: clientY - panStart.y }));
    };

    const handlePanEnd = () => setIsPanning(false);

    useEffect(() => {
        if (isPanning) {
            window.addEventListener('mousemove', handlePanMove);
            window.addEventListener('mouseup', handlePanEnd);
            window.addEventListener('touchmove', handlePanMove);
            window.addEventListener('touchend', handlePanEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handlePanMove);
            window.removeEventListener('mouseup', handlePanEnd);
            window.removeEventListener('touchmove', handlePanMove);
            window.removeEventListener('touchend', handlePanEnd);
        };
    }, [isPanning, panStart]);

    const handleWheelZoom = (e: React.WheelEvent) => {
        // Prevent default window scrolling if needed
        e.stopPropagation();
        const zoomSensitivity = 0.001;
        setMapState(prev => {
            const newScale = Math.min(Math.max(0.5, prev.scale - e.deltaY * zoomSensitivity), 4);
            return { ...prev, scale: newScale };
        });
    };

    // EARLY RETURNS MUST BE AFTER ALL HOOKS
    // Only show if encounter is active and grid is activated (Warden can always see button to activate)
    if (!encounter?.isActive) return null;
    
    // If not active, only Warden sees the "Ativar Grid" button
    if (!grid?.isActive && !isWarden) return null;


    // Minimized Button view
    if (isMinimized) {
        return (
            <button 
                onClick={() => setIsMinimized(false)}
                className={`fixed z-[300] bottom-4 right-4 md:bottom-8 md:right-8 bg-zinc-950 border-2 shadow-[0_0_20px_rgba(0,0,0,0.5)] p-4 flex items-center gap-3 animate-in slide-in-from-bottom duration-300 ${grid?.isActive ? 'border-amber-500 text-amber-500' : 'border-emerald-900 text-emerald-500'}`}
            >
                <div className="relative">
                    <Maximize2 size={24} className={grid?.isActive && !isWarden && isMyTurn ? 'animate-pulse' : ''} />
                    {grid?.isActive && !isWarden && isMyTurn && myEntity && myEntity.movementRemaining > 0 && (
                        <div className="absolute -top-2 -right-2 bg-amber-500 text-zinc-950 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                            !
                        </div>
                    )}
                </div>
                <div className="flex flex-col text-left">
                    <span className="font-bold uppercase tracking-widest text-xs">Módulo Tático</span>
                    <span className="text-[10px] opacity-70 font-mono">{grid?.isActive ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
            </button>
        );
    }

    // Expanded Window View
    return (
        <div 
            className="fixed z-[300] bg-zinc-950/95 border-2 border-emerald-900 shadow-[0_0_50px_rgba(0,0,0,0.7)] backdrop-blur-md flex flex-col"
            style={{ 
                left: `${position.x}px`, 
                top: `${position.y}px`, 
                width: 'min(90vw, 500px)',
                maxHeight: 'min(90vh, 700px)'
            }}
        >
            {/* Header / Drag Handle */}
            <div 
                className="bg-emerald-950/50 border-b border-emerald-900 p-2 flex justify-between items-center cursor-move"
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
            >
                <div className="flex items-center gap-2 text-emerald-500">
                    <Grip size={16} className="opacity-50" />
                    <span className="font-bold uppercase tracking-widest text-sm">Painel Tático (Grid)</span>
                </div>
                <button onClick={() => setIsMinimized(true)} className="text-emerald-500/50 hover:text-emerald-500 p-1">
                    <Minimize2 size={18} />
                </button>
            </div>

            {/* Controls */}
            <div className="p-4 border-b border-emerald-900/50 bg-black/30 flex flex-col gap-3">
                
                {/* Warden Controls */}
                {isWarden && (
                    <div className="bg-amber-950/20 border border-amber-900/50 p-3 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-amber-500 flex items-center gap-2 uppercase tracking-widest"><Settings size={14}/> Controles do Diretor</span>
                            <button 
                                onClick={() => toggleGridState(roomId, !grid?.isActive)}
                                className={`text-xs px-3 py-1 font-bold tracking-widest uppercase border ${grid?.isActive ? 'bg-red-950 text-red-500 border-red-900' : 'bg-emerald-950 text-emerald-500 border-emerald-900'}`}
                            >
                                {grid?.isActive ? 'Desativar Grid' : 'Ativar Grid'}
                            </button>
                        </div>
                        {grid?.isActive && (
                            <div className="flex items-center justify-between text-sm text-amber-400">
                                <label className="flex items-center gap-2">
                                    Movimento por Turno:
                                    <input 
                                        type="number" 
                                        className="w-16 bg-zinc-950 border border-amber-900 p-1 text-center outline-none"
                                        value={grid?.movementPerTurn || 5}
                                        onChange={(e) => updateGridMovementSetting(roomId, parseInt(e.target.value) || 0)}
                                    />
                                </label>
                            </div>
                        )}
                        
                        {/* Selected Entity Override */}
                        {isWarden && selectedEntityId && grid?.entities?.[selectedEntityId] && (
                            <div className="mt-2 p-2 border border-blue-900/50 bg-blue-950/20 flex flex-col gap-2">
                                <div className="text-xs text-blue-400 font-bold uppercase flex justify-between">
                                    <span>Substituição: {grid.entities[selectedEntityId].name || roomData?.players?.[selectedEntityId]?.name || selectedEntityId}</span>
                                    <button onClick={() => setSelectedEntityId(null)} className="text-red-500 hover:text-red-400"><X size={14}/></button>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-blue-300">
                                    Mover Pontos: 
                                    <input 
                                        type="number" 
                                        className="w-16 bg-zinc-950 border border-blue-900/50 p-1 text-center outline-none"
                                        value={grid.entities[selectedEntityId].movementRemaining}
                                        onChange={e => updateGridEntity(roomId, selectedEntityId, { x: grid.entities[selectedEntityId].x, y: grid.entities[selectedEntityId].y, movementRemaining: parseInt(e.target.value) || 0 })}
                                    />
                                    <button 
                                        onClick={() => removeGridEntity(roomId, selectedEntityId)}
                                        className="ml-auto text-xs bg-red-950 text-red-500 border border-red-900 px-2 py-1 uppercase"
                                    >
                                        Remover Peça
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Player Info */}
                {!isWarden && grid?.isActive && (
                    <div className="flex flex-col gap-2">
                        {!myEntity ? (
                            <div className="flex gap-2 items-end">
                                <div className="flex flex-col gap-1 flex-1">
                                    <label className="text-xs font-bold text-emerald-500 tracking-widest uppercase">Escolha seu ícone</label>
                                    <select 
                                        className="bg-zinc-950 border border-emerald-900 text-emerald-300 p-2 text-xl"
                                        value={selectedIcon}
                                        onChange={(e) => setSelectedIcon(e.target.value)}
                                    >
                                        {ICONS.map(i => <option key={i.label} value={i.emoji}>{i.emoji} {i.label}</option>)}
                                    </select>
                                </div>
                                <button 
                                    onClick={joinGrid}
                                    className="bg-emerald-900 hover:bg-emerald-800 text-emerald-100 px-4 py-2 font-bold uppercase tracking-widest text-sm transition-colors border-2 border-emerald-500"
                                >
                                    Pousar no Grid
                                </button>
                            </div>
                        ) : (
                            <div className={`p-3 border-2 ${isMyTurn ? 'border-amber-500 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'border-emerald-900/50 bg-emerald-950/10'} flex justify-between items-center`}>
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{myEntity.icon}</span>
                                    <div className="flex flex-col">
                                        <span className={`text-xs font-bold tracking-widest uppercase ${isMyTurn ? 'text-amber-500' : 'text-emerald-600'}`}>Seu Status</span>
                                        <span className={`text-sm font-mono ${isMyTurn ? 'text-amber-300' : 'text-emerald-500/50'}`}>
                                            Movimento: {myEntity.movementRemaining} {isMyTurn ? '' : '(Aguarde seu turno)'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeGridEntity(roomId, playerId)}
                                    className="text-xs text-red-500/50 hover:text-red-500 uppercase font-bold px-2 border border-red-500/20"
                                >
                                    Sair
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Grid Area */}
            {grid?.isActive ? (
                <div 
                    className="p-4 flex-1 overflow-hidden bg-black flex justify-center items-center relative"
                    onWheel={handleWheelZoom}
                >
                    <div className="absolute top-2 right-2 z-50 flex flex-col gap-2 bg-black/50 p-2 border border-emerald-900/50">
                        <button onClick={() => setMapState(prev => ({ ...prev, scale: Math.min(prev.scale + 0.2, 4) }))} className="text-emerald-500 hover:text-emerald-300"><ZoomIn size={18}/></button>
                        <button onClick={() => setMapState(prev => ({ ...prev, scale: Math.max(prev.scale - 0.2, 0.5) }))} className="text-emerald-500 hover:text-emerald-300"><ZoomOut size={18}/></button>
                        <button onClick={() => setMapState({ scale: 1, x: 0, y: 0 })} className="text-emerald-500 hover:text-emerald-300"><Crosshair size={18}/></button>
                    </div>

                    <style dangerouslySetInnerHTML={{__html: `
                        .radar-sweep {
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            width: 200%;
                            height: 200%;
                            background: conic-gradient(from 0deg, transparent 70%, rgba(16, 185, 129, 0.4) 100%);
                            transform-origin: center;
                            animation: radar-spin 4s linear infinite;
                            border-radius: 50%;
                            pointer-events: none;
                            z-index: 5;
                            transform: translate(-50%, -50%);
                        }
                        @keyframes radar-spin {
                            100% { transform: translate(-50%, -50%) rotate(360deg); }
                        }
                    `}} />

                    {/* Draggable Map Canvas */}
                    <div 
                        className="relative cursor-move flex items-center justify-center transition-transform duration-75"
                        style={{ 
                            transform: `translate(${mapState.x}px, ${mapState.y}px) scale(${mapState.scale})`,
                        }}
                        onMouseDown={handlePanStart}
                        onTouchStart={handlePanStart}
                    >
                        {/* Radar Background Effects */}
                        <div className="absolute inset-0 rounded-full border border-emerald-900/40 pointer-events-none z-0 scale-150"></div>
                        <div className="absolute inset-0 rounded-full border border-emerald-900/20 pointer-events-none z-0 scale-100"></div>
                        <div className="radar-sweep"></div>
                        
                        {/* Custom Map Background Image Layer */}
                        {grid.backgroundImage && (
                            <img 
                                src={grid.backgroundImage}
                                alt="Map Background"
                                className="absolute top-0 left-0 w-full h-full object-contain z-0 opacity-40 mix-blend-screen pointer-events-none"
                            />
                        )}

                        <div className="relative z-10">
                            {/* Top Coordinates (Letters A-O) */}
                            <div className="flex z-10 relative">
                                <div className="w-6 sm:w-8 h-6 flex items-center justify-center"></div>
                                {Array.from({ length: GRID_SIZE }).map((_, i) => (
                                    <div key={`coord-top-${i}`} className="w-8 sm:w-10 h-6 flex items-center justify-center text-[10px] text-emerald-500/70 font-mono font-bold">
                                        {String.fromCharCode(65 + i)}
                                    </div>
                                ))}
                            </div>

                            <div className="flex">
                                {/* Left Coordinates (Numbers 1-15) */}
                                <div className="flex flex-col z-10 relative">
                                    {Array.from({ length: GRID_SIZE }).map((_, i) => (
                                        <div key={`coord-left-${i}`} className="w-6 sm:w-8 h-8 sm:h-10 flex items-center justify-center text-[10px] text-emerald-500/70 font-mono font-bold">
                                            {i + 1}
                                        </div>
                                    ))}
                                </div>

                                {/* Actual Grid */}
                                <div 
                                    className="grid flex-shrink-0 bg-emerald-950/10 border-2 border-emerald-900/50 relative overflow-hidden backdrop-blur-sm"
                                    style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
                                >
                                    {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                                        const x = i % GRID_SIZE;
                                        const y = Math.floor(i / GRID_SIZE);
                                        
                                        // Find entity here
                                        const entityEntry = Object.entries(grid.entities || {}).find(([_, e]) => e.x === x && e.y === y);
                                        const entity = entityEntry ? entityEntry[1] : null;
                                        const isMe = entityEntry ? entityEntry[0] === playerId : false;
                                        
                                        // Highlight valid movement tiles for active player
                                        let isValidMove = false;
                                        if (!isWarden && myEntity && isMyTurn && myEntity.movementRemaining > 0 && !entity) {
                                            const distX = Math.abs(myEntity.x - x);
                                            const distY = Math.abs(myEntity.y - y);
                                            // Ensure orthogonal moves ONLY
                                            if ((distX === 1 && distY === 0) || (distX === 0 && distY === 1)) {
                                                isValidMove = true;
                                            }
                                        }

                                        const isSelectedByWarden = isWarden && selectedEntityId === entityEntry?.[0];

                                        return (
                                            <div 
                                                key={i}
                                                // Prevent pan drag from triggering if we just want to click a tile
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onTouchStart={(e) => e.stopPropagation()}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleTileClick(x, y);
                                                }}
                                                className={`
                                                    w-8 h-8 sm:w-10 sm:h-10 border border-emerald-500/10 flex items-center justify-center text-xl relative transition-colors
                                                    ${isValidMove ? 'bg-amber-500/20 hover:bg-amber-500/40 cursor-pointer border-amber-500/50' : ''}
                                                    ${!isValidMove && !entity ? 'hover:bg-emerald-500/20' : ''}
                                                    ${isSelectedByWarden && !entity ? 'hover:bg-blue-500/30 cursor-crosshair' : ''}
                                                    ${isSelectedByWarden && entity ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-black z-20' : ''}
                                                `}
                                            >
                                                {/* Grid Crosshairs overlay */}
                                                <div className="absolute inset-0 pointer-events-none opacity-20">
                                                    <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-emerald-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
                                                </div>

                                                {entity && (
                                                    <div 
                                                        className={`relative w-full h-full flex items-center justify-center select-none shadow-lg ${isMe ? 'bg-amber-900/60 border-2 border-amber-500 z-10' : 'bg-emerald-900/60 z-10'} ${entity.color || ''}`}
                                                        title={entity.name || (entityEntry ? (roomData?.players?.[entityEntry[0]]?.name || 'Unidade') : 'Unidade')}
                                                    >
                                                        <span className={(entity.color && !isMe) ? entity.color : 'text-emerald-100 drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]'}>{entity.icon}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="w-6 sm:w-8"></div>
                            </div>
                            <div className="h-6"></div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center p-8 bg-black">
                    <span className="font-mono text-emerald-900 uppercase tracking-widest animate-pulse">
                        Sinal de Radar Desativado
                    </span>
                </div>
            )}
            
        </div>
    );
}
