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
export function checkLineOfSight(x1: number, y1: number, x2: number, y2: number, encounter: EncounterState | null): LOSResult {
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
