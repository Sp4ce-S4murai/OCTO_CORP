import { Item, Weapon } from "../types/character";

export const GLOBAL_ITEMS: Record<string, Item | Weapon> = {
    "vacc-suit": {
        id: "vacc-suit",
        name: "Traje Espacial (Vaccsuit)",
        description: "Traje padrão para o vácuo, fornece oxigênio e regulação térmica.",
        type: "gear",
        weight: 2,
        quantity: 1,
        imageUrl: "/images/weapons/vacsuit.png"
    },
    "med-scanner": {
        id: "med-scanner",
        name: "Scanner Médico",
        description: "Analisa sinais vitais e diagnostica ferimentos e contaminações.",
        type: "tool",
        weight: 1,
        quantity: 1
    },
    "mag-boots": {
        id: "mag-boots",
        name: "Botas Magnéticas",
        description: "Permite andar em gravidade zero sobre superfícies metálicas.",
        type: "gear",
        weight: 1,
        quantity: 1
    },
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
    } as Weapon,
    "vibro-knife": {
        id: "vibro-knife",
        name: "Vibro-Faca",
        description: "Faca de combate ultra-sônica de alta frequência.",
        type: "weapon",
        weight: 1,
        quantity: 1,
        damage: "1d10+3",
        range: 1,
        baseStat: "combat",
        bonus: 0,
        imageUrl: "/images/weapons/v.png"
    } as Weapon,
    "stimpak": {
        id: "stimpak",
        name: "Stim-pak",
        description: "Injeção de emergência que cura 1d10 de Vida.",
        type: "gear",
        weight: 0,
        quantity: 3
    }
};

export const STARTER_KITS: Record<string, (Item | Weapon)[]> = {
    "soldier-kit": [
        GLOBAL_ITEMS["vacc-suit"],
        GLOBAL_ITEMS["assault-rifle"],
        GLOBAL_ITEMS["stimpak"]
    ],
    "teamster-kit": [
        GLOBAL_ITEMS["vacc-suit"],
        GLOBAL_ITEMS["molecular-sword"],
        GLOBAL_ITEMS["mag-boots"]
    ],
    "scientist-kit": [
        GLOBAL_ITEMS["vacc-suit"],
        GLOBAL_ITEMS["pistol"],
        GLOBAL_ITEMS["med-scanner"]
    ]
};
