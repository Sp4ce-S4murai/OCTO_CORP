"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { ref, onValue, Unsubscribe } from "firebase/database";
import { database } from "./firebase";
import {
    CharacterSheet, EncounterState, EnvironmentState, Item, RoomData, Weapon,
} from "../types/character";
import { ShipState } from "../types/ship";
import { roomPath } from "./paths";

/**
 * Estado da sala, fatiado por sub-path.
 *
 * Antes existia um `subscribeToRoom` unico: um onValue em `rooms/{id}` inteiro,
 * montado separadamente por WardenClient, TacticalGrid e PlayerTacticalClient.
 * Qualquer mudanca — 1 de HP, um token andando uma casa — reentregava a sala
 * completa (fichas, logs, nave, inventario global) para cada um desses
 * listeners, e re-renderizava os tres componentes por inteiro.
 *
 * Agora cada sub-path tem seu proprio listener, escrevendo numa fatia propria
 * do store. Um componente que le so `encounter` nao re-renderiza quando muda
 * `/players`, porque a identidade da fatia dele nao mudou.
 */
export interface RoomSlices {
    connected: boolean;
    isLocked: boolean;
    environment: EnvironmentState | null;
    encounter: EncounterState | null;
    players: Record<string, CharacterSheet>;
    playerOrder: string[] | null;
    ship: ShipState | null;
    activeImage: string | null;
    activePanicTest: RoomData['activePanicTest'];
    globalInventory: Record<string, Item | Weapon>;
}

const EMPTY: RoomSlices = {
    connected: false,
    isLocked: false,
    environment: null,
    encounter: null,
    players: {},
    playerOrder: null,
    ship: null,
    activeImage: null,
    activePanicTest: null,
    globalInventory: {},
};

export const useRoomStore = create<RoomSlices>(() => ({ ...EMPTY }));

/**
 * Sub-paths escutados e onde cada um aterrissa no store.
 *
 * `logs` fica de fora de proposito: TerminalLog ja faz sua propria query
 * limitada aos ultimos 50, e trazer o historico inteiro para o store anularia
 * o ganho de nao baixar dados que ninguem esta olhando.
 */
const SLICES: { path: string; key: keyof RoomSlices; fallback: unknown }[] = [
    { path: 'isLocked',        key: 'isLocked',        fallback: false },
    { path: 'environment',     key: 'environment',     fallback: null },
    { path: 'encounter',       key: 'encounter',       fallback: null },
    { path: 'players',         key: 'players',         fallback: {} },
    { path: 'playerOrder',     key: 'playerOrder',     fallback: null },
    { path: 'ship',            key: 'ship',            fallback: null },
    { path: 'activeImage',     key: 'activeImage',     fallback: null },
    { path: 'activePanicTest', key: 'activePanicTest', fallback: null },
    { path: 'globalInventory', key: 'globalInventory', fallback: {} },
];

// Uma unica assinatura por sala, compartilhada por todos os componentes
// montados. Sem esta contagem, PlayerTacticalClient e TacticalGrid — que vivem
// na mesma tela — abririam dois conjuntos completos de listeners.
let activeRoomId: string | null = null;
let refCount = 0;
let unsubs: Unsubscribe[] = [];

function attach(roomId: string) {
    if (activeRoomId === roomId) {
        refCount += 1;
        return;
    }
    detachAll();

    activeRoomId = roomId;
    refCount = 1;
    useRoomStore.setState({ ...EMPTY });

    unsubs = SLICES.map(({ path, key, fallback }) =>
        onValue(ref(database, `${roomPath(roomId)}/${path}`), (snap) => {
            useRoomStore.setState({
                [key]: snap.val() ?? fallback,
                connected: true,
            } as Partial<RoomSlices>);
        })
    );
}

function detachAll() {
    unsubs.forEach(u => u());
    unsubs = [];
    activeRoomId = null;
    refCount = 0;
}

function release() {
    refCount -= 1;
    if (refCount <= 0) {
        detachAll();
        useRoomStore.setState({ ...EMPTY });
    }
}

/** Liga o store nesta sala enquanto o componente estiver montado. */
export function useRoomSync(roomId: string) {
    useEffect(() => {
        if (!roomId) return;
        attach(roomId);
        return () => release();
    }, [roomId]);
}

/**
 * Remonta o RoomData inteiro a partir das fatias.
 *
 * Existe so para os componentes que ainda nao foram migrados para ler fatias
 * (WardenClient). Quem usa isto re-renderiza a qualquer mudanca da sala — ou
 * seja, nao ganha nada alem de dividir os listeners com o resto do app.
 */
export function useComposedRoomData(): RoomData | null {
    const s = useRoomStore();
    if (!s.connected) return null;
    return {
        isLocked: s.isLocked,
        environment: s.environment ?? undefined,
        encounter: s.encounter ?? undefined,
        activePanicTest: s.activePanicTest,
        players: s.players,
        playerOrder: s.playerOrder ?? undefined,
        logs: {},
        activeImage: s.activeImage ?? undefined,
        ship: s.ship ?? undefined,
        globalInventory: s.globalInventory,
    };
}
