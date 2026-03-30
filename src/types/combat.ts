export type TokenType = 'player' | 'enemy' | 'npc';
export type CoverType = 'none' | 'half' | 'full';

export interface Token {
    id: string;
    type: TokenType;
    name: string;
    x: number; // grid x coordinate
    y: number; // grid y coordinate
    hp: number;
    maxHp: number;
    speed: number;
    cover: CoverType;
}

export interface CombatState {
    isActive: boolean;
    round: number;
    currentTurnIndex: number;
    initiativeOrder: string[]; // Token IDs
    tokens: Record<string, Token>;
    gridSize: number; // default 50
}
