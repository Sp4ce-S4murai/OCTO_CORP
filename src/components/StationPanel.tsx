"use client";

import { useState } from "react";
import { ShipState, ShipAction, StationRole } from "@/types/ship";
import { occupyStation, leaveStation, submitShipAction, rollDice, applyEnemyDamage, drainResource, repairSystem, revealEnemy } from "@/lib/shipDatabase";
import { pushLog } from "@/lib/database";
import { CharacterSheet } from "@/types/character";
import { Crosshair, Navigation, Wrench, Eye, Shield, Fuel, Zap, Radio, ChevronRight } from "lucide-react";

interface StationPanelProps {
    roomId: string;
    ship: ShipState;
    playerId: string;
    character: CharacterSheet;
}

const STATION_META: Record<string, { label: string; role: StationRole; icon: React.ReactNode; color: string; borderColor: string; bgColor: string }> = {
    bridge:      { label: 'PONTE DE COMANDO',    role: 'pilot',    icon: <Navigation size={16} />, color: 'text-blue-400',   borderColor: 'border-blue-800', bgColor: 'bg-blue-950/20' },
    tactical:    { label: 'ESTAÇÃO TÁTICA',       role: 'gunner',   icon: <Crosshair size={16} />,  color: 'text-red-400',    borderColor: 'border-red-800',  bgColor: 'bg-red-950/20' },
    engineering: { label: 'ENGENHARIA',           role: 'engineer', icon: <Wrench size={16} />,     color: 'text-amber-400',  borderColor: 'border-amber-800', bgColor: 'bg-amber-950/20' },
    science:     { label: 'ESTAÇÃO CIENTÍFICA',    role: 'science',  icon: <Eye size={16} />,        color: 'text-purple-400', borderColor: 'border-purple-800', bgColor: 'bg-purple-950/20' },
};

export function StationPanel({ roomId, ship, playerId, character }: StationPanelProps) {
    const [selectedWeaponId, setSelectedWeaponId] = useState<string>("");
    const [rollInput, setRollInput] = useState("");

    // Find which station this player occupies
    const myStationEntry = Object.entries(ship.stations).find(([, s]) => s.occupantId === playerId);
    const myStationKey = myStationEntry?.[0];
    const myStation = myStationEntry?.[1];

    const isCombatActive = ship.combat?.isActive;
    const isStationsPhase = ship.combat?.phase === 'stations';
    const alreadyActed = myStation?.role && ship.combat?.actionsThisRound?.[myStation.role];

    // --- Station selection UI ---
    if (!myStationKey) {
        return (
            <section className="border border-cyan-900/50 bg-cyan-950/10 p-4">
                <h3 className="text-sm font-bold tracking-widest text-cyan-500 uppercase mb-3 flex items-center gap-2">
                    <Shield size={16} /> SELECIONE SUA ESTAÇÃO DE BORDO
                </h3>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(ship.stations).map(([key, station]) => {
                        const meta = STATION_META[key];
                        const isOccupied = !!station.occupantId;
                        return (
                            <button
                                key={key}
                                onClick={() => occupyStation(roomId, key, playerId, character.name)}
                                disabled={isOccupied}
                                className={`flex items-center gap-2 px-4 py-3 border font-bold tracking-widest uppercase text-xs transition-colors ${isOccupied ? 'opacity-30 cursor-not-allowed border-zinc-800 text-zinc-600' : `${meta.borderColor} ${meta.color} ${meta.bgColor} hover:opacity-80`}`}
                            >
                                {meta.icon}
                                <div className="text-left">
                                    <div>{meta.label}</div>
                                    {isOccupied && <div className="text-[9px] normal-case opacity-60">{station.occupantName}</div>}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>
        );
    }

    const stationMeta = STATION_META[myStationKey];
    const stationRole = myStation?.role || 'unassigned';

    // d100 roll helper
    const doRoll = (targetValue: number): { roll: number; isHit: boolean; isCritical: boolean; isAutoFail: boolean } => {
        const useInput = rollInput.trim();
        let roll: number;
        if (useInput) {
            roll = parseInt(useInput);
            if (isNaN(roll)) roll = Math.floor(Math.random() * 100);
        } else {
            roll = Math.floor(Math.random() * 100);
        }
        const rollStr = roll.toString().padStart(2, '0');
        const isDouble = rollStr[0] === rollStr[1];
        const isAutoFail = roll >= 90;
        const isHit = !isAutoFail && roll <= targetValue;
        const isCritical = isDouble;
        setRollInput("");
        return { roll, isHit, isCritical, isAutoFail };
    };

    // --- PILOT ACTIONS ---
    const handleEvade = async () => {
        const target = ship.stats.speed;
        const { roll, isHit, isCritical } = doRoll(target);
        const result = isHit ? (isCritical ? 'critical_success' : 'success') : (isCritical ? 'critical_failure' : 'failure');

        const action: ShipAction = {
            type: 'evade', stationRole: 'pilot', playerId, playerName: character.name,
            roll, targetValue: target, result,
            description: isHit ? 'Manobra evasiva bem-sucedida' : 'Evasão falhou',
        };
        await submitShipAction(roomId, 'pilot', action);
        await pushLog(roomId, {
            timestamp: Date.now(), playerName: character.name, playerId,
            statName: `MANOBRA EVASIVA (alvo: ≤${target})`, statValue: target, roll,
            result: isHit ? 'Ship Evade' : 'Ship Damage',
        });
        if (isHit) drainResource(roomId, 'fuel', 5);
    };

    // --- GUNNER ACTIONS ---
    const handleFire = async () => {
        if (!selectedWeaponId) return;
        const weapon = ship.weapons[selectedWeaponId];
        if (!weapon || weapon.currentCooldown > 0) return;
        if (ship.resources.ammo.current < weapon.ammoCost) return;

        const enemies = ship.enemies ? Object.values(ship.enemies) : [];
        const primaryEnemy = enemies[0];
        const enemyAR = primaryEnemy ? primaryEnemy.stats.armor : 0;
        const target = Math.max(1, ship.stats.combat - Math.floor(enemyAR / 5));

        const { roll, isHit, isCritical } = doRoll(target);
        const result = isHit ? (isCritical ? 'critical_success' : 'success') : (isCritical ? 'critical_failure' : 'failure');

        let damage = 0;
        if (isHit) {
            damage = rollDice(weapon.damage);
            if (isCritical) damage = Math.floor(damage * 1.5);
            if (primaryEnemy) {
                await applyEnemyDamage(roomId, primaryEnemy.id, damage);
            }
        }

        await drainResource(roomId, 'ammo', weapon.ammoCost);

        const action: ShipAction = {
            type: 'fire', stationRole: 'gunner', playerId, playerName: character.name,
            weaponId: selectedWeaponId, roll, targetValue: target, result,
            description: isHit ? `${weapon.name}: ${damage} dano` : `${weapon.name}: Disparo perdido`,
        };
        await submitShipAction(roomId, 'gunner', action);
        await pushLog(roomId, {
            timestamp: Date.now(), playerName: character.name, playerId,
            statName: `DISPARO ${weapon.name.toUpperCase()} (alvo: ≤${target})`, statValue: damage, roll,
            result: isHit ? 'Ship Fire' : 'Ship Damage',
        });
    };

    // --- ENGINEER ACTIONS ---
    const handleRepair = async (systemKey: string) => {
        const target = character.stats.intellect;
        const { roll, isHit, isCritical } = doRoll(target);
        const repairAmount = isHit ? (isCritical ? 40 : 20) : 0;

        if (isHit) {
            await repairSystem(roomId, systemKey, repairAmount);
        }

        const action: ShipAction = {
            type: 'repair', stationRole: 'engineer', playerId, playerName: character.name,
            targetSystem: systemKey, roll, targetValue: target,
            result: isHit ? (isCritical ? 'critical_success' : 'success') : (isCritical ? 'critical_failure' : 'failure'),
            description: isHit ? `Reparo: +${repairAmount}% integridade` : 'Reparo falhou',
        };
        await submitShipAction(roomId, 'engineer', action);
        await pushLog(roomId, {
            timestamp: Date.now(), playerName: character.name, playerId,
            statName: `REPARO ${systemKey.toUpperCase()} (alvo: ≤${target})`, statValue: repairAmount, roll,
            result: isHit ? 'Ship Repair' : 'Ship Damage',
        });
    };

    // --- SCIENCE ACTIONS ---
    const handleScan = async () => {
        const target = ship.stats.sensors;
        const { roll, isHit, isCritical } = doRoll(target);

        if (isHit && ship.enemies) {
            const unrevealed = Object.values(ship.enemies).filter(e => !e.revealed);
            if (unrevealed.length > 0) {
                await revealEnemy(roomId, unrevealed[0].id);
            }
        }

        const action: ShipAction = {
            type: 'scan', stationRole: 'science', playerId, playerName: character.name,
            roll, targetValue: target,
            result: isHit ? (isCritical ? 'critical_success' : 'success') : (isCritical ? 'critical_failure' : 'failure'),
            description: isHit ? 'Scan completo — dados revelados' : 'Interferência — scan falhou',
        };
        await submitShipAction(roomId, 'science', action);
        await pushLog(roomId, {
            timestamp: Date.now(), playerName: character.name, playerId,
            statName: `ESCANEAMENTO (alvo: ≤${target})`, statValue: target, roll,
            result: isHit ? 'Ship Scan' : 'Ship Damage',
        });
    };

    const SYSTEM_LABELS: Record<string, string> = {
        propulsion: 'Propulsão', lifeSupport: 'Suporte de Vida',
        weapons: 'Armamento', sensors: 'Sensores',
    };

    // --- RENDER ---
    return (
        <section className={`border ${stationMeta.borderColor} ${stationMeta.bgColor} p-4`}>
            <div className="flex justify-between items-center mb-3">
                <h3 className={`text-sm font-bold tracking-widest uppercase flex items-center gap-2 ${stationMeta.color}`}>
                    {stationMeta.icon} {stationMeta.label}
                </h3>
                <button onClick={() => leaveStation(roomId, myStationKey)}
                    className="text-[10px] text-zinc-600 hover:text-zinc-400 uppercase tracking-widest font-bold transition">
                    ABANDONAR POSTO
                </button>
            </div>

            {/* Manual d100 input */}
            {isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex items-center gap-2 mb-3">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">D100 MANUAL:</label>
                    <input type="number" min="0" max="99" placeholder="RNG" value={rollInput} onChange={e => setRollInput(e.target.value)}
                        className="bg-zinc-950 border border-zinc-700 text-zinc-300 p-1 text-xs outline-none w-16 text-center" />
                    <span className="text-[9px] text-zinc-600">(vazio = virtual)</span>
                </div>
            )}

            {/* Action already submitted */}
            {alreadyActed && (
                <div className="border border-emerald-900/50 bg-emerald-950/20 p-3 text-center">
                    <span className="text-xs font-bold tracking-widest text-emerald-500 uppercase">
                        ✓ AÇÃO SUBMETIDA — AGUARDANDO RESOLUÇÃO
                    </span>
                    {alreadyActed.description && (
                        <p className="text-[10px] text-emerald-600 mt-1">{alreadyActed.description}</p>
                    )}
                </div>
            )}

            {/* Combat not active info */}
            {!isCombatActive && (
                <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                    Estação operacional — aguardando ordens de combate.
                </div>
            )}

            {/* PILOT UI */}
            {stationRole === 'pilot' && isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex flex-col gap-3">
                    <div className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">
                        SPD DA NAVE: {ship.stats.speed} | COMBUSTÍVEL: {ship.resources.fuel.current}/{ship.resources.fuel.max}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleEvade}
                            className="flex-1 bg-blue-950/50 hover:bg-blue-900 text-blue-400 border border-blue-800 px-4 py-3 font-bold tracking-widest flex items-center justify-center gap-2 transition-colors uppercase text-xs">
                            <Navigation size={14} /> MANOBRA EVASIVA
                        </button>
                    </div>
                </div>
            )}

            {/* GUNNER UI */}
            {stationRole === 'gunner' && isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex flex-col gap-3">
                    <div className="text-[10px] text-red-600 font-bold uppercase tracking-widest">
                        CBT DA NAVE: {ship.stats.combat} | MUNIÇÃO: {ship.resources.ammo.current}/{ship.resources.ammo.max}
                    </div>
                    <div className="flex flex-col gap-2">
                        {Object.entries(ship.weapons).map(([wId, weapon]) => (
                            <label key={wId} className={`flex items-center gap-3 px-3 py-2 border cursor-pointer transition ${selectedWeaponId === wId ? 'border-red-500 bg-red-950/30 text-red-300' : 'border-zinc-800 text-zinc-500 hover:border-red-800'} ${weapon.currentCooldown > 0 ? 'opacity-30 cursor-not-allowed' : ''}`}>
                                <input type="radio" name="weapon" value={wId} checked={selectedWeaponId === wId}
                                    onChange={() => setSelectedWeaponId(wId)} disabled={weapon.currentCooldown > 0} className="hidden" />
                                <Crosshair size={12} />
                                <span className="text-xs font-bold uppercase flex-1">{weapon.name}</span>
                                <span className="text-[9px] font-mono">{weapon.damage} | Custo:{weapon.ammoCost}</span>
                                {weapon.currentCooldown > 0 && <span className="text-[9px] text-amber-500">CD:{weapon.currentCooldown}</span>}
                            </label>
                        ))}
                    </div>
                    <button onClick={handleFire} disabled={!selectedWeaponId || ship.systems.weapons.status === 'offline'}
                        className="bg-red-900 hover:bg-red-800 text-red-100 px-4 py-3 font-bold tracking-widest flex items-center justify-center gap-2 transition-colors uppercase text-xs border border-red-700 disabled:opacity-30 disabled:cursor-not-allowed">
                        <Zap size={14} /> DISPARAR
                    </button>
                    {ship.systems.weapons.status === 'offline' && (
                        <span className="text-[10px] text-red-500 font-bold uppercase animate-pulse">⚠ ARMAMENTO OFFLINE</span>
                    )}
                </div>
            )}

            {/* ENGINEER UI */}
            {stationRole === 'engineer' && isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex flex-col gap-3">
                    <div className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">
                        INTELECTO DO OPERADOR: {character.stats.intellect}
                    </div>
                    <div className="flex flex-col gap-2">
                        {Object.entries(ship.systems).map(([key, sys]) => (
                            <div key={key} className="flex items-center justify-between bg-zinc-950 border border-amber-900/30 px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${sys.status === 'online' ? 'bg-emerald-500' : sys.status === 'damaged' ? 'bg-amber-500 animate-pulse' : 'bg-red-600 animate-pulse'}`} />
                                    <span className="text-xs font-bold uppercase text-amber-400">{SYSTEM_LABELS[key]}</span>
                                    <span className="text-[9px] text-amber-700 font-mono">{sys.integrity}%</span>
                                </div>
                                <button onClick={() => handleRepair(key)} disabled={sys.integrity >= 100}
                                    className="text-[10px] font-bold uppercase bg-amber-950/50 text-amber-400 border border-amber-800 px-3 py-1 hover:bg-amber-900 transition disabled:opacity-20 disabled:cursor-not-allowed">
                                    REPARAR
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SCIENCE UI */}
            {stationRole === 'science' && isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex flex-col gap-3">
                    <div className="text-[10px] text-purple-600 font-bold uppercase tracking-widest">
                        SNS DA NAVE: {ship.stats.sensors}
                    </div>

                    {/* Enemy Intel */}
                    {ship.enemies && Object.values(ship.enemies).map(enemy => (
                        <div key={enemy.id} className={`border px-3 py-2 ${enemy.revealed ? 'border-purple-700 bg-purple-950/20' : 'border-zinc-800 bg-zinc-900/50'}`}>
                            <div className="flex items-center gap-2">
                                <span>{enemy.icon}</span>
                                <span className="text-xs font-bold uppercase text-purple-400">{enemy.name}</span>
                                {enemy.revealed ? (
                                    <span className="text-[9px] text-purple-600 font-mono ml-auto">
                                        HP:{enemy.hp.current}/{enemy.hp.max} AR:{enemy.stats.armor} CBT:{enemy.stats.combat} SPD:{enemy.stats.speed}
                                    </span>
                                ) : (
                                    <span className="text-[9px] text-zinc-600 font-mono ml-auto">DADOS NÃO REVELADOS</span>
                                )}
                            </div>
                        </div>
                    ))}

                    <button onClick={handleScan} disabled={ship.systems.sensors.status === 'offline'}
                        className="bg-purple-900 hover:bg-purple-800 text-purple-100 px-4 py-3 font-bold tracking-widest flex items-center justify-center gap-2 transition-colors uppercase text-xs border border-purple-700 disabled:opacity-30 disabled:cursor-not-allowed">
                        <Radio size={14} /> ESCANEAR CONTATOS
                    </button>
                    {ship.systems.sensors.status === 'offline' && (
                        <span className="text-[10px] text-red-500 font-bold uppercase animate-pulse">⚠ SENSORES OFFLINE</span>
                    )}
                </div>
            )}
        </section>
    );
}
