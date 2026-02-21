"use client";

import { useEffect, useState, useMemo } from "react";
import { CharacterSheet, Skills, SkillNode, CharacterClass } from "@/types/character";
import { updatePlayer } from "@/lib/database";

interface Props {
    roomId: string;
    character: CharacterSheet;
}

// Flat representation of the complex Skill Tree
export const RAW_SKILLS: SkillNode[] = [
    // BÁSICAS
    { name: "Linguística", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Zoologia", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Botânica", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Geologia", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Maquinário", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Reparos", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Química", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Computação", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Gravidade Zero", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Matemática", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Arte", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Arqueologia", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Teologia", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Treino Militar", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Malandragem", tier: "Básicas (+10)", isActive: false, prerequisites: [] },
    { name: "Atletismo", tier: "Básicas (+10)", isActive: false, prerequisites: [] },

    // EXPERTISES
    { name: "Psicologia", tier: "Expertises (+15)", isActive: false, prerequisites: ["Linguística", "Zoologia"] },
    { name: "Patologia", tier: "Expertises (+15)", isActive: false, prerequisites: ["Zoologia", "Botânica"] },
    { name: "Medicina", tier: "Expertises (+15)", isActive: false, prerequisites: ["Zoologia"] },
    { name: "Ecologia", tier: "Expertises (+15)", isActive: false, prerequisites: ["Botânica", "Geologia"] },
    { name: "Mineração", tier: "Expertises (+15)", isActive: false, prerequisites: ["Geologia", "Maquinário"] },
    { name: "Mecânica", tier: "Expertises (+15)", isActive: false, prerequisites: ["Maquinário", "Reparos"] },
    { name: "Explosivos", tier: "Expertises (+15)", isActive: false, prerequisites: ["Reparos", "Química"] },
    { name: "Farmacologia", tier: "Expertises (+15)", isActive: false, prerequisites: ["Química"] },
    { name: "Hacking", tier: "Expertises (+15)", isActive: false, prerequisites: ["Computação"] },
    { name: "Pilotagem", tier: "Expertises (+15)", isActive: false, prerequisites: ["Gravidade Zero", "Matemática"] },
    { name: "Física", tier: "Expertises (+15)", isActive: false, prerequisites: ["Matemática"] },
    { name: "Misticismo", tier: "Expertises (+15)", isActive: false, prerequisites: ["Arte", "Arqueologia", "Teologia"] },
    { name: "Tática", tier: "Expertises (+15)", isActive: false, prerequisites: ["Teologia"] }, // Mapped to simplify
    { name: "Sobrevivência", tier: "Expertises (+15)", isActive: false, prerequisites: ["Treino Militar"] },
    { name: "Armas de Fogo", tier: "Expertises (+15)", isActive: false, prerequisites: ["Malandragem"] },
    { name: "Briga", tier: "Expertises (+15)", isActive: false, prerequisites: ["Atletismo"] },

    // MAESTRIAS
    { name: "Sofontologia", tier: "Maestrias (+20)", isActive: false, prerequisites: ["Psicologia"] },
    { name: "Exobiologia", tier: "Maestrias (+20)", isActive: false, prerequisites: ["Patologia"] },
    { name: "Cirurgia", tier: "Maestrias (+20)", isActive: false, prerequisites: ["Medicina"] },
    { name: "Planetologia", tier: "Maestrias (+20)", isActive: false, prerequisites: ["Ecologia"] },
    { name: "Robótica", tier: "Maestrias (+20)", isActive: false, prerequisites: ["Mecânica"] },
    { name: "Engenharia", tier: "Maestrias (+20)", isActive: false, prerequisites: ["Mecânica"] },
    { name: "Cibernética", tier: "Maestrias (+20)", isActive: false, prerequisites: ["Mecânica"] },
    { name: "Inteligência Artificial", tier: "Maestrias (+20)", isActive: false, prerequisites: ["Hacking"] },
    { name: "Especialização em Veículo", tier: "Maestrias (+20)", isActive: false, prerequisites: ["Pilotagem"] },
    { name: "Hiperespaço", tier: "Maestrias (+20)", isActive: false, prerequisites: ["Física", "Pilotagem"] },
    { name: "Xenoesoterismo", tier: "Maestrias (+20)", isActive: false, prerequisites: ["Misticismo"] },
    { name: "Comando", tier: "Maestrias (+20)", isActive: false, prerequisites: ["Tática"] },
    { name: "Especialização em Combate", tier: "Maestrias (+20)", isActive: false, prerequisites: ["Armas de Fogo", "Briga"] },
];

export function SkillTreeSelector({ roomId, character }: Props) {
    // We hydrate a flat array from the saved skills trees
    const [flatSkills, setFlatSkills] = useState<{ [key: string]: SkillNode }>({});

    useEffect(() => {
        // When the component loads, we merge RAW_SKILLS topology with whatever is saved in Firebase
        const hydrated: { [key: string]: SkillNode } = {};
        const { trained, expert, master } = character.skills || {};

        RAW_SKILLS.forEach(skillDef => {
            let savedState = null;
            if (skillDef.tier.includes("Básicas")) savedState = trained?.[skillDef.name];
            if (skillDef.tier.includes("Expertises")) savedState = expert?.[skillDef.name];
            if (skillDef.tier.includes("Maestrias")) savedState = master?.[skillDef.name];

            hydrated[skillDef.name] = {
                ...skillDef,
                isActive: !!savedState?.isActive
            };
        });

        setFlatSkills(hydrated);
    }, [character.skills]);

    // Derived check for auto-granted skills by class
    const classAutoSkills = useMemo(() => {
        switch (character.characterClass) {
            case 'Soldier': return ["Treino Militar", "Atletismo"];
            case 'Android': return ["Linguística", "Computação", "Matemática"];
            case 'Teamster': return ["Maquinário", "Gravidade Zero"];
            default: return [];
        }
    }, [character.characterClass]);

    const isSkillActive = (skillName: string) => {
        return classAutoSkills.includes(skillName) || !!flatSkills[skillName]?.isActive;
    };

    // Sync to database automatically when modifying
    const handleToggle = async (skillName: string, currentlyActive: boolean) => {
        const skill = flatSkills[skillName];
        if (!skill) return;

        // Check prerequisites if turning ON
        if (!currentlyActive && skill.prerequisites.length > 0) {
            const hasReq = skill.prerequisites.some(reqName => isSkillActive(reqName));
            if (!hasReq) {
                alert("Falta de Pré-requisito: Você precisa possuir pelo menos 1 perícia base antes de aprender esta.");
                return;
            }
        }

        // Toggle logic in structured firebase update
        const targetTier = skill.tier.includes("Básicas") ? "trained"
            : skill.tier.includes("Expertises") ? "expert"
                : "master";

        const payload = { ...skill, isActive: !currentlyActive };

        // We update the deeply nested path in Firebase
        const payloadPath = `skills/${targetTier}/${skillName}`;
        await updatePlayer(roomId, character.id, {
            [payloadPath]: payload
        } as any);
    };

    const renderColumn = (label: string, match: string) => {
        const list = RAW_SKILLS.filter(s => s.tier.includes(match));

        return (
            <div className="flex-1 flex flex-col gap-2">
                <h4 className="text-emerald-500/50 uppercase font-bold text-xs tracking-widest border-b border-emerald-900/50 pb-2 mb-2">
                    {label}
                </h4>
                {list.map(skill => {
                    const isActive = isSkillActive(skill.name);
                    const isCompulsory = classAutoSkills.includes(skill.name);

                    // Render Logic
                    const hasMetReq = skill.prerequisites.length === 0 || skill.prerequisites.some(p => isSkillActive(p));

                    return (
                        <label
                            key={skill.name}
                            className={`flex items-center gap-2 p-1 px-2 border ${isActive ? 'bg-emerald-900/40 border-emerald-600' : 'bg-transparent border-transparent'} hover:bg-emerald-950/40 transition-colors ${!hasMetReq ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <input
                                type="checkbox"
                                checked={isActive}
                                disabled={isCompulsory || !hasMetReq}
                                onChange={() => handleToggle(skill.name, isActive)}
                                className="accent-emerald-500 bg-zinc-950 border-emerald-900"
                            />
                            <span className={`text-sm ${isActive ? 'text-emerald-300 font-bold' : 'text-emerald-700'} ${isCompulsory ? 'underline decoration-amber-500' : ''}`}>
                                {skill.name}
                            </span>
                        </label>
                    )
                })}
            </div>
        );
    };

    return (
        <div className="bg-zinc-950/50 border border-emerald-900 p-4 mb-6">
            <h3 className="text-emerald-500 font-bold mb-4 uppercase text-lg border-b border-emerald-900 pb-2">
                Matriz de Perícias
            </h3>
            <p className="text-xs text-emerald-700 mb-6">Módulos com sublinhado laranja são pré-carregados pelo genoma da Classe ativa e não podem ser desinstalados. Expertises e Maestrias requerem que um nó-pilar esteja previamente ativo.</p>

            <div className="flex flex-col md:flex-row gap-8">
                {renderColumn("Básicas (+10)", "Básicas")}
                {renderColumn("Expertises (+15)", "Expertises")}
                {renderColumn("Maestrias (+20)", "Maestrias")}
            </div>
        </div>
    );
}
