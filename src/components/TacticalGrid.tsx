"use client";

import { useState, useEffect } from "react";
import { subscribeToRoom, updateTokenPosition, removeTokenFromGrid, deductTokenMovement, updatePlayerNested, addNPCToEncounter, updateNpcHp, pushLog, updateNpcData } from "@/lib/database";
import { RoomData, EncounterState, Weapon, NpcAttack } from "@/types/character";
import { Trash2, Target, Plus, Minus, Crosshair, Skull, Swords, ChevronDown, ChevronUp, X } from "lucide-react";

interface TacticalGridProps {
    roomId: string;
    playerId?: string;
    isWarden?: boolean;
}

const GRID_SIZE = 20;
const CELL_SIZE = 40;

const NPC_COLORS = [
    { label: "Vermelho", value: "bg-red-500" },
    { label: "Laranja", value: "bg-orange-500" },
    { label: "Roxo", value: "bg-purple-500" },
    { label: "Rosa", value: "bg-pink-500" },
    { label: "Amarelo", value: "bg-yellow-400" },
    { label: "Ciano", value: "bg-cyan-400" },
];

const NPC_ICONS = ["👾", "💀", "🤖", "🕷️", "👤", "🐙", "🦂", "🧟", "👹", "🐍"];

const EMPTY_NPC_FORM = {
    name: "",
    initiative: 10,
    icon: "👾",
    color: "bg-red-500",
    hp: 20,
    maxHp: 20,
    movementMax: 6,
    attacks: [] as NpcAttack[],
};

export function TacticalGrid({ roomId, playerId, isWarden }: TacticalGridProps) {
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
    const [npcForm, setNpcForm] = useState({ ...EMPTY_NPC_FORM });
    const [showNpcForm, setShowNpcForm] = useState(false);
    const [newAttack, setNewAttack] = useState<NpcAttack>({ name: "", damage: "1d10", range: 1 });
    const [expandedNpc, setExpandedNpc] = useState<string | null>(null);

    useEffect(() => {
        const unsub = subscribeToRoom(roomId, (data) => setRoomData(data));
        return () => unsub();
    }, [roomId]);

    const encounter = roomData?.encounter;
    const tokens = encounter?.tokens || {};
    const npcs = encounter?.npcs || {};

    const activeTokenId = isWarden ? selectedTokenId : playerId;
    const activeToken = activeTokenId ? tokens[activeTokenId] : null;

    const getTokenMaxRange = (tId: string) => {
        const char = roomData?.players?.[tId];
        if (!char || !char.inventory) return 0;
        const weapons = char.inventory.filter(i => i.type === 'weapon') as Weapon[];
        if (weapons.length === 0) return 1;
        return Math.max(...weapons.map(w => w.range));
    };

    const handleCellClick = (x: number, y: number) => {
        if (!isWarden) {
            const myToken = Object.entries(tokens).find(([id]) => id === playerId);
            if (myToken) {
                const dist = Math.max(Math.abs(myToken[1].x - x), Math.abs(myToken[1].y - y));
                if (dist <= myToken[1].movementPoints.current) {
                    updateTokenPosition(roomId, playerId!, x, y, myToken[1].color);
                    deductTokenMovement(roomId, playerId!, dist);
                }
            } else {
                const maxMp = roomData?.players?.[playerId!]?.movementPoints?.max || 6;
                updateTokenPosition(roomId, playerId!, x, y, 'bg-emerald-500', maxMp);
            }
            return;
        }
        // Warden: move selected token
        if (selectedTokenId) {
            const color = tokens[selectedTokenId]?.color || 'bg-red-500';
            updateTokenPosition(roomId, selectedTokenId, x, y, color);
            setSelectedTokenId(null);
        }
    };

    const handleTokenClick = (e: React.MouseEvent, tokenId: string) => {
        e.stopPropagation();
        if (isWarden) {
            setSelectedTokenId(prev => prev === tokenId ? null : tokenId);
        } else {
            if (tokenId !== playerId && playerId) {
                const currentTarget = roomData?.players?.[playerId]?.selectedTargetId;
                updatePlayerNested(roomId, playerId, "selectedTargetId", currentTarget === tokenId ? null : tokenId);
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

    const handleSpawnNpc = () => {
        if (!npcForm.name.trim()) return;
        addNPCToEncounter(roomId, {
            name: npcForm.name,
            initiative: npcForm.initiative,
            icon: npcForm.icon,
            color: npcForm.color,
            hp: npcForm.hp,
            maxHp: npcForm.hp,
            movementMax: npcForm.movementMax,
            attacks: npcForm.attacks,
        });
        setNpcForm({ ...EMPTY_NPC_FORM });
        setShowNpcForm(false);
    };

    const handleAddAttack = () => {
        if (!newAttack.name.trim()) return;
        setNpcForm(prev => ({ ...prev, attacks: [...prev.attacks, { ...newAttack }] }));
        setNewAttack({ name: "", damage: "1d10", range: 1 });
    };

    const handleRemoveAttack = (idx: number) => {
        setNpcForm(prev => ({ ...prev, attacks: prev.attacks.filter((_, i) => i !== idx) }));
    };

    const handleNpcHpChange = (npcId: string, delta: number) => {
        const npc = npcs[npcId];
        if (!npc || npc.isDead) return;
        const newHp = Math.max(0, Math.min(npc.maxHp, npc.hp + delta));
        updateNpcHp(roomId, npcId, newHp);
        if (newHp <= 0) {
            pushLog(roomId, {
                timestamp: Date.now(),
                playerName: "SISTEMA",
                playerId: "SYSTEM",
                statName: `AMEAÇA ABATIDA: ${npc.name}`,
                statValue: 0,
                roll: 0,
                result: 'Warden Message'
            });
        }
    };

    if (!roomData) return <div className="text-emerald-500 font-mono p-4 animate-pulse">Carregando Malha Tática...</div>;

    return (
        <div className="flex w-full h-full overflow-hidden bg-black">

            {/* WARDEN SIDEBAR */}
            {isWarden && (
                <aside className="w-72 shrink-0 bg-zinc-950 border-r border-red-900/50 flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-red-900/50 bg-red-950/20">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-red-400 flex items-center gap-2">
                            <Skull size={14} /> CONTROLE DE AMEAÇAS
                        </h2>
                    </div>

                    {/* NPC LIST */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-2">
                        {Object.keys(npcs).length === 0 && (
                            <p className="text-xs text-red-900 italic p-2">Nenhuma ameaça registrada.</p>
                        )}
                        {Object.values(npcs).map(npc => {
                            const token = tokens[npc.id];
                            const isSelected = selectedTokenId === npc.id;
                            const hpPct = npc.maxHp > 0 ? (npc.hp / npc.maxHp) * 100 : 0;
                            const hpColor = hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-yellow-500' : 'bg-red-500';
                            const isExpanded = expandedNpc === npc.id;

                            return (
                                <div key={npc.id} className={`border rounded-sm transition-all ${isSelected ? 'border-white bg-zinc-900' : 'border-red-900/40 bg-zinc-950 hover:border-red-700/50'}`}>
                                    {/* NPC Header */}
                                    <div className="flex items-center gap-2 p-2">
                                        <button
                                            onClick={() => setSelectedTokenId(prev => prev === npc.id ? null : npc.id)}
                                            className={`flex-1 text-left text-xs font-bold uppercase tracking-wide transition-colors ${isSelected ? 'text-white' : 'text-red-400'}`}
                                        >
                                            <span className="text-sm">{npc.color === 'bg-red-500' ? '🔴' : npc.color === 'bg-purple-500' ? '🟣' : npc.color === 'bg-orange-500' ? '🟠' : npc.color === 'bg-yellow-400' ? '🟡' : npc.color === 'bg-cyan-400' ? '🔵' : '🔴'}</span>{" "}
                                            {npc.name}
                                        </button>
                                        {token && (
                                            <span className="text-[10px] text-zinc-500 font-mono">[{token.x},{token.y}]</span>
                                        )}
                                        <button
                                            onClick={() => setExpandedNpc(prev => prev === npc.id ? null : npc.id)}
                                            className="text-red-700 hover:text-red-400 transition-colors"
                                        >
                                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        </button>
                                        <button
                                            onClick={() => { removeTokenFromGrid(roomId, npc.id); setSelectedTokenId(null); }}
                                            className="text-red-700/50 hover:text-red-400 transition-colors p-0.5"
                                            title="Remover do combate"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>

                                    {/* HP Bar */}
                                    <div className="px-2 pb-1">
                                        <div className="flex items-center gap-1 mb-1">
                                            <button onClick={() => handleNpcHpChange(npc.id, -1)} className="text-red-400 hover:text-red-200 text-xs bg-red-950/50 px-1 rounded">-</button>
                                            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                <div className={`h-full ${hpColor} transition-all duration-300`} style={{ width: `${hpPct}%` }} />
                                            </div>
                                            <button onClick={() => handleNpcHpChange(npc.id, 1)} className="text-emerald-400 hover:text-emerald-200 text-xs bg-emerald-950/50 px-1 rounded">+</button>
                                            <span className="text-[10px] text-zinc-400 font-mono w-10 text-right">{npc.hp}/{npc.maxHp}</span>
                                        </div>
                                    </div>

                                    {/* Expanded: attacks + direct HP input */}
                                    {isExpanded && (
                                        <div className="px-2 pb-2 border-t border-red-900/30 pt-2 flex flex-col gap-1">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-red-500/70 uppercase">HP Direto:</span>
                                                <input
                                                    type="number"
                                                    className="w-14 bg-zinc-900 border border-red-900/50 text-red-300 text-xs text-center outline-none font-mono"
                                                    value={npc.hp}
                                                    onChange={e => updateNpcHp(roomId, npc.id, Number(e.target.value))}
                                                />
                                                <span className="text-[10px] text-zinc-500">/ {npc.maxHp}</span>
                                            </div>
                                            {npc.attacks && npc.attacks.length > 0 && (
                                                <div className="mt-1">
                                                    <span className="text-[10px] text-red-500/70 uppercase font-bold block mb-1">Ataques:</span>
                                                    {npc.attacks.map((atk, i) => (
                                                        <div key={i} className="flex items-center justify-between bg-red-950/20 border border-red-900/20 px-2 py-1 rounded mb-0.5">
                                                            <span className="text-[10px] text-red-300 font-bold uppercase">{atk.name}</span>
                                                            <span className="text-[10px] text-zinc-400 font-mono">{atk.damage} | {atk.range}sq</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {/* MP display */}
                                            {token && (
                                                <div className="text-[10px] text-zinc-500 mt-1">
                                                    Move: {token.movementPoints.current}/{token.movementPoints.max}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* SPAWN NPC FORM */}
                    <div className="border-t border-red-900/50 p-2 shrink-0">
                        <button
                            onClick={() => setShowNpcForm(p => !p)}
                            className="w-full flex items-center justify-center gap-2 bg-red-950/50 hover:bg-red-900/60 border border-red-800 text-red-400 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors"
                        >
                            <Plus size={12} /> {showNpcForm ? 'CANCELAR' : 'NOVA AMEAÇA'}
                        </button>

                        {showNpcForm && (
                            <div className="mt-2 flex flex-col gap-2">
                                <input
                                    type="text"
                                    placeholder="Nome da Ameaça..."
                                    value={npcForm.name}
                                    onChange={e => setNpcForm(p => ({ ...p, name: e.target.value }))}
                                    className="w-full bg-zinc-900 border border-red-900/50 text-red-300 p-1.5 text-xs outline-none font-mono"
                                />

                                <div className="grid grid-cols-2 gap-2">
                                    <label className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-red-500/70 uppercase">HP</span>
                                        <input type="number" value={npcForm.hp}
                                            onChange={e => setNpcForm(p => ({ ...p, hp: Number(e.target.value), maxHp: Number(e.target.value) }))}
                                            className="bg-zinc-900 border border-red-900/50 text-red-300 p-1 text-xs outline-none font-mono" />
                                    </label>
                                    <label className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-red-500/70 uppercase">Iniciativa</span>
                                        <input type="number" value={npcForm.initiative}
                                            onChange={e => setNpcForm(p => ({ ...p, initiative: Number(e.target.value) }))}
                                            className="bg-zinc-900 border border-red-900/50 text-red-300 p-1 text-xs outline-none font-mono" />
                                    </label>
                                </div>

                                {/* Icon selector */}
                                <div>
                                    <span className="text-[10px] text-red-500/70 uppercase">Ícone</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {NPC_ICONS.map(icon => (
                                            <button key={icon} onClick={() => setNpcForm(p => ({ ...p, icon }))}
                                                className={`text-base p-0.5 rounded border transition-all ${npcForm.icon === icon ? 'border-red-400 bg-red-950/50 scale-110' : 'border-transparent hover:border-red-800'}`}>
                                                {icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Movement Max */}
                                <label className="flex flex-col gap-0.5">
                                    <span className="text-[10px] text-red-500/70 uppercase">Movimento Máx.</span>
                                    <input type="number" value={npcForm.movementMax}
                                        onChange={e => setNpcForm(p => ({ ...p, movementMax: Number(e.target.value) }))}
                                        className="bg-zinc-900 border border-red-900/50 text-red-300 p-1 text-xs outline-none font-mono" />
                                </label>

                                {/* Color selector */}
                                <div>
                                    <span className="text-[10px] text-red-500/70 uppercase">Cor do Token</span>
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                        {NPC_COLORS.map(c => (
                                            <button key={c.value} onClick={() => setNpcForm(p => ({ ...p, color: c.value }))}
                                                className={`w-5 h-5 rounded-full ${c.value} transition-transform ${npcForm.color === c.value ? 'ring-2 ring-white scale-125' : 'opacity-60 hover:opacity-100'}`}
                                                title={c.label} />
                                        ))}
                                    </div>
                                </div>

                                {/* Attacks */}
                                <div className="border-t border-red-900/30 pt-2">
                                    <span className="text-[10px] text-red-500/70 uppercase font-bold">Ataques</span>
                                    {npcForm.attacks.map((atk, i) => (
                                        <div key={i} className="flex items-center gap-1 mt-1">
                                            <span className="text-[10px] text-red-300 flex-1 truncate font-mono">{atk.name} | {atk.damage} | {atk.range}sq</span>
                                            <button onClick={() => handleRemoveAttack(i)} className="text-red-700 hover:text-red-400"><X size={10} /></button>
                                        </div>
                                    ))}
                                    <div className="flex flex-col gap-1 mt-1">
                                        <input type="text" placeholder="Nome do ataque" value={newAttack.name}
                                            onChange={e => setNewAttack(p => ({ ...p, name: e.target.value }))}
                                            className="bg-zinc-900 border border-red-900/30 text-red-300 p-1 text-xs outline-none font-mono" />
                                        <div className="flex gap-1">
                                            <input type="text" placeholder="Dano (ex: 2d6)" value={newAttack.damage}
                                                onChange={e => setNewAttack(p => ({ ...p, damage: e.target.value }))}
                                                className="flex-1 bg-zinc-900 border border-red-900/30 text-red-300 p-1 text-xs outline-none font-mono" />
                                            <input type="number" placeholder="Alc" value={newAttack.range}
                                                onChange={e => setNewAttack(p => ({ ...p, range: Number(e.target.value) }))}
                                                className="w-10 bg-zinc-900 border border-red-900/30 text-red-300 p-1 text-xs outline-none font-mono" />
                                            <button onClick={handleAddAttack}
                                                className="bg-red-900/50 hover:bg-red-800 text-red-300 px-1 text-xs font-bold border border-red-800">+</button>
                                        </div>
                                    </div>
                                </div>

                                <button onClick={handleSpawnNpc}
                                    className="w-full bg-red-900 hover:bg-red-800 text-red-100 font-bold uppercase tracking-widest py-2 text-xs transition-colors mt-1">
                                    ADICIONAR AO COMBATE
                                </button>
                            </div>
                        )}
                    </div>
                </aside>
            )}

            {/* GRID AREA */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative scanline-overlay bg-black">
                <div
                    className="grid bg-zinc-950/50 border-2 border-emerald-900/50 relative shadow-[0_0_50px_rgba(16,185,129,0.1)] mx-auto my-auto"
                    style={{
                        gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
                        gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
                        width: `${GRID_SIZE * CELL_SIZE}px`,
                        height: `${GRID_SIZE * CELL_SIZE}px`
                    }}
                >
                    {/* Cells */}
                    {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                        const x = i % GRID_SIZE;
                        const y = Math.floor(i / GRID_SIZE);
                        let isMovable = false;
                        let isAttackable = false;

                        if (activeToken) {
                            const dist = Math.max(Math.abs(activeToken.x - x), Math.abs(activeToken.y - y));
                            if (dist > 0 && dist <= activeToken.movementPoints.current) isMovable = true;
                            const maxRange = getTokenMaxRange(activeTokenId!);
                            if (dist > 0 && dist <= maxRange) isAttackable = true;
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
                                <div className={`w-1 h-1 rounded-full pointer-events-none ${isMovable ? 'bg-emerald-500/50' : isAttackable ? 'bg-red-500/30' : 'bg-emerald-900/30'}`} />
                            </div>
                        );
                    })}

                    {/* Tokens */}
                    {Object.entries(tokens).map(([id, token]) => {
                        const isSelectedByWarden = selectedTokenId === id;
                        const isPlayerToken = !!roomData.players?.[id];
                        const isNpc = id.startsWith('npc_');
                        const isTargeted = !isWarden && playerId && roomData.players?.[playerId]?.selectedTargetId === id;
                        const npcData = isNpc ? npcs[id] : null;
                        const isCorpse = isNpc && (npcData?.isDead || (npcData?.hp ?? 1) <= 0);

                        const isTurn = encounter?.turnOrder?.[encounter.currentTurnIndex] === id;

                        // HP bar for NPCs
                        const hpPct = npcData && npcData.maxHp > 0 ? (npcData.hp / npcData.maxHp) * 100 : 100;

                        // Token background
                        let tokenBg = isPlayerToken ? 'bg-emerald-500 text-zinc-950' : 'bg-red-500 text-zinc-950';
                        if (isCorpse) tokenBg = 'bg-zinc-800 text-zinc-500 grayscale opacity-60';

                        return (
                            <div
                                key={id}
                                onClick={(e) => handleTokenClick(e, id)}
                                className={`absolute flex flex-col items-center justify-center font-bold text-sm uppercase tracking-tighter shadow-lg cursor-pointer transition-all duration-300 rounded z-10
                                    ${tokenBg}
                                    ${!isCorpse && (isSelectedByWarden || isTargeted) ? 'ring-4 ring-white scale-110 z-20 shadow-[0_0_20px_rgba(255,255,255,0.5)]' : 'hover:scale-105'}
                                    ${!isCorpse && isTurn ? 'ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.8)]' : ''}
                                `}
                                style={{
                                    left: `${token.x * CELL_SIZE}px`,
                                    top: `${token.y * CELL_SIZE}px`,
                                    width: `${CELL_SIZE}px`,
                                    height: `${CELL_SIZE}px`
                                }}
                            >
                                {isTargeted && !isCorpse && <Target size={24} className="absolute text-red-500 scale-150 opacity-80 animate-pulse pointer-events-none" />}

                                {/* Token label: emoji icon for NPCs, initials for players */}
                                {isCorpse ? (
                                    <span className="text-xl z-10">💀</span>
                                ) : isNpc ? (
                                    <span className="text-xl z-10">{npcData?.icon || '👾'}</span>
                                ) : (
                                    <span className="z-10 text-[11px]">{roomData.players[id]?.name.substring(0, 2).toUpperCase() || '??'}</span>
                                )}

                                {/* HP bar under NPC token */}
                                {isNpc && npcData && !isCorpse && (
                                    <div className="absolute -bottom-3 left-0 right-0 h-1.5 bg-black/80 rounded-full overflow-hidden border border-zinc-700">
                                        <div
                                            className={`h-full transition-all ${hpPct > 50 ? 'bg-emerald-400' : hpPct > 25 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                            style={{ width: `${hpPct}%` }}
                                        />
                                    </div>
                                )}

                                {/* MP badge */}
                                {!isNpc && (
                                    <div className="absolute -bottom-2 bg-black text-[9px] px-1 text-emerald-400 border border-emerald-900">
                                        {token.movementPoints.current}/{token.movementPoints.max}
                                    </div>
                                )}

                                {/* Delete button (Warden selected) */}
                                {isSelectedByWarden && isWarden && (
                                    <button
                                        onClick={(e) => handleRemoveToken(e, id)}
                                        className="absolute -top-3 -right-3 bg-red-900 text-white rounded-full p-1 hover:bg-red-600 z-30 shadow-xl border border-red-500"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default TacticalGrid;
