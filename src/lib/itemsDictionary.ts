import { CharacterClass, CharacterSheet, Item, Weapon } from "../types/character";

/**
 * FONTE ÚNICA DE VERDADE do banco de itens.
 *
 * Antes existiam dois cadastros paralelos das mesmas 7 armas — este arquivo e
 * `itemPresets.ts` (BALANCED_WEAPONS) — com ids diferentes (`pistol` vs
 * `pistol_01`). `itemPresets.ts` foi removido. Os ids kebab-case daqui são os
 * que as salas em produção já têm em `globalInventory`, então são os que ficam.
 *
 * --- Nota de balanceamento ---
 * O eixo de troca é dano x alcance x precisão (`bonus`, somado ao stat na
 * rolagem d100 de acerto). Antes disso, duas armas dominavam estritamente as
 * outras: o Rifle de Precisão (4d10, alcance 40, +10) era melhor que a Escopeta
 * em todos os eixos, e a Escopeta (4d10, alcance 5) era melhor que o
 * Lança-Chamas (2d10, alcance 5) em todos os eixos. Agora cada arma perde em
 * pelo menos um eixo para cada uma das outras.
 */
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
    // --- Armas ---
    "pistol": {
        id: "pistol",
        name: "Pistola",
        description: "Pistola semiautomática padrão de 12.7mm AP. Leve, precisa e sem pretensão: o que você saca quando o resto já falhou.",
        type: "weapon",
        weight: 1,
        quantity: 1,
        damage: "2d10",
        range: 10,
        baseStat: "combat",
        bonus: 5,
        imageUrl: "/images/weapons/pistol.png"
    } as Weapon,
    "assault-rifle": {
        id: "assault-rifle",
        name: "Rifle de Assalto",
        description: "Fuzil de assalto bullpup confiável e modular. Sem virtudes e sem vícios — o padrão contra o qual todo o resto é medido.",
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
        description: "Escopeta de bombeamento HS-12 Bulldog com munição de tungstênio. Dificílima de errar e devastadora — desde que a coisa já esteja perto demais.",
        type: "weapon",
        weight: 2,
        quantity: 1,
        damage: "4d10",
        range: 4,
        baseStat: "combat",
        bonus: 10,
        imageUrl: "/images/weapons/shotgun.png"
    } as Weapon,
    "flamethrower": {
        id: "flamethrower",
        name: "Lança Chamas",
        description: "Unidade incineradora industrial FT-84 'Hellfire'. Cobre mais corredor que a escopeta e não exige mira — o fogo encontra o caminho sozinho.",
        type: "weapon",
        weight: 3,
        quantity: 1,
        damage: "3d10",
        range: 6,
        baseStat: "combat",
        bonus: 10,
        imageUrl: "/images/weapons/flamethrower.png"
    } as Weapon,
    "sniper-rifle": {
        id: "sniper-rifle",
        name: "Rifle de Precisão",
        description: "Rail-Sniper pesado M-99 'Goliath'. Alcança o outro lado do hangar, mas é pesado, lento de alinhar e inútil se algo encostar em você.",
        type: "weapon",
        weight: 3,
        quantity: 1,
        damage: "4d10",
        range: 40,
        baseStat: "combat",
        bonus: -10,
        imageUrl: "/images/weapons/sniper_rifle.png"
    } as Weapon,
    "molecular-sword": {
        id: "molecular-sword",
        name: "Espada Molecular",
        description: "Lâmina nano-composta com borda monomolecular. Corta blindagem como tecido — se você sobreviver ao trajeto até o alcance de um braço.",
        type: "weapon",
        weight: 1,
        quantity: 1,
        damage: "3d10+5",
        range: 1,
        baseStat: "combat",
        bonus: 5,
        imageUrl: "/images/weapons/molecular_sword.png"
    } as Weapon,
    "vibro-knife": {
        id: "vibro-knife",
        name: "Vibro-Faca",
        description: "Faca de combate ultra-sônica de alta frequência. Rápida o bastante para acertar qualquer coisa, pequena o bastante para raramente resolver o problema de uma vez.",
        type: "weapon",
        weight: 1,
        quantity: 1,
        damage: "2d10+3",
        range: 1,
        baseStat: "combat",
        bonus: 10,
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

/** Rótulos das classes em PT-BR, usados no seletor de classe e nos kits do Diretor. */
export const CLASS_LABELS: Record<CharacterClass, string> = {
    Teamster:  "Operador (Teamster)",
    Soldier:   "Soldado (Soldier)",
    Scientist: "Cientista (Scientist)",
    Android:   "Androide (Android)",
};

/**
 * Kits iniciais indexados por CharacterClass — antes as chaves eram
 * "soldier-kit"/"teamster-kit"/"scientist-kit", que não casavam com o tipo
 * CharacterClass, e o Android não tinha kit nenhum.
 */
export const STARTER_KITS: Record<CharacterClass, string[]> = {
    Soldier:   ["vacc-suit", "assault-rifle", "stimpak"],
    Teamster:  ["vacc-suit", "molecular-sword", "mag-boots"],
    Scientist: ["vacc-suit", "pistol", "med-scanner"],
    Android:   ["vacc-suit", "vibro-knife", "med-scanner"],
};

/**
 * Devolve cópias novas dos itens do kit.
 *
 * Copiar importa: `createEmptyCharacter` antes atribuía o próprio array
 * module-level (`inventory: BALANCED_WEAPONS`) a todo personagem criado, de
 * modo que todos compartilhavam as mesmas instâncias de objeto.
 */
export function getStarterKit(characterClass: CharacterClass): (Item | Weapon)[] {
    return (STARTER_KITS[characterClass] ?? []).map(id => ({ ...GLOBAL_ITEMS[id] }));
}

/**
 * Calcula o inventário resultante de o personagem assumir `newClass`.
 *
 * Remove uma ocorrência de cada item do kit anterior — preservando tudo o que
 * o Diretor entregou à mão durante a sessão — e acrescenta o kit novo.
 * Devolve `null` quando não há nada a fazer (o kit daquela classe já foi dado).
 */
export function computeStarterKitChange(
    character: CharacterSheet,
    newClass: CharacterClass
): Pick<CharacterSheet, 'inventory' | 'starterKit'> | null {
    if (character.starterKit?.characterClass === newClass) return null;

    const inventory = [...(character.inventory ?? [])];
    for (const id of character.starterKit?.itemIds ?? []) {
        const i = inventory.findIndex(it => it.id === id);
        if (i >= 0) inventory.splice(i, 1);
    }

    const kit = getStarterKit(newClass);
    return {
        inventory: [...inventory, ...kit],
        starterKit: { characterClass: newClass, itemIds: kit.map(i => i.id) },
    };
}
