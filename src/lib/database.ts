import { ref, onValue, set, update, push, remove, get } from "firebase/database";
import { database } from "./firebase";
import { CharacterSheet, RollLog, RoomData, EnvironmentState, EncounterState } from "../types/character";

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

export const updatePlayerNested = async (roomId: string, playerId: string, path: string, value: string | number | boolean) => {
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
    const initialEncounter: EncounterState = {
        isActive: true,
        status: 'rolling',
        initiatives: {},
        turnOrder: [],
        currentTurnIndex: 0,
        round: 1,
        npcs: {},
        grid: {
            isActive: false, // Minimized by default, or Warden can activate it
            movementPerTurn: 5,
            entities: {}
        }
    };
    await set(encPath, initialEncounter);
};

export const submitInitiative = async (roomId: string, playerId: string, value: number) => {
    const initPath = ref(database, `${roomPath(roomId)}/encounter/initiatives/${playerId}`);
    await set(initPath, value);
};

export const beginTurns = async (roomId: string, sortedPlayerIds: string[]) => {
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    await update(encPath, {
        status: 'active',
        turnOrder: sortedPlayerIds,
        currentTurnIndex: 0,
        round: 1
    });
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

    // Reset movement for next player if they are on the grid
    if (encounter.grid?.entities) {
        const nextPlayerId = encounter.turnOrder[nextIndex];
        if (encounter.grid.entities[nextPlayerId]) {
            updates[`grid/entities/${nextPlayerId}/movementRemaining`] = encounter.grid.movementPerTurn || 5;
        }
    }

    await update(encPath, updates);
};

export const endEncounter = async (roomId: string) => {
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    await remove(encPath);
};

export const updateGridMovementSetting = async (roomId: string, movement: number) => {
    const gridPath = ref(database, `${roomPath(roomId)}/encounter/grid`);
    await update(gridPath, { movementPerTurn: movement });
};

export const updateGridEntity = async (roomId: string, playerId: string, entityData: { x: number, y: number, icon?: string, movementRemaining?: number }) => {
    const entityPath = ref(database, `${roomPath(roomId)}/encounter/grid/entities/${playerId}`);
    await update(entityPath, entityData);
};

export const removeGridEntity = async (roomId: string, playerId: string) => {
    const entityPath = ref(database, `${roomPath(roomId)}/encounter/grid/entities/${playerId}`);
    await remove(entityPath);
};

export const toggleGridState = async (roomId: string, isActive: boolean) => {
    const gridPath = ref(database, `${roomPath(roomId)}/encounter/grid`);
    await update(gridPath, { isActive });
};

export const setGridBackgroundImage = async (roomId: string, base64Image: string) => {
    const gridPath = ref(database, `${roomPath(roomId)}/encounter/grid`);
    await update(gridPath, { backgroundImage: base64Image });
};

export const clearGridBackgroundImage = async (roomId: string) => {
    const imgPath = ref(database, `${roomPath(roomId)}/encounter/grid/backgroundImage`);
    await remove(imgPath);
};

// --- NPC SYSTEM ---

export const addNPCToEncounter = async (
    roomId: string, 
    npcData: { name: string; initiative: number; icon: string; color: string; movementRemaining: number }
) => {
    const npcId = `npc_${crypto.randomUUID()}`;
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    
    // We must fetch current encounter to inject the NPC correctly into turn order if active
    const snapshot = await get(encPath);
    const encounter = snapshot.val() as EncounterState;
    if (!encounter) return;

    const updates: any = {};
    updates[`npcs/${npcId}`] = { id: npcId, name: npcData.name };
    updates[`initiatives/${npcId}`] = npcData.initiative;
    
    // Add to grid
    updates[`grid/entities/${npcId}`] = {
        x: Math.floor(15 / 2),
        y: Math.floor(15 / 2),
        icon: npcData.icon,
        color: npcData.color,
        isNPC: true,
        name: npcData.name,
        movementRemaining: npcData.movementRemaining
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
    updates[`grid/entities/${npcId}`] = null;

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
            stress: { current: 2, min: 2 }
        },
        skills: {
            trained: {}, expert: {}, master: {}
        }
    };
};
