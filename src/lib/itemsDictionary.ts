import { Item, Weapon } from "../types/character";

export const GLOBAL_ITEMS: Record<string, Item | Weapon> = {
    "vacc-suit": {
        id: "vacc-suit",
        name: "Traje Espacial (Vaccsuit)",
        description: "Traje padrão para o vácuo, fornece oxigênio e regulação térmica.",
        type: "gear",
        weight: 2,
        quantity: 1
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
    "assault-rifle": {
        id: "assault-rifle",
        name: "Rifle de Assalto",
        description: "Arma tática padrão militar. (4d10 Dano)",
        type: "weapon",
        damage: "4d10",
        range: 15,
        baseStat: "combat",
        bonus: 0,
        weight: 2,
        quantity: 1
    } as Weapon,
    "flamethrower": {
        id: "flamethrower",
        name: "Lança-chamas",
        description: "Arma de Efeito de Área. (3d10 Dano)",
        type: "weapon",
        damage: "3d10",
        range: 3,
        baseStat: "combat",
        bonus: 0,
        weight: 2,
        quantity: 1
    } as Weapon,
    "revolver": {
        id: "revolver",
        name: "Revólver",
        description: "Arma de fogo confiável. (2d10 Dano)",
        type: "weapon",
        damage: "2d10",
        range: 8,
        baseStat: "combat",
        bonus: 5,
        weight: 1,
        quantity: 1
    } as Weapon,
    "katana": {
        id: "katana",
        name: "Katana",
        description: "Lâmina monomolecular para combate corpo a corpo.",
        type: "weapon",
        damage: "1d10+STR",
        range: 1,
        baseStat: "strength",
        bonus: 10,
        weight: 1,
        quantity: 1
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
        GLOBAL_ITEMS["katana"],
        GLOBAL_ITEMS["mag-boots"]
    ],
    "scientist-kit": [
        GLOBAL_ITEMS["vacc-suit"],
        GLOBAL_ITEMS["revolver"],
        GLOBAL_ITEMS["med-scanner"]
    ]
};
