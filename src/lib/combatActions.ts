"use client";

import { startEncounter, beginTurns, endEncounter, pushLog } from "./database";
import { CharacterSheet, EncounterState } from "@/types/character";

const getTimestamp = () => Date.now();

/**
 * Ordem de jogadores efetiva: playerOrder salvo, com qualquer jogador novo
 * (ainda sem entrada salva) anexado ao fim.
 *
 * Extraida de WardenClient.getCurrentOrder para ser reaproveitada por quem
 * mais precisar iniciar turnos — hoje o proprio TacticalGrid, que ganhou seu
 * gerenciador de combate para o Diretor nao precisar alternar entre o painel
 * e o mapa tatico no meio de uma cena.
 */
export function getOrderedPlayerIds(
    players: Record<string, CharacterSheet> | undefined,
    playerOrder: string[] | undefined
): string[] {
    if (!players) return [];
    const allIds = Object.keys(players);
    const saved = playerOrder || [];
    const validSaved = new Set(saved.filter(id => allIds.includes(id)));
    return [...saved.filter(id => validSaved.has(id)), ...allIds.filter(id => !validSaved.has(id))];
}

/** Abre a fase de rolagem de iniciativa. */
export async function startCombat(roomId: string) {
    await startEncounter(roomId);
    await pushLog(roomId, {
        timestamp: getTimestamp(),
        playerName: "SISTEMA",
        playerId: "SYSTEM",
        statName: 'INICIATIVA REQUISITADA',
        statValue: 0,
        roll: 0,
        result: 'Warden Message',
    });
}

/**
 * Fecha a rolagem de iniciativa e comeca os turnos, ordenando por iniciativa
 * decrescente. Quem ainda nao rolou entra no fim da fila, na ordem salva da
 * sala — assim uma rolagem esquecida nao trava o combate.
 */
export async function beginTurnsFromInitiative(
    roomId: string,
    encounter: EncounterState,
    players: Record<string, CharacterSheet> | undefined,
    playerOrder: string[] | undefined
) {
    const initiatives = encounter.initiatives || {};
    const sortedIds = Object.entries(initiatives)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id);

    for (const id of getOrderedPlayerIds(players, playerOrder)) {
        if (!sortedIds.includes(id)) sortedIds.push(id);
    }

    await beginTurns(roomId, sortedIds);
    await pushLog(roomId, {
        timestamp: getTimestamp(),
        playerName: "SISTEMA",
        playerId: "SYSTEM",
        statName: 'COMBATE INICIADO',
        statValue: 0,
        roll: 0,
        result: 'Warden Message',
    });
}

/** Encerra o combate por completo, removendo o no /encounter. */
export async function endCombat(roomId: string) {
    await endEncounter(roomId);
    await pushLog(roomId, {
        timestamp: getTimestamp(),
        playerName: "SISTEMA",
        playerId: "SYSTEM",
        statName: 'COMBATE ENCERRADO',
        statValue: 0,
        roll: 0,
        result: 'Warden Message',
    });
}
