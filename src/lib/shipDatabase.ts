import { ref, onValue, set, update, push, remove, get } from "firebase/database";
import { database } from "./firebase";
import { ShipState, ShipWeapon, EnemyShip, ShipAlert, ShipAction, SHIP_PRESETS, ShipTemplate, ShipStation } from "../types/ship";
import { pushLog, updatePlayerNested } from "./database";

const shipPath = (roomId: string) => `rooms/${roomId}/ship`;

// --- SHIP CRUD ---

export const createShip = async (roomId: string, template: ShipTemplate) => {
    const sPath = ref(database, shipPath(roomId));

    const weapons: Record<string, ShipWeapon> = {};
    template.weapons.forEach(w => {
        const wId = `w_${crypto.randomUUID().slice(0, 8)}`;
        weapons[wId] = { ...w, id: wId };
    });

    const ship: ShipState = {
        name: template.name,
        class: template.class,
        stats: { ...template.stats },
        hp: { ...template.hp },
        systems: {
            propulsion:  { status: 'online', integrity: 100 },
            lifeSupport: { status: 'online', integrity: 100 },
            weapons:     { status: 'online', integrity: 100 },
            sensors:     { status: 'online', integrity: 100 },
        },
        resources: {
            fuel:   { current: 100, max: 100 },
            oxygen: { current: 100, max: 100 },
            ammo:   { current: 50, max: 50 },
        },
        weapons,
        stations: {
            bridge:      { role: 'pilot',    occupants: {} },
            tactical:    { role: 'gunner',   occupants: {} },
            engineering: { role: 'engineer', occupants: {} },
            science:     { role: 'science',  occupants: {} },
        },
    };

    await set(sPath, ship);
};

export const updateShipField = async (roomId: string, path: string, value: unknown) => {
    const sPath = ref(database, `${shipPath(roomId)}/${path}`);
    await set(sPath, value);
};

export const updateShipFields = async (roomId: string, updates: Record<string, unknown>) => {
    const sPath = ref(database, shipPath(roomId));
    await update(sPath, updates);
};

export const deleteShip = async (roomId: string) => {
    const sPath = ref(database, shipPath(roomId));
    await remove(sPath);
};

export const subscribeToShip = (
    roomId: string,
    callback: (data: ShipState | null) => void
) => {
    const sRef = ref(database, shipPath(roomId));
    return onValue(sRef, (snapshot) => {
        callback(snapshot.val());
    });
};

// --- STATION MANAGEMENT ---

export const occupyStation = async (roomId: string, stationKey: string, playerId: string, playerName: string) => {
    // First, clear this player from any other station
    const shipRef = ref(database, shipPath(roomId));
    const snapshot = await get(shipRef);
    const ship = snapshot.val() as ShipState | null;
    if (!ship) return;

    const updates: Record<string, unknown> = {};

    // Remove from old stations
    Object.entries(ship.stations).forEach(([key, station]) => {
        if (station.occupants && station.occupants[playerId] && key !== stationKey) {
            updates[`stations/${key}/occupants/${playerId}`] = null;
        }
    });

    // Add to new station
    updates[`stations/${stationKey}/occupants/${playerId}`] = { id: playerId, name: playerName };

    await update(shipRef, updates);
};

export const leaveStation = async (roomId: string, stationKey: string, playerId: string) => {
    const occupantRef = ref(database, `${shipPath(roomId)}/stations/${stationKey}/occupants/${playerId}`);
    await remove(occupantRef);
};

// --- SHIP COMBAT ---

export const startShipCombat = async (roomId: string) => {
    const shipRef = ref(database, shipPath(roomId));
    const snapshot = await get(shipRef);
    const ship = snapshot.val() as ShipState | null;
    if (!ship) return;

    // Roll initiative: compare ship SPD
    const playerInit = Math.floor(Math.random() * 100);
    const enemies = ship.enemies ? Object.values(ship.enemies) : [];
    const bestEnemySpeed = enemies.length > 0 ? Math.max(...enemies.map(e => e.stats.speed)) : 0;
    const enemyInit = Math.floor(Math.random() * 100);

    const playerGoesFirst = (playerInit + ship.stats.speed) >= (enemyInit + bestEnemySpeed);

    const combatState = {
        isActive: true,
        round: 1,
        phase: 'stations',
        playerShipInitiative: playerInit + ship.stats.speed,
        enemyInitiative: enemyInit + bestEnemySpeed,
        playerGoesFirst,
        actionsThisRound: {},
        combatLog: [`COMBATE ESPACIAL INICIADO — Rodada 1`],
    };

    await update(shipRef, { combat: combatState });

    await pushLog(roomId, {
        timestamp: Date.now(),
        playerName: "SISTEMA NAVE",
        playerId: "SHIP",
        statName: `ALERTA DE COMBATE: ${playerGoesFirst ? 'VANTAGEM TÁTICA' : 'INIMIGO COM INICIATIVA'}`,
        statValue: 0,
        roll: 0,
        result: 'Ship Damage',
    });
};

export const endShipCombat = async (roomId: string) => {
    const combatRef = ref(database, `${shipPath(roomId)}/combat`);
    await remove(combatRef);

    await pushLog(roomId, {
        timestamp: Date.now(),
        playerName: "SISTEMA NAVE",
        playerId: "SHIP",
        statName: 'COMBATE ESPACIAL ENCERRADO',
        statValue: 0,
        roll: 0,
        result: 'Ship Damage',
    });
};

export const submitShipAction = async (roomId: string, stationRole: string, action: ShipAction) => {
    const actionRef = ref(database, `${shipPath(roomId)}/combat/actionsThisRound/${stationRole}`);
    await set(actionRef, action);
};

export const advanceShipPhase = async (roomId: string) => {
    const shipRef = ref(database, shipPath(roomId));
    const snapshot = await get(shipRef);
    const ship = snapshot.val() as ShipState | null;
    if (!ship?.combat) return;

    const phases = ['stations', 'resolution', 'damage'] as const;
    const currentIdx = phases.indexOf(ship.combat.phase as typeof phases[number]);
    let nextPhase: string;
    let newRound = ship.combat.round;

    if (currentIdx >= phases.length - 1) {
        // Loop back to stations, new round
        nextPhase = 'stations';
        newRound += 1;

        // Reset weapon cooldowns
        const weaponUpdates: Record<string, unknown> = {};
        if (ship.weapons) {
            Object.entries(ship.weapons).forEach(([wId, weapon]) => {
                if (weapon.currentCooldown > 0) {
                    weaponUpdates[`weapons/${wId}/currentCooldown`] = weapon.currentCooldown - 1;
                }
            });
        }

        await update(shipRef, {
            'combat/phase': nextPhase,
            'combat/round': newRound,
            'combat/actionsThisRound': {},
            ...weaponUpdates,
        });
    } else {
        nextPhase = phases[currentIdx + 1];
        await update(shipRef, {
            'combat/phase': nextPhase,
        });
    }
};

// --- DAMAGE & EFFECTS ---

export const applyShipDamage = async (roomId: string, damage: number, source: string) => {
    const shipRef = ref(database, shipPath(roomId));
    const snapshot = await get(shipRef);
    const ship = snapshot.val() as ShipState | null;
    if (!ship) return;

    const effectiveDamage = Math.max(0, damage - Math.floor(ship.stats.armor / 10));
    const newHp = Math.max(0, ship.hp.current - effectiveDamage);

    const updates: Record<string, unknown> = {
        'hp/current': newHp,
    };

    // Push alert
    const alertId = `alert_${Date.now()}`;
    const severity = newHp <= ship.hp.max * 0.25 ? 'catastrophic'
                   : newHp <= ship.hp.max * 0.5 ? 'critical'
                   : 'warning';

    updates[`alerts/${alertId}`] = {
        id: alertId,
        timestamp: Date.now(),
        severity,
        message: `IMPACTO: ${effectiveDamage} dano (${source}). Integridade: ${newHp}/${ship.hp.max}`,
    };

    await update(shipRef, updates);

    // Push log for terminal
    await pushLog(roomId, {
        timestamp: Date.now(),
        playerName: "SISTEMA NAVE",
        playerId: "SHIP",
        statName: `DANO NO CASCO: ${effectiveDamage} (${source})`,
        statValue: effectiveDamage,
        roll: damage,
        result: 'Ship Damage',
    });

    // Propagate stress to ALL crew members
    await propagateHullStress(roomId, effectiveDamage);

    // Check critical thresholds
    if (newHp <= ship.hp.max * 0.5 && ship.hp.current > ship.hp.max * 0.5) {
        await triggerRandomSystemDamage(roomId);
    }
    if (newHp <= ship.hp.max * 0.25 && ship.hp.current > ship.hp.max * 0.25) {
        await damageSystem(roomId, 'lifeSupport', 50);
    }
};

export const propagateHullStress = async (roomId: string, damage: number) => {
    if (damage <= 0) return;

    // Fetch all players
    const playersRef = ref(database, `rooms/${roomId}/players`);
    const snapshot = await get(playersRef);
    const players = snapshot.val() as Record<string, { id: string; name: string; vitals: { stress: { current: number; min: number } } }> | null;
    if (!players) return;

    const stressIncrement = 1;
    const updatePromises = Object.entries(players)
        .filter(([id]) => id !== 'placeholder')
        .map(([playerId, player]) => {
            const newStress = Math.min(20, (player.vitals?.stress?.current || 0) + stressIncrement);
            return updatePlayerNested(roomId, playerId, "vitals/stress/current", newStress);
        });

    await Promise.all(updatePromises);

    await pushLog(roomId, {
        timestamp: Date.now(),
        playerName: "SISTEMA NAVE",
        playerId: "SHIP",
        statName: `TREMOR NO CASCO: +${stressIncrement} STRESS PARA TODA A TRIPULAÇÃO`,
        statValue: stressIncrement,
        roll: 0,
        result: 'Warden Stress',
    });
};

export const damageSystem = async (roomId: string, systemKey: string, integrityLoss: number) => {
    const systemRef = ref(database, `${shipPath(roomId)}/systems/${systemKey}`);
    const snapshot = await get(systemRef);
    const system = snapshot.val() as { status: string; integrity: number } | null;
    if (!system) return;

    const newIntegrity = Math.max(0, system.integrity - integrityLoss);
    const newStatus = newIntegrity <= 0 ? 'offline' : newIntegrity <= 50 ? 'damaged' : 'online';

    await update(systemRef, { integrity: newIntegrity, status: newStatus });

    const systemNames: Record<string, string> = {
        propulsion: 'PROPULSÃO', lifeSupport: 'SUPORTE DE VIDA',
        weapons: 'ARMAMENTO', sensors: 'SENSORES'
    };

    await pushLog(roomId, {
        timestamp: Date.now(),
        playerName: "SISTEMA NAVE",
        playerId: "SHIP",
        statName: `SUBSISTEMA ${systemNames[systemKey] || systemKey}: ${newStatus.toUpperCase()} (${newIntegrity}%)`,
        statValue: integrityLoss,
        roll: 0,
        result: 'System Failure',
    });

    // Alert
    const alertId = `alert_${Date.now()}`;
    await update(ref(database, `${shipPath(roomId)}/alerts/${alertId}`), {
        id: alertId,
        timestamp: Date.now(),
        severity: newStatus === 'offline' ? 'catastrophic' : 'critical',
        message: `${systemNames[systemKey]}: ${newStatus === 'offline' ? 'DESLIGADO' : 'DANIFICADO'} — ${newIntegrity}%`,
        system: systemKey,
    });
};

export const repairSystem = async (roomId: string, systemKey: string, repairAmount: number) => {
    const systemRef = ref(database, `${shipPath(roomId)}/systems/${systemKey}`);
    const snapshot = await get(systemRef);
    const system = snapshot.val() as { status: string; integrity: number } | null;
    if (!system) return;

    const newIntegrity = Math.min(100, system.integrity + repairAmount);
    const newStatus = newIntegrity >= 80 ? 'online' : newIntegrity > 0 ? 'damaged' : 'offline';

    await update(systemRef, { integrity: newIntegrity, status: newStatus });
};

export const triggerRandomSystemDamage = async (roomId: string) => {
    const systems = ['propulsion', 'lifeSupport', 'weapons', 'sensors'];
    const target = systems[Math.floor(Math.random() * systems.length)];
    await damageSystem(roomId, target, 40);
};

// --- RESOURCES ---

export const drainResource = async (roomId: string, resourceKey: string, amount: number) => {
    const resRef = ref(database, `${shipPath(roomId)}/resources/${resourceKey}`);
    const snapshot = await get(resRef);
    const resource = snapshot.val() as { current: number; max: number } | null;
    if (!resource) return;

    const newCurrent = Math.max(0, resource.current - amount);
    await update(resRef, { current: newCurrent });

    if (newCurrent <= 0) {
        const resourceNames: Record<string, string> = {
            fuel: 'COMBUSTÍVEL', oxygen: 'OXIGÊNIO', ammo: 'MUNIÇÃO'
        };
        const alertId = `alert_${Date.now()}`;
        await update(ref(database, `${shipPath(roomId)}/alerts/${alertId}`), {
            id: alertId,
            timestamp: Date.now(),
            severity: 'catastrophic',
            message: `${resourceNames[resourceKey]}: ESGOTADO`,
        });
    }
};

export const refillResource = async (roomId: string, resourceKey: string, amount: number) => {
    const resRef = ref(database, `${shipPath(roomId)}/resources/${resourceKey}`);
    const snapshot = await get(resRef);
    const resource = snapshot.val() as { current: number; max: number } | null;
    if (!resource) return;

    const newCurrent = Math.min(resource.max, resource.current + amount);
    await update(resRef, { current: newCurrent });
};

// --- ENEMY MANAGEMENT ---

export const addEnemyShip = async (roomId: string, enemy: Omit<EnemyShip, 'id'>) => {
    const enemyId = `enemy_${crypto.randomUUID().slice(0, 8)}`;
    const enemyRef = ref(database, `${shipPath(roomId)}/enemies/${enemyId}`);
    await set(enemyRef, { ...enemy, id: enemyId });
    return enemyId;
};

export const removeEnemyShip = async (roomId: string, enemyId: string) => {
    const enemyRef = ref(database, `${shipPath(roomId)}/enemies/${enemyId}`);
    await remove(enemyRef);
};

export const applyEnemyDamage = async (roomId: string, enemyId: string, damage: number) => {
    const enemyRef = ref(database, `${shipPath(roomId)}/enemies/${enemyId}`);
    const snapshot = await get(enemyRef);
    const enemy = snapshot.val() as EnemyShip | null;
    if (!enemy) return;

    const effectiveDamage = Math.max(0, damage - Math.floor(enemy.stats.armor / 10));
    const newHp = Math.max(0, enemy.hp.current - effectiveDamage);

    await update(enemyRef, { 'hp/current': newHp });

    await pushLog(roomId, {
        timestamp: Date.now(),
        playerName: "SISTEMA NAVE",
        playerId: "SHIP",
        statName: `DANO EM ${enemy.name.toUpperCase()}: ${effectiveDamage}`,
        statValue: effectiveDamage,
        roll: damage,
        result: 'Ship Fire',
    });

    if (newHp <= 0) {
        await pushLog(roomId, {
            timestamp: Date.now(),
            playerName: "SISTEMA NAVE",
            playerId: "SHIP",
            statName: `${enemy.name.toUpperCase()} DESTRUÍDO`,
            statValue: 0,
            roll: 0,
            result: 'Ship Critical',
        });
    }
};

export const revealEnemy = async (roomId: string, enemyId: string) => {
    const enemyRef = ref(database, `${shipPath(roomId)}/enemies/${enemyId}`);
    await update(enemyRef, { revealed: true });
};

// --- DICE HELPERS ---

export const rollDice = (notation: string): number => {
    // Parse "2d10", "4d10", "1d10" etc.
    const match = notation.match(/(\d+)d(\d+)/);
    if (!match) return 0;
    const [, count, faces] = match;
    let total = 0;
    for (let i = 0; i < parseInt(count); i++) {
        total += Math.floor(Math.random() * parseInt(faces)) + 1;
    }
    return total;
};

// --- SHIP COMBAT ALERTS ---

export const pushShipAlert = async (roomId: string, severity: ShipAlert['severity'], message: string, system?: string) => {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const alertRef = ref(database, `${shipPath(roomId)}/alerts/${alertId}`);
    await set(alertRef, {
        id: alertId,
        timestamp: Date.now(),
        severity,
        message,
        system,
    });
};

export const clearAlerts = async (roomId: string) => {
    const alertsRef = ref(database, `${shipPath(roomId)}/alerts`);
    await remove(alertsRef);
};
