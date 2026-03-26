export type StationRole = 'pilot' | 'gunner' | 'engineer' | 'science' | 'unassigned';

export interface ShipStats {
    armor: number;       // AR — reduz dano recebido
    combat: number;      // CBT — alvo para rolagens ofensivas (d100 ≤ CBT)
    speed: number;       // SPD — iniciativa e esquiva
    sensors: number;     // SNS — detecção, lock-on, escaneamento
}

export type SystemStatus = 'online' | 'damaged' | 'offline';

export interface SystemState {
    status: SystemStatus;
    integrity: number;    // 0-100
}

export interface ShipSystems {
    propulsion:  SystemState;
    lifeSupport: SystemState;
    weapons:     SystemState;
    sensors:     SystemState;
}

export interface ShipWeapon {
    id: string;
    name: string;
    damage: string;         // ex: "2d10", "4d10"
    ammoCost: number;       // munição consumida por disparo
    type: 'kinetic' | 'energy' | 'torpedo' | 'pointDefense';
    cooldown: number;       // turnos de recarga (0 = sem cooldown)
    currentCooldown: number;
}

export interface ShipResources {
    fuel:   { current: number; max: number };
    oxygen: { current: number; max: number };
    ammo:   { current: number; max: number };
}

export interface ShipStation {
    role: StationRole;
    occupantId: string | null;
    occupantName: string | null;
}

export type ShipActionType = 'fire' | 'evade' | 'scan' | 'repair' | 'redirect_power' | 'brace';

export interface ShipAction {
    type: ShipActionType;
    stationRole: StationRole;
    playerId: string;
    playerName: string;
    weaponId?: string;
    targetSystem?: string;
    roll?: number;
    targetValue?: number;
    result?: 'pending' | 'success' | 'failure' | 'critical_success' | 'critical_failure';
    description?: string;
}

export interface ShipCombatState {
    isActive: boolean;
    round: number;
    phase: 'initiative' | 'stations' | 'resolution' | 'damage';
    playerShipInitiative: number;
    enemyInitiative: number;
    playerGoesFirst: boolean;
    actionsThisRound: Record<string, ShipAction>;  // stationRole -> ação
    combatLog: string[];     // últimas mensagens de combate
}

export interface EnemyShip {
    id: string;
    name: string;
    stats: ShipStats;
    hp: { current: number; max: number };
    weapons: ShipWeapon[];
    icon: string;
    revealed: boolean;       // se o cientista escaneou
}

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'catastrophic';

export interface ShipAlert {
    id: string;
    timestamp: number;
    severity: AlertSeverity;
    message: string;
    system?: string;
}

export interface ShipState {
    name: string;
    class: string;                    // ex: "Cargueiro Classe-C", "Corveta Militar"
    stats: ShipStats;
    hp: { current: number; max: number };
    systems: ShipSystems;
    resources: ShipResources;
    weapons: Record<string, ShipWeapon>;
    stations: Record<string, ShipStation>;  // 'bridge' | 'tactical' | 'engineering' | 'science'
    combat?: ShipCombatState;
    enemies?: Record<string, EnemyShip>;
    alerts?: Record<string, ShipAlert>;
}

// --- Ship Template Presets ---

export interface ShipTemplate {
    name: string;
    class: string;
    stats: ShipStats;
    hp: { current: number; max: number };
    weapons: ShipWeapon[];
}

export const SHIP_PRESETS: Record<string, ShipTemplate> = {
    'Cargueiro Classe-C': {
        name: 'USCSS Cronus',
        class: 'Cargueiro Classe-C',
        stats: { armor: 20, combat: 30, speed: 25, sensors: 35 },
        hp: { current: 40, max: 40 },
        weapons: [
            { id: 'w1', name: 'Canhão PDC', damage: '1d10', ammoCost: 1, type: 'pointDefense', cooldown: 0, currentCooldown: 0 },
        ]
    },
    'Corveta Militar': {
        name: 'TCS Warhound',
        class: 'Corveta Militar',
        stats: { armor: 35, combat: 50, speed: 40, sensors: 30 },
        hp: { current: 60, max: 60 },
        weapons: [
            { id: 'w1', name: 'Baterias de Railgun', damage: '2d10', ammoCost: 2, type: 'kinetic', cooldown: 0, currentCooldown: 0 },
            { id: 'w2', name: 'Torpedo Thermonuclear', damage: '4d10', ammoCost: 5, type: 'torpedo', cooldown: 2, currentCooldown: 0 },
        ]
    },
    'Nave Científica': {
        name: 'DSRV Eureka',
        class: 'Nave Científica',
        stats: { armor: 10, combat: 15, speed: 30, sensors: 60 },
        hp: { current: 25, max: 25 },
        weapons: [
            { id: 'w1', name: 'Laser de Corte', damage: '1d10', ammoCost: 1, type: 'energy', cooldown: 1, currentCooldown: 0 },
        ]
    },
    'Estação Orbital': {
        name: 'Prospect Station',
        class: 'Estação Orbital',
        stats: { armor: 45, combat: 25, speed: 0, sensors: 50 },
        hp: { current: 80, max: 80 },
        weapons: [
            { id: 'w1', name: 'Baterias Defensivas', damage: '2d10', ammoCost: 2, type: 'pointDefense', cooldown: 0, currentCooldown: 0 },
            { id: 'w2', name: 'Canhão de Massa', damage: '3d10', ammoCost: 3, type: 'kinetic', cooldown: 1, currentCooldown: 0 },
        ]
    }
};

export const ENEMY_PRESETS: Record<string, Omit<EnemyShip, 'id'>> = {
    'Caçador Pirata': {
        name: 'Caçador Pirata',
        stats: { armor: 15, combat: 40, speed: 45, sensors: 20 },
        hp: { current: 30, max: 30 },
        weapons: [
            { id: 'ew1', name: 'Autocanhões', damage: '1d10', ammoCost: 1, type: 'kinetic', cooldown: 0, currentCooldown: 0 },
        ],
        icon: '🏴‍☠️',
        revealed: false
    },
    'Cruzador Corporativo': {
        name: 'Cruzador Corporativo',
        stats: { armor: 40, combat: 55, speed: 30, sensors: 45 },
        hp: { current: 70, max: 70 },
        weapons: [
            { id: 'ew1', name: 'Baterias de Plasma', damage: '3d10', ammoCost: 3, type: 'energy', cooldown: 0, currentCooldown: 0 },
            { id: 'ew2', name: 'Mísseis Guiados', damage: '2d10', ammoCost: 2, type: 'torpedo', cooldown: 1, currentCooldown: 0 },
        ],
        icon: '🛡️',
        revealed: false
    },
    'Entidade Biológica': {
        name: 'Entidade Biológica Desconhecida',
        stats: { armor: 50, combat: 60, speed: 35, sensors: 10 },
        hp: { current: 50, max: 50 },
        weapons: [
            { id: 'ew1', name: 'Investida Orgânica', damage: '3d10', ammoCost: 0, type: 'kinetic', cooldown: 1, currentCooldown: 0 },
            { id: 'ew2', name: 'Jato Ácido', damage: '2d10', ammoCost: 0, type: 'energy', cooldown: 0, currentCooldown: 0 },
        ],
        icon: '👾',
        revealed: false
    },
    'Drone Autônomo': {
        name: 'Drone de Combate',
        stats: { armor: 10, combat: 35, speed: 55, sensors: 40 },
        hp: { current: 15, max: 15 },
        weapons: [
            { id: 'ew1', name: 'Laser Pulse', damage: '1d10', ammoCost: 0, type: 'energy', cooldown: 0, currentCooldown: 0 },
        ],
        icon: '🤖',
        revealed: false
    }
};
