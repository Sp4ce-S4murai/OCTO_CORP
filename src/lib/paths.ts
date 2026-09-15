/**
 * Fonte única de verdade para os caminhos do Realtime Database.
 *
 * Toda a branch v2 escreve sob um namespace próprio (`v2_rooms`, `v2_users`, …)
 * para que testes e previews nunca toquem nos dados da mesa em produção.
 * Quando a migração for validada, basta publicar NEXT_PUBLIC_RTDB_NAMESPACE=""
 * na Vercel — nenhum caminho precisa ser reescrito à mão.
 */
export const RTDB_NAMESPACE = process.env.NEXT_PUBLIC_RTDB_NAMESPACE ?? 'v2_';

export const roomsRoot = () => `${RTDB_NAMESPACE}rooms`;
export const mapsRoot = () => `${RTDB_NAMESPACE}maps`;

export const roomPath = (roomId: string) => `${roomsRoot()}/${roomId}`;

export const playersPath = (roomId: string) => `${roomPath(roomId)}/players`;
export const playerPath = (roomId: string, playerId: string) => `${playersPath(roomId)}/${playerId}`;
export const logsPath = (roomId: string) => `${roomPath(roomId)}/logs`;
export const encounterPath = (roomId: string) => `${roomPath(roomId)}/encounter`;
export const shipPath = (roomId: string) => `${roomPath(roomId)}/ship`;
export const environmentPath = (roomId: string) => `${roomPath(roomId)}/environment`;
export const isLockedPath = (roomId: string) => `${roomPath(roomId)}/isLocked`;
export const activeImagePath = (roomId: string) => `${roomPath(roomId)}/activeImage`;
export const activePanicTestPath = (roomId: string) => `${roomPath(roomId)}/activePanicTest`;
export const globalInventoryPath = (roomId: string) => `${roomPath(roomId)}/globalInventory`;

export const userProfilePath = (userId: string) => `${RTDB_NAMESPACE}users/${userId}/characters`;

/** Templates de mapa reutilizáveis, fora do estado ao vivo da sala (Fase 4). */
export const mapPath = (mapId: string) => `${mapsRoot()}/${mapId}`;

/** Prefixo usado pelo Firebase Storage para as imagens transmitidas na sala. */
export const roomImageStoragePath = (roomId: string, fileName: string) =>
    `${RTDB_NAMESPACE}rooms/${roomId}/images/${fileName}`;
