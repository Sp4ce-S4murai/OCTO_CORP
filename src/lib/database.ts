import { ref, onValue, set, update, push, remove, get } from "firebase/database";
import { database } from "./firebase";
import { CharacterSheet, CharacterClass, RollLog, EnvironmentState, EncounterState, GridObstacle, Item, Weapon, NpcData, NpcAttack } from "../types/character";
import { applyClassToCharacter } from "./characterClass";
import { CLASS_LABELS } from "./itemsDictionary";
import { roomPath, playerPath, logsPath, userProfilePath } from "./paths";


// Caminhos vem de lib/paths.ts — ver o namespace v2_ documentado la.

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

/**
 * Grava a imagem transmitida na sala.
 *
 * Recebe um Blob, e nao uma string, de proposito: hoje ele vira data URI
 * base64 no Realtime Database, porque o Firebase Storage exige plano Blaze e
 * este projeto esta no Spark. No dia em que o Storage entrar, so o corpo desta
 * funcao muda — nenhum componente precisa ser tocado.
 */
export const setRoomImage = async (roomId: string, blob: Blob) => {
    const dataUri = await blobToDataUri(blob);

    // ~700 KB de base64 ja indicam que a compressao no componente falhou; sem
    // isto o Diretor so veria a transmissao travar sem explicacao.
    if (dataUri.length > 700_000) {
        throw new Error('Imagem grande demais mesmo apos compressao. Use uma imagem menor.');
    }

    await set(ref(database, `${roomPath(roomId)}/activeImage`), dataUri);
};

export const clearRoomImage = async (roomId: string) => {
    await remove(ref(database, `${roomPath(roomId)}/activeImage`));
};

const blobToDataUri = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });

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

/**
 * Garante que exista um nó de encontro, criando um dormente se preciso.
 *
 * O Diretor precisa montar o mapa e posicionar ameacas ANTES de iniciar o
 * combate — e startEncounter ja e escrito para preservar npcs, obstaculos,
 * tokens e gridSize que existirem. Sem isto, addNPCToEncounter batia em
 * `if (!encounter) return` e nao acontecia nada, sem erro nenhum na tela.
 */
export const ensureEncounter = async (roomId: string): Promise<EncounterState> => {
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);
    const snapshot = await get(encPath);
    const current = snapshot.val() as EncounterState | null;
    if (current) return current;

    const dormant: EncounterState = {
        isActive: false,
        status: 'rolling',
        initiatives: {},
        turnOrder: [],
        currentTurnIndex: 0,
        round: 1,
        npcs: {},
        tokens: {},
        obstacles: {},
        gridSize: 20,
    };
    await set(encPath, dormant);
    return dormant;
};

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

/**
 * Primeira celula livre a partir do centro do mapa.
 *
 * Toda ameaca nascia fixa em (0, 0) — no grid isometrico isso e o canto de
 * cima, e varias ameacas seguidas empilhavam no mesmo losango, dando a
 * impressao de que o botao nao tinha funcionado.
 */
const findFreeCell = (encounter: EncounterState): { x: number; y: number } => {
    const size = encounter.gridSize || 20;
    const taken = new Set(
        Object.values(encounter.tokens || {}).map(t => `${Number(t.x)},${Number(t.y)}`)
    );
    Object.values(encounter.obstacles || {}).forEach(o => {
        if (o.isBlocking) taken.add(`${Number(o.x)},${Number(o.y)}`);
    });

    const mid = Math.floor(size / 2);
    // Anéis concentricos a partir do centro.
    for (let r = 0; r < size; r++) {
        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const x = mid + dx;
                const y = mid + dy;
                if (x < 0 || y < 0 || x >= size || y >= size) continue;
                if (!taken.has(`${x},${y}`)) return { x, y };
            }
        }
    }
    return { x: 0, y: 0 };
};

export const addNPCToEncounter = async (
    roomId: string, 
    npcData: { name: string; initiative: number; icon?: string; color: string; hp: number; maxHp: number; movementMax?: number; combat?: number; attacks?: NpcAttack[] }
) => {
    const npcId = `npc_${crypto.randomUUID()}`;
    const encPath = ref(database, `${roomPath(roomId)}/encounter`);

    // Cria o encontro se ainda nao houver: posicionar ameacas no mapa e uma
    // etapa de preparacao, nao exige combate ja iniciado.
    const encounter = await ensureEncounter(roomId);

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
    const spawn = findFreeCell(encounter);
    updates[`tokens/${npcId}`] = {
        id: npcId,
        x: spawn.x,
        y: spawn.y,
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
        // Inventario nasce vazio de proposito: o kit inicial e concedido pelo
        // ClassSelector no momento em que a classe e confirmada, que e onde a
        // classe realmente existe (aqui ela e sempre o default 'Teamster').
        // Antes isto entregava BALANCED_WEAPONS — as 7 armas do jogo de uma vez,
        // e ainda por cima a mesma referencia de array para todo personagem.
        inventory: []
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

export const addGridObstacle = async (roomId: string, obstacle: GridObstacle) => {
    await ensureEncounter(roomId);
    const obPath = ref(database, `${roomPath(roomId)}/encounter/obstacles/${obstacle.id}`);
    await set(obPath, obstacle);
};

export const removeGridObstacle = async (roomId: string, obstacleId: string) => {
    const obPath = ref(database, `${roomPath(roomId)}/encounter/obstacles/${obstacleId}`);
    await remove(obPath);
};

export const updateEncounterState = async (roomId: string, updates: Partial<EncounterState>) => {
    await ensureEncounter(roomId);
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


// --- SALA TESTE (ferramenta de ADM) ---

export const TEST_ROOM_ID = 'TESTE';
export const TEST_ROOM_PASSWORD = 'teste';

export interface TestRoomSeat {
    /** Nome da janela — estavel, sem espacos, para window.open reaproveitar a aba. */
    key: string;
    label: string;
    url: string;
    characterClass?: CharacterClass;
}

export interface TestRoomSeed {
    roomId: string;
    password: string;
    seats: TestRoomSeat[];
}

/**
 * Assentos da sala de teste. Sincrono e sem tocar no banco de proposito: a UI
 * precisa saber quantas janelas abrir *antes* de esperar a sala ser criada,
 * porque depois de um await o navegador deixa de tratar o clique como gesto do
 * usuario e bloqueia todos os window.open menos o primeiro.
 */
export const getTestRoomSeats = (roomId: string = TEST_ROOM_ID): TestRoomSeat[] => [
    { key: 'diretor', label: 'DIRETOR', url: `/sala/${roomId}/diretor` },
    ...(Object.keys(CLASS_LABELS) as CharacterClass[]).map(cls => ({
        key: cls.toLowerCase(),
        label: CLASS_LABELS[cls],
        url: `/sala/${roomId}/jogador/${testPlayerId(cls)}`,
        characterClass: cls,
    })),
];

const testPlayerId = (cls: CharacterClass) => `teste_${cls.toLowerCase()}`;

const roll2d10 = () => (Math.floor(Math.random() * 10) + 1) + (Math.floor(Math.random() * 10) + 1);

/**
 * Personagem de teste com atributos ja rolados e classe aplicada.
 *
 * createEmptyCharacter deixa tudo zerado porque o jogador preenche a ficha na
 * mesa; numa ficha de teste isso e inutil — com Combate 0 nenhum ataque acerta
 * nada. Aqui os valores saem no padrao Mothership: 2d10+25 para Atributos e
 * 2d10+10 para Resistencias, antes das mutacoes de classe.
 */
export const createTestCharacter = (
    id: string,
    name: string,
    characterClass: CharacterClass
): CharacterSheet => {
    const base = createEmptyCharacter(id, name);
    base.baseStats = {
        strength: roll2d10() + 25,
        speed: roll2d10() + 25,
        intellect: roll2d10() + 25,
        combat: roll2d10() + 25,
    };
    base.baseSaves = {
        sanity: roll2d10() + 10,
        fear: roll2d10() + 10,
        body: roll2d10() + 10,
    };

    return {
        ...base,
        ...applyClassToCharacter(base, characterClass, {
            androidPenaltyStat: 'strength',
            scientistBonusStat: 'intellect',
        }),
    } as CharacterSheet;
};

/**
 * Zera a sala de teste e a repovoa com uma ficha pronta por classe.
 *
 * Destrutivo de proposito: apaga `{namespace}rooms/TESTE` inteira antes de
 * semear, para que cada teste comece do mesmo estado conhecido. So mexe na
 * sala TESTE — nunca em salas de campanha.
 */
export const createTestRoom = async (roomId: string = TEST_ROOM_ID): Promise<TestRoomSeed> => {
    await remove(ref(database, roomPath(roomId)));

    const players: Record<string, CharacterSheet> = {};
    for (const cls of Object.keys(CLASS_LABELS) as CharacterClass[]) {
        const playerId = testPlayerId(cls);
        players[playerId] = createTestCharacter(playerId, CLASS_LABELS[cls], cls);
    }

    await set(ref(database, roomPath(roomId)), {
        settings: { password: TEST_ROOM_PASSWORD },
        players,
        playerOrder: Object.keys(players),
        // Encontro dormente ja incluido: sem ele o Diretor abre a sala de teste
        // e nao consegue adicionar ameaca nem pintar obstaculo.
        encounter: {
            isActive: false,
            status: 'rolling',
            initiatives: {},
            turnOrder: [],
            currentTurnIndex: 0,
            round: 1,
            npcs: {},
            tokens: {},
            obstacles: {},
            gridSize: 20,
        },
    });

    return { roomId, password: TEST_ROOM_PASSWORD, seats: getTestRoomSeats(roomId) };
};
