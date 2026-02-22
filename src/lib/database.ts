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

export const updatePlayer = async (roomId: string, playerId: string, partialData: Partial<CharacterSheet>) => {
    const pPath = ref(database, playerPath(roomId, playerId));
    await update(pPath, partialData);
};

// Advanced: update nested property (e.g. vitals.stress.current)
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

export const addTerminalLog = pushLog; // Alias for backward compatibility if needed

// --- ENCOUNTER SYSTEM ---

export const startEncounter = async (roomId: string) => {
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    const initialEncounter: EncounterState = {
        isActive: true,
        status: 'rolling',
        initiatives: {},
        turnOrder: [],
        currentTurnIndex: 0,
        round: 1
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
    const nextIndex = encounter.currentTurnIndex + 1;

    if (nextIndex >= encounter.turnOrder.length) {
        // Loop back to start, increment round
        await update(encPath, { currentTurnIndex: 0, round: encounter.round + 1 });
    } else {
        await update(encPath, { currentTurnIndex: nextIndex });
    }
};

export const endEncounter = async (roomId: string) => {
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    await remove(encPath);
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
