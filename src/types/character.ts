export type CharacterClass = 'Soldier' | 'Android' | 'Scientist' | 'Teamster';

export interface Vitals {
    health: { current: number; max: number };
    wounds: { current: number; max: number };
    stress: { current: number; min: number };
}

export interface Stats {
    strength: number;
    speed: number;
    intellect: number;
    combat: number;
}

export interface Saves {
    sanity: number;
    fear: number;
    body: number;
}

export interface SkillNode {
    name: string;
    tier: 'Básicas (+10)' | 'Expertises (+15)' | 'Maestrias (+20)';
    isActive: boolean;
    prerequisites: string[]; // Names of parent skills required
}

export interface Skills {
    trained: Record<string, SkillNode>;
    expert: Record<string, SkillNode>;
    master: Record<string, SkillNode>;
}

export interface CharacterSheet {
    id: string; // Unique ID scoped within the room
    name: string;
    pronouns: string;
    characterClass: CharacterClass;

    // We split stats to allow base (rolled) vs class mods
    baseStats: Stats;
    classMods: Partial<Stats>; // Deltas applied by class (e.g. Android +20 Intellect)
    stats: Stats; // The derived total used for rolls (baseStats + classMods)

    baseSaves: Saves;
    classSaveMods: Partial<Saves>;
    saves: Saves;

    vitals: Vitals;
    skills: Skills;
}

// Room represents the collection of players in a specific Warden session
export interface RoomData {
    players: Record<string, CharacterSheet>;
    logs: Record<string, RollLog>;
}

export interface RollLog {
    id: string;
    timestamp: number;
    playerName: string;
    playerId: string;
    statName: string; // e.g., "Strength", "Sanity", or "Panic"
    statValue: number;
    modifier?: { name: string; value: number }; // +10, +15, +20
    roll: number;
    result: 'Success' | 'Critical Success' | 'Failure' | 'Critical Failure' | 'Panic Fail' | 'Panic Success';
}
