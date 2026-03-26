"use client";

import { useState } from "react";
import { ShipState, ShipAction, StationRole } from "@/types/ship";
import { occupyStation, leaveStation, submitShipAction, rollDice, applyEnemyDamage, drainResource, repairSystem, revealEnemy } from "@/lib/shipDatabase";
import { pushLog } from "@/lib/database";
import { CharacterSheet } from "@/types/character";
import { Crosshair, Navigation, Wrench, Eye, Shield, Zap, Radio, X, Users, Star, ChevronRight } from "lucide-react";

interface StationPanelProps {
    roomId: string;
    ship: ShipState;
    playerId: string;
    character: CharacterSheet;
}

// --- Static station info ---
interface StationInfo {
    label: string;
    role: StationRole;
    icon: React.ReactNode;
    color: string;
    borderColor: string;
    bgColor: string;
    description: string;
    statUsed: string;
    skills: { name: string; bonus: string }[];
    actions: string[];
}

const STATION_INFO: Record<string, StationInfo> = {
    bridge: {
        label: 'PONTE DE COMANDO', role: 'pilot',
        icon: <Navigation size={16} />,
        color: 'text-blue-400', borderColor: 'border-blue-800', bgColor: 'bg-blue-950/20',
        description: 'Controle vetorial, evasão e manobras. O piloto é a linha entre a vida e o vácuo. Uma decisão errada aqui é a última.',
        statUsed: 'SPD da Nave',
        skills: [
            { name: 'Pilotagem', bonus: '+15' },
            { name: 'Espec. em Veículo', bonus: '+20' },
            { name: 'Espec. em Combate', bonus: '+10' },
        ],
        actions: ['Manobra Evasiva (queima 5 combustível)', 'Fuga Total (queima 20 combustível, +20 evasão)'],
    },
    tactical: {
        label: 'ESTAÇÃO TÁTICA', role: 'gunner',
        icon: <Crosshair size={16} />,
        color: 'text-red-400', borderColor: 'border-red-800', bgColor: 'bg-red-950/20',
        description: 'Seleção de armamento, controle de disparo e cálculo balístico. Cada projétil custa. Faça valer.',
        statUsed: 'CBT da Nave − AR do Inimigo',
        skills: [
            { name: 'Armas de Fogo', bonus: '+15' },
            { name: 'Tática', bonus: '+15' },
            { name: 'Espec. em Combate', bonus: '+20' },
        ],
        actions: ['Disparar Arma Selecionada', 'Disparo Concentrado (−10 chance, dano ×1.5)'],
    },
    engineering: {
        label: 'ENGENHARIA', role: 'engineer',
        icon: <Wrench size={16} />,
        color: 'text-amber-400', borderColor: 'border-amber-800', bgColor: 'bg-amber-950/20',
        description: 'Diagnóstico de falhas, reparo de subsistemas e redirecionamento de energia. Quando tudo está quebrado, engenheiros são deuses.',
        statUsed: 'Intelecto do Operador',
        skills: [
            { name: 'Engenharia', bonus: '+20' },
            { name: 'Reparos', bonus: '+10' },
            { name: 'Mecânica Industrial', bonus: '+15' },
            { name: 'Maquinário', bonus: '+10' },
        ],
        actions: ['Reparar Sistema (+20% integridade)', 'Redirecionar Energia (+15 a um sistema)'],
    },
    science: {
        label: 'ESTAÇÃO CIENTÍFICA', role: 'science',
        icon: <Eye size={16} />,
        color: 'text-purple-400', borderColor: 'border-purple-800', bgColor: 'bg-purple-950/20',
        description: 'Escaneamento tático, análise de ameaças e guerra eletrônica. Informação é a única arma que não custa munição.',
        statUsed: 'SNS da Nave',
        skills: [
            { name: 'Computação', bonus: '+10' },
            { name: 'Física', bonus: '+15' },
            { name: 'Hacking', bonus: '+15' },
            { name: 'Xenobiologia', bonus: '+10' },
        ],
        actions: ['Escanear Contatos (revela stats do inimigo)', 'Analisar Ponto Fraco (+10 ao próximo ataque)'],
    },
};

// Bonus description by crew count
const CREW_BONUS = (n: number) => {
    if (n <= 1) return null;
    if (n === 2) return { label: '+10 BÔNUS DE EQUIPE', color: 'text-emerald-400' };
    return { label: '+10 + VANTAGEM (2 dados)', color: 'text-yellow-400' };
};

export function StationPanel({ roomId, ship, playerId, character }: StationPanelProps) {
    const [selectedWeaponId, setSelectedWeaponId] = useState<string>("");
    const [rollInput, setRollInput] = useState("");
    const [confirmingStation, setConfirmingStation] = useState<string | null>(null);

    // Find which station this player is in
    const myStationEntry = Object.entries(ship.stations).find(
        ([, s]) => s.occupants && s.occupants[playerId]
    );
    const myStationKey = myStationEntry?.[0];
    const myStation = myStationEntry?.[1];

    const isCombatActive = ship.combat?.isActive;
    const isStationsPhase = ship.combat?.phase === 'stations';
    const alreadyActed = myStation?.role && ship.combat?.actionsThisRound?.[`${myStation.role}_${playerId}`];
    const myOccupants = myStation?.occupants ? Object.values(myStation.occupants) : [];
    const crewBonus = CREW_BONUS(myOccupants.length);

    // Effective roll bonus from crew
    const getCrewBonusValue = () => myOccupants.length >= 2 ? 10 : 0;
    const hasAdvantage = () => myOccupants.length >= 3;

    // d100 roll with crew bonus + optional advantage
    const doRoll = (baseTarget: number) => {
        const bonus = getCrewBonusValue();
        const target = Math.min(95, baseTarget + bonus);
        const useInput = rollInput.trim();
        let roll: number;
        if (useInput) {
            roll = parseInt(useInput);
            if (isNaN(roll)) roll = Math.floor(Math.random() * 100);
        } else {
            roll = Math.floor(Math.random() * 100);
        }
        // Advantage: roll again, take best
        let finalRoll = roll;
        if (hasAdvantage() && !useInput) {
            const roll2 = Math.floor(Math.random() * 100);
            finalRoll = Math.min(roll, roll2); // lower = better in d100
        }
        const rollStr = finalRoll.toString().padStart(2, '0');
        const isDouble = rollStr[0] === rollStr[1];
        const isAutoFail = finalRoll >= 90;
        const isHit = !isAutoFail && finalRoll <= target;
        const isCritical = isDouble;
        setRollInput("");
        return { roll: finalRoll, isHit, isCritical, isAutoFail, target };
    };

    // Action key includes playerId for multi-occupant tracking
    const actionKey = `${myStation?.role}_${playerId}`;

    // --- PILOT ACTIONS ---
    const handleEvade = async () => {
        const { roll, isHit, isCritical, target } = doRoll(ship.stats.speed);
        const action: ShipAction = {
            type: 'evade', stationRole: 'pilot', playerId, playerName: character.name,
            roll, targetValue: target,
            result: isHit ? (isCritical ? 'critical_success' : 'success') : (isCritical ? 'critical_failure' : 'failure'),
            description: isHit ? `Manobra evasiva bem-sucedida${isCritical ? ' (CRÍTICO!)' : ''}` : 'Evasão falhou',
        };
        await submitShipAction(roomId, actionKey, action);
        await pushLog(roomId, {
            timestamp: Date.now(), playerName: character.name, playerId,
            statName: `MANOBRA EVASIVA (alvo: ≤${target}${getCrewBonusValue() > 0 ? ` +${getCrewBonusValue()}eq` : ''})`,
            statValue: target, roll, result: isHit ? 'Ship Evade' : 'Ship Damage',
        });
        if (isHit) drainResource(roomId, 'fuel', 5);
    };

    // --- GUNNER ACTIONS ---
    const handleFire = async () => {
        if (!selectedWeaponId) return;
        const weapon = ship.weapons[selectedWeaponId];
        if (!weapon || weapon.currentCooldown > 0 || ship.resources.ammo.current < weapon.ammoCost) return;
        const enemies = ship.enemies ? Object.values(ship.enemies) : [];
        const primaryEnemy = enemies[0];
        const enemyAR = primaryEnemy ? primaryEnemy.stats.armor : 0;
        const baseTarget = Math.max(1, ship.stats.combat - Math.floor(enemyAR / 5));
        const { roll, isHit, isCritical, target } = doRoll(baseTarget);
        let damage = 0;
        if (isHit) {
            damage = rollDice(weapon.damage);
            if (isCritical) damage = Math.floor(damage * 1.5);
            if (primaryEnemy) await applyEnemyDamage(roomId, primaryEnemy.id, damage);
        }
        await drainResource(roomId, 'ammo', weapon.ammoCost);
        const action: ShipAction = {
            type: 'fire', stationRole: 'gunner', playerId, playerName: character.name,
            weaponId: selectedWeaponId, roll, targetValue: target,
            result: isHit ? (isCritical ? 'critical_success' : 'success') : (isCritical ? 'critical_failure' : 'failure'),
            description: isHit ? `${weapon.name}: ${damage} dano${isCritical ? ' (CRÍTICO!)' : ''}` : `${weapon.name}: Disparo perdido`,
        };
        await submitShipAction(roomId, actionKey, action);
        await pushLog(roomId, {
            timestamp: Date.now(), playerName: character.name, playerId,
            statName: `DISPARO ${weapon.name.toUpperCase()} (alvo: ≤${target})`, statValue: damage, roll,
            result: isHit ? 'Ship Fire' : 'Ship Damage',
        });
    };

    // --- ENGINEER ACTIONS ---
    const handleRepair = async (systemKey: string) => {
        const { roll, isHit, isCritical, target } = doRoll(character.stats.intellect);
        const repairAmount = isHit ? (isCritical ? 50 : 25) : 0;
        if (isHit) await repairSystem(roomId, systemKey, repairAmount);
        const action: ShipAction = {
            type: 'repair', stationRole: 'engineer', playerId, playerName: character.name,
            targetSystem: systemKey, roll, targetValue: target,
            result: isHit ? (isCritical ? 'critical_success' : 'success') : (isCritical ? 'critical_failure' : 'failure'),
            description: isHit ? `Reparo ${systemKey}: +${repairAmount}%` : 'Reparo falhou',
        };
        await submitShipAction(roomId, actionKey, action);
        await pushLog(roomId, {
            timestamp: Date.now(), playerName: character.name, playerId,
            statName: `REPARO ${systemKey.toUpperCase()} (alvo: ≤${target})`, statValue: repairAmount, roll,
            result: isHit ? 'Ship Repair' : 'Ship Damage',
        });
    };

    // --- SCIENCE ACTIONS ---
    const handleScan = async () => {
        const { roll, isHit, isCritical, target } = doRoll(ship.stats.sensors);
        if (isHit && ship.enemies) {
            const unrevealed = Object.values(ship.enemies).filter(e => !e.revealed);
            if (unrevealed.length > 0) await revealEnemy(roomId, unrevealed[0].id);
        }
        const action: ShipAction = {
            type: 'scan', stationRole: 'science', playerId, playerName: character.name,
            roll, targetValue: target,
            result: isHit ? (isCritical ? 'critical_success' : 'success') : (isCritical ? 'critical_failure' : 'failure'),
            description: isHit ? `Scan completo${isCritical ? ' (dados completos!)' : ''}` : 'Interferência — scan falhou',
        };
        await submitShipAction(roomId, actionKey, action);
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

    // =============================================================
    // 1. CONFIRMATION MODAL
    // =============================================================
    if (confirmingStation) {
        const info = STATION_INFO[confirmingStation];
        const station = ship.stations[confirmingStation];
        const existingOccupants = station?.occupants ? Object.values(station.occupants) : [];
        const futureCount = existingOccupants.length + 1;
        const futureBonus = CREW_BONUS(futureCount);

        return (
            <div className={`border-2 ${info.borderColor} ${info.bgColor} p-5 flex flex-col gap-4 relative`}>
                <div className="flex justify-between items-start">
                    <h3 className={`text-lg font-bold tracking-[0.15em] uppercase flex items-center gap-2 ${info.color}`}>
                        {info.icon} {info.label}
                    </h3>
                    <button onClick={() => setConfirmingStation(null)}
                        className="text-zinc-600 hover:text-zinc-400 transition">
                        <X size={18} />
                    </button>
                </div>

                <p className="text-sm text-zinc-400 leading-relaxed border-l-2 border-zinc-700 pl-3 italic">
                    {info.description}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Stats & Skills */}
                    <div className="flex flex-col gap-3">
                        <div>
                            <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-500">ATRIBUTO PRINCIPAL</span>
                            <div className={`mt-1 text-sm font-bold ${info.color}`}>{info.statUsed}</div>
                        </div>
                        <div>
                            <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-500">SKILLS COM BÔNUS</span>
                            <div className="flex flex-col gap-1 mt-1">
                                {info.skills.map(s => (
                                    <div key={s.name} className="flex items-center justify-between bg-black/30 px-2 py-1">
                                        <span className="text-xs text-zinc-300">{s.name}</span>
                                        <span className={`text-xs font-bold font-mono ${info.color}`}>{s.bonus}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-500">AÇÕES DISPONÍVEIS</span>
                            <div className="flex flex-col gap-1 mt-1">
                                {info.actions.map(a => (
                                    <div key={a} className="flex items-center gap-2 text-xs text-zinc-400">
                                        <ChevronRight size={10} className={info.color} />{a}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Crew info */}
                    <div className="flex flex-col gap-3">
                        <div>
                            <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-500">TRIPULANTES ATUAIS</span>
                            {existingOccupants.length === 0 ? (
                                <div className="mt-1 text-xs text-zinc-600 italic">Posto vago</div>
                            ) : (
                                <div className="flex flex-col gap-1 mt-1">
                                    {existingOccupants.map(o => (
                                        <div key={o.id} className="flex items-center gap-2 bg-black/30 px-2 py-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <span className="text-xs text-zinc-300">{o.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border p-3 flex flex-col gap-1" style={{ borderColor: futureBonus ? '#10b981' : '#1a3a3a', background: futureBonus ? '#05201520' : 'transparent' }}>
                            <div className="flex items-center gap-2">
                                <Users size={12} className="text-zinc-500" />
                                <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-500">
                                    COM VOCÊ: {futureCount} TRIPULANTE{futureCount !== 1 ? 'S' : ''}
                                </span>
                            </div>
                            {futureBonus ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <Star size={11} className="text-emerald-400" />
                                    <span className={`text-sm font-bold ${futureBonus.color}`}>{futureBonus.label}</span>
                                </div>
                            ) : (
                                <div className="text-xs text-zinc-600 mt-1">Sem bônus de equipe</div>
                            )}
                            {futureCount === 2 && (
                                <div className="text-[9px] text-zinc-600 mt-0.5">3 tripulantes = Vantagem em todas as rolagens</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-1">
                    <button
                        onClick={() => {
                            occupyStation(roomId, confirmingStation, playerId, character.name);
                            setConfirmingStation(null);
                        }}
                        className={`flex-1 py-3 font-bold tracking-widest uppercase text-sm border ${info.borderColor} ${info.color} ${info.bgColor} hover:opacity-80 transition flex items-center justify-center gap-2`}
                    >
                        {info.icon} CONFIRMAR POSTO
                    </button>
                    <button
                        onClick={() => setConfirmingStation(null)}
                        className="px-6 py-3 font-bold tracking-widest uppercase text-xs border border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 transition"
                    >
                        VOLTAR
                    </button>
                </div>
            </div>
        );
    }

    // =============================================================
    // 2. STATION SELECTION UI
    // =============================================================
    if (!myStationKey) {
        return (
            <section className="border border-cyan-900/50 bg-black/20 p-4 flex flex-col gap-3">
                <h3 className="text-sm font-bold tracking-widest text-cyan-500 uppercase flex items-center gap-2">
                    <Shield size={16} /> SELECIONE SUA ESTAÇÃO DE BORDO
                </h3>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Clique em um posto para ver detalhes. Múltiplos tripulantes conferem bônus.</p>
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(ship.stations).map(([key, station]) => {
                        const info = STATION_INFO[key];
                        const occupants = station.occupants ? Object.values(station.occupants) : [];
                        const alreadyHere = occupants.some(o => o.id === playerId);
                        const bonus = CREW_BONUS(occupants.length + 1);
                        return (
                            <button
                                key={key}
                                onClick={() => setConfirmingStation(key)}
                                className={`flex flex-col gap-1.5 p-3 border text-left transition group ${alreadyHere ? 'opacity-40 cursor-not-allowed' : `${info.borderColor} ${info.bgColor} hover:opacity-80`}`}
                                disabled={alreadyHere}
                            >
                                <div className={`flex items-center gap-2 font-bold tracking-widest uppercase text-xs ${info.color}`}>
                                    {info.icon} {info.label}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] text-zinc-500 font-mono">
                                        {occupants.length > 0
                                            ? occupants.map(o => o.name).join(', ')
                                            : 'VAGO'}
                                    </span>
                                    {bonus && (
                                        <span className={`text-[9px] font-bold ${bonus.color}`}>{bonus.label}</span>
                                    )}
                                </div>
                                {occupants.length > 0 && occupants.length < 3 && (
                                    <span className="text-[8px] text-emerald-700">+{3 - occupants.length} para vantagem</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </section>
        );
    }

    // =============================================================
    // 3. STATION ACTIVE UI
    // =============================================================
    const stationInfo = STATION_INFO[myStationKey];
    const stationRole = myStation?.role || 'unassigned';

    return (
        <section className={`border ${stationInfo.borderColor} ${stationInfo.bgColor} p-4 flex flex-col gap-3`}>
            <div className="flex justify-between items-center">
                <h3 className={`text-sm font-bold tracking-widest uppercase flex items-center gap-2 ${stationInfo.color}`}>
                    {stationInfo.icon} {stationInfo.label}
                </h3>
                <button onClick={() => leaveStation(roomId, myStationKey, playerId)}
                    className="text-[10px] text-zinc-600 hover:text-zinc-400 uppercase tracking-widest font-bold transition flex items-center gap-1">
                    <X size={10} /> ABANDONAR POSTO
                </button>
            </div>

            {/* Crew bonus banner */}
            {crewBonus && (
                <div className="flex items-center gap-2 bg-emerald-950/30 border border-emerald-900/50 px-3 py-1.5">
                    <Star size={11} className="text-emerald-400 flex-shrink-0" />
                    <span className={`text-xs font-bold tracking-widest uppercase ${crewBonus.color}`}>{crewBonus.label} ATIVO</span>
                    <span className="text-[9px] text-zinc-600 ml-auto">
                        {myOccupants.map(o => o.name).join(' + ')}
                    </span>
                </div>
            )}

            {/* D100 manual input */}
            {isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex items-center gap-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">D100:</label>
                    <input type="number" min="0" max="99" placeholder="RNG virtual" value={rollInput}
                        onChange={e => setRollInput(e.target.value)}
                        className="bg-zinc-950 border border-zinc-700 text-zinc-300 p-1.5 text-xs outline-none w-24 text-center" />
                    {hasAdvantage() && (
                        <span className="text-[9px] text-yellow-500 font-bold uppercase">VANTAGEM ATIVA</span>
                    )}
                </div>
            )}

            {/* Action submitted */}
            {alreadyActed && (
                <div className="border border-emerald-900/50 bg-emerald-950/20 p-3 text-center">
                    <div className="text-xs font-bold tracking-widest text-emerald-500 uppercase">
                        ✓ AÇÃO SUBMETIDA — AGUARDANDO RESOLUÇÃO
                    </div>
                    {(alreadyActed as ShipAction).description && (
                        <p className="text-[10px] text-emerald-600 mt-1">{(alreadyActed as ShipAction).description}</p>
                    )}
                </div>
            )}

            {/* Not in combat */}
            {!isCombatActive && (
                <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold px-1">
                    Estação operacional — aguardando ordens de combate.
                </div>
            )}

            {/* PILOT */}
            {stationRole === 'pilot' && isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex flex-col gap-2">
                    <div className="text-[10px] text-blue-700 font-bold uppercase tracking-widest">
                        ALVO: SPD {ship.stats.speed}{getCrewBonusValue() > 0 ? ` +${getCrewBonusValue()} = ${ship.stats.speed + getCrewBonusValue()}` : ''} | COMB: {ship.resources.fuel.current}
                    </div>
                    <button onClick={handleEvade}
                        className="bg-blue-950/50 hover:bg-blue-900 text-blue-400 border border-blue-800 px-4 py-3 font-bold tracking-widest flex items-center justify-center gap-2 transition uppercase text-xs">
                        <Navigation size={14} /> MANOBRA EVASIVA
                    </button>
                </div>
            )}

            {/* GUNNER */}
            {stationRole === 'gunner' && isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex flex-col gap-2">
                    <div className="text-[10px] text-red-700 font-bold uppercase tracking-widest">
                        CBT {ship.stats.combat} | MUN: {ship.resources.ammo.current}
                    </div>
                    <div className="flex flex-col gap-1">
                        {Object.entries(ship.weapons).map(([wId, weapon]) => (
                            <label key={wId}
                                className={`flex items-center gap-3 px-3 py-2 border cursor-pointer transition ${selectedWeaponId === wId ? 'border-red-500 bg-red-950/30 text-red-300' : 'border-zinc-800 text-zinc-500 hover:border-red-800'} ${weapon.currentCooldown > 0 ? 'opacity-30 cursor-not-allowed' : ''}`}>
                                <input type="radio" name="weapon" value={wId} checked={selectedWeaponId === wId}
                                    onChange={() => setSelectedWeaponId(wId)} disabled={weapon.currentCooldown > 0} className="hidden" />
                                <Crosshair size={12} />
                                <span className="text-xs font-bold uppercase flex-1">{weapon.name}</span>
                                <span className="text-[9px] font-mono">{weapon.damage} • {weapon.ammoCost}mun</span>
                                {weapon.currentCooldown > 0 && <span className="text-[9px] text-amber-500">CD:{weapon.currentCooldown}</span>}
                            </label>
                        ))}
                    </div>
                    <button onClick={handleFire} disabled={!selectedWeaponId || ship.systems.weapons.status === 'offline'}
                        className="bg-red-900 hover:bg-red-800 text-red-100 px-4 py-3 font-bold tracking-widest flex items-center justify-center gap-2 transition uppercase text-xs border border-red-700 disabled:opacity-30 disabled:cursor-not-allowed">
                        <Zap size={14} /> DISPARAR
                    </button>
                    {ship.systems.weapons.status === 'offline' && (
                        <span className="text-[10px] text-red-500 font-bold uppercase animate-pulse">⚠ ARMAMENTO OFFLINE</span>
                    )}
                </div>
            )}

            {/* ENGINEER */}
            {stationRole === 'engineer' && isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex flex-col gap-2">
                    <div className="text-[10px] text-amber-700 font-bold uppercase tracking-widest">
                        INTELECTO: {character.stats.intellect}{getCrewBonusValue() > 0 ? ` +${getCrewBonusValue()} = ${character.stats.intellect + getCrewBonusValue()}` : ''}
                    </div>
                    {Object.entries(ship.systems).map(([key, sys]) => (
                        <div key={key} className="flex items-center justify-between bg-black/30 border border-amber-900/20 px-3 py-2">
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
            )}

            {/* SCIENCE */}
            {stationRole === 'science' && isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex flex-col gap-2">
                    <div className="text-[10px] text-purple-700 font-bold uppercase tracking-widest">
                        SNS {ship.stats.sensors}{getCrewBonusValue() > 0 ? ` +${getCrewBonusValue()} = ${ship.stats.sensors + getCrewBonusValue()}` : ''}
                    </div>
                    {ship.enemies && Object.values(ship.enemies).map(enemy => (
                        <div key={enemy.id} className={`border px-3 py-2 ${enemy.revealed ? 'border-purple-700 bg-purple-950/20' : 'border-zinc-800 bg-zinc-900/30'}`}>
                            <div className="flex items-center gap-2">
                                <span>{enemy.icon}</span>
                                <span className="text-xs font-bold uppercase text-purple-400 flex-1">{enemy.name}</span>
                                {enemy.revealed ? (
                                    <span className="text-[9px] text-purple-500 font-mono">
                                        HP:{enemy.hp.current}/{enemy.hp.max} AR:{enemy.stats.armor} CBT:{enemy.stats.combat}
                                    </span>
                                ) : (
                                    <span className="text-[9px] text-zinc-600">NÃO REVELADO</span>
                                )}
                            </div>
                        </div>
                    ))}
                    <button onClick={handleScan} disabled={ship.systems.sensors.status === 'offline'}
                        className="bg-purple-900 hover:bg-purple-800 text-purple-100 px-4 py-3 font-bold tracking-widest flex items-center justify-center gap-2 transition uppercase text-xs border border-purple-700 disabled:opacity-30 disabled:cursor-not-allowed">
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
