import { CharacterClass, CharacterSheet, Saves, Stats } from "../types/character";
import { computeStarterKitChange } from "./itemsDictionary";

export interface ClassOptions {
    /** Atributo que sofre o -10 da Falha de Sistema do Android. */
    androidPenaltyStat?: keyof Stats;
    /** Atributo que recebe o +5 da Especialização do Cientista. */
    scientistBonusStat?: keyof Stats;
}

/**
 * Calcula o efeito de o personagem assumir uma classe: mutações de atributo e
 * resistência, feridas máximas e kit inicial.
 *
 * Esta lógica vivia inline dentro de ClassSelector.tsx, o que impedia criar um
 * personagem com classe já aplicada fora da UI (por exemplo, ao semear a Sala
 * Teste). É pura de propósito — quem chama decide o que fazer com o payload.
 */
export function applyClassToCharacter(
    character: CharacterSheet,
    cls: CharacterClass,
    opts: ClassOptions = {}
): Partial<CharacterSheet> {
    const classMods: Partial<Stats> = {};
    const classSaveMods: Partial<Saves> = {};

    const stats: Stats = { ...character.baseStats };
    const saves: Saves = { ...character.baseSaves };
    let maxWounds = 2;

    /*
     * MUTAÇÕES DO GENOMA
     */
    if (cls === 'Soldier') {
        classMods.combat = 10;
        classSaveMods.body = 10;
        classSaveMods.fear = 20;
        maxWounds = 3;
    }
    else if (cls === 'Android') {
        classMods.intellect = 20;
        classSaveMods.fear = 60;
        maxWounds = 3;
        if (opts.androidPenaltyStat) {
            classMods[opts.androidPenaltyStat] = -10;
        }
    }
    else if (cls === 'Scientist') {
        classMods.intellect = 10;
        classSaveMods.sanity = 30;
        if (opts.scientistBonusStat) {
            classMods[opts.scientistBonusStat] = (classMods[opts.scientistBonusStat] || 0) + 5;
        }
    }
    else if (cls === 'Teamster') {
        classMods.strength = 5;
        classMods.speed = 5;
        classMods.intellect = 5;
        classMods.combat = 5;
        classSaveMods.sanity = 10;
        classSaveMods.fear = 10;
        classSaveMods.body = 10;
    }

    for (const key in classMods) {
        stats[key as keyof Stats] += classMods[key as keyof Stats] || 0;
    }
    for (const key in classSaveMods) {
        saves[key as keyof Saves] += classSaveMods[key as keyof Saves] || 0;
    }

    const payload: Partial<CharacterSheet> = {
        characterClass: cls,
        classMods,
        classSaveMods,
        stats,
        saves,
        vitals: {
            ...character.vitals,
            wounds: { ...character.vitals.wounds, max: maxWounds }
        }
    };

    // Kit inicial: null quando o kit desta classe já foi concedido, para que
    // reajustar o atributo do Android/Cientista não duplique itens.
    const kitChange = computeStarterKitChange(character, cls);
    if (kitChange) Object.assign(payload, kitChange);

    return payload;
}
