import { Weapon } from "@/types/character";

export const BALANCED_WEAPONS: Weapon[] = [
    {
        id: "pistol_01",
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
    },
    {
        id: "assault_rifle_01",
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
    },
    {
        id: "shotgun_01",
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
    },
    {
        id: "flamethrower_01",
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
    },
    {
        id: "sniper_rifle_01",
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
    },
    {
        id: "molecular_sword_01",
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
    },
    {
        id: "vibro_knife_01",
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
    }
];
