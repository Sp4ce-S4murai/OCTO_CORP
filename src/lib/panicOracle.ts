import { Consequence } from '@/types/character';

export interface PanicOracleInput {
    stress: number;
    panicStat: number; // The limit the player must roll under or equal to fail (or over to succeed). Wait, usually it's Roll > Stat = Success.
    context: string;
    rolledD20: number; // Pre-rolled D20 value
}

export interface PanicUIAction {
    trigger_popup: boolean;
    theme: {
        background_color: string;
        text_color: string;
        border: string;
    };
    popup_content: {
        title: string;
        event_log: string;
        player_read_text: string;
    };
}

export interface PanicMechanics {
    roll_d20: number;
    is_panic: boolean;
    entropy_score: number | null;
    effect_name: string;
    consequences_payload: Consequence[];
}

export interface PanicOracleOutput {
    ui_action: PanicUIAction;
    mechanics: PanicMechanics;
}

function rollD(faces: number): number {
    return Math.floor(Math.random() * faces) + 1;
}

export function generatePanicResult(input: PanicOracleInput): PanicOracleOutput {
    const { stress, context, rolledD20 } = input;

    // 1. O Teste (Julgamento do Abismo)
    // Sucesso: rolou MAIOR que o estress atual
    const isSuccess = rolledD20 > stress;

    if (isSuccess) {
        return {
            ui_action: {
                trigger_popup: true,
                theme: {
                    background_color: "#1A365D", // Safe blue
                    text_color: "#E2E8F0",
                    border: "2px solid #3182CE"
                },
                popup_content: {
                    title: "SISTEMA ESTÁVEL: ESTRESSE CONTIDO",
                    event_log: `Gatilho superado: ${context}`,
                    player_read_text: "O abismo olhou de volta, mas sua mente ancorou-se na realidade. A respiração pesa, o suor escorre, mas o controle permanece. Por enquanto."
                }
            },
            mechanics: {
                roll_d20: rolledD20,
                is_panic: false,
                entropy_score: null,
                effect_name: "Controle Mantido",
                consequences_payload: []
            }
        };
    }

    // 2. Cálculo de Condição (Tabela de Pânico)
    const entropyScore = rolledD20;

    let effectName = "";
    let playerReadText = "";
    let consequencesPayload: Consequence[] = [];

    // Tabela de Pânico
    if (entropyScore <= 3) {
        effectName = "Foco Terminal (Hyper-Resonance)";
        playerReadText = "O medo queima as distrações. O mundo desacelera. Cada detalhe irradia um propósito cristalino, como se a realidade fosse feita de espelhos quebrados.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "buff",
            target_stat: "all",
            modifier_type: "advantage",
            modifier_value: null,
            duration_type: "rolls",
            duration_value: 1,
            ui_description: "Ganhou Foco Terminal: Vantagem na próxima rolagem."
        }];
    } else if (entropyScore === 4) {
        effectName = "Sangramento Sensorial";
        playerReadText = "Você pode mastigar o som dos alarmes e a cor vermelha cega seus ouvidos. A parede entre o real e o pesadelo acaba de trincar.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "debuff",
            target_stat: "intellect",
            modifier_type: "disadvantage",
            modifier_value: null,
            duration_type: "rolls",
            duration_value: 1,
            ui_description: "Sangramento Sensorial: Desvantagem na próxima rolagem de Intelecto/Percepção."
        }];
    } else if (entropyScore === 5) {
        effectName = "Rejeição Somática (Glitch Motor)";
        playerReadText = "Seu cérebro grita 'corra', mas seus nervos respondem com uma coreografia de curto-circuito. Seus dedos abrem e o mundo despenca das suas mãos.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "debuff",
            target_stat: "physical",
            modifier_type: "disadvantage",
            modifier_value: null,
            duration_type: "rolls",
            duration_value: 1,
            ui_description: "Derruba o que estiver segurando. Desvantagem na próxima rolagem Física."
        }];
    } else if (entropyScore === 6) {
        effectName = "Cascata de Estresse";
        playerReadText = "O ritmo cardíaco entra num looping enlouquecedor. O terror se retroalimenta. O pânico deforma a borda da sua visão.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "debuff",
            target_stat: "stress",
            modifier_type: "math_add",
            modifier_value: 1,
            duration_type: "instant",
            duration_value: null,
            ui_description: "Cascata de Estresse: Adiciona +1 de Stress."
        }];
    } else if (entropyScore === 7) {
        effectName = "Miasma de Pânico (Contágio)";
        playerReadText = "O ar se torna espesso, saturado com o feromônio do seu próprio terror animal. É contagiante. Eles estão sentindo também.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "debuff",
            target_stat: "stress",
            modifier_type: "math_add",
            modifier_value: 1,
            duration_type: "instant",
            duration_value: null,
            ui_description: "Ganhou +1 Stress. (Aliados próximos também devem sofrer)."
        }];
    } else if (entropyScore === 8) {
        effectName = "Sobrescrita de Presa";
        playerReadText = "O primata no fundo do seu córtex assumiu o volante. Lutar é a morte. Fugir é a única religião aceitável agora.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "forced_action",
            target_stat: "combat",
            modifier_type: "disadvantage",
            modifier_value: null,
            duration_type: "turns",
            duration_value: 1,
            ui_description: "Desvantagem severa em Combate. Forçado a fugir no próximo turno."
        }];
    } else if (entropyScore === 9) {
        effectName = "Fantasmas Auditivos";
        playerReadText = "Vozes estáticas invadem o seu canal auditivo. Elas não são do rádio. Elas cochicham segredos que o ferro quente tenta queimar da memória.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "debuff",
            target_stat: "intellect", // Affecting mental/tech rolls
            modifier_type: "disadvantage",
            modifier_value: null,
            duration_type: "minutes",
            duration_value: rollD(10),
            ui_description: "Desvantagem em rolagens mentais/tecnológicas por 1d10 minutos."
        }];
    } else if (entropyScore === 10) {
        effectName = "Âncora Catatônica";
        playerReadText = "Erro Fatal. Sistema neurológico travado para evitar corrupção completa do ego. O corpo congela, convertendo-se em uma estátua de puro pavor.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "lock",
            target_stat: "all",
            modifier_type: "disadvantage",
            modifier_value: null,
            duration_type: "turns",
            duration_value: 1,
            ui_description: "Perde o próximo turno inteiro. Incapaz de agir ou reagir."
        }];
    } else if (entropyScore === 11) {
        effectName = "Vácuo Adrenal";
        playerReadText = "A fornalha química no seu sangue subitamente se apaga. Você fica frio, pesado, desprovido de qualquer calor combativo ou instinto restante.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "debuff",
            target_stat: "all",
            modifier_type: "disadvantage",
            modifier_value: null,
            duration_type: "rolls",
            duration_value: 3,
            ui_description: "Corpo pesado: Desvantagem nas próximas 3 rolagens."
        }];
    } else if (entropyScore === 12) {
        effectName = "Nulificação de Confiança (Paranoia)";
        playerReadText = "A geometria dos olhos dos seus amigos está errada. Há algo alienígena por trás de seus dentes. Eles vão te matar. Não deixe eles tocarem em você.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "status",
            target_stat: "all", // Imune a buff
            modifier_type: "disadvantage",
            modifier_value: null,
            duration_type: "turns",
            duration_value: rollD(10),
            ui_description: "Imune a buffs, curas e ajuda de aliados por 1d10 turnos."
        }];
    } else if (entropyScore === 13) {
        effectName = "Cisma de Realidade (Alucinações Severas)";
        playerReadText = "O espaço se distorce num caleidoscópio de vísceras cósmicas. O teto sangra gravidade. Nada disso é real, mas o desespero é físico.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "debuff",
            target_stat: "all",
            modifier_type: "disadvantage",
            modifier_value: null,
            duration_type: "minutes",
            duration_value: rollD(10),
            ui_description: "Alucinações: Desvantagem em TODAS as rolagens por 1d10 minutos."
        }];
    } else if (entropyScore === 14) {
        effectName = "Espiral da Ruína";
        playerReadText = "O vácuo te olha de volta e pisca. Você aceita o vazio absoluto. Por que lutar? Há um certo conforto em ser aniquilado.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "debuff",
            target_stat: "stress",
            modifier_type: "math_add",
            modifier_value: rollD(4),
            duration_type: "instant",
            duration_value: null,
            ui_description: "Sofre 1d4 de Stress imediato. Vontade de viver enfraquecida."
        }, {
            id: crypto.randomUUID(),
            name: "Ruína Psíquica",
            type: "debuff",
            target_stat: "panic",
            modifier_type: "disadvantage",
            modifier_value: null,
            duration_type: "rolls",
            duration_value: 1,
            ui_description: "Desvantagem no próximo Teste de Pânico."
        }];
    } else if (entropyScore === 15) {
        effectName = "Falha de Hardware (Infarto)";
        playerReadText = "Um soco fantasma atravessa suas costelas. O peito aperta violentamente. O coração esmaga-se sob a pressão de um terror denso como cimento.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "damage",
            target_stat: "wounds",
            modifier_type: "math_add",
            modifier_value: 1,
            duration_type: "instant",
            duration_value: null,
            ui_description: "Adquire 1 Ferida instantaneamente e o Status 'Exausto'."
        }];
    } else if (entropyScore === 16) {
        effectName = "Protocolo Berserker (Surto Psicótico)";
        playerReadText = "O fio se rompe. O que restava da humanidade derrete numa fornalha de fúria homicida primária. Apenas o banho de sangue vai acalmar o abismo.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "forced_action",
            target_stat: "combat",
            modifier_type: "math_add",
            modifier_value: null,
            duration_type: "turns",
            duration_value: rollD(4), // 1d4 turns
            ui_description: "Forçado a atacar a entidade viva mais próxima com força letal."
        }];
    } else if (entropyScore === 17) {
        effectName = "Morte do Ego (Estupor)";
        playerReadText = "A tela apagou. Ninguém atende aos controles corporais. Você virou apenas um vaso vazio testemunhando um canal morto sintonizado em pura estática.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "lock",
            target_stat: "all",
            modifier_type: "disadvantage",
            modifier_value: null,
            duration_type: "permanent", // Requires intervention
            duration_value: null,
            ui_description: "Incapacitado por tempo indeterminado até intervenção médica/ocultista."
        }];
    } else if (entropyScore === 18) {
        effectName = "Imolação Sináptica";
        playerReadText = "O cérebro cozinha sob a descarga de percepção indescritível. Os fios derretem. Um pedaço fundamental do que você é desintegrou para sempre.";
        const attrs = ["strength", "speed", "intellect", "combat"];
        const degradedAttr = attrs[Math.floor(Math.random() * attrs.length)];
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "permanent",
            target_stat: degradedAttr,
            modifier_type: "math_sub",
            modifier_value: rollD(10),
            duration_type: "permanent",
            duration_value: null,
            ui_description: `Dano cerebral irreversível: subtrai 1d10 pontos do atributo ${degradedAttr}.`
        }];
    } else if (entropyScore === 19) {
        effectName = "Onda de Choque Psíquico";
        playerReadText = "A pressão atinge massa crítica eruptiva. A psicoesfera distorce e seu grito rasga a realidade circundante antes da inconsciência absoluta.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "status",
            target_stat: "all",
            modifier_type: "disadvantage",
            modifier_value: null,
            duration_type: "permanent",
            duration_value: null,
            ui_description: "Desmaio Inconsciente. (Aliados próximos sofrem 1d10 Stress)."
        }];
    } else {
        effectName = "Expurgamento de Sistema (Condição Terminal)";
        playerReadText = "A última coisa que você sente não é dor, mas um POP molhado por trás dos olhos. Seu corpo desistiu de tolerar o próprio peso da fobia.";
        consequencesPayload = [{
            id: crypto.randomUUID(),
            name: effectName,
            type: "damage",
            target_stat: "hp",
            modifier_type: "percentage_drop",
            modifier_value: 100, // Insta Kill basically
            duration_type: "instant",
            duration_value: null,
            ui_description: "Morte Súbita induzida por Colapso Psicológico.",
            is_fatal: true
        }];
    }

    return {
        ui_action: {
            trigger_popup: true,
            theme: {
                background_color: "#FF8C00", // Emergency Orange
                text_color: "#111111",
                border: "4px solid #FF0000"
            },
            popup_content: {
                title: "AVISO DE SISTEMA: COLAPSO PSICOLÓGICO",
                event_log: `Gatilho Crítico: ${context}`,
                player_read_text: playerReadText
            }
        },
        mechanics: {
            roll_d20: rolledD20,
            is_panic: true,
            entropy_score: entropyScore,
            effect_name: effectName,
            consequences_payload: consequencesPayload
        }
    };
}
