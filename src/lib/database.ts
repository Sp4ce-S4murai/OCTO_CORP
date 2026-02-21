import { ref, onValue, set, update, push, remove, get } from "firebase/database";
import { database } from "./firebase";
import { CharacterSheet, RollLog, RoomData } from "../types/character";

// Helper to get relative path for a room
const roomPath = (roomId: string) => `rooms/${roomId}`;
const playerPath = (roomId: string, playerId: string) => `rooms/${roomId}/players/${playerId}`;
const logsPath = (roomId: string) => `rooms/${roomId}/logs`;

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

// Actions
export const updatePlayer = async (roomId: string, playerId: string, partialData: Partial<CharacterSheet>) => {
    const pPath = ref(database, playerPath(roomId, playerId));
    await update(pPath, partialData);
};

// Advanced: update nested property (e.g. vitals.stress.current)
export const updatePlayerNested = async (roomId: string, playerId: string, path: string, value: any) => {
    const pPath = ref(database, playerPath(roomId, playerId));
    await update(pPath, { [path]: value });
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
