import { Item, Weapon } from "../types/character";

export const GLOBAL_ITEMS: Record<string, Item | Weapon> = {
    "pistol": {
        id: "pistol",
        name: "Pistola",
        description: "Pistola semiautomática padrão de 12.7mm AP.",
        type: "weapon",
        weight: 1,
        quantity: 1,
        damage: "1d10",
        range: 10,
        baseStat: "combat",
        bonus: 0,
        imageUrl: "/images/weapons/pistol.png"
    } as Weapon,
    "assault-rifle": {
        id: "assault-rifle",
        name: "Rifle de Assalto",
        description: "Fuzil de assalto bullpup confiável e modular.",
        type: "weapon",
        weight: 2,
        quantity: 1,
        damage: "3d10",
        range: 20,
        baseStat: "combat",
        bonus: 0,
        imageUrl: "/images/weapons/assault_rifle.png"
    } as Weapon,
    "shotgun": {
        id: "shotgun",
        name: "Escopeta (Punheteira)",
        description: "Escopeta de bombeamento HS-12 Bulldog com munição de tungstênio.",
        type: "weapon",
        weight: 2,
        quantity: 1,
        damage: "4d10",
        range: 5,
        baseStat: "combat",
        bonus: 0,
        imageUrl: "/images/weapons/shotgun.png"
    } as Weapon,
    "flamethrower": {
        id: "flamethrower",
        name: "Lança Chamas",
        description: "Unidade incineradora industrial FT-84 'Hellfire'.",
        type: "weapon",
        weight: 3,
        quantity: 1,
        damage: "2d10",
        range: 5,
        baseStat: "combat",
        bonus: 0,
        imageUrl: "/images/weapons/flamethrower.png"
    } as Weapon,
    "sniper-rifle": {
        id: "sniper-rifle",
        name: "Rifle de Precisão",
        description: "Rail-Sniper pesado M-99 'Goliath' para alvos de longo alcance.",
        type: "weapon",
        weight: 3,
        quantity: 1,
        damage: "4d10",
        range: 40,
        baseStat: "combat",
        bonus: 10,
        imageUrl: "/images/weapons/sniper_rifle.png"
    } as Weapon,
    "molecular-sword": {
        id: "molecular-sword",
        name: "Espada Molecular",
        description: "Lâmina nano-composta com borda monomolecular.",
        type: "weapon",
        weight: 1,
        quantity: 1,
        damage: "2d10+5",
        range: 1,
        baseStat: "combat",
        bonus: 0,
        imageUrl: "/images/weapons/molecular_sword.png"
    } as Weapon
};

export const STARTER_KITS: Record<string, (Item | Weapon)[]> = {
    "soldier-kit": [
        GLOBAL_ITEMS["assault-rifle"],
        GLOBAL_ITEMS["pistol"]
    ],
    "teamster-kit": [
        GLOBAL_ITEMS["molecular-sword"],
        GLOBAL_ITEMS["shotgun"]
    ],
    "sniper-kit": [
        GLOBAL_ITEMS["sniper-rifle"],
        GLOBAL_ITEMS["pistol"]
    ]
};
