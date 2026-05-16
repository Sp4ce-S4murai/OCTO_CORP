import { ref, onValue, set, update, push, remove, get } from "firebase/database";
import { database } from "./firebase";
import { CharacterSheet, RollLog, RoomData, EnvironmentState, EncounterState, Item, Weapon, NpcData, NpcAttack } from "../types/character";
import { BALANCED_WEAPONS } from "./itemPresets";
import { CombatState, Token } from "../types/combat";


// Helper to get relative path for a room
const roomPath = (roomId: string) => `rooms/${roomId}`;
const playerPath = (roomId: string, playerId: string) => `rooms/${roomId}/players/${playerId}`;
const logsPath = (roomId: string) => `rooms/${roomId}/logs`;
const userProfilePath = (userId: string) => `users/${userId}/characters`;

// Generic subscription hook logic to be used inside React
export const subscribeToRoom = (
    roomId: string,
    callback: (data: RoomData | null) => void
) => {
    const roomRef = ref(database, roomPath(roomId));
    return onValue(roomRef, (snapshot) => {
        callback(snapshot.val());
    });
};

export const subscribeToPlayer = (
    roomId: string,
    playerId: string,
    callback: (data: CharacterSheet | null) => void
) => {
    const pPath = ref(database, playerPath(roomId, playerId));
    return onValue(pPath, (snapshot) => {
        callback(snapshot.val());
    });
};

// --- USER PROFILE ACTIONS ---

export const saveUserCharacter = async (userId: string, character: CharacterSheet) => {
    // Save to the user's hub
    const charPath = ref(database, `${userProfilePath(userId)}/${character.id}`);
    await set(charPath, character);
};

export const subscribeToUserCharacters = (
    userId: string,
    callback: (characters: CharacterSheet[]) => void
) => {
    const charsRef = ref(database, userProfilePath(userId));
    return onValue(charsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            callback(Object.values(data));
        } else {
            callback([]);
        }
    });
};

export const deleteUserCharacter = async (userId: string, characterId: string) => {
    const charPath = ref(database, `${userProfilePath(userId)}/${characterId}`);
    await remove(charPath);
};

// --- ROOM CREATION & AUTH ---

export const createRoom = async (roomId: string, password?: string) => {
    if (password) {
        const pswdPath = ref(database, `${roomPath(roomId)}/settings/password`);
        await set(pswdPath, password);
    }
};

export const verifyRoomPassword = async (roomId: string, password?: string): Promise<boolean> => {
    const pswdPath = ref(database, `${roomPath(roomId)}/settings/password`);
    const snapshot = await get(pswdPath);
    const roomPassword = snapshot.val();

    // Se a sala não tem senha configurada, permite a entrada direto.
    if (!roomPassword) {
        return true;
    }

    // Se tem senha, compara com a senha informada.
    return roomPassword === password;
};


// --- IN-ROOM ACTIONS ---

export const updateEnvironment = async (roomId: string, envData: Partial<EnvironmentState>) => {
    const ePath = ref(database, `${roomPath(roomId)}/environment`);
    await set(ePath, envData);
};

export const updatePlayer = async (roomId: string, playerId: string, partialData: Partial<CharacterSheet> | Record<string, unknown>) => {
    const pPath = ref(database, playerPath(roomId, playerId));
    await update(pPath, partialData);
};

export const setRoomLockdown = async (roomId: string, isLocked: boolean) => {
    const pPath = ref(database, `${roomPath(roomId)}/isLocked`);
    await set(pPath, isLocked);
};

export const setRoomImage = async (roomId: string, base64Image: string) => {
    const iPath = ref(database, `${roomPath(roomId)}/activeImage`);
    await set(iPath, base64Image);
};

export const clearRoomImage = async (roomId: string) => {
    const iPath = ref(database, `${roomPath(roomId)}/activeImage`);
    await remove(iPath);
};

export const submitPanicTestRoll = async (roomId: string, playerId: string, playerName: string, rolledD20: number, stress: number, isPanicCheck: boolean) => {
    const panicRef = ref(database, `${roomPath(roomId)}/activePanicTest`);
    await set(panicRef, {
        playerId,
        playerName,
        status: 'rolled',
        rolledD20,
        stress,
        is_panic: isPanicCheck
    });
};

export const submitPanicTestWaiting = async (roomId: string, playerId: string, playerName: string) => {
    const panicRef = ref(database, `${roomPath(roomId)}/activePanicTest`);
    await set(panicRef, {
        playerId,
        playerName,
        status: 'waiting'
    });
};

export const submitPanicTestResolution = async (roomId: string, resultText: string, resultDescription: string) => {
    const panicRef = ref(database, `${roomPath(roomId)}/activePanicTest`);
    await update(panicRef, {
        status: 'resolved',
        resultText,
        resultDescription
    });
};

export const clearActivePanicTest = async (roomId: string) => {
    const pPath = ref(database, `${roomPath(roomId)}/activePanicTest`);
    await remove(pPath);
};

export const updatePlayerNested = async (roomId: string, playerId: string, path: string, value: string | number | boolean | null) => {
    const pPath = ref(database, playerPath(roomId, playerId));
    await update(pPath, { [path]: value });
};

export const updatePlayerOrder = async (roomId: string, order: string[]) => {
    const orderPath = ref(database, `${roomPath(roomId)}/playerOrder`);
    await set(orderPath, order);
};

export const createPlayer = async (roomId: string, character: CharacterSheet) => {
    const pPath = ref(database, playerPath(roomId, character.id));
    await set(pPath, character);
};

export const deletePlayer = async (roomId: string, playerId: string) => {
    const pPath = ref(database, playerPath(roomId, playerId));
    await remove(pPath);
};

export const pushLog = async (roomId: string, log: Omit<RollLog, 'id'>) => {
    const lPath = ref(database, logsPath(roomId));
    const newLogRef = push(lPath);
    await set(newLogRef, { ...log, id: newLogRef.key });
};

// --- ENCOUNTER SYSTEM ---

export const startEncounter = async (roomId: string) => {
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    const snapshot = await get(encPath);
    const current = snapshot.val() as EncounterState;

    const initialEncounter: EncounterState = {
        isActive: true,
        status: 'rolling',
        initiatives: {},
        turnOrder: [],
        currentTurnIndex: 0,
        round: 1,
        npcs: current?.npcs || {},
        obstacles: current?.obstacles || {},
        gridSize: current?.gridSize || 20,
        tokens: current?.tokens || {}
    };
    await set(encPath, initialEncounter);
};

export const submitInitiative = async (roomId: string, playerId: string, value: number) => {
    const initPath = ref(database, `${roomPath(roomId)}/encounter/initiatives/${playerId}`);
    await set(initPath, value);
};

export const beginTurns = async (roomId: string, sortedPlayerIds: string[]) => {
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    const snapshot = await get(encPath);
    const encounter = snapshot.val() as EncounterState;
    
    const updates: any = {
        status: 'active',
        turnOrder: sortedPlayerIds,
        currentTurnIndex: 0,
        round: 1
    };

    const firstEntityId = sortedPlayerIds[0];
    if (encounter?.tokens && encounter.tokens[firstEntityId]) {
        updates[`tokens/${firstEntityId}/movementPoints/current`] = encounter.tokens[firstEntityId].movementPoints.max;
    }

    await update(encPath, updates);
};

export const nextTurn = async (roomId: string, encounter: EncounterState) => {
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    let nextIndex = encounter.currentTurnIndex + 1;
    let newRound = encounter.round;

    if (nextIndex >= encounter.turnOrder.length) {
        // Loop back to start, increment round
        nextIndex = 0;
        newRound += 1;
    }

    const updates: any = {
        currentTurnIndex: nextIndex,
        round: newRound
    };

    const nextEntityId = encounter.turnOrder[nextIndex];
    if (encounter.tokens && encounter.tokens[nextEntityId]) {
        updates[`tokens/${nextEntityId}/movementPoints/current`] = encounter.tokens[nextEntityId].movementPoints.max;
    }

    await update(encPath, updates);
};

export const endEncounter = async (roomId: string) => {
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    await remove(encPath);
};



// --- NPC SYSTEM ---

export const addNPCToEncounter = async (
    roomId: string, 
    npcData: { name: string; initiative: number; icon?: string; color: string; hp: number; maxHp: number; movementMax?: number; combat?: number; attacks?: NpcAttack[] }
) => {
    const npcId = `npc_${crypto.randomUUID()}`;
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    
    // We must fetch current encounter to inject the NPC correctly into turn order if active
    const snapshot = await get(encPath);
    const encounter = snapshot.val() as EncounterState;
    if (!encounter) return;

    const movMax = npcData.movementMax || 6;

    const updates: any = {};
    const npcRecord: NpcData = {
        id: npcId,
        name: npcData.name,
        hp: npcData.hp,
        maxHp: npcData.maxHp,
        color: npcData.color,
        icon: npcData.icon || '👾',
        movementMax: movMax,
        isDead: false,
        combat: npcData.combat || 45, // default 45
        attacks: npcData.attacks || [],
    };
    updates[`npcs/${npcId}`] = npcRecord;
    updates[`initiatives/${npcId}`] = npcData.initiative;
    updates[`tokens/${npcId}`] = {
        id: npcId,
        x: 0,
        y: 0,
        color: npcData.color,
        movementPoints: { current: movMax, max: movMax }
    };
    

    // If active, recalculate turn order
    if (encounter.status === 'active') {
        const currentOrder = encounter.turnOrder || [];
        // Insert into proper initiative order
        const allInit = { ...encounter.initiatives, [npcId]: npcData.initiative };
        const newOrder = [...currentOrder, npcId].sort((a, b) => (allInit[b] || 0) - (allInit[a] || 0));
        updates[`turnOrder`] = newOrder;
        
        // Find new current turn index based on the player ID that was currently acting
        const currentActorId = currentOrder[encounter.currentTurnIndex];
        const newCurrentIndex = newOrder.indexOf(currentActorId);
        updates[`currentTurnIndex`] = newCurrentIndex >= 0 ? newCurrentIndex : 0;
    }

    await update(encPath, updates);
    return npcId;
};

export const removeNPCFromEncounter = async (roomId: string, npcId: string) => {
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    const snapshot = await get(encPath);
    const encounter = snapshot.val() as EncounterState;
    if (!encounter) return;

    const updates: any = {};
    updates[`npcs/${npcId}`] = null;
    updates[`initiatives/${npcId}`] = null;


    if (encounter.turnOrder) {
        const newOrder = encounter.turnOrder.filter(id => id !== npcId);
        updates[`turnOrder`] = newOrder;

        if (encounter.status === 'active') {
            const currentActorId = encounter.turnOrder[encounter.currentTurnIndex];
            if (currentActorId === npcId) {
                // If the removed NPC was acting, move to next
                let nextIndex = encounter.currentTurnIndex;
                if (nextIndex >= newOrder.length) nextIndex = 0;
                updates[`currentTurnIndex`] = nextIndex;
            } else {
                const newCurrentIndex = newOrder.indexOf(currentActorId);
                updates[`currentTurnIndex`] = newCurrentIndex >= 0 ? newCurrentIndex : 0;
            }
        }
    }

    await update(encPath, updates);
};

// Initial template for a blank character
export const createEmptyCharacter = (id: string, name: string): CharacterSheet => {
    // Attributes and Saves start at 0
    const baseStats = { strength: 0, speed: 0, intellect: 0, combat: 0 };
    const baseSaves = { sanity: 0, fear: 0, body: 0 };

    return {
        id,
        name,
        pronouns: '',
        characterClass: 'Teamster',
        avatarUrl: '',

        baseStats,
        classMods: {},
        stats: { ...baseStats }, // initially same as base (no mods yet)

        baseSaves,
        classSaveMods: {},
        saves: { ...baseSaves },

        vitals: {
            health: { current: 10, max: 10 },
            wounds: { current: 0, max: 2 },
            stress: { current: 2, min: 2 },
            armor: { current: 10, max: 10 }
        },
        skills: {
            trained: {}, expert: {}, master: {}
        },
        inventory: BALANCED_WEAPONS
    };
};

// --- COMBAT / DAMAGE RESOLUTION ---
export const applyDamageToPlayer = async (roomId: string, playerId: string, damage: number) => {
    const pPath = ref(database, playerPath(roomId, playerId));
    const snapshot = await get(pPath);
    const char = snapshot.val() as CharacterSheet;
    
    if (!char || damage <= 0) return { damageToHealth: 0, armorDestroyed: false, woundsGained: 0, isDead: false, newHealth: 0, maxHealth: 1 };

    let currentArmor = char.vitals.armor?.current ?? 0;
    let currentHealth = char.vitals.health.current;
    let currentWounds = char.vitals.wounds.current;
    const maxHealth = char.vitals.health.max || 10;
    const maxWounds = char.vitals.wounds.max || 2;

    let damageToHealth = 0;
    let armorDestroyed = false;

    if (currentArmor > 0) {
        if (damage < currentArmor) {
            // Armor absorbs completely
            return { damageToHealth: 0, armorDestroyed: false, woundsGained: 0, isDead: false, newHealth: currentHealth, maxHealth };
        } else {
            // Armor destroyed
            armorDestroyed = true;
            damageToHealth = damage - currentArmor;
            currentArmor = 0;
        }
    } else {
        damageToHealth = damage;
    }

    if (damageToHealth <= 0 && armorDestroyed) {
        // Edge case: Damage equals AP
        await update(pPath, { "vitals/armor/current": 0 });
        return { damageToHealth: 0, armorDestroyed: true, woundsGained: 0, isDead: false, newHealth: currentHealth, maxHealth };
    }

    // Apply health damage
    currentHealth -= damageToHealth;

    // Wound rollover logic
    let woundsGained = 0;
    while (currentHealth <= 0 && currentWounds < maxWounds) {
        currentWounds += 1;
        woundsGained += 1;
        currentHealth += maxHealth;
    }

    // Clamp to death state
    let isDead = false;
    if (currentWounds >= maxWounds) {
        currentWounds = maxWounds;
        currentHealth = 0;
        isDead = true;
    }

    const updates: Record<string, number> = {
        "vitals/health/current": currentHealth,
        "vitals/wounds/current": currentWounds,
    };
    if (armorDestroyed) {
        updates["vitals/armor/current"] = 0;
    }

    await update(pPath, updates);

    return { damageToHealth, armorDestroyed, woundsGained, isDead, newHealth: currentHealth, maxHealth };
};

// --- TACTICAL COMBAT SYSTEM ---

const combatPath = (roomId: string) => `rooms/${roomId}/combat`;

export const subscribeToCombat = (
    roomId: string,
    callback: (data: CombatState | null) => void
) => {
    const cPath = ref(database, combatPath(roomId));
    return onValue(cPath, (snapshot) => {
        callback(snapshot.val());
    });
};

export const startTacticalCombat = async (roomId: string) => {
    const cPath = ref(database, combatPath(roomId));
    const initialState: CombatState = {
        isActive: true,
        round: 1,
        currentTurnIndex: 0,
        initiativeOrder: [],
        tokens: {},
        gridSize: 50
    };
    await set(cPath, initialState);
};

export const updateCombatState = async (roomId: string, data: Partial<CombatState>) => {
    const cPath = ref(database, combatPath(roomId));
    await update(cPath, data);
};

export const spawnToken = async (roomId: string, token: Token) => {
    const tPath = ref(database, `${combatPath(roomId)}/tokens/${token.id}`);
    await set(tPath, token);
};

export const updateToken = async (roomId: string, tokenId: string, data: Partial<Token>) => {
    const tPath = ref(database, `${combatPath(roomId)}/tokens/${tokenId}`);
    await update(tPath, data);
};

export const removeToken = async (roomId: string, tokenId: string) => {
    const tPath = ref(database, `${combatPath(roomId)}/tokens/${tokenId}`);
    await remove(tPath);
};

export const endTacticalCombat = async (roomId: string) => {
    const cPath = ref(database, combatPath(roomId));
    await remove(cPath);
};

// --- INVENTORY SYSTEM ---

export const giveItemToPlayer = async (roomId: string, playerId: string, items: (Item | Weapon)[]) => {
    const pPath = ref(database, playerPath(roomId, playerId));
    const snapshot = await get(pPath);
    const character = snapshot.val() as CharacterSheet;
    
    if (!character) return;
    
    const currentInventory = character.inventory || [];
    const newInventory = [...currentInventory, ...items];
    
    await update(pPath, { inventory: newInventory });
};

export const removeItemFromPlayer = async (roomId: string, playerId: string, itemIndex: number) => {
    const pPath = ref(database, playerPath(roomId, playerId));
    const snapshot = await get(pPath);
    const character = snapshot.val() as CharacterSheet;
    
    if (!character || !character.inventory) return;
    
    const newInventory = character.inventory.filter((_, index) => index !== itemIndex);
    
    await update(pPath, { inventory: newInventory });
};

export const updatePlayerInventory = async (roomId: string, playerId: string, inventory: (Item | Weapon)[]) => {
    const pPath = ref(database, playerPath(roomId, playerId));
    await update(pPath, { inventory });
};

// --- TACTICAL GRID SYSTEM (EncounterState) ---

export const updateTokenPosition = async (roomId: string, tokenId: string, x: number, y: number, color?: string, maxMovement?: number) => {
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    const snapshot = await get(encPath);
    const encounter = snapshot.val() as EncounterState;
    
    const existingToken = encounter?.tokens?.[tokenId];
    
    const tokenData = { 
        id: tokenId, 
        x, 
        y, 
        ...(color ? { color } : (existingToken?.color ? { color: existingToken.color } : {})),
        movementPoints: existingToken?.movementPoints || { current: maxMovement || 6, max: maxMovement || 6 }
    };
    
    const tokenPath = ref(database, `${roomPath(roomId)}/encounter/tokens/${tokenId}`);
    await update(tokenPath, tokenData);
};

export const deductTokenMovement = async (roomId: string, tokenId: string, distance: number) => {
    const mpPath = ref(database, `${roomPath(roomId)}/encounter/tokens/${tokenId}/movementPoints/current`);
    const snapshot = await get(mpPath);
    const current = snapshot.val() as number;
    if (current !== null && current >= distance) {
        await set(mpPath, current - distance);
    }
};

export const removeTokenFromGrid = async (roomId: string, tokenId: string) => {
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    const snapshot = await get(encPath);
    const encounter = snapshot.val() as EncounterState;

    // If it's an NPC token AND it's registered in encounter.npcs, do full NPC removal
    if (tokenId.startsWith('npc_') && encounter?.npcs?.[tokenId]) {
        await removeNPCFromEncounter(roomId, tokenId);
        return;
    }

// Otherwise (orphan NPC token or player token) — just remove the token entry
    const updates: any = {};
    updates[`tokens/${tokenId}`] = null;

    if (encounter?.turnOrder) {
        const newOrder = encounter.turnOrder.filter(id => id !== tokenId);
        updates[`turnOrder`] = newOrder;
        let newIndex = encounter.currentTurnIndex;
        if (newIndex >= newOrder.length) newIndex = 0;
        updates[`currentTurnIndex`] = newIndex;
    }

    await update(encPath, updates);
};

export const addGridObstacle = async (roomId: string, obstacle: any) => {
    const obPath = ref(database, `${roomPath(roomId)}/encounter/obstacles/${obstacle.id}`);
    await set(obPath, obstacle);
};

export const removeGridObstacle = async (roomId: string, obstacleId: string) => {
    const obPath = ref(database, `${roomPath(roomId)}/encounter/obstacles/${obstacleId}`);
    await remove(obPath);
};

export const updateEncounterState = async (roomId: string, updates: Partial<EncounterState>) => {
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    await update(encPath, updates);
};

// --- GLOBAL INVENTORY ---

export const initializeGlobalInventory = async (roomId: string) => {
    const invPath = ref(database, `${roomPath(roomId)}/globalInventory`);
    const snapshot = await get(invPath);
    if (!snapshot.exists()) {
        const { GLOBAL_ITEMS } = await import('./itemsDictionary');
        await set(invPath, GLOBAL_ITEMS);
    }
};

export const addGlobalItem = async (roomId: string, item: Item | Weapon) => {
    const itemPath = ref(database, `${roomPath(roomId)}/globalInventory/${item.id}`);
    await set(itemPath, item);
};

export const deleteGlobalItem = async (roomId: string, itemId: string) => {
    const itemPath = ref(database, `${roomPath(roomId)}/globalInventory/${itemId}`);
    await remove(itemPath);
};

// --- NPC HP MANAGEMENT ---

export const updateNpcData = async (roomId: string, npcId: string, data: Partial<NpcData>) => {
    const npcRef = ref(database, `${roomPath(roomId)}/encounter/npcs/${npcId}`);
    await update(npcRef, data);
};

export const killNpc = async (roomId: string, npcId: string) => {
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    const snapshot = await get(encPath);
    const encounter = snapshot.val() as EncounterState;
    if (!encounter) return;

    const updates: Record<string, unknown> = {};
    updates[`npcs/${npcId}/hp`] = 0;
    updates[`npcs/${npcId}/isDead`] = true;

    // Remove from turn order
    if (encounter.turnOrder) {
        const newOrder = encounter.turnOrder.filter((id: string) => id !== npcId);
        updates['turnOrder'] = newOrder;

        if (encounter.status === 'active') {
            const currentActorId = encounter.turnOrder[encounter.currentTurnIndex];
            if (currentActorId === npcId) {
                // Was the active turn — advance to next
                const nextIndex = encounter.currentTurnIndex < newOrder.length ? encounter.currentTurnIndex : 0;
                updates['currentTurnIndex'] = nextIndex;
            } else {
                const newCurrentIndex = newOrder.indexOf(currentActorId);
                updates['currentTurnIndex'] = newCurrentIndex >= 0 ? newCurrentIndex : 0;
            }
        }
    }

    await update(encPath, updates);
};

export const updateNpcHp = async (roomId: string, npcId: string, newHp: number) => {
    if (newHp <= 0) {
        // Trigger full kill sequence (isDead flag + turn order cleanup)
        await killNpc(roomId, npcId);
        return;
    }
    const npcRef = ref(database, `${roomPath(roomId)}/encounter/npcs/${npcId}/hp`);
    await set(npcRef, newHp);
};

