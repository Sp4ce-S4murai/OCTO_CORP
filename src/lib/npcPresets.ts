import { NpcAttack } from "@/types/character";

export const NPC_CLASSES: Record<string, { name: string, combat: number, hp: number, movementMax: number, icon: string, attacks: NpcAttack[], color: string }> = {
    'Customizado': { name: '', combat: 45, hp: 20, movementMax: 6, icon: '👾', attacks: [], color: 'bg-red-500' },
    'Alien': { name: 'Xenomorfo Base', combat: 60, hp: 30, movementMax: 8, icon: '👾', color: 'bg-purple-500', attacks: [{ name: 'Garras', damage: '2d10', range: 1 }] },
    'Sintético': { name: 'Androide Hostil', combat: 50, hp: 40, movementMax: 6, icon: '🤖', color: 'bg-cyan-400', attacks: [{ name: 'Pancada Mecânica', damage: '1d10+5', range: 1 }] },
    'Mercenário': { name: 'Mercenário Humano', combat: 40, hp: 20, movementMax: 6, icon: '👤', color: 'bg-orange-500', attacks: [{ name: 'Rifle', damage: '2d10', range: 5 }] },
    'Criatura': { name: 'Monstro Local', combat: 45, hp: 25, movementMax: 6, icon: '🕷️', color: 'bg-yellow-400', attacks: [{ name: 'Mordida', damage: '1d10', range: 1 }] },
    'Morto-Vivo': { name: 'Infectado', combat: 35, hp: 15, movementMax: 4, icon: '🧟', color: 'bg-pink-500', attacks: [{ name: 'Agarrão', damage: '1d5', range: 1 }] },
    'Clone': { name: 'Clone de Jogador', combat: 45, hp: 20, movementMax: 6, icon: '👥', color: 'bg-zinc-600', attacks: [] },
};

export const NPC_RANKS: Record<string, { name: string, combatMod: number, hpMult: number }> = {
    'Bucha': { name: 'Bucha (Minion)', combatMod: -15, hpMult: 0.5 },
    'Normal': { name: 'Normal', combatMod: 0, hpMult: 1 },
    'Elite': { name: 'Elite', combatMod: +15, hpMult: 1.5 },
    'Chefe': { name: 'Chefe (Boss)', combatMod: +30, hpMult: 3 },
};
