"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Swords, Target, AlertTriangle, CheckCircle2 } from "lucide-react";
import { subscribeToPlayer, subscribeToRoom, createEmptyCharacter, createPlayer, pushLog, updatePlayerNested, updateNpcHp } from "@/lib/database";
import { CharacterSheet, Weapon, RoomData } from "@/types/character";
import { checkLineOfSight } from "@/lib/tacticalUtils";
import { TacticalGrid } from "@/components/TacticalGrid";
import { MiniSheet } from "@/components/MiniSheet";
import { DiceCalculator } from "@/components/DiceCalculator";

// Roll a dice expression like "2d6+3"
function rollDice(expr: string): { total: number; detail: string } {
    const match = expr.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!match) return { total: 0, detail: "?" };
    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const bonus = match[3] ? parseInt(match[3]) : 0;
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((a, b) => a + b, 0) + bonus;
    return { total, detail: `[${rolls.join("+")}]${bonus ? (bonus > 0 ? `+${bonus}` : `${bonus}`) : ""}` };
}

// Chebyshev distance between two token positions
function chebyshevDist(x1: number, y1: number, x2: number, y2: number) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

interface AttackFeedback {
    weaponName: string;
    result: string;
    detail: string;
    success: boolean;
}

export default function PlayerTacticalClient({ roomId, playerId }: { roomId: string; playerId: string }) {
    const [character, setCharacter] = useState<CharacterSheet | null>(null);
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(true);
    const [attackFeedback, setAttackFeedback] = useState<AttackFeedback | null>(null);
    const [showDice, setShowDice] = useState(false);

    // Damage Overlay State
    const [damageOverlay, setDamageOverlay] = useState<{show: boolean, amount: number}>({show: false, amount: 0});
    const prevHealthRef = useRef<number | null>(null);

    useEffect(() => {
        if (!character) return;
        const currentHp = character.vitals?.health?.current;
        if (prevHealthRef.current !== null && currentHp !== undefined && currentHp < prevHealthRef.current) {
            setDamageOverlay({ show: true, amount: prevHealthRef.current - currentHp });
            setTimeout(() => setDamageOverlay({ show: false, amount: 0 }), 2000);
        }
        if (currentHp !== undefined) prevHealthRef.current = currentHp;
    }, [character?.vitals?.health?.current]);

    useEffect(() => {
        const unsub1 = subscribeToPlayer(roomId, playerId, (data) => {
            if (data) {
                setCharacter(data);
            } else {
                const newChar = createEmptyCharacter(playerId, playerId);
                createPlayer(roomId, newChar).then(() => setCharacter(newChar));
            }
            setLoading(false);
        });
        const unsub2 = subscribeToRoom(roomId, setRoomData);
        return () => { unsub1(); unsub2(); };
    }, [roomId, playerId]);

    const handleAttack = (weapon: Weapon) => {
        if (!character || !roomData) return;

        const encounter = roomData.encounter;
        if (encounter?.isActive) {
            const isMyTurn = encounter.status === 'active' && encounter.turnOrder[encounter.currentTurnIndex] === playerId;
            if (!isMyTurn) {
                setAttackFeedback({ weaponName: weapon.name, result: "Aguarde seu Turno", detail: "Você só pode atacar no seu turno de combate.", success: false });
                setTimeout(() => setAttackFeedback(null), 3000);
                return;
            }
        }

        const targetId = character.selectedTargetId;
        if (!targetId) {
            setAttackFeedback({ weaponName: weapon.name, result: "Sem Alvo Selecionado", detail: "Clique em um inimigo no grid para selecionar.", success: false });
            setTimeout(() => setAttackFeedback(null), 3000);
            return;
        }

        // Range check & LOS check
        const myToken = roomData.encounter?.tokens?.[playerId];
        const targetToken = roomData.encounter?.tokens?.[targetId];
        let losPenalty = 0;
        
        if (myToken && targetToken) {
            const dist = chebyshevDist(myToken.x, myToken.y, targetToken.x, targetToken.y);
            if (dist > weapon.range) {
                setAttackFeedback({ weaponName: weapon.name, result: `Fora de Alcance (${dist} > ${weapon.range} casas)`, detail: "Mova-se mais perto do alvo.", success: false });
                setTimeout(() => setAttackFeedback(null), 3000);
                return;
            }

            // LOS Check
            const los = checkLineOfSight(myToken.x, myToken.y, targetToken.x, targetToken.y, encounter || null);
            if (los.blocked) {
                setAttackFeedback({ weaponName: weapon.name, result: "Alvo Bloqueado", detail: "Existe uma parede obstruindo sua linha de visão.", success: false });
                setTimeout(() => setAttackFeedback(null), 3000);
                return;
            }
            losPenalty = los.penalty;
        }

        // Roll to hit: d100 vs stat
        const statValue = Math.max(0, (character.stats[weapon.baseStat] + weapon.bonus) - losPenalty);
        const hitRoll = Math.floor(Math.random() * 100) + 1;
        const isCrit = hitRoll <= 5;
        const isHit = hitRoll <= statValue || isCrit;

        let result = "";
        let detail = `Rolou ${hitRoll} vs ${statValue} (${weapon.baseStat.toUpperCase()} + bônus)`;
        let dmgDetail = "";
        let finalDmg = 0;

        if (isHit) {
            const { total: dmg, detail: dDetail } = rollDice(weapon.damage);
            finalDmg = isCrit ? dmg * 2 : dmg;
            dmgDetail = `DANO: ${finalDmg}${isCrit ? " (CRÍTICO x2!)" : ""} ${dDetail}`;
            result = isCrit ? "💥 CRÍTICO!" : "✅ ACERTOU!";

            // Apply damage to NPC if target is an NPC
            if (targetId.startsWith('npc_')) {
                const targetNpc = roomData?.encounter?.npcs?.[targetId];
                if (targetNpc) {
                    const newHp = Math.max(0, targetNpc.hp - finalDmg);
                    updateNpcHp(roomId, targetId, newHp);
                }
            }
        } else {
            result = "❌ ERROU!";
        }

        const targetName = roomData?.encounter?.npcs?.[targetId]?.name
            || roomData?.players?.[targetId]?.name
            || "Alvo";

        const msg = `${result} | ${detail}${losPenalty > 0 ? ` | ALVO EM COBERTURA (-${losPenalty}%)` : ""}${dmgDetail ? " | " + dmgDetail : ""}`;

        pushLog(roomId, {
            timestamp: Date.now(),
            playerName: character.name,
            playerId: character.id,
            statName: `ATAQUE: ${weapon.name} → ${targetName}`,
            statValue: statValue,
            roll: hitRoll,
            result: isHit ? (isCrit ? "Critical Success" : "Success") : "Failure",
            customMessage: msg,
        });

        // Broadcast popup
        import("@/lib/firebase").then(({ database }) => {
            import("firebase/database").then(({ ref, update }) => {
                update(ref(database, `rooms/${roomId}/encounter`), {
                    lastAttackEvent: {
                        id: Date.now(),
                        attacker: character.name.toUpperCase(),
                        target: targetName.toUpperCase(),
                        weapon: weapon.name,
                        damage: finalDmg,
                        message: msg,
                        success: isHit
                    }
                });
            });
        });

        setAttackFeedback({ weaponName: weapon.name, result, detail: `${detail}${dmgDetail ? " | " + dmgDetail : ""}`, success: isHit });
        setTimeout(() => setAttackFeedback(null), 4000);
    };

    if (loading) return <div className="animate-pulse flex p-4 text-emerald-500/50 justify-center items-center h-full">Carregando Interface Tática...</div>;
    if (!character) return null;

    const weapons = (character.inventory || []).filter(i => i.type === 'weapon') as Weapon[];
    const gear = (character.inventory || []).filter(i => i.type !== 'weapon');
    const targetId = character.selectedTargetId;
    const targetName = targetId
        ? (roomData?.encounter?.npcs?.[targetId]?.name || roomData?.players?.[targetId]?.name || "Alvo")
        : null;

    return (
        <div className="flex flex-col h-screen w-full relative">
            {/* Header */}
            <header className="bg-zinc-950/90 border-b border-emerald-900/50 p-4 flex items-center justify-between z-10 shrink-0 select-none">
                <Link href={`/sala/${roomId}/jogador/${playerId}`} className="flex items-center gap-2 text-emerald-600 hover:text-emerald-400 font-bold uppercase tracking-widest transition-colors z-[150] relative bg-zinc-950/80 p-2">
                    <ArrowLeft size={18} /> Voltar à Ficha
                </Link>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold uppercase tracking-widest text-emerald-400">
                        SISTEMA TÁTICO // {character.name}
                    </span>
                </div>
                <div className="w-[150px]" />
            </header>

            {/* Main */}
            <div className="flex flex-1 overflow-hidden relative">

                {/* Grid */}
                <main className="flex-1 relative bg-black overflow-hidden">
                    <TacticalGrid roomId={roomId} playerId={playerId} isWarden={false} />
                </main>

                {/* Right Panel */}
                <aside className="w-80 flex flex-col bg-zinc-950 overflow-hidden shrink-0 z-10 border-l border-emerald-900/50">

                    {/* Tabs */}
                    <div className="flex border-b border-emerald-900/50 shrink-0">
                        <button
                            onClick={() => setShowDice(false)}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1 transition-colors ${!showDice ? 'bg-red-950/30 text-red-400 border-b-2 border-red-500' : 'text-emerald-700 hover:text-emerald-500'}`}
                        >
                            <Swords size={14} /> Arsenal
                        </button>
                        <button
                            onClick={() => setShowDice(true)}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1 transition-colors ${showDice ? 'bg-emerald-950/30 text-emerald-400 border-b-2 border-emerald-500' : 'text-emerald-700 hover:text-emerald-500'}`}
                        >
                            Ficha / Dados
                        </button>
                    </div>

                    {/* Arsenal Tab */}
                    {!showDice && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-3">

                            {/* Attack Feedback */}
                            {attackFeedback && (
                                <div className={`border p-3 flex flex-col gap-1 animate-in fade-in ${attackFeedback.success ? 'border-emerald-500 bg-emerald-950/30' : 'border-red-500 bg-red-950/30'}`}>
                                    <div className="flex items-center gap-2">
                                        {attackFeedback.success
                                            ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                                            : <AlertTriangle size={16} className="text-red-400 shrink-0" />}
                                        <span className={`font-bold text-sm uppercase tracking-widest ${attackFeedback.success ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {attackFeedback.result}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400 font-mono">{attackFeedback.detail}</p>
                                </div>
                            )}

                            {/* Target indicator */}
                            <div className={`flex items-center gap-2 px-3 py-2 border text-xs font-bold uppercase tracking-widest ${targetId ? 'border-red-700 bg-red-950/30 text-red-400' : 'border-zinc-800 bg-zinc-900/30 text-zinc-600'}`}>
                                <Target size={14} />
                                {targetName ? `ALVO: ${targetName}` : "Sem Alvo — Clique no Grid"}
                                {targetId && (
                                    <button
                                        onClick={() => updatePlayerNested(roomId, playerId, "selectedTargetId", null)}
                                        className="ml-auto text-red-700 hover:text-red-400 transition-colors"
                                        title="Limpar alvo"
                                    >✕</button>
                                )}
                            </div>

                            {/* Weapons */}
                            <div>
                                <h3 className="text-xs text-red-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                                    <Swords size={12} /> Armas
                                </h3>
                                {weapons.length === 0 ? (
                                    <p className="text-xs text-zinc-600 italic p-2 border border-dashed border-zinc-800">
                                        Nenhuma arma no inventário.
                                    </p>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {weapons.map((w, i) => {
                                            const statVal = character.stats[w.baseStat] + w.bonus;
                                            const hasTarget = !!targetId;

                                            // Check range if we have tokens
                                            let inRange = true;
                                            if (hasTarget) {
                                                const myToken = roomData?.encounter?.tokens?.[playerId];
                                                const targetToken = roomData?.encounter?.tokens?.[targetId!];
                                                if (myToken && targetToken) {
                                                    const dist = chebyshevDist(myToken.x, myToken.y, targetToken.x, targetToken.y);
                                                    inRange = dist <= w.range;
                                                }
                                            }

                                            return (
                                                <div key={`${w.id}-${i}`} className="border border-red-900/40 bg-zinc-950 flex flex-col">
                                                    <div className="p-2 flex justify-between items-start">
                                                        <div>
                                                            <p className="text-sm font-bold text-red-300 uppercase tracking-widest">{w.name}</p>
                                                            <p className="text-xs text-zinc-500 italic">{w.description}</p>
                                                        </div>
                                                    </div>
                                                    <div className="px-2 pb-1 flex gap-2 text-[10px] font-mono text-zinc-500">
                                                        <span className="text-red-400">💥 {w.damage}</span>
                                                        <span>🎯 {w.range} casas</span>
                                                        <span className="uppercase">{w.baseStat} +{w.bonus}</span>
                                                        <span className="text-emerald-400 ml-auto">Acerto: {statVal}%</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAttack(w)}
                                                        disabled={!hasTarget || !inRange}
                                                        className={`w-full py-2 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all
                                                            ${!hasTarget ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                                                                : !inRange ? 'bg-orange-950/50 text-orange-600 border-t border-orange-900/30 cursor-not-allowed'
                                                                : 'bg-red-900/50 hover:bg-red-800 text-red-300 border-t border-red-800 cursor-pointer'}`}
                                                    >
                                                        <Swords size={12} />
                                                        {!hasTarget ? "Selecione um Alvo" : !inRange ? "Fora de Alcance" : `ATACAR → ${targetName}`}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Gear */}
                            {gear.length > 0 && (
                                <div>
                                    <h3 className="text-xs text-emerald-600 font-bold uppercase tracking-widest mb-2">Equipamentos</h3>
                                    <div className="flex flex-col gap-1">
                                        {gear.map((item, i) => (
                                            <div key={`${item.id}-${i}`} className="border border-emerald-900/30 bg-zinc-950 p-2">
                                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">{item.name} <span className="text-emerald-700 font-normal">x{item.quantity}</span></p>
                                                <p className="text-[10px] text-zinc-600 italic">{item.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Ficha/Dados Tab */}
                    {showDice && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                            <div className="p-3 bg-zinc-900/50 border-b border-emerald-900/50">
                                <MiniSheet character={character} readOnly={true} />
                            </div>
                            <div className="p-3">
                                <DiceCalculator roomId={roomId} character={character} />
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            {/* DAMAGE OVERLAY */}
            {damageOverlay.show && (
                <div className="fixed inset-0 z-[400] pointer-events-none flex items-center justify-center">
                    <div className="absolute inset-0 bg-red-900/40 mix-blend-multiply animate-pulse" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_50%,rgba(220,38,38,0.8)_100%)]" />
                    <div className="text-red-500 text-6xl md:text-8xl font-black uppercase tracking-widest z-10 font-mono drop-shadow-[0_0_20px_rgba(220,38,38,1)] animate-in fade-in zoom-in slide-in-from-bottom-10 duration-300">
                        -{damageOverlay.amount} HP
                    </div>
                </div>
            )}
        </div>
    );
}
