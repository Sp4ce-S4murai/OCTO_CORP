import { EncounterState } from "@/types/character";

export interface LOSResult {
    blocked: boolean;
    penalty: number;
    cells: { x: number; y: number }[];
}

/**
 * Bresenham's line algorithm to find all cells between two points
 */
export function getLineOfSightCells(x1: number, y1: number, x2: number, y2: number): { x: number; y: number }[] {
    const cells: { x: number; y: number }[] = [];
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = (x1 < x2) ? 1 : -1;
    const sy = (y1 < y2) ? 1 : -1;
    let err = dx - dy;

    let currX = x1;
    let currY = y1;

    while (true) {
        if (currX === x2 && currY === y2) break;
        
        // Skip the start cell
        if (currX !== x1 || currY !== y1) {
            cells.push({ x: currX, y: currY });
        }

        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; currX += sx; }
        if (e2 < dx) { err += dx; currY += sy; }
    }

    return cells;
}

/**
 * Checks if there is a clear line of sight and calculates cover penalties
 */
export function checkLineOfSight(x1: number, y1: number, x2: number, y2: number, encounter: EncounterState | null | undefined): LOSResult {
    if (!encounter) return { blocked: false, penalty: 0, cells: [] };
    
    const cells = getLineOfSightCells(x1, y1, x2, y2);
    const obstacles = Object.values(encounter.obstacles || {});
    
    let blocked = false;
    let penalty = 0;

    for (const cell of cells) {
        const obs = obstacles.find(o => Number(o.x) === cell.x && Number(o.y) === cell.y);
        if (obs) {
            if (obs.isOpaque) {
                blocked = true;
                break;
            }
            if (obs.type === 'cover') {
                penalty += 20; // -20% Combat penalty for cover
            }
        }
    }

    return { blocked, penalty, cells };
}

/**
 * A celula esta bloqueada para movimento?
 *
 * Bloqueiam: obstaculos com isBlocking (parede, porta, cobertura) e qualquer
 * outro token vivo. Cadaver nao bloqueia — dar a volta num corpo no meio do
 * corredor so atrapalharia a mesa. `moverId` e ignorado para o token nao
 * bloquear a si mesmo.
 */
export function isCellBlocked(
    x: number,
    y: number,
    encounter: EncounterState | null | undefined,
    moverId?: string
): boolean {
    if (!encounter) return false;

    const obstacle = Object.values(encounter.obstacles || {}).find(
        o => Number(o.x) === x && Number(o.y) === y
    );
    if (obstacle?.isBlocking) return true;

    for (const [id, token] of Object.entries(encounter.tokens || {})) {
        if (id === moverId) continue;
        if (Number(token.x) !== x || Number(token.y) !== y) continue;
        const npc = encounter.npcs?.[id];
        const isCorpse = npc ? (npc.isDead || npc.hp <= 0) : false;
        if (!isCorpse) return true;
    }

    return false;
}

/**
 * Celulas que o token alcanca com o movimento que lhe resta, e o custo de cada
 * uma. Busca em largura em 8 direcoes, cada passo custando 1 — mesma metrica
 * Chebyshev que o resto do jogo ja usa.
 *
 * Antes o alcance era so a distancia Chebyshev ate o destino, o que deixava o
 * token atravessar parede em linha reta: os blocos existiam no desenho mas nao
 * paravam ninguem. Com a busca, contornar a parede custa os passos do contorno,
 * e o que nao tem caminho simplesmente nao entra no conjunto.
 */
export function computeReachableCells(
    startX: number,
    startY: number,
    budget: number,
    encounter: EncounterState | null | undefined,
    moverId?: string
): Map<string, number> {
    const reachable = new Map<string, number>();
    if (budget <= 0) return reachable;

    const size = encounter?.gridSize || 20;
    const queue: { x: number; y: number; cost: number }[] = [{ x: startX, y: startY, cost: 0 }];
    const seen = new Set<string>([`${startX},${startY}`]);

    while (queue.length > 0) {
        const cur = queue.shift()!;
        if (cur.cost >= budget) continue;

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = cur.x + dx;
                const ny = cur.y + dy;
                const key = `${nx},${ny}`;
                if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
                if (seen.has(key)) continue;
                seen.add(key);
                if (isCellBlocked(nx, ny, encounter, moverId)) continue;

                const cost = cur.cost + 1;
                reachable.set(key, cost);
                queue.push({ x: nx, y: ny, cost });
            }
        }
    }

    return reachable;
}
