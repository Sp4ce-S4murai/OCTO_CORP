"use client";

import { useState } from "react";
import { ShipState, ShipAction, StationRole, StationOccupant } from "@/types/ship";
import { occupyStation, leaveStation, submitShipAction, rollDice, applyEnemyDamage, drainResource, repairSystem, revealEnemy } from "@/lib/shipDatabase";
import { pushLog } from "@/lib/database";
import { CharacterSheet } from "@/types/character";
import { Crosshair, Navigation, Wrench, Eye, Shield, Zap, Radio, X, ChevronRight, Users } from "lucide-react";

interface StationPanelProps {
    roomId: string;
    ship: ShipState;
    playerId: string;
    character: CharacterSheet;
}

// --- Station metadata including preview info and skills/bonuses ---
const STATION_META: Record<string, {
    label: string;
    role: StationRole;
    icon: React.ReactNode;
    color: string;
    borderColor: string;
    bgColor: string;
    description: string;
    primaryStat: string;
    primaryStatKey: string; // key in ship.stats or 'character.stat'
    primaryStatSource: 'ship' | 'character';
    characterStatKey?: string; // keyof CharacterSheet.stats
    skills: Array<{ name: string; bonus: string; description: string }>;
    crewBonuses: Array<{ count: number; label: string; effect: string }>;
}> = {
    bridge: {
        label: 'PONTE DE COMANDO', role: 'pilot',
        icon: <Navigation size={18} />, color: 'text-blue-400', borderColor: 'border-blue-800', bgColor: 'bg-blue-950/20',
        description: 'O Piloto controla a movimentação da nave, evasão de ataques e manobras táticas. A velocidade da nave determina sua capacidade de esquivar.',
        primaryStat: 'SPD', primaryStatKey: 'speed', primaryStatSource: 'ship',
        skills: [
            { name: 'Pilotagem', bonus: '+15', description: 'Rolagem: d100 ≤ SPD da nave. Sucesso = evasão completa' },
            { name: 'Atléticos', bonus: '+0', description: 'Sem bônus, mas pode ser usado como base' },
        ],
        crewBonuses: [
            { count: 2, label: 'CO-PILOTO', effect: '+10 ao alvo de evasão (+10 SPD efetivo)' },
            { count: 3, label: 'EQUIPE DE VÔO', effect: 'Pode rolar DUAS vezes e escolher o melhor resultado' },
        ],
    },
    tactical: {
        label: 'ESTAÇÃO TÁTICA', role: 'gunner',
        icon: <Crosshair size={18} />, color: 'text-red-400', borderColor: 'border-red-800', bgColor: 'bg-red-950/20',
        description: 'O Artilheiro opera os sistemas de armamento da nave. O atributo CBT da nave é o alvo de d100 para acerto, modificado pela Armadura (AR) inimiga.',
        primaryStat: 'CBT', primaryStatKey: 'combat', primaryStatSource: 'ship',
        skills: [
            { name: 'Armas de Fogo', bonus: '+15', description: 'Rolagem: d100 ≤ CBT - (AR inimiga/5). Acerto = rolar dano' },
            { name: 'Tática e Estratégia', bonus: '+15', description: 'Bônus de habilidade aplicado ao alvo da rolagem de acerto' },
        ],
        crewBonuses: [
            { count: 2, label: 'CARREGADOR', effect: 'Remove penalidade de cooldown em 1 rodada extra' },
            { count: 3, label: 'SEÇÃO DE ARTILHARIA', effect: 'Disparo duplo: duas armas diferentes no mesmo turno' },
        ],
    },
    engineering: {
        label: 'ENGENHARIA', role: 'engineer',
        icon: <Wrench size={18} />, color: 'text-amber-400', borderColor: 'border-amber-800', bgColor: 'bg-amber-950/20',
        description: 'O Engenheiro repara subsistemas danificados e redireciona energia. Usa o Intelecto do personagem para rolagens de reparo.',
        primaryStat: 'INTELECTO', primaryStatKey: 'intellect', primaryStatSource: 'character',
        characterStatKey: 'intellect',
        skills: [
            { name: 'Engenharia', bonus: '+20', description: 'Rolagem: d100 ≤ Intelecto. Reparo de +20% integridade' },
            { name: 'Reparos', bonus: '+10', description: 'Base para manutenção de emergência sob pressão' },
            { name: 'Computação', bonus: '+10', description: 'Redirecionar energia entre sistemas' },
        ],
        crewBonuses: [
            { count: 2, label: 'ASSISTENTE', effect: 'Reparo bem-sucedido devolve +40% ao invés de +20%' },
            { count: 3, label: 'EQUIPE DE MANUTENÇÃO', effect: 'Pode reparar DOIS sistemas em um único turno' },
        ],
    },
    science: {
        label: 'ESTAÇÃO CIENTÍFICA', role: 'science',
        icon: <Eye size={18} />, color: 'text-purple-400', borderColor: 'border-purple-800', bgColor: 'bg-purple-950/20',
        description: 'O Cientista opera os sensores e analisa ameaças. Revelar dados inimigos dá vantagem tática a toda a equipe.',
        primaryStat: 'SNS', primaryStatKey: 'sensors', primaryStatSource: 'ship',
        skills: [
            { name: 'Computação', bonus: '+10', description: 'Rolagem: d100 ≤ SNS da nave. Sucesso revela dados do inimigo' },
            { name: 'Física Xenobiologia', bonus: '+15', description: 'Análise de Ponto Fraco: -5 AR do inimigo próxima rodada' },
        ],
        crewBonuses: [
            { count: 2, label: 'OPERADOR DE SENSORES', effect: 'Scan automático sem rolagem se SNS > 40' },
            { count: 3, label: 'EQUIPE CIENTÍFICA', effect: 'Revela TODOS os dados inimigos + reduz AR em 5 na próxima rodada' },
        ],
    },
};

// --- Station Preview Modal ---
function StationModal({
    stationKey, ship, character, playerId, onConfirm, onCancel
}: {
    stationKey: string;
    ship: ShipState;
    character: CharacterSheet;
    playerId: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const meta = STATION_META[stationKey];
    if (!meta) return null;

    const station = (ship.stations || {})[stationKey];
    const occupants = station?.occupants ? Object.values(station.occupants) : [];
    const isAlreadyHere = occupants.some(o => o.playerId === playerId);
    const crewCount = occupants.length + (isAlreadyHere ? 0 : 1); // projected count after joining
    const applicableBonus = meta.crewBonuses.filter(b => b.count <= crewCount).slice(-1)[0];

    const primaryValue = meta.primaryStatSource === 'ship'
        ? ship.stats[meta.primaryStatKey as keyof typeof ship.stats]
        : character.stats[meta.characterStatKey as keyof typeof character.stats] ?? 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className={`w-full max-w-lg border-2 ${meta.borderColor} bg-zinc-950 flex flex-col`}>
                {/* Header */}
                <div className={`flex items-center justify-between px-5 py-3 ${meta.bgColor} border-b ${meta.borderColor}`}>
                    <div className="flex items-center gap-2">
                        <span className={meta.color}>{meta.icon}</span>
                        <h3 className={`text-sm font-bold tracking-[0.2em] uppercase ${meta.color}`}>{meta.label}</h3>
                    </div>
                    <button onClick={onCancel} className="text-zinc-600 hover:text-zinc-300 transition"><X size={18} /></button>
                </div>

                <div className="p-5 flex flex-col gap-5">
                    {/* Description */}
                    <p className="text-xs text-zinc-400 leading-relaxed">{meta.description}</p>

                    {/* Primary Stat */}
                    <div className={`flex items-center gap-4 border ${meta.borderColor} ${meta.bgColor} p-3`}>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Atributo Base</span>
                            <span className={`text-3xl font-bold font-mono ${meta.color}`}>{primaryValue}</span>
                            <span className="text-[9px] text-zinc-600 uppercase">{meta.primaryStat}</span>
                        </div>
                        <div className="flex-1 text-[10px] text-zinc-500">
                            <span className="font-bold text-zinc-400">Alvo da rolagem:</span> d100 ≤ {primaryValue}
                            <br />Duplos e rolagem ≥ 90 são especiais.
                        </div>
                    </div>

                    {/* Skills */}
                    <div>
                        <h4 className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 mb-2">HABILIDADES COM BÔNUS</h4>
                        <div className="flex flex-col gap-1.5">
                            {meta.skills.map(skill => (
                                <div key={skill.name} className="flex items-start gap-3 bg-zinc-900 border border-zinc-800 px-3 py-2">
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <span className={`text-sm font-bold font-mono ${meta.color}`}>{skill.bonus}</span>
                                        <span className="text-[10px] font-bold text-zinc-300 uppercase">{skill.name}</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-600 leading-tight flex-1">{skill.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Crew Bonuses */}
                    <div>
                        <h4 className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 mb-2 flex items-center gap-1.5">
                            <Users size={11} /> BÔNUS POR TRIPULAÇÃO NO POSTO
                        </h4>
                        <div className="flex flex-col gap-1.5">
                            {meta.crewBonuses.map(bonus => {
                                const willActivate = crewCount >= bonus.count;
                                return (
                                    <div key={bonus.count} className={`flex gap-3 px-3 py-2 border ${willActivate ? `${meta.borderColor} ${meta.bgColor}` : 'border-zinc-800 bg-zinc-900/30 opacity-50'}`}>
                                        <div className="flex-shrink-0">
                                            <span className={`text-[10px] font-bold uppercase ${willActivate ? meta.color : 'text-zinc-600'}`}>
                                                {bonus.count}+ {bonus.label}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-zinc-400 flex-1">{bonus.effect}</span>
                                        {willActivate && <ChevronRight size={12} className={`flex-shrink-0 ${meta.color}`} />}
                                    </div>
                                );
                            })}
                        </div>
                        {applicableBonus && (
                            <div className={`mt-2 text-[10px] font-bold ${meta.color} uppercase tracking-widest`}>
                                ✓ Bônus ativo ao entrar: {applicableBonus.label}
                            </div>
                        )}
                    </div>

                    {/* Current occupants */}
                    {occupants.length > 0 && (
                        <div>
                            <h4 className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 mb-1.5">JÁ NO POSTO</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {occupants.map(occ => (
                                    <span key={occ.playerId} className={`text-[10px] font-bold uppercase px-2 py-1 border ${meta.borderColor} ${meta.color}`}>
                                        {occ.playerName}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-5 pb-5">
                    <button onClick={onCancel} className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-700 py-2.5 text-xs font-bold uppercase tracking-widest transition">
                        CANCELAR
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isAlreadyHere}
                        className={`flex-2 flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition border disabled:opacity-40 disabled:cursor-not-allowed ${meta.borderColor} ${meta.bgColor} ${meta.color} hover:opacity-90`}
                    >
                        {isAlreadyHere ? 'JÁ ESTÁ AQUI' : 'ASSUMIR POSTO'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Main StationPanel ---
export function StationPanel({ roomId, ship, playerId, character }: StationPanelProps) {
    const [previewStation, setPreviewStation] = useState<string | null>(null);
    const [selectedWeaponId, setSelectedWeaponId] = useState<string>("");
    const [rollInput, setRollInput] = useState("");

    // Find which station this player occupies
    const myStationEntry = Object.entries(ship.stations || {}).find(([, s]) => s.occupants && s.occupants[playerId]);
    const myStationKey = myStationEntry?.[0];
    const myStation = myStationEntry?.[1];
    const myOccupant = myStation?.occupants?.[playerId];

    const isCombatActive = ship.combat?.isActive;
    const isStationsPhase = ship.combat?.phase === 'stations';
    const alreadyActed = myOccupant?.hasActed;

    // Crew count at current station (for bonus display)
    const crewAtMyStation = myStation?.occupants ? Object.values(myStation.occupants).length : 0;

    const getSkillBonus = (skillNames: string[]): number => {
        let maxBonus = 0;
        const allSkills = [
            ...Object.values(character?.skills?.trained || {}),
            ...Object.values(character?.skills?.expert || {}),
            ...Object.values(character?.skills?.master || {})
        ];
        for (const skill of allSkills) {
            if (skillNames.includes(skill.name)) {
                const match = skill.tier.match(/\+(\d+)/);
                const bonus = match ? parseInt(match[1]) : 10;
                if (bonus > maxBonus) maxBonus = bonus;
            }
        }
        return maxBonus;
    };

    const pilotSkill = getSkillBonus(['Pilotagem', 'Atléticos']);
    const gunnerSkill = getSkillBonus(['Armas de Fogo', 'Tática e Estratégia']);
    const engineerSkill = getSkillBonus(['Engenharia', 'Reparos', 'Computação']);
    const scienceSkill = getSkillBonus(['Computação', 'Física Xenobiologia']);

    const enemiesOut = ship.enemies ? Object.values(ship.enemies) : [];
    const primaryEnemy = enemiesOut[0];
    const enemyAR = primaryEnemy ? primaryEnemy.stats.armor : 0;

    const pilotTarget = Math.min(99, ship.stats.speed + pilotSkill + (crewAtMyStation >= 2 ? 10 : 0));
    const gunnerTarget = Math.max(1, ship.stats.combat + gunnerSkill - Math.floor(enemyAR / 5));
    const engineerTarget = Math.min(99, character.stats.intellect + engineerSkill);
    const scienceTarget = Math.min(99, ship.stats.sensors + scienceSkill);


    // d100 roll helper
    const doRoll = (targetValue: number) => {
        const useInput = rollInput.trim();
        let roll = useInput ? (parseInt(useInput) || Math.floor(Math.random() * 100)) : Math.floor(Math.random() * 100);
        const rollStr = roll.toString().padStart(2, '0');
        const isDouble = rollStr[0] === rollStr[1];
        const isAutoFail = roll >= 90;
        const isHit = !isAutoFail && roll <= targetValue;
        setRollInput("");
        return { roll, isHit, isCritical: isDouble, isAutoFail };
    };

    const handleConfirmStation = async (stationKey: string) => {
        await occupyStation(roomId, stationKey, playerId, character.name);
        setPreviewStation(null);
    };

    // --- PILOT ---
    const handleEvade = async () => {
        const target = pilotTarget;
        let { roll, isHit, isCritical } = doRoll(target);
        // If 3+ crew: roll again and take best
        if (crewAtMyStation >= 3) {
            const r2 = doRoll(target);
            if (r2.isHit && !isHit) { roll = r2.roll; isHit = r2.isHit; isCritical = r2.isCritical; }
        }
        const result = isHit ? (isCritical ? 'critical_success' : 'success') : (isCritical ? 'critical_failure' : 'failure');
        const action: ShipAction = { type: 'evade', stationRole: 'pilot', playerId, playerName: character.name, roll, targetValue: target, result, description: isHit ? 'Evasão bem-sucedida' : 'Evasão falhou' };
        await submitShipAction(roomId, myStationKey!, 'pilot', action, playerId);
        await pushLog(roomId, { timestamp: Date.now(), playerName: character.name, playerId, statName: `EVASÃO (alvo: ≤${target})`, statValue: target, roll, result: isHit ? 'Ship Evade' : 'Ship Damage' });
        if (isHit) drainResource(roomId, 'fuel', 5);
    };

    // --- GUNNER ---
    const handleFire = async () => {
        if (!selectedWeaponId) return;
        const weapon = ship.weapons[selectedWeaponId];
        if (!weapon || weapon.currentCooldown > 0) return;
        if (ship.resources.ammo.current < weapon.ammoCost) return;
        const target = gunnerTarget;
        const { roll, isHit, isCritical } = doRoll(target);
        const result = isHit ? (isCritical ? 'critical_success' : 'success') : (isCritical ? 'critical_failure' : 'failure');
        let damage = 0;
        if (isHit) {
            damage = rollDice(weapon.damage);
            if (isCritical) damage = Math.floor(damage * 1.5);
            if (primaryEnemy) await applyEnemyDamage(roomId, primaryEnemy.id, damage);
        }
        await drainResource(roomId, 'ammo', weapon.ammoCost);
        const action: ShipAction = { type: 'fire', stationRole: 'gunner', playerId, playerName: character.name, weaponId: selectedWeaponId, roll, targetValue: target, result, description: isHit ? `${weapon.name}: ${damage} dano` : `${weapon.name}: Disparo perdido` };
        await submitShipAction(roomId, myStationKey!, 'gunner', action, playerId);
        await pushLog(roomId, { timestamp: Date.now(), playerName: character.name, playerId, statName: `DISPARO ${weapon.name.toUpperCase()} (alvo: ≤${target})`, statValue: damage, roll, result: isHit ? 'Ship Fire' : 'Ship Damage' });
    };

    // --- ENGINEER ---
    const handleRepair = async (systemKey: string) => {
        const target = engineerTarget;
        const { roll, isHit, isCritical } = doRoll(target);
        const baseRepair = crewAtMyStation >= 2 ? 40 : 20;
        const repairAmount = isHit ? (isCritical ? baseRepair * 2 : baseRepair) : 0;
        if (isHit) await repairSystem(roomId, systemKey, repairAmount);
        const action: ShipAction = { type: 'repair', stationRole: 'engineer', playerId, playerName: character.name, targetSystem: systemKey, roll, targetValue: target, result: isHit ? (isCritical ? 'critical_success' : 'success') : (isCritical ? 'critical_failure' : 'failure'), description: isHit ? `Reparo: +${repairAmount}% integridade` : 'Reparo falhou' };
        await submitShipAction(roomId, myStationKey!, 'engineer', action, playerId);
        await pushLog(roomId, { timestamp: Date.now(), playerName: character.name, playerId, statName: `REPARO ${systemKey.toUpperCase()} (alvo: ≤${target})`, statValue: repairAmount, roll, result: isHit ? 'Ship Repair' : 'Ship Damage' });
    };

    // --- SCIENCE ---
    const handleScan = async () => {
        const autoScan = crewAtMyStation >= 2 && ship.stats.sensors > 40;
        const target = scienceTarget;
        const { roll, isHit } = autoScan ? { roll: 1, isHit: true } : doRoll(target);
        if (isHit && ship.enemies) {
            const unrevealed = Object.values(ship.enemies).filter(e => !e.revealed);
            if (unrevealed.length > 0) await revealEnemy(roomId, unrevealed[0].id);
        }
        const action: ShipAction = { type: 'scan', stationRole: 'science', playerId, playerName: character.name, roll, targetValue: target, result: isHit ? 'success' : 'failure', description: isHit ? 'Scan concluído — dados revelados' : 'Interferência — scan falhou' };
        await submitShipAction(roomId, myStationKey!, 'science', action, playerId);
        await pushLog(roomId, { timestamp: Date.now(), playerName: character.name, playerId, statName: `SCAN${autoScan ? ' AUTOMÁTICO' : ''} (alvo: ≤${target})`, statValue: target, roll, result: isHit ? 'Ship Scan' : 'Ship Damage' });
    };

    const SYSTEM_LABELS: Record<string, string> = { propulsion: 'Propulsão', lifeSupport: 'Suporte de Vida', weapons: 'Armamento', sensors: 'Sensores' };

    // =================== RENDER ===================

    // Station not occupied: show selection grid
    if (!myStationKey) {
        return (
            <>
                {previewStation && (
                    <StationModal
                        stationKey={previewStation} ship={ship} character={character} playerId={playerId}
                        onConfirm={() => handleConfirmStation(previewStation)}
                        onCancel={() => setPreviewStation(null)}
                    />
                )}

                <section className="border border-cyan-900/50 bg-cyan-950/5 p-4">
                    <h3 className="text-xs font-bold tracking-[0.2em] text-cyan-500 uppercase mb-3 flex items-center gap-2">
                        <Shield size={14} /> SELECIONE SEU POSTO DE BORDO
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(STATION_META).map(([key, meta]) => {
                            const station = (ship.stations || {})[key];
                            const occupants = station?.occupants ? Object.values(station.occupants) : [];
                            const cm = { blue: 'border-blue-800 text-blue-400 hover:bg-blue-950/30', red: 'border-red-800 text-red-400 hover:bg-red-950/30', amber: 'border-amber-800 text-amber-400 hover:bg-amber-950/30', purple: 'border-purple-800 text-purple-400 hover:bg-purple-950/30' }[meta.color as string] || '';
                            const crewBonus = occupants.length >= 2 ? meta.crewBonuses.find(b => b.count <= occupants.length + 1)?.label : null;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setPreviewStation(key)}
                                    className={`flex flex-col gap-1.5 px-4 py-3 border text-left transition-colors cursor-pointer ${cm} bg-zinc-950/50`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="opacity-80">{meta.icon}</span>
                                        <span className="text-xs font-bold tracking-widest uppercase">{meta.label}</span>
                                    </div>
                                    {occupants.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {occupants.slice(0, 3).map(occ => (
                                                <span key={occ.playerId} className="text-[9px] font-bold uppercase bg-zinc-900 px-1.5 py-0.5 border border-zinc-700 text-zinc-400">
                                                    {occ.playerName.split(' ')[0]}
                                                </span>
                                            ))}
                                            {crewBonus && <span className="text-[8px] font-bold uppercase text-emerald-500 px-1 py-0.5">+{crewBonus}</span>}
                                        </div>
                                    ) : (
                                        <span className="text-[9px] text-zinc-600 uppercase tracking-widest">— Vago —</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </section>
            </>
        );
    }

    // Station occupied: show action panel
    const stationMeta = STATION_META[myStationKey];
    const stationRole = myStation?.role || 'unassigned';

    const crewBonusActive = crewAtMyStation >= 2
        ? stationMeta.crewBonuses.filter(b => b.count <= crewAtMyStation).slice(-1)[0]
        : null;

    return (
        <section className={`border ${stationMeta.borderColor} ${stationMeta.bgColor} p-4`}>
            <div className="flex justify-between items-center mb-3">
                <h3 className={`text-sm font-bold tracking-widest uppercase flex items-center gap-2 ${stationMeta.color}`}>
                    {stationMeta.icon} {stationMeta.label}
                    {crewBonusActive && (
                        <span className="text-[9px] font-bold bg-emerald-900 text-emerald-400 border border-emerald-700 px-2 py-0.5">
                            {crewBonusActive.label}
                        </span>
                    )}
                </h3>
                <button onClick={() => leaveStation(roomId, myStationKey, playerId)}
                    className="text-[10px] text-zinc-600 hover:text-zinc-400 uppercase tracking-widest font-bold transition">
                    ABANDONAR POSTO
                </button>
            </div>

            {/* Crew at station */}
            {crewAtMyStation > 1 && (
                <div className="flex items-center gap-2 mb-3">
                    <Users size={11} className="text-zinc-500" />
                    <div className="flex gap-1">
                        {Object.values(myStation!.occupants!).map(occ => (
                            <span key={occ.playerId} className={`text-[9px] font-bold uppercase px-2 py-0.5 border ${stationMeta.borderColor} ${stationMeta.color}`}>
                                {occ.playerName.split(' ')[0]}{occ.hasActed ? ' ✓' : ''}
                            </span>
                        ))}
                    </div>
                    {crewBonusActive && (
                        <span className="text-[9px] text-zinc-500 ml-auto">{crewBonusActive.effect}</span>
                    )}
                </div>
            )}

            {/* Manual d100 input */}
            {isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex items-center gap-2 mb-3">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">D100 MANUAL:</label>
                    <input type="number" min="0" max="99" placeholder="RNG" value={rollInput} onChange={e => setRollInput(e.target.value)}
                        className="bg-zinc-950 border border-zinc-700 text-zinc-300 p-1 text-xs outline-none w-16 text-center" />
                    <span className="text-[9px] text-zinc-600">(vazio = virtual)</span>
                </div>
            )}

            {/* Already acted */}
            {alreadyActed && (
                <div className="border border-emerald-900/50 bg-emerald-950/20 p-3 text-center">
                    <span className="text-xs font-bold tracking-widest text-emerald-500 uppercase">✓ AÇÃO SUBMETIDA — AGUARDANDO RESOLUÇÃO</span>
                </div>
            )}

            {/* Not in combat */}
            {!isCombatActive && (
                <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold border border-zinc-800 bg-zinc-900/30 px-3 py-2">
                    Estação operacional — aguardando início de combate.
                </div>
            )}

            {/* PILOT ACTIONS */}
            {stationRole === 'pilot' && isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex flex-col gap-2">
                    <div className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">
                        ALVO EVASÃO: ≤{pilotTarget} | (SPD:{ship.stats.speed} + SKILL:{pilotSkill} {crewAtMyStation >= 2 ? '+ CREW:10' : ''}) | COMBUSTÍVEL: {ship.resources.fuel.current}
                    </div>
                    <button onClick={handleEvade}
                        className="bg-blue-950/50 hover:bg-blue-900 text-blue-400 border border-blue-800 px-4 py-3 font-bold tracking-widest flex items-center justify-center gap-2 transition upper text-xs">
                        <Navigation size={14} /> MANOBRA EVASIVA {crewAtMyStation >= 3 ? '(ROLAR 2x)' : ''}
                    </button>
                </div>
            )}

            {/* GUNNER ACTIONS */}
            {stationRole === 'gunner' && isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex flex-col gap-3">
                    <div className="text-[10px] text-red-600 font-bold uppercase tracking-widest">
                        ALVO DISPARO: ≤{gunnerTarget} | (CBT:{ship.stats.combat} + SKILL:{gunnerSkill} - AR:{Math.floor(enemyAR/5)}) | MUN: {ship.resources.ammo.current}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {Object.entries(ship.weapons).map(([wId, weapon]) => (
                            <label key={wId} className={`flex items-center gap-3 px-3 py-2 border cursor-pointer transition ${selectedWeaponId === wId ? 'border-red-500 bg-red-950/30 text-red-300' : 'border-zinc-800 text-zinc-500 hover:border-red-800'} ${weapon.currentCooldown > 0 ? 'opacity-30 cursor-not-allowed' : ''}`}>
                                <input type="radio" name="weapon" value={wId} checked={selectedWeaponId === wId} onChange={() => setSelectedWeaponId(wId)} disabled={weapon.currentCooldown > 0} className="hidden" />
                                <Crosshair size={12} />
                                <span className="text-xs font-bold uppercase flex-1">{weapon.name}</span>
                                <span className="text-[9px] font-mono">{weapon.damage} | Custo:{weapon.ammoCost}</span>
                                {weapon.currentCooldown > 0 && <span className="text-[9px] text-amber-500">CD:{weapon.currentCooldown}</span>}
                            </label>
                        ))}
                    </div>
                    <button onClick={handleFire} disabled={!selectedWeaponId || ship.systems.weapons.status === 'offline'}
                        className="bg-red-900 hover:bg-red-800 text-red-100 px-4 py-3 font-bold tracking-widest flex items-center justify-center gap-2 transition upper text-xs border border-red-700 disabled:opacity-30 disabled:cursor-not-allowed">
                        <Zap size={14} /> DISPARAR {crewAtMyStation >= 3 ? '(DUPLO DISPONÍVEL)' : ''}
                    </button>
                </div>
            )}

            {/* ENGINEER ACTIONS */}
            {stationRole === 'engineer' && isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex flex-col gap-3">
                    <div className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">
                        ALVO REPARO: ≤{engineerTarget} | (INT:{character.stats.intellect} + SKILL:{engineerSkill}) | RECUPERAÇÃO: +{crewAtMyStation >= 2 ? '40' : '20'}%
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {Object.entries(ship.systems).map(([key, sys]) => (
                            <div key={key} className="flex items-center justify-between bg-zinc-950 border border-amber-900/30 px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${sys.status === 'online' ? 'bg-emerald-500' : sys.status === 'damaged' ? 'bg-amber-500 animate-pulse' : 'bg-red-600 animate-pulse'}`} />
                                    <span className="text-xs font-bold uppercase text-amber-400">{SYSTEM_LABELS[key]}</span>
                                    <span className="text-[9px] text-amber-700 font-mono">{sys.integrity}%</span>
                                </div>
                                <button onClick={() => handleRepair(key)} disabled={sys.integrity >= 100}
                                    className="text-[10px] font-bold uppercase bg-amber-950/50 text-amber-400 border border-amber-800 px-3 py-1 hover:bg-amber-900 transition disabled:opacity-20">
                                    REPARAR
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SCIENCE ACTIONS */}
            {stationRole === 'science' && isCombatActive && isStationsPhase && !alreadyActed && (
                <div className="flex flex-col gap-3">
                    <div className="text-[10px] text-purple-600 font-bold uppercase tracking-widest">
                        ALVO SCAN: ≤{scienceTarget} | (SNS:{ship.stats.sensors} + SKILL:{scienceSkill}) {crewAtMyStation >= 2 && ship.stats.sensors > 40 ? '— SCAN AUTOMÁTICO ATIVO' : ''}
                    </div>
                    {ship.enemies && Object.values(ship.enemies).map(enemy => (
                        <div key={enemy.id} className={`border px-3 py-2 ${enemy.revealed ? 'border-purple-700 bg-purple-950/20' : 'border-zinc-800 bg-zinc-900/50'}`}>
                            <div className="flex items-center gap-2">
                                <span>{enemy.icon}</span>
                                <span className="text-xs font-bold uppercase text-purple-400">{enemy.name}</span>
                                {enemy.revealed
                                    ? <span className="text-[9px] text-purple-600 font-mono ml-auto">HP:{enemy.hp.current}/{enemy.hp.max} AR:{enemy.stats.armor} CBT:{enemy.stats.combat}</span>
                                    : <span className="text-[9px] text-zinc-600 ml-auto">NÃO REVELADO</span>
                                }
                            </div>
                        </div>
                    ))}
                    <button onClick={handleScan} disabled={ship.systems.sensors.status === 'offline'}
                        className="bg-purple-900 hover:bg-purple-800 text-purple-100 px-4 py-3 font-bold tracking-widest flex items-center justify-center gap-2 transition text-xs border border-purple-700 disabled:opacity-30">
                        <Radio size={14} /> ESCANEAR CONTATOS
                    </button>
                </div>
            )}
        </section>
    );
}
