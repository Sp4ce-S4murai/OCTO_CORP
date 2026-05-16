"use client";
import { useEffect, useState } from "react";
import Link from "next/link";


import { subscribeToRoom, updatePlayerNested, updatePlayer, pushLog, updateEnvironment, updatePlayerOrder, startEncounter, beginTurns, nextTurn, endEncounter, clearActivePanicTest, setRoomLockdown, setRoomImage, clearRoomImage, addNPCToEncounter, removeNPCFromEncounter, giveItemToPlayer, removeItemFromPlayer, initializeGlobalInventory, resetGlobalInventory, updateNpcHp, killNpc, applyDamageToPlayer } from "@/lib/database";
import { RoomData, CharacterSheet, Consequence, Item, Weapon, NpcData, NpcAttack } from "@/types/character";
import { STARTER_KITS } from "@/lib/itemsDictionary";
import { User, Activity, Lock, Unlock, Eye, X, ChevronUp, ChevronDown, Swords, Play, SkipForward, Square, Image as ImageIcon, Trash2, Upload, Package, Skull, Plus, Zap, ChevronRight } from "lucide-react";
import { generatePanicResult } from "@/lib/panicOracle";
import { TerminalLog } from "./TerminalLog";
import { HeartRateMonitor } from "./HeartRateMonitor";
import { PanicIcon } from "./PanicIcon";
import { ShipDashboard } from "./ShipDashboard";
import { ShipWardenPanel } from "./ShipWardenPanel";
import { MiniSheet } from "./MiniSheet";
import { GlobalInventoryEditor } from "./GlobalInventoryEditor";
import { NPC_CLASSES, NPC_RANKS } from "@/lib/npcPresets";


const getTimestamp = () => Date.now();

export default function WardenClient({ roomId }: { roomId: string }) {
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(true);
    const [wardenMessage, setWardenMessage] = useState("");
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

    // Custom Condition Form State for Panic Modal
    const [customCondition, setCustomCondition] = useState({
        show: false,
        name: "",
        stat: "all",
        modifier: "disadvantage",
        value: 0,
        isFatal: false
    });

    const [newNpc, setNewNpc] = useState({
        name: "",
        initiative: 10,
        icon: "👾",
        color: "text-red-500",
        hp: 20,
        maxHp: 20,
        combat: 45,
        movementMax: 6,
        attacks: [] as NpcAttack[],
    });
    const [selectedNpcClass, setSelectedNpcClass] = useState<string>('Customizado');
    const [selectedNpcRank, setSelectedNpcRank] = useState<string>('Normal');
    const [cloneTargetId, setCloneTargetId] = useState<string>('');
    const [newNpcAttack, setNewNpcAttack] = useState<NpcAttack>({ name: "", damage: "1d10", range: 1 });
    // Per-NPC damage controls: npcId -> { playerId, amount }
    const [npcDmgControls, setNpcDmgControls] = useState<Record<string, { playerId: string; amount: number }>>({});
    const [expandedNpcId, setExpandedNpcId] = useState<string | null>(null);

    const [selectedPlayerToGive, setSelectedPlayerToGive] = useState<string>("");
    const [selectedItemToGive, setSelectedItemToGive] = useState<string>("");

    const getCurrentOrder = () => {
        if (!roomData?.players) return [];
        const allPlayerIds = Object.keys(roomData.players);
        const savedOrder = roomData.playerOrder || [];
        const validOrderIds = new Set(savedOrder.filter((id: string) => allPlayerIds.includes(id)));
        return [...savedOrder.filter((id: string) => validOrderIds.has(id)), ...allPlayerIds.filter((id: string) => !validOrderIds.has(id))];
    };

    const movePlayer = (playerId: string, direction: 'UP' | 'DOWN') => {
        if (!roomData?.players) return;
        const currentOrder = getCurrentOrder();
        const currentIndex = currentOrder.indexOf(playerId);
        if (currentIndex === -1) return;

        const newIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= currentOrder.length) return;

        const newOrder = [...currentOrder];
        [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];

        updatePlayerOrder(roomId, newOrder);
        setRoomData((prev: RoomData | null) => prev ? { ...prev, playerOrder: newOrder } : prev);
    };

    const handleStartCombat = () => {
        startEncounter(roomId);
        pushLog(roomId, {
            timestamp: getTimestamp(),
            playerName: "SISTEMA",
            playerId: "SYSTEM",
            statName: 'INICIATIVA REQUISITADA',
            statValue: 0,
            roll: 0,
            result: 'Warden Message'
        });
    };

    const handleBeginTurns = () => {
        if (!roomData?.encounter || !roomData.players) return;

        // Sort players by initiative descending
        const initiatives = roomData.encounter.initiatives || {};
        const entries = Object.entries(initiatives).sort((a, b) => b[1] - a[1]);
        const sortedIds = entries.map(e => e[0]);

        // Add any missing players at the end
        const allIds = getCurrentOrder();
        for (const id of allIds) {
            if (!sortedIds.includes(id)) {
                sortedIds.push(id);
            }
        }

        beginTurns(roomId, sortedIds);
        pushLog(roomId, {
            timestamp: getTimestamp(),
            playerName: "SISTEMA",
            playerId: "SYSTEM",
            statName: 'COMBATE INICIADO',
            statValue: 0,
            roll: 0,
            result: 'Warden Message'
        });
    };

    const handleNextTurn = () => {
        if (!roomData?.encounter) return;
        nextTurn(roomId, roomData.encounter);
    };

    const handleEndCombat = () => {
        endEncounter(roomId);
        pushLog(roomId, {
            timestamp: getTimestamp(),
            playerName: "SISTEMA",
            playerId: "SYSTEM",
            statName: 'COMBATE ENCERRADO',
            statValue: 0,
            roll: 0,
            result: 'Warden Message'
        });
    };

    const ENVIRONMENT_PRESETS = {
        'Clima Estabilizado': { presetName: 'Clima Estabilizado', temperature: '21', pressure: '1.0', oxygen: '100', luminosity: 'Estável', gravity: '1.0', radiation: '0.1' },
        'Superfície de Magma (Vulcania-9)': { presetName: 'Superfície de Magma', temperature: '480', pressure: '3.5', oxygen: '4', luminosity: 'Ofuscante Vermelho', gravity: '1.2', radiation: '120' },
        'Vácuo Espacial (Exterior)': { presetName: 'Vácuo', temperature: '-270', pressure: '0.0', oxygen: '0', luminosity: 'Escuridão', gravity: '0.0', radiation: '80' },
        'Planeta Glacial (Hoth-Z)': { presetName: 'Planeta Glacial', temperature: '-80', pressure: '1.2', oxygen: '25', luminosity: 'Ofuscante Branco', gravity: '1.5', radiation: '2' },
        'Pântano Ácido (Tóxico)': { presetName: 'Pântano Ácido', temperature: '45', pressure: '2.0', oxygen: '12', luminosity: 'Neblina Verde', gravity: '1.0', radiation: '60' },
        'Estação Abandonada (Falha Energética)': { presetName: 'Estação Abandonada', temperature: '5', pressure: '0.8', oxygen: '15', luminosity: 'Piscando', gravity: '0.1', radiation: '10' },
        'Gigante Gasoso (Queda Livre)': { presetName: 'Atmosfera Densa', temperature: '-120', pressure: '45.0', oxygen: '0', luminosity: 'Tempestade Magnética', gravity: '3.5', radiation: '500' },
        'Zona de Quarentena (Nível 5)': { presetName: 'Quarentena Biológica', temperature: '38', pressure: '1.5', oxygen: 'Corrosivo', luminosity: 'Luz Negra', gravity: '1.0', radiation: '5' },
        'O Vazio (Anomalia)': { presetName: 'O Vazio', temperature: '---', pressure: '---', oxygen: '---', luminosity: 'NULA', gravity: 'ERR', radiation: 'ERR' }
    };

    const applyEnvironmentPreset = (presetName: keyof typeof ENVIRONMENT_PRESETS) => {
        updateEnvironment(roomId, ENVIRONMENT_PRESETS[presetName]);
        pushLog(roomId, {
            timestamp: getTimestamp(),
            playerName: "SISTEMA",
            playerId: "SYSTEM",
            statName: `TELEMETRIA AMBIENTAL: ${presetName}`,
            statValue: 0,
            roll: 0,
            result: 'Warden Message'
        });
    };

    useEffect(() => {
        initializeGlobalInventory(roomId);
        const unsubscribe = subscribeToRoom(roomId, (data) => {
            setRoomData(data);
            setLoading(false);
        });

        const handlePaste = (e: ClipboardEvent) => {
            // Ignore if typing in an input/textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.clipboardData && e.clipboardData.items) {
                for (let i = 0; i < e.clipboardData.items.length; i++) {
                    if (e.clipboardData.items[i].type.indexOf("image") !== -1) {
                        const file = e.clipboardData.items[i].getAsFile();
                        if (file) processImageFile(file);
                        break;
                    }
                }
            }
        };

        window.addEventListener("paste", handlePaste);

        return () => {
            unsubscribe();
            window.removeEventListener("paste", handlePaste);
        };
    }, [roomId]);

    const processImageFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                // Max dimensions to avoid huge base64 strings
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const base64Data = canvas.toDataURL("image/jpeg", 0.7); // compress quality
                    setRoomImage(roomId, base64Data);
                    pushLog(roomId, {
                        timestamp: getTimestamp(),
                        playerName: "SISTEMA",
                        playerId: "SYSTEM",
                        statName: 'SLIDESHOW: IMAGEM ATUALIZADA',
                        statValue: 0,
                        roll: 0,
                        result: 'Warden Message'
                    });
                }
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleClearImage = () => {
        clearRoomImage(roomId);
        pushLog(roomId, {
            timestamp: getTimestamp(),
            playerName: "SISTEMA",
            playerId: "SYSTEM",
            statName: 'SLIDESHOW: IMAGEM REMOVIDA',
            statValue: 0,
            roll: 0,
            result: 'Warden Message'
        });
    };



    const handleUpdate = (playerId: string, path: string, value: string | number | boolean) => {
        const character = roomData?.players?.[playerId];
        if (!character) return;

        if (path.startsWith("baseStats/") || path.startsWith("baseSaves/")) {
            const updates: Record<string, string | number | boolean> = { [path]: value };

            if (path.startsWith("baseStats/")) {
                const stat = path.split("/")[1] as keyof typeof character.stats;
                updates[`stats/${stat}`] = Number(value) + (character.classMods?.[stat] || 0);
            } else if (path.startsWith("baseSaves/")) {
                const save = path.split("/")[1] as keyof typeof character.saves;
                updates[`saves/${save}`] = Number(value) + (character.classSaveMods?.[save] || 0);
            }

            updatePlayer(roomId, playerId, updates);
        } else {
            updatePlayerNested(roomId, playerId, path, value);
        }
    };

    const handleDamage = async (playerId: string, damage: number) => {
        const char = roomData?.players?.[playerId];
        if (!char || damage <= 0) return;

        const result = await applyDamageToPlayer(roomId, playerId, damage);

        let logMsg = `Dano Bruto: ${damage}`;
        if (result.armorDestroyed) logMsg += ` | ARMADURA DESTRUÍDA!`;
        logMsg += ` | HP Restante: ${result.newHealth}/${result.maxHealth}`;

        pushLog(roomId, {
            timestamp: getTimestamp(),
            playerName: char.name || "UNIDADE",
            playerId: char.id,
            statName: 'DANO DIRETO',
            statValue: damage,
            roll: 0,
            result: result.armorDestroyed ? 'Critical Success' : 'Warden Damage',
            customMessage: logMsg
        });
    };

    const handleStress = (playerId: string, amount: number) => {
        const char = roomData?.players?.[playerId];
        if (!char || amount === 0) return;

        const isAtMax = char.vitals.stress.current >= 20;
        // Cap stress at 20
        const newStress = Math.min(20, Math.max(char.vitals.stress.min, char.vitals.stress.current + amount));
        updatePlayerNested(roomId, playerId, "vitals/stress/current", newStress);

        if (isAtMax) {
            // Already at max, trigger panic directly via dedicated log
            pushLog(roomId, {
                timestamp: getTimestamp(),
                playerName: char.name || "UNIDADE",
                playerId: char.id,
                statName: 'PÂNICO ACTIVADO (STRESS MAX)',
                statValue: newStress,
                roll: 0,
                result: 'Warden Panic'
            });
        } else {
            pushLog(roomId, {
                timestamp: getTimestamp(),
                playerName: char.name || "UNIDADE",
                playerId: char.id,
                statName: 'AUMENTO DE STRESS',
                statValue: amount,
                roll: 0,
                result: 'Warden Stress'
            });
        }
    };


    const handleTriggerPanic = (playerId: string) => {
        const char = roomData?.players?.[playerId];
        if (!char) return;

        // Just push the 'Warden Panic' log - player's client intercepts and shows the panic modal
        // Do NOT modify stress here - only failure adds +1 stress
        pushLog(roomId, {
            timestamp: getTimestamp(),
            playerName: "SISTEMA MOTHERSHIP",
            playerId: char.id,
            statName: `TESTE DE PÂNICO FORÇADO: ${char.name}`,
            statValue: char.vitals.stress.current,
            roll: 0,
            result: 'Warden Panic'
        });
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!wardenMessage.trim()) return;

        pushLog(roomId, {
            timestamp: getTimestamp(),
            playerName: "DIRETOR",
            playerId: "SYSTEM",
            statName: wardenMessage.trim(),
            statValue: 0,
            roll: 0,
            result: 'Warden Message'
        });

        setWardenMessage(""); // Clear input
    };

    const toggleLockdown = () => {
        if (!roomData) return;
        const newLockState = !roomData.isLocked;
        setRoomLockdown(roomId, newLockState).catch(console.error);

        pushLog(roomId, {
            timestamp: getTimestamp(),
            playerName: "SISTEMA",
            playerId: "SYSTEM",
            statName: `PROTOCOLO DE SEGURANÇA: ${newLockState ? 'ATIVADO (FICHAS TRAVADAS)' : 'DESATIVADO (EDIÇÃO LIVRE)'}`,
            statValue: 0,
            roll: 0,
            result: 'Warden Message'
        });
    };

    const handleApplyPanicOracle = () => {
        const test = roomData?.activePanicTest;
        if (!test || !test.playerId) return;

        const char = roomData.players[test.playerId];
        if (!char) return;

        const oracleResult = generatePanicResult({
            stress: test.stress || 20,
            panicStat: char.saves.sanity || 0,
            context: "Determinação do Diretor (Oráculo)",
            rolledD20: test.rolledD20 || 1
        });

        const newConsequences = [...(char.consequences || []), ...oracleResult.mechanics.consequences_payload];
        const newStress = Math.min(20, (char.vitals.stress.current || 0) + 1);
        const hasFatal = oracleResult.mechanics.consequences_payload.some(c => c.is_fatal);

        if (hasFatal) {
            updatePlayer(roomId, test.playerId, {
                consequences: newConsequences,
                "vitals/health/current": 0,
                "vitals/wounds/current": char.vitals.wounds.max || 1,
            } as Record<string, unknown>);
        } else {
            updatePlayer(roomId, test.playerId, {
                consequences: newConsequences,
                "vitals/stress/current": newStress
            } as Record<string, unknown>);
        }

        pushLog(roomId, {
            timestamp: getTimestamp(),
            playerName: "COMPUTADOR MOTHERSHIP",
            playerId: "sys",
            statName: `CONDIÇÃO DE PÂNICO: ${oracleResult.mechanics.effect_name}`,
            statValue: oracleResult.mechanics.entropy_score || 0,
            roll: test.rolledD20 || 0,
            result: 'Tabela de Pânico'
        });

        import("@/lib/database").then(({ submitPanicTestResolution }) => {
            submitPanicTestResolution(roomId, oracleResult.mechanics.effect_name, oracleResult.mechanics.consequences_payload[0]?.ui_description || "O Oráculo interveio.");
        });

        setCustomCondition(prev => ({ ...prev, show: false }));
    };

    const handleApplyCustomCondition = () => {
        const test = roomData?.activePanicTest;
        if (!test || !test.playerId) return;

        const char = roomData.players[test.playerId];
        if (!char) return;

        if (!customCondition.name) return alert("Insira um nome para a condição.");

        const newSequence = {
            id: crypto.randomUUID(),
            name: customCondition.name,
            type: customCondition.isFatal ? "damage" : "debuff",
            target_stat: customCondition.stat,
            modifier_type: customCondition.modifier,
            modifier_value: customCondition.value || null,
            duration_type: "permanent",
            duration_value: null,
            ui_description: "Inserção Manual do Diretor.",
            is_fatal: customCondition.isFatal
        };

        const newConsequences = [...(char.consequences || []), newSequence as unknown as Consequence];
        const newStress = Math.min(20, (char.vitals.stress.current || 0) + 1);

        if (customCondition.isFatal) {
            updatePlayer(roomId, test.playerId, {
                consequences: newConsequences,
                "vitals/health/current": 0,
                "vitals/wounds/current": char.vitals.wounds.max || 1,
            } as Record<string, unknown>);
        } else {
            updatePlayer(roomId, test.playerId, {
                consequences: newConsequences,
                "vitals/stress/current": newStress
            } as Record<string, unknown>);
        }

        pushLog(roomId, {
            timestamp: getTimestamp(),
            playerName: "SISTEMA MOTHERSHIP",
            playerId: "sys",
            statName: `CONDIÇÃO DE PÂNICO APLICADA: ${char.name} > ${customCondition.name}`,
            statValue: 0,
            roll: test.rolledD20 || 0,
            result: 'Tabela de Pânico'
        });

        import("@/lib/database").then(({ submitPanicTestResolution }) => {
            submitPanicTestResolution(roomId, customCondition.name, customCondition.isFatal ? "CONDIÇÃO FATAL APLICADA." : `Penalidade/Modificador: ${customCondition.modifier.toUpperCase()}`);
        });

        setCustomCondition({ show: false, name: "", stat: "all", modifier: "disadvantage", value: 0, isFatal: false });
    };

    const handleDismissPanicTest = () => {
        if (!roomData?.activePanicTest) return;

        pushLog(roomId, {
            timestamp: getTimestamp(),
            playerName: "SISTEMA MOTHERSHIP",
            playerId: "sys",
            statName: `TESTE DE PÂNICO BEM SUCEDIDO (${roomData.activePanicTest.playerName})`,
            statValue: 0,
            roll: roomData.activePanicTest.rolledD20 || 0,
            result: 'Warden Message'
        });

        clearActivePanicTest(roomId);
    };

    if (loading) {
        return <div className="animate-pulse flex p-4 text-emerald-500/50">Sincronizando feed de vídeo...</div>;
    }

    const orderedPlayers = roomData?.players ? getCurrentOrder().map(id => roomData.players[id]).filter(Boolean) : [];

    return (
        <main className="max-w-7xl mx-auto flex flex-col gap-8">

            {/* SHIP DASHBOARD (visible when ship exists) */}
            {roomData?.ship && <ShipDashboard ship={roomData.ship} />}

            {/* SHIP WARDEN PANEL */}
            <ShipWardenPanel roomId={roomId} ship={roomData?.ship || null} />
            <header className="border-b-2 border-emerald-900 pb-4 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-widest text-emerald-400">
                        PAINEL DO DIRETOR // SETOR {roomId}
                    </h1>
                    <p className="text-emerald-700 mt-2">Nível de Acesso: Máximo (Sobrescrita Remota Autorizada)</p>
                </div>
                <div className="flex gap-4">
                    <Link href={`/sala/${roomId}/diretor/tatico`} className="flex items-center gap-2 px-4 py-2 border font-bold uppercase tracking-widest transition-colors bg-blue-950/30 border-blue-900 text-blue-500 hover:bg-blue-900 hover:text-blue-300">
                        <Swords size={18} /> MAPA TÁTICO
                    </Link>
                    <button
                        onClick={toggleLockdown}
                        className={`flex items-center gap-2 px-4 py-2 border font-bold uppercase tracking-widest transition-colors ${roomData?.isLocked ? 'bg-red-950/80 border-red-900 text-red-500 hover:bg-red-900' : 'bg-emerald-950/30 border-emerald-900 text-emerald-600 hover:bg-emerald-900 hover:text-emerald-300'}`}
                        title={roomData?.isLocked ? "Destravar edição dos jogadores" : "Travar Fichas (Lockdown)"}
                    >
                        {roomData?.isLocked ? <><Lock size={18} /> TRAVAMENTO MÁXIMO ATIVADO</> : <><Unlock size={18} /> FICHAS LIVRES (DESTRAVADAS)</>}
                    </button>
                </div>
            </header>

            {/* INVENTÁRIO GLOBAL */}
            <section className="bg-zinc-950/80 border border-emerald-900/50 p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold tracking-widest text-emerald-500 flex items-center gap-2 uppercase">
                        <Package size={24} /> INVENTÁRIO GLOBAL E SUPRIMENTOS
                    </h2>
                    <button
                        onClick={async () => {
                            if(confirm("Deseja resetar o Almoxarifado para o novo padrão balanceado? Isso substituirá a lista atual de itens globais.")) {
                                await resetGlobalInventory(roomId);
                                alert("Almoxarifado resetado com sucesso!");
                            }
                        }}
                        className="text-[10px] font-bold text-red-500/70 border border-red-900/50 px-3 py-1.5 hover:bg-red-950/40 transition-all flex items-center gap-2"
                    >
                        <Trash2 size={14} /> RESETAR DICIONÁRIO
                    </button>
                </div>
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex flex-col gap-1 w-64">
                        <label className="text-xs text-emerald-600 font-bold uppercase">SELECIONAR JOGADOR</label>
                        <select className="bg-zinc-950 border border-emerald-900/50 text-emerald-300 p-2 font-mono text-sm outline-none" value={selectedPlayerToGive} onChange={e => setSelectedPlayerToGive(e.target.value)}>
                            <option value="">-- ESCOLHER ALVO --</option>
                            {orderedPlayers.map((p: CharacterSheet) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1 w-64">
                        <label className="text-xs text-emerald-600 font-bold uppercase">SELECIONAR ITEM/KIT</label>
                        <select className="bg-zinc-950 border border-emerald-900/50 text-emerald-300 p-2 font-mono text-sm outline-none" value={selectedItemToGive} onChange={e => setSelectedItemToGive(e.target.value)}>
                            <option value="">-- ESCOLHER ITEM/KIT --</option>
                            <optgroup label="ITENS INDIVIDUAIS">
                                {Object.values(roomData?.globalInventory || {}).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </optgroup>
                            <optgroup label="STARTER KITS">
                                {Object.keys(STARTER_KITS).map(kit => <option key={kit} value={`kit:${kit}`}>{kit.toUpperCase()}</option>)}
                            </optgroup>
                        </select>
                    </div>
                    <button 
                        disabled={!selectedPlayerToGive || !selectedItemToGive}
                        onClick={() => {
                            let itemsToGive: (Item | Weapon)[] = [];
                            let itemName = "";
                            if (selectedItemToGive.startsWith("kit:")) {
                                const kitKey = selectedItemToGive.replace("kit:", "");
                                itemsToGive = STARTER_KITS[kitKey];
                                itemName = `Kit: ${kitKey.toUpperCase()}`;
                            } else {
                                const gItem = roomData?.globalInventory?.[selectedItemToGive];
                                if (gItem) {
                                    itemsToGive = [gItem];
                                    itemName = gItem.name;
                                }
                            }
                            giveItemToPlayer(roomId, selectedPlayerToGive, itemsToGive);
                            const targetName = roomData?.players[selectedPlayerToGive]?.name || "Desconhecido";
                            pushLog(roomId, {
                                timestamp: Date.now(),
                                playerName: "SISTEMA LOGÍSTICO",
                                playerId: selectedPlayerToGive,
                                statName: `INVENTÁRIO ATUALIZADO: ${targetName} RECEBEU ${itemName}`,
                                statValue: 0,
                                roll: 0,
                                result: 'Warden Message'
                            });
                            setSelectedItemToGive("");
                        }}
                        className="bg-emerald-950/50 hover:bg-emerald-900 text-emerald-400 border border-emerald-800 px-6 py-2 font-bold tracking-widest flex items-center gap-2 transition-colors uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        TRANSFERIR SUPRIMENTO
                    </button>
                </div>
            </section>

            {/* EDITOR DE INVENTÁRIO GLOBAL */}
            <GlobalInventoryEditor roomId={roomId} globalInventory={roomData?.globalInventory} />

            {/* PAINEL DE COMBATE */}
            <section className="bg-zinc-950/80 border border-blue-900/50 p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold tracking-widest text-blue-500 flex items-center gap-2 uppercase">
                        <Swords size={24} /> GERENCIADOR DE COMBATE
                    </h2>

                    {!roomData?.encounter?.isActive && (
                        <button onClick={handleStartCombat} className="bg-blue-950/50 hover:bg-blue-900 text-blue-400 border border-blue-800 px-6 py-2 font-bold tracking-widest flex items-center gap-2 transition-colors uppercase">
                            <Swords size={18} /> INICIAR COMBATE
                        </button>
                    )}

                    {roomData?.encounter?.isActive && (
                        <div className="flex gap-4">
                            {roomData.encounter.status === 'rolling' && (
                                <button onClick={handleBeginTurns} className="bg-emerald-950/50 hover:bg-emerald-900 text-emerald-400 border border-emerald-800 px-6 py-2 font-bold tracking-widest flex items-center gap-2 transition-colors uppercase">
                                    <Play size={18} /> COMEÇAR TURNOS
                                </button>
                            )}
                            {roomData.encounter.status === 'active' && (
                                <button onClick={handleNextTurn} className="bg-amber-950/50 hover:bg-amber-900 text-amber-400 border border-amber-800 px-6 py-2 font-bold tracking-widest flex items-center gap-2 transition-colors uppercase">
                                    <SkipForward size={18} /> FORÇAR PRÓXIMO TURNO
                                </button>
                            )}
                            <button onClick={handleEndCombat} className="bg-red-950/50 hover:bg-red-900 text-red-500 border border-red-900 px-6 py-2 font-bold tracking-widest flex items-center gap-2 transition-colors uppercase">
                                <Square size={18} /> ENCERRAR COMBATE
                            </button>
                        </div>
                    )}
                </div>



                {roomData?.encounter?.isActive && roomData.encounter.status === 'rolling' && (
                    <div className="bg-blue-950/20 border border-blue-900/30 p-4">
                        <h3 className="text-sm text-blue-600 mb-2 uppercase font-bold tracking-widest">Aguardando Rolagens de Iniciativa</h3>
                        <div className="flex flex-wrap gap-4">
                            {orderedPlayers.map(player => {
                                const init = roomData.encounter?.initiatives?.[player.id];
                                const hasRolled = init !== undefined;
                                return (
                                    <div key={player.id} className={`flex items-center gap-2 px-3 py-1 border ${hasRolled ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-zinc-950 border-blue-900/30 text-blue-700/50'}`}>
                                        <span className="text-xs uppercase font-bold truncate max-w-[150px]">{player.name}</span>
                                        <span className="text-sm font-mono">{hasRolled ? init : '...'}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {roomData?.encounter?.isActive && roomData.encounter.status === 'active' && (
                    <div className="flex flex-col gap-2">
                        <div className="text-xs text-blue-700 font-bold uppercase tracking-widest">FILA DE TURNOS (RODADA {roomData.encounter.round})</div>
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                            {roomData.encounter.turnOrder.map((pid: string, idx: number) => {
                                const isNPC = pid.startsWith('npc_');
                                const name = isNPC ? roomData.encounter?.npcs?.[pid]?.name : roomData.players[pid]?.name;
                                const isCurrent = idx === roomData.encounter?.currentTurnIndex;
                                return (
                                    <div key={pid} className={`shrink-0 flex items-center gap-2 px-4 py-2 border ${isCurrent ? 'bg-blue-900 text-blue-100 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse' : 'bg-zinc-950 text-blue-600/50 border-blue-900/30'}`}>
                                        <span className={`text-xs uppercase font-bold ${isNPC ? 'text-red-500' : ''}`}>{idx + 1}. {name || 'DESCONHECIDO'}</span>
                                        <span className="text-xs font-mono opacity-50">[{roomData.encounter?.initiatives?.[pid] || 0}]</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* NPC MANAGEMENT PANEL — only visible when encounter is active */}
                {roomData?.encounter?.isActive && (
                    <div className="border border-red-900/50 bg-red-950/20 p-4 mt-2 flex flex-col gap-4">
                        <h3 className="text-sm text-red-500 mb-1 uppercase font-bold tracking-widest flex items-center gap-2"><Skull size={14}/> GESTÃO DE AMEAÇAS</h3>

                        {/* Active NPCs list */}
                        {Object.values(roomData.encounter?.npcs || {}).length > 0 && (
                            <div className="flex flex-col gap-2">
                                {Object.values(roomData.encounter?.npcs || {}).map((npc: NpcData) => {
                                    const hpPct = npc.maxHp > 0 ? (npc.hp / npc.maxHp) * 100 : 0;
                                    const hpColor = hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-yellow-500' : 'bg-red-500';
                                    const isExpanded = expandedNpcId === npc.id;
                                    const dmgCtrl = npcDmgControls[npc.id] || { playerId: '', amount: 5 };

                                    return (
                                        <div key={npc.id} className={`border ${npc.isDead ? 'border-zinc-800 bg-zinc-900/30 opacity-60' : 'border-red-900/50 bg-zinc-950'} rounded-sm`}>
                                            {/* Header row */}
                                            <div className="flex items-center gap-2 p-2">
                                                <span className="text-lg shrink-0">{npc.isDead ? '💀' : (npc.icon || '👾')}</span>
                                                <span className={`flex-1 text-xs font-bold uppercase tracking-wide ${npc.isDead ? 'text-zinc-500 line-through' : 'text-red-400'}`}>{npc.name}</span>
                                                <span className="text-[10px] font-mono text-zinc-500">{npc.hp}/{npc.maxHp} HP</span>
                                                {!npc.isDead && (
                                                    <button
                                                        onClick={() => setExpandedNpcId(prev => prev === npc.id ? null : npc.id)}
                                                        className="text-red-700 hover:text-red-400 transition-colors px-1"
                                                        title="Expandir controles"
                                                    >
                                                        {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { removeNPCFromEncounter(roomId, npc.id); setExpandedNpcId(null); }}
                                                    className="text-red-700/50 hover:text-red-400 transition-colors p-0.5"
                                                    title="Remover do combate"
                                                >
                                                    <X size={12}/>
                                                </button>
                                            </div>

                                            {/* HP bar */}
                                            {!npc.isDead && (
                                                <div className="px-2 pb-1">
                                                    <div className="flex items-center gap-1 mb-1">
                                                        <button onClick={() => updateNpcHp(roomId, npc.id, npc.hp - 1)} className="text-red-400 text-xs bg-red-950/50 px-1.5 rounded hover:bg-red-900">-</button>
                                                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                            <div className={`h-full ${hpColor} transition-all duration-300`} style={{ width: `${hpPct}%` }} />
                                                        </div>
                                                        <button onClick={() => updateNpcHp(roomId, npc.id, Math.min(npc.maxHp, npc.hp + 1))} className="text-emerald-400 text-xs bg-emerald-950/50 px-1.5 rounded hover:bg-emerald-900">+</button>
                                                        <input
                                                            type="number"
                                                            className="w-10 bg-zinc-900 border border-red-900/50 text-red-300 text-xs text-center outline-none font-mono ml-1"
                                                            value={npc.hp}
                                                            onChange={e => updateNpcHp(roomId, npc.id, Number(e.target.value))}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Expanded: apply damage to player */}
                                            {isExpanded && !npc.isDead && (
                                                <div className="px-2 pb-2 border-t border-red-900/30 pt-2 flex flex-col gap-2">
                                                    <span className="text-[10px] text-red-400 font-bold uppercase">Aplicar Dano Direto em Jogador:</span>
                                                    <div className="flex gap-1 items-center flex-wrap">
                                                        <select
                                                            className="flex-1 bg-zinc-900 border border-red-900/50 text-red-300 p-1 text-xs outline-none font-mono"
                                                            value={dmgCtrl.playerId}
                                                            onChange={e => setNpcDmgControls(prev => ({ ...prev, [npc.id]: { ...dmgCtrl, playerId: e.target.value } }))}
                                                        >
                                                            <option value="">-- Alvo --</option>
                                                            {orderedPlayers.map((p: CharacterSheet) => (
                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            className="w-14 bg-zinc-900 border border-red-900/50 text-red-300 p-1 text-xs text-center outline-none font-mono"
                                                            value={dmgCtrl.amount}
                                                            onChange={e => setNpcDmgControls(prev => ({ ...prev, [npc.id]: { ...dmgCtrl, amount: Number(e.target.value) } }))}
                                                        />
                                                        <button
                                                            disabled={!dmgCtrl.playerId || dmgCtrl.amount <= 0}
                                                            onClick={() => {
                                                                const target = roomData?.players?.[dmgCtrl.playerId];
                                                                if (!target) return;
                                                                handleDamage(dmgCtrl.playerId, dmgCtrl.amount);
                                                                pushLog(roomId, {
                                                                    timestamp: Date.now(),
                                                                    playerName: npc.name,
                                                                    playerId: dmgCtrl.playerId,
                                                                    statName: `DANO DIRETO DE ${npc.name.toUpperCase()} EM ${target.name.toUpperCase()}`,
                                                                    statValue: dmgCtrl.amount,
                                                                    roll: 0,
                                                                    result: 'Warden Damage'
                                                                });
                                                            }}
                                                            className="bg-red-900 hover:bg-red-800 text-red-100 px-2 py-1 text-xs font-bold uppercase border border-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                                        >
                                                            <Zap size={10}/> DAR DANO
                                                        </button>
                                                    </div>

                                                    {/* Configured attacks */}
                                                    {npc.attacks && npc.attacks.length > 0 && (
                                                        <div className="mt-2 border-t border-red-900/30 pt-2">
                                                            <span className="text-[10px] text-red-400 font-bold uppercase block mb-1">Ataques Definidos:</span>
                                                            <div className="flex flex-col gap-1">
                                                                {npc.attacks.map((atk, i) => (
                                                                    <div key={i} className="flex flex-col bg-red-950/20 border border-red-900/30 p-1">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[10px] text-red-300 font-bold uppercase">{atk.name}</span>
                                                                            <span className="text-[10px] text-zinc-400 font-mono">{atk.damage} | {atk.range}sq</span>
                                                                        </div>
                                                                        <button
                                                                            disabled={!dmgCtrl.playerId}
                                                                            onClick={() => {
                                                                                const target = roomData?.players?.[dmgCtrl.playerId];
                                                                                if (!target) return;
                                                                                
                                                                                // Roll damage
                                                                                const match = atk.damage.match(/^(\d+)d(\d+)(?:\+?(\d+))?$/i);
                                                                                let totalDmg = 0;
                                                                                let dDetail = "";
                                                                                if (match) {
                                                                                    const count = parseInt(match[1]);
                                                                                    const sides = parseInt(match[2]);
                                                                                    const bonus = match[3] ? parseInt(match[3]) : 0;
                                                                                    const rolls = [];
                                                                                    for (let d=0; d<count; d++) rolls.push(Math.floor(Math.random()*sides)+1);
                                                                                    totalDmg = rolls.reduce((a,b)=>a+b,0) + bonus;
                                                                                    dDetail = `[${rolls.join("+")}]${bonus ? `+${bonus}` : ""}`;
                                                                                } else {
                                                                                    totalDmg = parseInt(atk.damage) || 1;
                                                                                }

                                                                                handleDamage(dmgCtrl.playerId, totalDmg);
                                                                                pushLog(roomId, {
                                                                                    timestamp: Date.now(),
                                                                                    playerName: npc.name,
                                                                                    playerId: dmgCtrl.playerId,
                                                                                    statName: `ATAQUE (${atk.name}) → ${target.name.toUpperCase()}`,
                                                                                    statValue: totalDmg,
                                                                                    roll: 0,
                                                                                    result: 'Success',
                                                                                    customMessage: `Dano: ${totalDmg} ${dDetail}`
                                                                                });
                                                                            }}
                                                                            className="mt-1 bg-red-900/50 hover:bg-red-800 text-red-200 px-2 py-0.5 text-[10px] font-bold uppercase border border-red-700 disabled:opacity-40 transition-colors w-full flex items-center justify-center gap-1"
                                                                        >
                                                                            <Swords size={10}/> ROLAR ATAQUE
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Spawn NPC form */}
                        <div className="border-t border-red-900/30 pt-3">
                            <span className="text-xs text-red-500/70 uppercase font-bold">Nova Ameaça</span>
                            <div className="flex flex-wrap gap-2 items-end mt-2">
                                <div className="w-full flex gap-2">
                                    <div className="flex flex-col gap-0.5 flex-1">
                                        <label className="text-xs text-red-500/70 uppercase">Classe</label>
                                        <select
                                            value={selectedNpcClass}
                                            onChange={e => {
                                                const c = e.target.value;
                                                setSelectedNpcClass(c);
                                                if (NPC_CLASSES[c]) {
                                                    const cls = NPC_CLASSES[c];
                                                    const rank = NPC_RANKS[selectedNpcRank];
                                                    setNewNpc(prev => ({
                                                        ...prev,
                                                        name: cls.name,
                                                        combat: cls.combat + (rank?.combatMod || 0),
                                                        hp: Math.floor(cls.hp * (rank?.hpMult || 1)),
                                                        movementMax: cls.movementMax,
                                                        icon: cls.icon,
                                                        color: cls.color,
                                                        attacks: cls.attacks
                                                    }));
                                                }
                                            }}
                                            className="bg-zinc-950 border border-red-900/50 text-red-300 p-2 text-sm outline-none w-full font-mono"
                                        >
                                            {Object.keys(NPC_CLASSES).map(k => <option key={k} value={k}>{k}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-0.5 flex-1">
                                        <label className="text-xs text-red-500/70 uppercase">Ranque</label>
                                        <select
                                            value={selectedNpcRank}
                                            onChange={e => {
                                                const r = e.target.value;
                                                setSelectedNpcRank(r);
                                                const cls = NPC_CLASSES[selectedNpcClass];
                                                if (cls && NPC_RANKS[r]) {
                                                    const rank = NPC_RANKS[r];
                                                    setNewNpc(prev => ({
                                                        ...prev,
                                                        combat: cls.combat + rank.combatMod,
                                                        hp: Math.floor(cls.hp * rank.hpMult),
                                                    }));
                                                }
                                            }}
                                            className="bg-zinc-950 border border-red-900/50 text-red-300 p-2 text-sm outline-none w-full font-mono"
                                        >
                                            {Object.keys(NPC_RANKS).map(k => <option key={k} value={k}>{NPC_RANKS[k].name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {selectedNpcClass === 'Clone' && (
                                    <label className="flex flex-col gap-0.5 mt-2 border-l-2 border-blue-900/50 pl-2 bg-blue-950/10 p-2">
                                        <span className="text-[10px] text-blue-400 uppercase font-bold tracking-widest">Clonar de:</span>
                                        <select
                                            value={cloneTargetId}
                                            onChange={e => {
                                                const pid = e.target.value;
                                                setCloneTargetId(pid);
                                                const player = roomData?.players?.[pid];
                                                if (player) {
                                                    const rank = NPC_RANKS[selectedNpcRank];
                                                    setNewNpc(prev => ({
                                                        ...prev,
                                                        name: `Clone: ${player.name}`,
                                                        combat: (player.stats?.combat || 45) + (rank?.combatMod || 0),
                                                        hp: Math.floor((player.vitals?.health?.max || 20) * (rank?.hpMult || 1)),
                                                        maxHp: Math.floor((player.vitals?.health?.max || 20) * (rank?.hpMult || 1)),
                                                        icon: '👥',
                                                        color: 'text-zinc-400',
                                                        attacks: []
                                                    }));
                                                }
                                            }}
                                            className="bg-zinc-950 border border-blue-900/50 text-blue-300 p-1.5 text-sm outline-none font-mono"
                                        >
                                            <option value="">Selecione um Jogador</option>
                                            {Object.entries(roomData?.players || {}).map(([id, p]) => (
                                                <option key={id} value={id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                                <input
                                    type="text"
                                    placeholder="Nome do NPC"
                                    className="bg-zinc-950 border border-red-900/50 text-red-300 p-2 text-sm outline-none w-full mt-1"
                                    value={newNpc.name}
                                    onChange={e => setNewNpc(prev => ({...prev, name: e.target.value}))}
                                />
                                <div className="flex flex-col gap-0.5 mt-1">
                                    <label className="text-xs text-red-500/70 uppercase">INIC</label>
                                    <input
                                        type="number"
                                        className="bg-zinc-950 border border-red-900/50 text-red-300 p-2 text-sm outline-none w-14"
                                        value={newNpc.initiative}
                                        onChange={e => setNewNpc(prev => ({...prev, initiative: parseInt(e.target.value)||0}))}
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5 mt-1">
                                    <label className="text-xs text-red-500/70 uppercase">CBT</label>
                                    <input
                                        type="number"
                                        className="bg-zinc-950 border border-red-900/50 text-red-300 p-2 text-sm outline-none w-14"
                                        value={newNpc.combat}
                                        onChange={e => setNewNpc(prev => ({...prev, combat: parseInt(e.target.value)||0}))}
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5 mt-1">
                                    <label className="text-xs text-red-500/70 uppercase">HP</label>
                                    <input
                                        type="number"
                                        className="bg-zinc-950 border border-red-900/50 text-red-300 p-2 text-sm outline-none w-14"
                                        value={newNpc.hp}
                                        onChange={e => setNewNpc(prev => ({...prev, hp: parseInt(e.target.value)||0}))}
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5 mt-1">
                                    <label className="text-xs text-red-500/70 uppercase">MOVE</label>
                                    <input
                                        type="number"
                                        className="bg-zinc-950 border border-red-900/50 text-red-300 p-2 text-sm outline-none w-14"
                                        value={newNpc.movementMax}
                                        onChange={e => setNewNpc(prev => ({...prev, movementMax: parseInt(e.target.value)||6}))}
                                    />
                                </div>
                                {/* Icon selector */}
                                <div className="flex flex-col gap-0.5 mt-1 w-full">
                                    <label className="text-xs text-red-500/70 uppercase">Ícone</label>
                                    <div className="flex gap-1">
                                        {['👾','💀','🤖','🕷️','👤','🐙','🦂','🧹','👹','🐍'].map(icon => (
                                            <button
                                                key={icon}
                                                onClick={() => setNewNpc(prev => ({...prev, icon}))}
                                                className={`text-base border rounded transition-all ${
                                                    newNpc.icon === icon ? 'border-red-400 bg-red-950/50 scale-110' : 'border-transparent hover:border-red-800'
                                                }`}
                                            >
                                                {icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* Attacks selector */}
                                <div className="w-full border-t border-red-900/30 pt-2 mt-1">
                                    <span className="text-xs text-red-500/70 uppercase">Ataques ({newNpc.attacks.length})</span>
                                    {newNpc.attacks.map((atk, i) => (
                                        <div key={i} className="flex items-center gap-1 mt-1">
                                            <span className="text-xs text-red-300 flex-1 truncate font-mono">{atk.name} | {atk.damage} | {atk.range}sq</span>
                                            <button onClick={() => setNewNpc(p => ({ ...p, attacks: p.attacks.filter((_, idx) => idx !== i) }))} className="text-red-700 hover:text-red-400"><X size={12} /></button>
                                        </div>
                                    ))}
                                    <div className="flex gap-1 mt-2 w-full flex-wrap">
                                        <input type="text" placeholder="Ataque" value={newNpcAttack.name} onChange={e => setNewNpcAttack(p => ({ ...p, name: e.target.value }))} className="flex-1 bg-zinc-950 border border-red-900/50 text-red-300 p-1.5 text-sm outline-none font-mono min-w-[80px]" />
                                        <input type="text" placeholder="Dano" value={newNpcAttack.damage} onChange={e => setNewNpcAttack(p => ({ ...p, damage: e.target.value }))} className="w-16 bg-zinc-950 border border-red-900/50 text-red-300 p-1.5 text-sm outline-none font-mono" />
                                        <input type="number" placeholder="Alc" value={newNpcAttack.range} onChange={e => setNewNpcAttack(p => ({ ...p, range: Number(e.target.value) }))} className="w-12 bg-zinc-950 border border-red-900/50 text-red-300 p-1.5 text-sm outline-none font-mono" />
                                        <button onClick={() => { if(newNpcAttack.name && newNpcAttack.damage) { setNewNpc(p => ({ ...p, attacks: [...p.attacks, newNpcAttack] })); setNewNpcAttack({ name: "", damage: "1d10", range: 1 }); } }} className="bg-red-900/50 hover:bg-red-800 text-red-300 px-3 font-bold border border-red-800 text-sm">+</button>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        if(newNpc.name.trim()) {
                                            addNPCToEncounter(roomId, {
                                                name: newNpc.name,
                                                initiative: newNpc.initiative,
                                                icon: newNpc.icon,
                                                color: newNpc.color || 'bg-red-500',
                                                hp: newNpc.hp,
                                                maxHp: newNpc.hp,
                                                combat: newNpc.combat,
                                                movementMax: newNpc.movementMax,
                                                attacks: newNpc.attacks,
                                            });
                                            setNewNpc({ name: '', initiative: 10, icon: '👾', color: 'text-red-500', hp: 20, maxHp: 20, combat: 45, movementMax: 6, attacks: [] });
                                            setSelectedNpcClass('Customizado');
                                            setSelectedNpcRank('Normal');
                                        }
                                    }}
                                    className="bg-red-900 text-xs px-4 py-2 text-red-100 font-bold uppercase transition hover:bg-red-800 flex items-center gap-1 mt-2 w-full justify-center"
                                >
                                    <Plus size={12}/> INSERIR AMEAÇA
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 content-start">

                    {/* ENVIRONMENT PRESET SELECTOR */}
                    <div className="md:col-span-2 border border-emerald-900/50 bg-emerald-950/10 p-4 mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-sm font-bold tracking-widest text-emerald-500 uppercase">CONTROLE DE TELEMETRIA AMBIENTAL</h2>
                            <span className="text-xs text-emerald-700">Painel do Jogador Atual: {roomData?.environment?.presetName || 'Desconhecido'}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(Object.keys(ENVIRONMENT_PRESETS) as Array<keyof typeof ENVIRONMENT_PRESETS>).map(preset => (
                                <button
                                    key={preset}
                                    onClick={() => applyEnvironmentPreset(preset)}
                                    className={`text-xs px-3 py-1 font-bold tracking-wide uppercase border transition-colors ${roomData?.environment?.presetName === preset ? 'bg-emerald-900 text-emerald-400 border-emerald-500' : 'bg-transparent text-emerald-600 border-emerald-900/50 hover:bg-emerald-950/50 hover:text-emerald-300'}`}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* IMAGE SLIDESHOW CONTROL */}
                    <div className="md:col-span-2 border border-blue-900/50 bg-blue-950/10 p-4 mb-4 flex flex-col gap-3">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-sm font-bold tracking-widest text-blue-500 uppercase flex items-center gap-2">
                                <ImageIcon size={16} /> COMPARTILHAMENTO DE TELA (SLIDESHOW)
                            </h2>
                            <span className="text-xs text-blue-700">Pressione <kbd className="bg-blue-900 text-blue-300 px-1 rounded mx-1">Ctrl+V</kbd> em qualquer lugar fora do chat para enviar uma imagem rápida.</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <label className="cursor-pointer bg-blue-950/50 hover:bg-blue-900 text-blue-400 border border-blue-800 px-4 py-2 font-bold tracking-widest flex items-center gap-2 transition-colors uppercase text-sm">
                                <Upload size={16} /> ESCOLHER ARQUIVO
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            processImageFile(e.target.files[0]);
                                        }
                                    }}
                                />
                            </label>

                            {roomData?.activeImage && (
                                <button
                                    onClick={handleClearImage}
                                    className="bg-red-950/50 hover:bg-red-900 text-red-500 border border-red-900 px-4 py-2 font-bold tracking-widest flex items-center gap-2 transition-colors uppercase text-sm"
                                >
                                    <Trash2 size={16} /> ENCERRAR SLIDESHOW
                                </button>
                            )}
                        </div>
                        {roomData?.activeImage && (
                            <div className="mt-2 border border-blue-500/30 p-2 max-w-sm">
                                <span className="text-xs text-blue-400 mb-1 block uppercase font-bold tracking-widest">Transmitindo Atualmente:</span>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={roomData.activeImage} alt="Transmissão Ativa" className="max-h-32 object-contain opacity-80" />
                            </div>
                        )}
                    </div>

                    {orderedPlayers.length === 0 && (
                        <div className="text-emerald-800 p-8 border border-emerald-900/50 bg-emerald-950/10">
                            Nenhuma assinatura vital detectada neste setor.
                        </div>
                    )}
                    {orderedPlayers.map((player: CharacterSheet, index: number) => (
                        <MiniSheet
                            key={player.id}
                            character={player}
                            onUpdate={(path, val) => handleUpdate(player.id, path, val as string | number | boolean)}
                            onDamage={(dmg) => handleDamage(player.id, dmg)}
                            onStress={(amount) => handleStress(player.id, amount)}
                            onInspect={() => setSelectedPlayerId(player.id)}
                            onMoveUp={() => movePlayer(player.id, 'UP')}
                            onMoveDown={() => movePlayer(player.id, 'DOWN')}
                            isFirst={index === 0}
                            isLast={index === orderedPlayers.length - 1}
                        />
                    ))}
                </div>

                <div className="xl:col-span-1 border-l-2 border-emerald-900/50 pl-0 xl:pl-8 flex flex-col">
                    <h2 className="text-xl text-emerald-500 mb-4 tracking-widest">FEED DE EVENTOS</h2>
                    <TerminalLog roomId={roomId} heightClass="h-[600px]" />

                    {/* Warden Broadcast Input */}
                    <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
                        <input
                            type="text"
                            value={wardenMessage}
                            onChange={(e) => setWardenMessage(e.target.value)}
                            placeholder="Transmitir mensagem via commlink..."
                            className="flex-1 bg-zinc-950 border border-emerald-900/50 p-2 text-emerald-400 outline-none focus:border-emerald-500 font-mono text-sm placeholder:text-emerald-900"
                        />
                        <button
                            type="submit"
                            disabled={!wardenMessage.trim()}
                            className="bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400 px-4 font-bold border border-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm"
                        >
                            ENVIAR
                        </button>
                    </form>
                </div>
            </section>

            {/* Modal de Inspeção Dinâmica */}
            {selectedPlayerId && roomData?.players?.[selectedPlayerId] && (
                <PlayerModal
                    roomId={roomId}
                    character={roomData.players[selectedPlayerId]}
                    onClose={() => setSelectedPlayerId(null)}
                    onUpdate={(path, val) => handleUpdate(selectedPlayerId, path, val as string | number | boolean)}
                    onTriggerPanic={() => { handleTriggerPanic(selectedPlayerId); setSelectedPlayerId(null); }}
                />
            )}

            {/* WARDEN PANIC TEST MODAL */}
            {roomData?.activePanicTest && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-zinc-950 border-2 border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.3)] max-w-lg w-full flex flex-col p-6 animate-in zoom-in-95 relative">
                        <button
                            onClick={() => clearActivePanicTest(roomId)}
                            className="absolute top-4 right-4 text-amber-500/50 hover:text-amber-500 transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <div className="flex items-center gap-3 border-b border-amber-500/30 pb-4 mb-6">
                            <PanicIcon className="text-amber-500 animate-pulse" size={40} strokeWidth={2.5} />
                            <div>
                                <h2 className="text-xl font-bold uppercase tracking-widest text-amber-500">TESTE DE PÂNICO ATIVO</h2>
                                <p className="text-sm text-amber-500/70 font-mono">ALVO: {roomData.activePanicTest.playerName || 'DESCONHECIDO'}</p>
                            </div>
                        </div>

                        {roomData.activePanicTest.status === 'waiting' && (
                            <div className="text-center py-8">
                                <p className="text-amber-300 animate-pulse text-lg tracking-widest uppercase">Aguardando inserção de dados pelo jogador...</p>
                            </div>
                        )}

                        {roomData.activePanicTest.status === 'rolled' && roomData.activePanicTest.is_panic === false && (
                            <div className="text-center flex flex-col items-center gap-6">
                                <div className="text-4xl font-bold text-emerald-500 bg-emerald-950/30 border border-emerald-500/50 w-full py-4 tracking-widest">
                                    [ SUCESSO ]
                                </div>
                                <div className="text-2xl font-mono text-emerald-400">Resultado: {roomData.activePanicTest.rolledD20} <span className="text-sm text-gray-400">&gt;</span> <span className="text-lg text-amber-400">Estresse {roomData.activePanicTest.stress}</span></div>
                                <button onClick={handleDismissPanicTest} className="w-full bg-emerald-900 border border-emerald-500 hover:bg-emerald-800 text-emerald-100 font-bold uppercase py-4 transition-colors">
                                    LIBERAR JOGADOR (OK)
                                </button>
                            </div>
                        )}

                        {roomData.activePanicTest.status === 'rolled' && roomData.activePanicTest.is_panic === true && (
                            <div className="flex flex-col items-center gap-6">
                                <div className="text-4xl font-bold text-red-500 bg-red-950/30 border border-red-500/50 w-full py-4 text-center tracking-widest">
                                    [ FALHA - PÂNICO ]
                                </div>
                                <div className="text-xl font-mono text-red-400">Resultado: {roomData.activePanicTest.rolledD20} <span className="text-sm text-gray-400">&lt;=</span> <span className="text-lg text-amber-400">Estresse {roomData.activePanicTest.stress}</span></div>

                                {!customCondition.show ? (
                                    <div className="w-full flex justify-between gap-4 mt-4">
                                        <button onClick={handleApplyPanicOracle} className="flex-1 bg-red-950 border border-red-500 hover:bg-red-900 text-red-400 font-bold uppercase py-4 transition-colors flex flex-col items-center gap-1">
                                            <span>USAR ORÁCULO</span>
                                            <span className="text-[10px] text-red-500/70 font-mono">(Tabela Automática)</span>
                                        </button>
                                        <button onClick={() => setCustomCondition(prev => ({ ...prev, show: true }))} className="flex-1 bg-amber-950 border border-amber-500 hover:bg-amber-900 text-amber-400 font-bold uppercase py-4 transition-colors flex flex-col items-center gap-1">
                                            <span>INSERIR CONDIÇÃO</span>
                                            <span className="text-[10px] text-amber-500/70 font-mono">(Manual)</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full border border-amber-500/50 p-4 bg-zinc-900/80">
                                        <h3 className="text-amber-500 font-bold uppercase tracking-widest text-sm mb-4 border-b border-amber-900/50 pb-2 flex justify-between">
                                            <span>Condição Manual</span>
                                            <button onClick={() => setCustomCondition(prev => ({ ...prev, show: false }))} className="text-amber-700 hover:text-amber-400"><X size={16} /></button>
                                        </h3>
                                        <div className="flex flex-col gap-3">
                                            <input type="text" placeholder="Nome da Condição..." className="bg-zinc-950 border border-amber-900/50 text-amber-300 p-2 font-mono outline-none focus:border-amber-500" value={customCondition.name} onChange={e => setCustomCondition(prev => ({ ...prev, name: e.target.value }))} />

                                            <div className="flex gap-2">
                                                <select className="flex-1 bg-zinc-950 border border-amber-900/50 text-amber-300 p-2 text-xs font-mono outline-none" value={customCondition.stat} onChange={e => setCustomCondition(prev => ({ ...prev, stat: e.target.value }))}>
                                                    <option value="all">TODOS ATRIBUTOS/SAVES</option>
                                                    <option value="strength">FORÇA</option>
                                                    <option value="speed">RAPIDEZ</option>
                                                    <option value="intellect">INTELECTO</option>
                                                    <option value="combat">COMBATE</option>
                                                    <option value="sanity">SANIDADE</option>
                                                    <option value="fear">MEDO</option>
                                                    <option value="body">CORPO</option>
                                                </select>
                                                <select className="flex-1 bg-zinc-950 border border-amber-900/50 text-amber-300 p-2 text-xs font-mono outline-none" value={customCondition.modifier} onChange={e => setCustomCondition(prev => ({ ...prev, modifier: e.target.value }))}>
                                                    <option value="disadvantage">DESVANTAGEM</option>
                                                    <option value="advantage">VANTAGEM</option>
                                                    <option value="math_sub">PENALIDADE (-)</option>
                                                </select>
                                            </div>

                                            {customCondition.modifier === 'math_sub' && (
                                                <input
                                                    type="number"
                                                    placeholder="Valor da Penalidade (ex: 5)"
                                                    className="bg-zinc-950 border border-amber-900/50 text-amber-300 p-2 font-mono outline-none focus:border-amber-500 w-full"
                                                    value={customCondition.value || ''}
                                                    onChange={e => setCustomCondition(prev => ({ ...prev, value: Number(e.target.value) }))}
                                                />
                                            )}

                                            <label className="flex items-center gap-2 mt-2 cursor-pointer border border-red-900/30 bg-red-950/10 p-2">
                                                <input type="checkbox" checked={customCondition.isFatal} onChange={e => setCustomCondition(prev => ({ ...prev, isFatal: e.target.checked }))} className="accent-red-500" />
                                                <span className="text-red-500 text-xs font-bold tracking-widest uppercase">CONDIÇÃO FATAL (MATA INSTANTANEAMENTE)</span>
                                            </label>

                                            <button onClick={handleApplyCustomCondition} className="w-full bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold uppercase tracking-widest p-3 mt-4 transition-colors">
                                                APLICAR CONDIÇÃO
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}


//
// MÓDULO DE INSPEÇÃO (MODAL DO DIRETOR)
function PlayerModal({ roomId, character, onClose, onUpdate, onTriggerPanic }: { roomId: string, character: CharacterSheet, onClose: () => void, onUpdate: (path: string, val: unknown) => void, onTriggerPanic: () => void }) {
    const isDead = character.vitals.wounds.current >= character.vitals.wounds.max;
    const [flavorText, setFlavorText] = useState("");
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className={`w-full max-w-4xl border-2 ${isDead ? 'border-red-900 bg-red-950/20' : 'border-emerald-900 bg-zinc-950'} p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-6`} onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-emerald-600 hover:text-emerald-300">
                    <X size={24} />
                </button>

                <h2 className={`text-2xl font-bold tracking-widest border-b pb-4 ${isDead ? 'text-red-500 border-red-900/50' : 'text-emerald-400 border-emerald-900/50'} flex justify-between items-center`}>
                    <span>INSPEÇÃO DE PROTOCOLO // {character.name || "UNIDADE"}</span>
                    {!isDead && (
                        <button
                            onClick={onTriggerPanic}
                            className="text-xs px-3 py-2 bg-amber-950 border border-amber-700 text-amber-400 hover:bg-amber-900 font-bold uppercase tracking-widest transition-colors"
                            title="Forçar Teste de Pânico no Jogador"
                        >
                            ⚠ TESTE DE PÂNICO
                        </button>
                    )}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Atributos */}
                    <div>
                        <h3 className="text-xl border-b border-emerald-900/50 pb-2 mb-4 text-emerald-500">ATRIBUTOS</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <WardenStatBox label="FORÇA" value={character.stats.strength} path="baseStats/strength" onUpdate={onUpdate} baseValue={character.baseStats.strength} />
                            <WardenStatBox label="RAPIDEZ" value={character.stats.speed} path="baseStats/speed" onUpdate={onUpdate} baseValue={character.baseStats.speed} />
                            <WardenStatBox label="INTELECTO" value={character.stats.intellect} path="baseStats/intellect" onUpdate={onUpdate} baseValue={character.baseStats.intellect} />
                            <WardenStatBox label="COMBATE" value={character.stats.combat} path="baseStats/combat" onUpdate={onUpdate} baseValue={character.baseStats.combat} />
                        </div>
                    </div>
                    {/* Resistencias */}
                    <div>
                        <h3 className="text-xl border-b border-emerald-900/50 pb-2 mb-4 text-emerald-500">RESISTÊNCIAS</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <WardenStatBox label="SANIDADE" value={character.saves.sanity} path="baseSaves/sanity" onUpdate={onUpdate} baseValue={character.baseSaves.sanity} />
                            <WardenStatBox label="MEDO" value={character.saves.fear} path="baseSaves/fear" onUpdate={onUpdate} baseValue={character.baseSaves.fear} />
                            <WardenStatBox label="CORPO" value={character.saves.body} path="baseSaves/body" onUpdate={onUpdate} baseValue={character.baseSaves.body} />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                    <WardenVitalBox label="SAÚDE" current={character.vitals.health.current} max={character.vitals.health.max} path="vitals/health" onUpdate={onUpdate} />
                    <WardenVitalBox label="FERIDAS" current={character.vitals.wounds.current} max={character.vitals.wounds.max} path="vitals/wounds" onUpdate={onUpdate} />
                    <div className="border border-emerald-900/50 bg-zinc-900/50 p-4 shrink-0">
                        <div className="text-emerald-600 mb-2 font-bold text-sm tracking-widest">STRESS (ATUAL/MÍNIMO)</div>
                        <div className="flex gap-2 items-center">
                            <input
                                type="number"
                                className="w-16 bg-transparent border-b border-amber-800 text-xl text-amber-500 outline-none text-center font-bold focus:border-amber-400 focus:bg-amber-950/20"
                                value={character.vitals.stress.current || 0}
                                onChange={(e) => onUpdate("vitals/stress/current", Number(e.target.value))}
                            />
                            <span className="text-emerald-800 font-bold">/</span>
                            <input
                                type="number"
                                className="w-16 bg-transparent border-b border-emerald-800 text-xl text-emerald-500 outline-none text-center focus:border-emerald-500 focus:bg-emerald-950/20"
                                value={character.vitals.stress.min || 0}
                                onChange={(e) => onUpdate("vitals/stress/min", Number(e.target.value))}
                            />
                        </div>
                    </div>
                    <div className="border border-emerald-900/50 bg-zinc-900/50 p-4 shrink-0">
                        <div className="text-emerald-600 mb-2 font-bold text-sm tracking-widest">MOVIMENTO MÁXIMO</div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => onUpdate("movementPoints/max", (character.movementPoints?.max || 6) - 1)} className="text-red-500 bg-red-950/50 px-2 py-1 font-bold">-</button>
                            <span className="font-bold text-white text-xl w-12 text-center">{character.movementPoints?.max || 6}</span>
                            <button onClick={() => onUpdate("movementPoints/max", (character.movementPoints?.max || 6) + 1)} className="text-emerald-500 bg-emerald-950/50 px-2 py-1 font-bold">+</button>
                        </div>
                    </div>
                </div>

                {/* Condições Ativas */}
                {character.consequences && character.consequences.length > 0 && (
                    <div className="mt-4 border border-amber-900/50 p-4 bg-amber-950/10">
                        <h3 className="text-xl border-b border-amber-900/50 pb-2 mb-4 text-amber-500">CONDIÇÕES ATIVAS</h3>
                        <div className="flex flex-wrap gap-2">
                            {character.consequences.map(c => (
                                <div key={c.id} className={`flex items-center gap-2 px-3 py-2 border ${c.is_fatal ? 'bg-red-950/50 border-red-900 text-red-500' : 'bg-zinc-950 border-amber-900/50 text-amber-500'}`}>
                                    <div className="flex flex-col">
                                        <span className="font-bold uppercase text-xs tracking-widest">{c.name} {c.is_fatal && '(FATAL)'}</span>
                                        <span className="opacity-70 text-[10px] italic">{c.ui_description}</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newCons = character.consequences!.filter(x => x.id !== c.id);
                                            onUpdate("consequences", newCons as unknown as Consequence[]);
                                        }}
                                        className="text-red-500/50 hover:text-red-400 p-1 ml-2 transition-colors"
                                        title="Remover Condição"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* INVENTÁRIO DO JOGADOR */}
                <div className="mt-4 border border-blue-900/50 p-4 bg-zinc-900/50">
                    <h3 className="text-xl border-b border-blue-900/50 pb-2 mb-4 text-blue-500 flex items-center gap-2">
                        <Package size={20} /> INVENTÁRIO
                    </h3>
                    <div className="flex flex-col gap-2">
                        {(!character.inventory || character.inventory.length === 0) ? (
                            <span className="text-sm text-blue-500/50 italic">Inventário Vazio</span>
                        ) : (
                            character.inventory.map((item, index) => (
                                <div key={`${item.id}-${index}`} className="flex justify-between items-center bg-zinc-950 border border-blue-900/30 p-2">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-blue-300 font-bold uppercase tracking-widest">{item.name} <span className="text-xs text-blue-500 opacity-70">x{item.quantity}</span></span>
                                        <span className="text-xs text-blue-500/70 italic">{item.description}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1">
                                            <label className="text-[10px] text-blue-600 font-bold uppercase">QTD:</label>
                                            <input 
                                                type="number" 
                                                className="w-12 bg-zinc-900 border border-blue-900 text-blue-400 text-center font-mono text-xs outline-none focus:border-blue-500" 
                                                value={item.quantity}
                                                onChange={(e) => {
                                                    const newInv = [...character.inventory!];
                                                    newInv[index].quantity = Number(e.target.value);
                                                    onUpdate("inventory", newInv);
                                                }}
                                            />
                                        </div>
                                        {itemToDelete === index ? (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="Motivo (ex: Quebrou)..." 
                                                    className="bg-red-950/50 border border-red-900 text-red-300 text-xs px-2 py-1 outline-none w-32"
                                                    value={flavorText}
                                                    onChange={e => setFlavorText(e.target.value)}
                                                />
                                                <button 
                                                    className="bg-red-900 text-white text-[10px] px-2 py-1 font-bold uppercase transition hover:bg-red-800"
                                                    onClick={() => {
                                                        removeItemFromPlayer(roomId, character.id, index);
                                                        pushLog(roomId, {
                                                            timestamp: Date.now(),
                                                            playerName: "SISTEMA LOGÍSTICO",
                                                            playerId: character.id,
                                                            statName: `ITEM PERDIDO: ${character.name} PERDEU ${item.name}`,
                                                            statValue: 0,
                                                            roll: 0,
                                                            result: 'Warden Message',
                                                            customMessage: flavorText || "O item foi destruído/perdido."
                                                        });
                                                        setItemToDelete(null);
                                                        setFlavorText("");
                                                    }}
                                                >
                                                    CONFIRMAR
                                                </button>
                                                <button className="text-zinc-500 hover:text-white" onClick={() => setItemToDelete(null)}><X size={14}/></button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => setItemToDelete(index)}
                                                className="text-red-500/50 hover:text-red-400 p-1 transition-colors"
                                                title="Remover Item"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function WardenStatBox({ label, value, baseValue, path, onUpdate }: { label: string, value: number, baseValue: number, path: string, onUpdate: (p: string, v: number) => void }) {
    return (
        <div className="border border-emerald-900/50 bg-zinc-900/50 p-2 flex flex-col hover:border-emerald-500 transition-colors">
            <span className="text-sm text-emerald-600 font-bold">{label}</span>
            <div className="flex justify-between items-center w-full mt-2">
                <div className="flex flex-col">
                    <span className="text-[10px] text-emerald-700/50 uppercase leading-none mb-1">Base</span>
                    <input
                        type="number"
                        className="w-14 bg-zinc-950 border border-emerald-900 text-center text-sm outline-none font-mono focus:border-emerald-500 text-amber-500 py-1"
                        value={baseValue || 0}
                        onChange={(e) => onUpdate(path, Number(e.target.value))}
                    />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-emerald-700/50 uppercase leading-none mb-1">Total (+Mod)</span>
                    <span className="text-2xl font-bold text-emerald-400">{value || 0}</span>
                </div>
            </div>
        </div>
    );
}

function WardenVitalBox({ label, current, max, path, onUpdate }: { label: string, current: number, max: number, path: string, onUpdate: (p: string, v: number) => void }) {
    return (
        <div className="border border-emerald-900/50 bg-zinc-900/50 p-4">
            <div className="text-emerald-600 mb-2 font-bold text-sm tracking-widest">{label}</div>
            <div className="flex gap-2 items-center">
                <input
                    type="number"
                    className="w-16 bg-transparent border-b border-emerald-800 text-xl text-emerald-400 outline-none text-center font-bold focus:border-emerald-400 focus:bg-emerald-950/20"
                    value={current || 0}
                    onChange={(e) => onUpdate(`${path}/current`, Number(e.target.value))}
                />
                <span className="text-emerald-800 font-bold">/</span>
                <input
                    type="number"
                    className="w-16 bg-transparent border-b border-emerald-800 text-xl text-emerald-600 outline-none text-center focus:border-emerald-600 focus:bg-emerald-950/20"
                    value={max || 0}
                    onChange={(e) => onUpdate(`${path}/max`, Number(e.target.value))}
                />
            </div>
        </div>
    );
}
