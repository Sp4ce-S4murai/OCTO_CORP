/**
 * Projecao isometrica — CAMADA VISUAL APENAS.
 *
 * A logica de jogo continua sendo grade cartesiana 2D pura: distancia
 * Chebyshev, linha de visao por Bresenham (tacticalUtils.ts), tokens com x/y
 * inteiros. Nada aqui entra no estado do jogo; isto so traduz (x, y) do
 * tabuleiro para pixels na tela e de volta.
 */

/** Losango classico 2:1. */
export const TILE_W = 64;
export const TILE_H = 32;

export interface Point { x: number; y: number }

/** Centro do losango da celula (x, y), em pixels, antes de qualquer offset. */
export function gridToScreen(x: number, y: number, tileW = TILE_W, tileH = TILE_H): Point {
    return {
        x: (x - y) * (tileW / 2),
        y: (x + y) * (tileH / 2),
    };
}

/**
 * Inverso de gridToScreen. Resolvendo o sistema:
 *   sx = (x - y) * W/2   ->   x - y = 2*sx/W
 *   sy = (x + y) * H/2   ->   x + y = 2*sy/H
 * chega-se a x = sx/W + sy/H e y = sy/H - sx/W.
 *
 * Devolve coordenada fracionaria; arredondar da a celula sob o ponteiro,
 * porque os centros das celulas sao os inteiros.
 */
export function screenToGrid(sx: number, sy: number, tileW = TILE_W, tileH = TILE_H): Point {
    return {
        x: sx / tileW + sy / tileH,
        y: sy / tileH - sx / tileW,
    };
}

export function screenToCell(sx: number, sy: number, tileW = TILE_W, tileH = TILE_H): Point {
    const p = screenToGrid(sx, sy, tileW, tileH);
    return { x: Math.round(p.x), y: Math.round(p.y) };
}

/** Pontos do losango de uma celula, relativos ao proprio centro. */
export function diamondPoints(tileW = TILE_W, tileH = TILE_H): number[] {
    return [0, -tileH / 2, tileW / 2, 0, 0, tileH / 2, -tileW / 2, 0];
}

/**
 * Deslocamento que traz o tabuleiro inteiro para coordenadas positivas.
 * Em projecao isometrica a coluna 0 fica a esquerda do zero, entao sem isto
 * metade do mapa nasce fora da tela.
 */
export function boardOffset(gridSize: number, tileW = TILE_W): Point {
    return { x: (gridSize - 1) * (tileW / 2), y: 0 };
}

export function boardPixelSize(gridSize: number, tileW = TILE_W, tileH = TILE_H) {
    return { width: gridSize * tileW, height: gridSize * tileH };
}

/** Ordem de desenho: quem esta mais "a frente" (x+y maior) cobre quem esta atras. */
export function depth(x: number, y: number): number {
    return x + y;
}

/**
 * Konva precisa de cor real, mas o banco guarda classe Tailwind (`bg-red-500`)
 * — foi assim que os tokens e obstaculos ja existentes foram gravados, entao
 * traduzir aqui e mais barato do que migrar os dados.
 */
const TAILWIND_HEX: Record<string, string> = {
    // paleta de tokens/NPC
    'bg-red-500': '#ef4444',
    'bg-orange-500': '#f97316',
    'bg-purple-500': '#a855f7',
    'bg-pink-500': '#ec4899',
    'bg-yellow-400': '#facc15',
    'bg-cyan-400': '#22d3ee',
    'bg-emerald-500': '#10b981',
    'bg-emerald-400': '#34d399',
    'bg-blue-500': '#3b82f6',
    'bg-zinc-600': '#52525b',
    // paleta do editor de mapa (TacticalGrid > MODO EDITOR)
    'bg-zinc-700': '#3f3f46',
    'bg-zinc-400': '#a1a1aa',
    'bg-red-600': '#dc2626',
    'bg-amber-600': '#d97706',
    'bg-yellow-500': '#eab308',
    'bg-blue-600': '#2563eb',
    'bg-emerald-600': '#059669',
    'bg-purple-600': '#9333ea',
    'bg-indigo-600': '#4f46e5',
    'bg-rose-600': '#e11d48',
    // usadas por presets e por dados antigos
    'bg-zinc-800': '#27272a',
    'bg-stone-600': '#57534e',
    'bg-amber-700': '#b45309',
};

export function tailwindToHex(cls: string | undefined, fallback = '#52525b'): string {
    if (!cls) return fallback;
    if (cls.startsWith('#')) return cls;
    return TAILWIND_HEX[cls] ?? fallback;
}

/**
 * Faces de um bloco isometrico erguido sobre a celula, com altura `h`.
 *
 * Losango flat nao distingue parede de cobertura — as duas viravam a mesma
 * mancha colorida. Com volume, parede vira cubo inteiro e cobertura meio
 * cubo, que e a leitura que a mesa espera.
 */
export function cubeFaces(h: number, tileW = TILE_W, tileH = TILE_H) {
    const hw = tileW / 2;
    const hh = tileH / 2;
    return {
        // Topo: o mesmo losango, erguido em h.
        top: [0, -hh - h, hw, -h, 0, hh - h, -hw, -h],
        // Face voltada para baixo-esquerda.
        left: [-hw, 0, 0, hh, 0, hh - h, -hw, -h],
        // Face voltada para baixo-direita.
        right: [0, hh, hw, 0, hw, -h, 0, hh - h],
    };
}

/** Escurece/clareia um hex, para dar sombreamento as faces do bloco. */
export function shade(hex: string, factor: number): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
        .map(c => Math.max(0, Math.min(255, Math.round(c * factor))));
    return `#${ch.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Altura do bloco por tipo de obstaculo, em pixels.
 *
 * Num tile isometrico 2:1 a aresta vertical de um cubo perfeito mede tileW/2,
 * que aqui e igual a TILE_H. Usar o dobro disso deixava a parede alta demais e
 * escondia por completo qualquer token atras dela.
 */
export function obstacleHeight(type: string, tileH = TILE_H): number {
    if (type === 'hazard') return 0;         // perigo de chao, sem volume
    if (type === 'cover') return tileH / 2;  // meio bloco
    return tileH;                            // parede e porta: cubo inteiro
}
