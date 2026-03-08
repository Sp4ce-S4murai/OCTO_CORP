"use client";

import { useEffect, useState, useRef } from "react";
import { subscribeToPlayer, updatePlayer, updatePlayerNested, createEmptyCharacter, createPlayer, submitInitiative, nextTurn, pushLog } from "@/lib/database";
import { CharacterSheet, EncounterState } from "@/types/character";
import { Lock, Unlock, User, Upload, Swords, AlertTriangle, Crosshair, Download, UploadCloud, ChevronDown, ChevronRight, X } from "lucide-react";
import { DiceCalculator } from "./DiceCalculator";
import { TerminalLog } from "./TerminalLog";
import { ClassSelector } from "./ClassSelector";
import { SkillTreeSelector } from "./SkillTreeSelector";
import { HeartRateMonitor } from "./HeartRateMonitor";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { PanicIcon } from "./PanicIcon";
import { EnvironmentState } from "@/types/character";
import { generatePanicResult, PanicOracleOutput } from "@/lib/panicOracle";
import { CombatGrid } from "./CombatGrid";

const VOID_MESSAGES = [
    "Você não está respirando.", "Eles estão te olhando.", "Sua pele não é sua.", "Atrás de você.", "As paredes respiram.",
    "O escuro sabe seu nome.", "Aquilo não era humano.", "Por que você parou?", "Não confie neles.", "O sangue não é seu.",
    "Eles já estão na nave.", "Olhe de novo.", "Sua mente está vazando.", "Isso não é um jogo.", "Você vai morrer aqui.",
    "Eles voltaram.", "O ar está acabando.", "O sensor mentiu.", "Ele está sorrindo para você.", "A sombra se moveu.",
    "Não feche os olhos.", "Falta pouco.", "Está debaixo da sua pele.", "Você me ouve?", "Nós estamos com fome.",
    "Abra a porta.", "Eles sabem o que você fez.", "Não tem ninguém aí.", "O vazio te abraça.", "A dor é o começo.",
    "Esse sangue é seu?", "O rádio está mentindo.", "Cuidado com o teto.", "Alguém sussurrou seu nome.", "A contagem regressiva...",
    "Eles não podem ser mortos.", "A escuridão tem dentes.", "Está tão frio...", "Você é o próximo.", "O sistema falhou.",
    "Não olhe para a câmera.", "A tripulação anterior também lutou.", "Apenas carne.", "Os mortos não dormem.", "Aquela coisa te viu.",
    "Você esqueceu como chorar.", "Tem algo na sua garganta.", "Por que está tão quieto?", "O abismo devolve o olhar.", "Ouviu isso?",
    "Você não consegue fugir.", "Eles estão no duto de ar.", "Cuidado onde pisa.", "Foi você quem os trouxe.", "O sinal foi cortado.",
    "Eles conhecem seus pecados.", "Seus pulmões vão ceder.", "Não existe resgate.", "Sinta eles se aproximando.", "Ninguém vai ajudar.",
    "Você os convidou para entrar.", "A carne cede.", "Onde está o resto da tripulação?", "Isso não é terra firme.", "Cuidado.",
    "Eles vestem a pele dos seus amigos.", "Ouça o rastejar.", "Não respire tão alto.", "Os olhos na parede.", "A luz nunca existiu.",
    "O escuro não é vazio.", "A porta não estava trancada.", "Quem você está enganando?", "O pânico é inútil.", "Você falhou.",
    "Ele está logo ali.", "Você sente esse cheiro?", "Esgotado. Quebrado. Sozinho.", "Isso não é um sonho.", "Acorde.",
    "O sangue deles em suas mãos.", "Os monitores estão errados.", "Tem alguém atrás da tela.", "Aperte o passo.", "Já é tarde demais.",
    "Seu coração vai parar.", "O espaço não é estéril.", "Algo eclodiu.", "As luzes nunca mais vão acender.", "O fim.",
    "Você é um fantasma preso num traje.", "Onde está a saída?", "Aquele barulho não foi a nave.", "Açougue.", "Não existe esperança.",
    "Aquela sombra não tem dono.", "O eco das suas mentiras.", "Uma respiração que não é sua.", "Arranhando o vidro.", "Deixe-os entrar..."
];

export default function PlayerSheetClient({ roomId, playerId }: { roomId: string; playerId: string }) {
    const [character, setCharacter] = useState<CharacterSheet | null>(null);
    const [isRoomLocked, setIsRoomLocked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [environment, setEnvironment] = useState<EnvironmentState | undefined>(undefined);
    const [encounter, setEncounter] = useState<EncounterState | undefined>(undefined);
    const [localInitiative, setLocalInitiative] = useState("");
    const [activePlayerName, setActivePlayerName] = useState<string>("");
    const [activeImage, setActiveImage] = useState<string | null>(null);

    const [showPanicModal, setShowPanicModal] = useState(false);
    const [manualPanicInput, setManualPanicInput] = useState("");
    const [activePanicTest, setActivePanicTest] = useState<any>(null);
    const [wardenAlert, setWardenAlert] = useState<{ type: 'damage' | 'stress', value: number, text: string } | null>(null);

    // Track other players in the room
    const [activePlayers, setActivePlayers] = useState<Array<{ id: string; name: string; characterClass?: string; avatarUrl?: string; hp: number; maxHp: number; stress: number; wounds: number }>>([]);

    useEffect(() => {
        const unsubscribe = subscribeToPlayer(roomId, playerId, (data) => {
            if (data) {
                setCharacter(data);
            } else {
                // Auto-create if not exists based on URL parameter topology constraint
                const newChar = createEmptyCharacter(playerId, playerId);
                createPlayer(roomId, newChar).then(() => {
                    setCharacter(newChar);
                });
            }
            setLoading(false);
        });

        // Listen for Room Lockdown State & Environment Telemetry
        import("@/lib/firebase").then(({ database }) => {
            import("firebase/database").then(({ ref, onValue }) => {
                onValue(ref(database, `rooms/${roomId}/isLocked`), (snap) => {
                    setIsRoomLocked(snap.val() || false);
                });

                // Listen for other players
                onValue(ref(database, `rooms/${roomId}/players`), (snap) => {
                    const playersData = snap.val();
                    if (playersData) {
                        const parsedPlayers = Object.keys(playersData)
                            .filter(id => id !== "placeholder" && id !== playerId)
                            .map(id => ({
                                id,
                                name: playersData[id]?.name || "Desconhecido",
                                characterClass: playersData[id]?.characterClass || null,
                                avatarUrl: playersData[id]?.avatarUrl,
                                hp: playersData[id]?.vitals?.health?.current || 0,
                                maxHp: playersData[id]?.vitals?.health?.max || 10,
                                stress: playersData[id]?.vitals?.stress?.current || 0,
                                wounds: playersData[id]?.vitals?.wounds?.current || 0
                            }));
                        setActivePlayers(parsedPlayers);
                    } else {
                        setActivePlayers([]);
                    }
                });

                onValue(ref(database, `rooms/${roomId}/environment`), (snap) => {
                    setEnvironment(snap.val());
                });

                onValue(ref(database, `rooms/${roomId}/encounter`), (snap) => {
                    setEncounter(snap.val());
                });

                onValue(ref(database, `rooms/${roomId}/activeImage`), (snap) => {
                    setActiveImage(snap.val());
                });

                onValue(ref(database, `rooms/${roomId}/activePanicTest`), (snap) => {
                    const data = snap.val();
                    setActivePanicTest(data);

                    if (data && data.playerId === playerId && data.status === 'waiting') {
                        setShowPanicModal(true);
                    } else {
                        setShowPanicModal(false);
                    }
                });
            });
        });

        return () => unsubscribe();
    }, [roomId, playerId]);

    // Listen for Warden Damage and Stress Logs
    useEffect(() => {
        let cleanup: (() => void) | undefined;
        let initial = true;
        import("@/lib/firebase").then(({ database }) => {
            import("firebase/database").then(({ ref, query, limitToLast, onChildAdded }) => {
                const logsRef = query(ref(database, `rooms/${roomId}/logs`), limitToLast(1));

                const unsubscribe = onChildAdded(logsRef, (snap) => {
                    if (initial) {
                        initial = false;
                        return;
                    }
                    const log = snap.val();
                    if (log && log.playerId === playerId) {
                        if (log.result === 'Warden Damage') {
                            setWardenAlert({ type: 'damage', value: log.statValue, text: "DANO DIRETO RECEBIDO" });
                        } else if (log.result === 'Warden Stress') {
                            setWardenAlert({ type: 'stress', value: log.statValue, text: "ESTRESSE INJETADO" });
                        } else if (log.result === 'Warden Panic') {
                            // Warden manually triggered a panic test
                            setShowPanicModal(true);
                        }
                    }
                });
                cleanup = () => unsubscribe();
            });
        });

        return () => {
            if (cleanup) cleanup();
        };
    }, [roomId, playerId]);

    // Fetch active player name during combat
    useEffect(() => {
        let unsubscribeName: (() => void) | undefined;

        if (encounter?.isActive && encounter.status === 'active' && encounter.turnOrder?.length > 0) {
            const activeId = encounter.turnOrder[encounter.currentTurnIndex];

            if (activeId === playerId && character?.name) {
                setActivePlayerName(character.name);
            } else {
                import("@/lib/firebase").then(({ database }) => {
                    import("firebase/database").then(({ ref, onValue }) => {
                        const nameRef = ref(database, `rooms/${roomId}/players/${activeId}/name`);
                        unsubscribeName = onValue(nameRef, (snap) => {
                            setActivePlayerName(snap.val() || "Desconhecido");
                        });
                    });
                });
            }
        }

        return () => {
            if (unsubscribeName) unsubscribeName();
        };
    }, [roomId, playerId, character?.name, encounter?.isActive, encounter?.status, encounter?.turnOrder, encounter?.currentTurnIndex]);

    // Watch for Stress crossing or holding at Panic Threshold (20)
    const prevStressRef = useRef<number | null>(null);
    useEffect(() => {
        if (character) {
            const currentStress = character.vitals.stress.current;
            const prevStress = prevStressRef.current;

            if (prevStress !== null) {
                // Trigger when:
                // a) Stress crosses from < 20 to >= 20
                // b) Stress was already at 20 and gets hit again (same or higher value received from remote)
                const crossedThreshold = currentStress >= 20 && prevStress < 20;
                const hitAgainAtMax = currentStress >= 20 && prevStress >= 20 && currentStress !== prevStress;

                if (crossedThreshold || hitAgainAtMax) {
                    import("@/lib/database").then(({ submitPanicTestWaiting }) => {
                        submitPanicTestWaiting(roomId, playerId, character.name);
                    });
                }
            }
            prevStressRef.current = currentStress;
        }
    }, [character?.vitals.stress.current]);

    const handleUpdate = (path: string, value: any) => {
        if (!character || isRoomLocked) return;

        if (path.startsWith("baseStats/") || path.startsWith("baseSaves/")) {
            const updates: any = { [path]: value };

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

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isRoomLocked || isDead) return;
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 300;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Compress heavily into WebP to save Firebase Realtime DB Bandwidth
                const dataUrl = canvas.toDataURL("image/webp", 0.7);
                handleUpdate("avatarUrl", dataUrl);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleExport = () => {
        if (!character) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(character, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${character.name || 'Ficha'}_${playerId}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);

                // Preserve the ID of this room's slot to avoid sync issues
                parsed.id = playerId;

                // Sync the entirely new character to Firebase
                createPlayer(roomId, parsed).then(() => {
                    alert("Ficha importada com sucesso!");
                });
            } catch (error) {
                console.error("Failed to parse JSON file", error);
                alert("O arquivo não é uma ficha válida do O.C.T.O. VTT.");
            }
        };
        reader.readAsText(file);

        // Clear input to allow re-importing same file if desired
        e.target.value = "";
    };

    const isVoid = environment?.presetName === 'O Vazio';
    const isDead = character ? character.vitals.wounds.current >= character.vitals.wounds.max : false;
    const [jumpscareImage, setJumpscareImage] = useState<string | null>(null);
    const [voidMessage, setVoidMessage] = useState<{ text: string, x: number, y: number } | null>(null);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        let messageTimer: NodeJS.Timeout;

        if (isVoid && !isDead) {
            // Jumpscare cycle
            const cycle = () => {
                const timeout = Math.random() * 5000 + 1000;
                timer = setTimeout(() => {
                    const randomId = Math.floor(Math.random() * 10) + 1;
                    setJumpscareImage(`/jumpscares/${randomId}.jpg`);
                    setTimeout(() => setJumpscareImage(null), Math.random() * 300 + 50);
                    cycle();
                }, timeout);
            };
            cycle();

            // Disturbing Messages cycle
            const messageCycle = () => {
                const timeout = Math.random() * 8000 + 4000; // 4s to 12s
                messageTimer = setTimeout(() => {
                    if (Math.random() < 0.7) { // 70% chance to show a message each tick
                        const randomMsg = VOID_MESSAGES[Math.floor(Math.random() * VOID_MESSAGES.length)];
                        const randomX = Math.random() * 80 + 10; // 10% to 90% view width
                        const randomY = Math.random() * 80 + 10; // 10% to 90% view height
                        setVoidMessage({ text: randomMsg, x: randomX, y: randomY });
                        setTimeout(() => setVoidMessage(null), Math.random() * 2000 + 1500); // 1.5s to 3.5s duration
                    }
                    messageCycle();
                }, timeout);
            };
            messageCycle();

        } else {
            setJumpscareImage(null);
            setVoidMessage(null);
        }
    }, [isVoid, isDead]);

    if (loading || !character) {
        return <div className="animate-pulse flex p-4 text-emerald-500/50">Carregando Conexão Neural...</div>;
    }

    // Combat / Encounter Logic
    const isEncounterActive = encounter?.isActive;
    const isRollingInitiative = isEncounterActive && encounter?.status === 'rolling';
    const hasRolledInitiative = isRollingInitiative && encounter?.initiatives?.[playerId] !== undefined;

    const isMyTurn = isEncounterActive && encounter?.status === 'active' && encounter.turnOrder[encounter.currentTurnIndex] === playerId;

    const handleSubmitInitiative = () => {
        const val = parseInt(localInitiative);
        if (!isNaN(val)) {
            submitInitiative(roomId, playerId, val);
        }
    };

    const handleEndTurn = () => {
        if (!encounter) return;
        nextTurn(roomId, encounter);
    };



    const getAvatarFilterState = () => {
        if (isDead) return 'avatar-filter-critical grayscale opacity-50';
        if (character.vitals.health.current <= 3) return 'avatar-filter-critical';
        if (character.vitals.health.current <= 6) return 'avatar-filter-warning';
        return 'avatar-filter-normal';
    };

    // --- CALCULATE CONDITION PENALTIES ---
    const getStatPenalty = (statName: string) => {
        if (!character?.consequences) return 0;
        let penalty = 0;
        character.consequences.forEach(c => {
            if (c.target_stat === statName || c.target_stat === 'all') {
                if (c.modifier_type === 'math_sub' && c.modifier_value) {
                    penalty += c.modifier_value;
                }
            }
        });
        return penalty;
    };

    const getSavePenalty = (saveName: string) => {
        if (!character?.consequences) return 0;
        let penalty = 0;
        character.consequences.forEach(c => {
            if (c.target_stat === saveName || c.target_stat === 'all') {
                if (c.modifier_type === 'math_sub' && c.modifier_value) {
                    penalty += c.modifier_value;
                }
            }
        });
        return penalty;
    };

    // Global Theme Override based on Combat Turn
    const activeBorderTheme = (isVoid && !isDead) ? 'border-zinc-500 bg-zinc-950/80 shadow-[0_0_50px_rgba(255,255,255,0.2)] grayscale' : (isMyTurn ? 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]' : (isDead ? 'border-red-900 bg-red-950/20' : 'border-emerald-900 bg-zinc-950/80'));

    const handlePanicSubmit = (type: 'roll' | 'manual') => {
        let rolledD20 = 0;
        if (type === 'roll') {
            rolledD20 = Math.floor(Math.random() * 20) + 1;
        } else {
            rolledD20 = parseInt(manualPanicInput);
            if (isNaN(rolledD20)) return;
        }

        const currentStress = character?.vitals.stress.current || 20;
        const isPanicCheck = rolledD20 <= currentStress;

        import("@/lib/database").then(({ submitPanicTestRoll }) => {
            submitPanicTestRoll(roomId, playerId, character?.name || "Desconhecido", rolledD20, currentStress, isPanicCheck);
        });

        setShowPanicModal(false);
        setManualPanicInput("");
    };

    return (
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-8 items-start relative pb-24">
            <CombatGrid roomId={roomId} isWarden={false} playerId={playerId} />

            {/* JUMPSCARE OVERLAY */}
            {jumpscareImage && (
                <div className="fixed inset-0 z-[300] bg-black flex items-center justify-center pointer-events-none">
                    <img src={jumpscareImage} className="w-full h-full object-cover mix-blend-difference opacity-90 animate-pulse" alt="Anomalia" />
                </div>
            )}

            {/* VOID CRT NOISE OVERLAY */}
            {isVoid && !isDead && (
                <>
                    {/* Dark background tint, toned down for legibility */}
                    <div className="fixed inset-0 z-[-10] bg-black/50 pointer-events-none"></div>

                    {/* Unsettling Random Text Messages */}
                    {voidMessage && (
                        <div
                            className="fixed z-[250] text-red-600 font-mono font-bold text-sm md:text-xl xl:text-3xl mix-blend-screen opacity-70 tracking-widest uppercase pointer-events-none animate-in fade-in zoom-in duration-1000"
                            style={{ left: `${voidMessage.x}%`, top: `${voidMessage.y}%`, transform: 'translate(-50%, -50%)', textShadow: '0 0 10px rgba(220, 38, 38, 0.8)' }}
                        >
                            {voidMessage.text}
                        </div>
                    )}

                    {/* TV Static SVG Noise, opacity lowered to not block text */}
                    <div className="fixed inset-0 z-[50] pointer-events-none opacity-20 mix-blend-overlay bg-[url('data:image/svg+xml;utf8,%3Csvg%20viewBox%3D%220%200%20200%20200%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cfilter%20id%3D%22noise%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.85%22%20numOctaves%3D%223%22%20stitchTiles%3D%22stitch%22%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url%28%23noise%29%22%2F%3E%3C%2Fsvg%3E')] animate-[heavy-oscillation_0.1s_infinite]"></div>

                    {/* Additional jittering scanlines, also more transparent */}
                    <div className="fixed inset-0 z-[51] pointer-events-none bg-[repeating-linear-gradient(transparent,transparent_2px,rgba(0,0,0,0.4)_3px)] bg-[length:100%_4px] animate-[moderate-jitter_0.5s_infinite]"></div>
                </>
            )}

            {/* FULLSCREEN IMAGE MODAL (Diretor's Slideshow) */}
            {activeImage && (
                <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 backdrop-blur-xl animate-in zoom-in-95 duration-500">
                    <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center justify-center animate-pulse-slow">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={activeImage}
                            alt="Transmissão do Diretor"
                            className="w-full h-full object-contain border-2 border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.3)] scanline-overlay"
                        />
                        <div className="absolute top-4 left-4 text-blue-500 bg-blue-950/80 px-4 py-2 text-xs font-bold tracking-widest uppercase border border-blue-900 flex items-center gap-2">
                            <UploadCloud size={14} className="animate-bounce" /> TRANSMISSÃO DIRETA // MOTHERSHIP
                        </div>
                    </div>
                </div>
            )}

            <main className={`flex-1 w-full min-w-0 border-2 ${activeBorderTheme} p-6 rounded-sm shadow-2xl relative overflow-hidden transition-all duration-500`}>

                {/* PANIC MODAL: INPUT D20 */}
                {!isDead && showPanicModal && (
                    <div className="absolute inset-0 bg-red-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-zinc-950 border-2 border-red-500 p-8 flex flex-col items-center gap-6 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.3)] text-center relative">
                            {/* CLOSE BUTTON (FECHAR TELA FORCADO) */}
                            <button
                                onClick={() => {
                                    setShowPanicModal(false);
                                    import("@/lib/database").then(({ clearActivePanicTest }) => clearActivePanicTest(roomId));
                                }}
                                className="absolute top-4 right-4 text-red-500/50 hover:text-red-500 transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <PanicIcon size={64} className="text-red-500 animate-pulse" strokeWidth={2.5} />
                            <div>
                                <h2 className="text-2xl font-bold uppercase tracking-widest text-red-500">Teste de Pânico</h2>
                                <p className="text-red-200/70 text-sm mt-2">O estresse de {character.name} atingiu níveis críticos! Tente rolar um D20 <span className="font-bold underline">MAIOR OU IGUAL</span> que o Stress Atual ({character.vitals.stress.current}) para manter a sanidade.</p>
                            </div>

                            <div className="flex flex-col w-full gap-4 mt-4">
                                <button
                                    onClick={() => handlePanicSubmit('roll')}
                                    className="w-full bg-red-900 border border-red-500 hover:bg-red-800 text-red-100 font-bold uppercase tracking-widest py-4 transition-colors relative overflow-hidden group"
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-2">Rolar D20 Virtual</span>
                                </button>

                                <div className="text-red-500/50 text-xs font-bold uppercase tracking-widest my-2">-- OU --</div>

                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        className="bg-red-950/50 border border-red-500 text-red-400 text-xl text-center p-3 w-24 outline-none focus:border-red-300"
                                        placeholder="Valor"
                                        value={manualPanicInput}
                                        onChange={(e) => setManualPanicInput(e.target.value)}
                                    />
                                    <button
                                        onClick={() => handlePanicSubmit('manual')}
                                        disabled={!manualPanicInput}
                                        className="flex-1 bg-zinc-900 border border-red-500 hover:bg-red-900/50 text-red-400 font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Inserir Manual
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* WAITING FOR WARDEN OVERLAY */}
                {!isDead && activePanicTest?.playerId === playerId && activePanicTest?.status === 'rolled' && (
                    <div className="absolute inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                        <div className="p-8 flex flex-col items-center justify-center gap-6 max-w-md w-full shadow-2xl text-center animate-in zoom-in-95 duration-300 border-2 border-amber-500 bg-amber-950/20 relative">
                            <button
                                onClick={() => {
                                    setShowPanicModal(false);
                                    import("@/lib/database").then(({ clearActivePanicTest }) => clearActivePanicTest(roomId));
                                }}
                                className="absolute top-4 right-4 text-amber-500/50 hover:text-amber-500 transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <PanicIcon size={80} className="animate-pulse text-amber-500" strokeWidth={2.5} />
                            <div>
                                <h2 className="text-2xl font-bold uppercase tracking-widest text-amber-500">RELATÓRIO DE SÍNTESE ENVIADO</h2>
                                <p className="opacity-80 text-sm mt-2 font-mono uppercase text-amber-200">Aguardando Avaliação do Diretor de Protocolo MOTHERSHIP.</p>
                            </div>

                            <div className="bg-black/50 p-6 border border-amber-500/20 text-center w-full my-4">
                                <p className="font-serif italic text-lg leading-relaxed text-amber-100">Resultado = {activePanicTest.rolledD20}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* RESOLVED PANIC TEST OVERLAY */}
                {!isDead && activePanicTest?.playerId === playerId && activePanicTest?.status === 'resolved' && (
                    <div className="absolute inset-0 bg-red-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                        <div className="bg-zinc-950 border-2 border-red-500 p-8 flex flex-col items-center gap-6 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.3)] text-center relative">
                            <PanicIcon size={64} className="text-red-500" strokeWidth={2.5} />
                            <div>
                                <h2 className="text-2xl font-bold uppercase tracking-widest text-red-500">TRAUMA ADQUIRIDO</h2>
                                <p className="text-red-200/70 text-sm mt-2 font-mono uppercase">O Diretor de Protocolo avaliou seu colapso.</p>
                            </div>

                            <div className="bg-red-900/20 border border-red-500/30 p-4 w-full my-2">
                                {/* @ts-ignore */}
                                <h3 className="text-lg font-bold text-red-400 mb-2 uppercase">{activePanicTest?.resultText || "Condição Desconhecida"}</h3>
                                {/* @ts-ignore */}
                                <p className="text-sm text-red-200">{activePanicTest?.resultDescription || ""}</p>
                            </div>

                            <button
                                onClick={() => {
                                    import("@/lib/database").then(({ clearActivePanicTest }) => clearActivePanicTest(roomId));
                                }}
                                className="w-full bg-red-800 hover:bg-red-700 text-white font-bold uppercase tracking-widest py-4 transition-colors"
                            >
                                Aceitar Condição
                            </button>
                        </div>
                    </div>
                )}

                {/* WARDEN ALERT POPUP */}
                {wardenAlert && !isDead && (
                    <div
                        className="fixed inset-0 z-[110] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in zoom-in duration-300 bg-black/60 cursor-pointer"
                        onClick={() => setWardenAlert(null)}
                    >
                        <div className={`p-8 border-4 shadow-2xl flex flex-col items-center justify-center max-w-sm w-full text-center ${wardenAlert.type === 'damage' ? 'bg-red-950 border-red-600 shadow-[0_0_100px_rgba(220,38,38,0.6)]' : 'bg-amber-950 border-amber-500 shadow-[0_0_100px_rgba(245,158,11,0.6)]'}`}>
                            <AlertTriangle size={64} className={`mb-4 animate-bounce ${wardenAlert.type === 'damage' ? 'text-red-500' : 'text-amber-500'}`} />
                            <h2 className={`text-2xl font-black uppercase tracking-widest ${wardenAlert.type === 'damage' ? 'text-red-500' : 'text-amber-500'}`}>{wardenAlert.text}</h2>
                            <div className={`text-6xl font-black mt-6 mb-8 ${wardenAlert.type === 'damage' ? 'text-red-500 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]' : 'text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]'}`}>
                                +{wardenAlert.value}
                            </div>
                            <button className="uppercase text-xs tracking-widest font-bold border border-white/20 px-8 py-3 w-full hover:bg-white/10 transition-colors text-white/80">RECONHECIDO</button>
                        </div>
                    </div>
                )}

                {/* INITIATIVE POPUP OVERLAY */}
                {!isDead && isRollingInitiative && !hasRolledInitiative && (
                    <div className="absolute inset-0 bg-zinc-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-blue-950/30 border-2 border-blue-500 p-8 flex flex-col items-center gap-6 max-w-md w-full shadow-[0_0_50px_rgba(59,130,246,0.2)]">
                            <AlertTriangle size={48} className="text-blue-500 animate-pulse" />
                            <h2 className="text-2xl font-bold uppercase tracking-widest text-blue-400 text-center">Protocolo de Combate Iniciado</h2>
                            <p className="text-blue-200/70 text-center text-sm">Insira seu valor de iniciativa rolado nos dados para entrar na fila de turnos.</p>

                            <input
                                type="number"
                                className="bg-zinc-950 border-2 border-blue-500 text-blue-400 text-4xl text-center p-4 w-32 outline-none focus:border-blue-300 focus:bg-blue-950/50"
                                placeholder="0"
                                value={localInitiative}
                                onChange={(e) => setLocalInitiative(e.target.value)}
                                autoFocus
                            />

                            <button
                                onClick={handleSubmitInitiative}
                                disabled={!localInitiative}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest py-4 border-2 border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Confirmar Iniciativa
                            </button>
                        </div>
                    </div>
                )}

                {isDead && (
                    <div className="absolute inset-0 bg-red-950/40 z-10 pointer-events-none flex items-center justify-center">
                        <div className="text-red-500 font-bold text-6xl md:text-9xl opacity-20 rotate-[-15deg] uppercase tracking-widest border-y-8 border-red-500/20 py-4 mix-blend-overlay">
                            O B I T O
                        </div>
                    </div>
                )}

                {isRoomLocked && !isDead && (
                    <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-red-950/80 border border-red-900 text-red-500 px-3 py-1 text-xs font-bold tracking-widest animate-pulse">
                        <Lock size={14} /> FICHAS TRAVADAS PELO DIRETOR
                    </div>
                )}

                {/* MY TURN BANNER */}
                {isMyTurn && (
                    <div className="bg-blue-600 text-white font-bold p-3 text-center uppercase tracking-[0.3em] shadow-[0_0_20px_rgba(59,130,246,0.5)] animate-pulse flex items-center justify-center gap-4 mb-6">
                        <Crosshair size={24} /> É O SEU TURNO <Crosshair size={24} />
                    </div>
                )}

                {/* ENCOUNTER STATUS BAR (NOT MY TURN) */}
                {!isMyTurn && isEncounterActive && encounter.status === 'active' && !isDead && (
                    <div className="bg-blue-950/50 border border-blue-900/50 text-blue-400 p-2 text-center text-xs tracking-widest uppercase mb-6 flex items-center justify-center gap-2">
                        <Swords size={14} /> Combate Ativo - Aguarde seu turno (Rodada {encounter.round}) - Turno de: {activePlayerName}
                    </div>
                )}

                <header className={`border-b-2 ${isMyTurn ? 'border-blue-500' : (isDead ? 'border-red-900' : 'border-emerald-900')} pb-4 mb-6 relative z-20`}>
                    {!isDead && (
                        <EnvironmentPanel environment={environment} />
                    )}
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        {/* AVATAR BOX (3x4 aspect ratio aprox) */}
                        <div className="w-32 h-40 shrink-0 border border-emerald-900 bg-zinc-950 flex flex-col items-center justify-center relative group overflow-hidden scanline-overlay">
                            {character.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={character.avatarUrl} alt="Avatar" className={`w-full h-full object-cover ${getAvatarFilterState()}`} />
                            ) : (
                                <User size={48} className={`opacity-20 ${isDead ? 'text-red-500' : 'text-emerald-500'}`} />
                            )}

                            {/* Hover Overlay for Upload */}
                            {!isRoomLocked && !isDead && (
                                <label className="absolute inset-0 bg-zinc-950/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                                    <Upload size={24} className="text-emerald-500 mb-2" />
                                    <span className="text-[10px] text-emerald-500 text-center font-bold tracking-widest uppercase px-2 hover:text-emerald-300">
                                        Substituir ID
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />
                                </label>
                            )}
                        </div>

                        {/* IDENTITY INFO */}
                        <div className="flex-1 w-full">
                            <div className="flex justify-between items-start gap-4 flex-col sm:flex-row">
                                <h1 className={`text-2xl font-bold uppercase tracking-widest ${isMyTurn ? 'text-blue-400' : (isDead ? 'text-red-500' : 'text-emerald-400')}`}>
                                    Terminal MOTHERSHIP // {roomId} {isDead && "[ SINAL PERDIDO ]"}
                                </h1>
                                {!isRoomLocked && !isDead && (
                                    <div className="flex gap-2 self-end sm:self-start">
                                        <label className="cursor-pointer bg-zinc-900 border border-emerald-900/50 p-2 hover:bg-emerald-950/50 hover:text-emerald-300 text-emerald-600 transition-colors" title="Importar Ficha do Computador">
                                            <UploadCloud size={18} />
                                            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                                        </label>
                                        <button onClick={handleExport} className="bg-zinc-900 border border-emerald-900/50 p-2 hover:bg-emerald-950/50 hover:text-emerald-300 text-emerald-600 transition-colors" title="Exportar Ficha para o Computador">
                                            <Download size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 flex flex-col md:flex-row gap-6">
                                <div className="flex-1 flex flex-col gap-4">
                                    <InputGroup label="NOME" value={character.name} onChange={(v) => handleUpdate("name", v)} disabled={isRoomLocked || isDead} />
                                    <InputGroup label="FUNÇÃO" value={character.characterClass || 'NENHUMA'} onChange={() => { }} disabled={true} />
                                </div>

                                {/* COMPACT VITALS */}
                                <div className="flex-1 flex flex-col gap-2 min-w-[280px]">
                                    <div className="h-4 w-full mb-1 opacity-80">
                                        <HeartRateMonitor currentHp={character.vitals.health.current} maxHp={character.vitals.health.max} stress={character.vitals.stress.current} wounds={character.vitals.wounds.current} isDead={isDead} isVoid={isVoid} />
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 border border-emerald-900/30 p-2 bg-emerald-950/10">
                                        {/* SAÚDE */}
                                        <div className="flex justify-between items-center bg-zinc-900/50 p-1 border border-emerald-900">
                                            <span className={`text-[10px] font-bold tracking-widest pl-1 ${isDead ? 'text-red-600' : 'text-emerald-600'}`}>SAÚDE</span>
                                            <div className="flex items-center text-xs pr-1 font-mono">
                                                <input disabled={isRoomLocked || isDead} type="number" className={`w-8 bg-transparent text-right outline-none focus:bg-emerald-900/50 ${isDead ? 'text-red-500 font-bold' : (character.vitals.health.current <= 3 ? 'text-red-500 font-bold animate-pulse' : (character.vitals.health.current <= 6 ? 'text-amber-500 font-bold' : 'text-emerald-300'))}`} value={character.vitals.health.current} onChange={(e) => handleUpdate("vitals/health/current", Number(e.target.value))} />
                                                <span className={isDead ? 'text-red-800 mx-1' : 'text-emerald-800 mx-1'}>/</span>
                                                <input disabled={isRoomLocked || isDead} type="number" className={`w-8 bg-transparent text-left outline-none focus:bg-emerald-900/50 ${isDead ? 'text-red-700 font-bold' : 'text-emerald-700'}`} value={character.vitals.health.max} onChange={(e) => handleUpdate("vitals/health/max", Number(e.target.value))} />
                                            </div>
                                        </div>
                                        {/* FERIDAS */}
                                        <div className={`flex justify-between items-center bg-zinc-900/50 p-1 border ${isDead ? 'border-red-900 bg-red-950/20' : 'border-emerald-900'}`}>
                                            <span className={`text-[10px] font-bold tracking-widest pl-1 ${isDead ? 'text-red-500' : 'text-emerald-600'}`}>FERIDAS</span>
                                            <div className="flex items-center text-xs pr-1 font-mono">
                                                <input disabled={isDead} type="number" className={`w-8 bg-transparent text-right outline-none focus:bg-emerald-900/50 ${isDead ? 'text-red-500 font-bold' : 'text-emerald-300'}`} value={character.vitals.wounds.current || 0} onChange={(e) => handleUpdate("vitals/wounds/current", Number(e.target.value))} />
                                                <span className={isDead ? 'text-red-800 mx-1' : 'text-emerald-800 mx-1'}>/</span>
                                                <input disabled={isRoomLocked || isDead} type="number" className={`w-8 bg-transparent text-left outline-none focus:bg-emerald-900/50 ${isDead ? 'text-red-700 font-bold' : 'text-emerald-700'}`} value={character.vitals.wounds.max} onChange={(e) => handleUpdate("vitals/wounds/max", Number(e.target.value))} />
                                            </div>
                                        </div>
                                        {/* STRESS */}
                                        <div className="flex justify-between items-center bg-amber-950/20 p-1 border border-amber-900/50">
                                            <span className="text-[10px] font-bold tracking-widest pl-1 text-amber-600">STRESS</span>
                                            <div className="flex items-center text-xs pr-1 font-mono">
                                                <input disabled={isRoomLocked || isDead} type="number" className="w-8 bg-transparent text-right outline-none text-amber-400 focus:bg-amber-900/50 font-bold" value={character.vitals.stress.current || 0} onChange={(e) => handleUpdate("vitals/stress/current", Number(e.target.value))} />
                                                <span className="text-amber-800/50 mx-1">/ Mão:</span>
                                                <input disabled={isRoomLocked || isDead} type="number" className="w-8 bg-transparent text-left outline-none text-amber-700/50 focus:bg-amber-900/50" value={character.vitals.stress.min || 0} onChange={(e) => handleUpdate("vitals/stress/min", Number(e.target.value))} title="Limite de Estresse Máximo" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ACTIVE PLAYERS MOVED TO SIDEBAR */}
                </header>

                <ClassSelector roomId={roomId} character={character} />

                {/* STATS & SAVES */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <CollapsibleSection title="ATRIBUTOS">
                        <div className="grid grid-cols-2 gap-4">
                            <StatBox label="FORÇA" value={character.stats.strength} penalty={getStatPenalty('strength')} baseValue={character.baseStats.strength} path="baseStats/strength" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                            <StatBox label="RAPIDEZ" value={character.stats.speed} penalty={getStatPenalty('speed')} baseValue={character.baseStats.speed} path="baseStats/speed" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                            <StatBox label="INTELECTO" value={character.stats.intellect} penalty={getStatPenalty('intellect')} baseValue={character.baseStats.intellect} path="baseStats/intellect" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                            <StatBox label="COMBATE" value={character.stats.combat} penalty={getStatPenalty('combat')} baseValue={character.baseStats.combat} path="baseStats/combat" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="RESISTÊNCIAS">
                        <div className="grid grid-cols-1 gap-4">
                            <StatBox label="SANIDADE" value={character.saves.sanity} penalty={getSavePenalty('sanity')} baseValue={character.baseSaves.sanity} path="baseSaves/sanity" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                            <StatBox label="MEDO" value={character.saves.fear} penalty={getSavePenalty('fear')} baseValue={character.baseSaves.fear} path="baseSaves/fear" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                            <StatBox label="CORPO" value={character.saves.body} penalty={getSavePenalty('body')} baseValue={character.baseSaves.body} path="baseSaves/body" onUpdate={handleUpdate} disabled={isRoomLocked || isDead} />
                        </div>
                    </CollapsibleSection>
                </section>


                {/* MODULE: TOOLS & LOGS */}
                <SkillTreeSelector roomId={roomId} character={character} isLocked={isRoomLocked || isDead} />

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    <DiceCalculator roomId={roomId} character={character} />
                    <TerminalLog roomId={roomId} />
                </section>

                {/* END TURN STICKY BUTTON */}
                {isMyTurn && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950/90 border-t-2 border-blue-500 flex justify-center z-[100] backdrop-blur-sm">
                        <button
                            onClick={handleEndTurn}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-4 font-bold uppercase tracking-widest text-lg border-2 border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.6)]"
                        >
                            ENCERRAR MEU TURNO
                        </button>
                    </div>
                )}
            </main>

            {/* SQUADRON SIDEBAR (ACTIVE PLAYERS) */}
            <aside className="w-full xl:w-72 shrink-0 flex flex-col gap-4 sticky top-6">
                <div className="bg-zinc-950 border border-emerald-900/50 p-4 shadow-xl">
                    <h2 className="text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-2 mb-4">
                        <User size={18} /> ESQUADRÃO ATIVO
                    </h2>

                    {activePlayers.length === 0 ? (
                        <div className="text-emerald-800 text-sm border border-emerald-900/30 p-4 bg-emerald-950/10 text-center uppercase tracking-widest">
                            Sinal Perdido // MOTHERSHIP O.S.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {activePlayers.map(p => {
                                const isDead = p.hp === 0;

                                // Compute avatar filter class (same as main sheet)
                                let avatarFilterClass = 'avatar-filter-normal';
                                if (isDead) avatarFilterClass = 'avatar-filter-critical grayscale opacity-50';
                                else if (p.hp <= 3) avatarFilterClass = 'avatar-filter-critical';
                                else if (p.hp <= 6) avatarFilterClass = 'avatar-filter-warning';

                                return (
                                    <div key={p.id} className="flex flex-col gap-1 bg-zinc-900/50 border border-emerald-900/50 shadow-inner group hover:bg-emerald-950/20 transition-colors overflow-hidden" title={p.name}>
                                        {/* Top: Avatar + Info */}
                                        <div className="flex items-stretch gap-0">
                                            {/* Avatar: narrower/shorter */}
                                            <div className="w-10 h-12 shrink-0 relative">
                                                {p.avatarUrl ? (
                                                    <img src={p.avatarUrl} alt={p.name} className={`w-full h-full object-cover ${avatarFilterClass}`} />
                                                ) : (
                                                    <div className="w-full h-full bg-emerald-950/30 flex items-center justify-center">
                                                        <User size={18} className={`opacity-50 ${isDead ? "text-red-900" : "text-emerald-500"}`} />
                                                    </div>
                                                )}
                                            </div>
                                            {/* Info block */}
                                            <div className="flex flex-col justify-between flex-1 min-w-0 px-2 py-1 border-l border-emerald-900/30">
                                                <span className={`text-[10px] uppercase tracking-widest truncate font-bold leading-tight ${isDead ? 'text-red-600 line-through opacity-70' : 'text-emerald-400'}`}>{p.name}</span>
                                                <span className="text-[9px] text-emerald-700 uppercase tracking-wider truncate">{p.characterClass || 'SEM CLASSE'}</span>
                                                <span className={`text-[9px] font-bold uppercase tracking-widest ${isDead ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    {isDead ? '● SINAL PERDIDO' : '● SINAL ATIVO'}
                                                </span>
                                            </div>
                                        </div>
                                        {/* HeartRateMonitor below */}
                                        <div className="px-0">
                                            <HeartRateMonitor currentHp={p.hp} maxHp={p.maxHp} stress={p.stress} wounds={p.wounds} isDead={isDead} isVoid={isVoid} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}

// Helpers
function InputGroup({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
    const [local, setLocal] = useState(value);
    const timeoutRef = useRef<any>(null);

    useEffect(() => {
        setLocal(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Strip special characters while preserving case.
        const val = e.target.value.replace(/[^a-zA-Z0-9À-ÿ .'\-\/]/g, '');
        setLocal(val);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => onChange(val), 500);
    };

    return (
        <div className="flex flex-col">
            <label className="text-xs text-emerald-700 mb-1">{label}</label>
            <input
                disabled={disabled}
                type="text"
                value={local}
                onChange={handleChange}
                className="bg-transparent border-b border-emerald-800 text-emerald-300 outline-none focus:border-emerald-400 focus:bg-emerald-950/20 px-1 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            />
        </div>
    );
}

function StatBox({ label, value, baseValue, path, onUpdate, disabled, penalty = 0 }: { label: string; value: number; baseValue: number; path: string; onUpdate: (p: string, v: number) => void; disabled?: boolean; penalty?: number }) {
    const isModified = value !== baseValue;
    const [isComponentLocked, setIsComponentLocked] = useState(true);

    const isLocked = isComponentLocked || disabled;

    // Calcula o valor final visivel para mostrar de forma transparente
    const displayValue = value - penalty;

    return (
        <div className="bg-zinc-900/50 border border-emerald-900/50 p-2 flex flex-col group hover:border-emerald-500 transition-colors relative">
            {disabled && <div className="absolute inset-0 z-10 cursor-not-allowed"></div>}
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-emerald-600 group-hover:text-emerald-400">{label}</span>
                <button onClick={() => setIsComponentLocked(!isComponentLocked)} className={`text-emerald-800 transition-colors ${disabled ? 'opacity-50' : 'hover:text-amber-500'}`} disabled={disabled}>
                    {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
            </div>
            <div className="flex justify-between items-center w-full">
                <div className="flex flex-col">
                    <span className="text-[10px] text-emerald-700/50 uppercase leading-none mb-1">Base</span>
                    <input
                        type="number"
                        value={baseValue || 0}
                        onChange={(e) => onUpdate(path, Number(e.target.value))}
                        disabled={isLocked}
                        className={`w-14 bg-zinc-950 border border-emerald-900 text-center text-sm outline-none font-mono focus:border-emerald-500 ${isLocked ? 'text-emerald-800/50 cursor-not-allowed' : 'text-amber-400'} disabled:bg-zinc-900/10`}
                        title="Atributo Base (S/ Classe)"
                    />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-emerald-700/50 uppercase leading-none mb-1">Total</span>
                    <div className="flex items-center gap-1">
                        {penalty > 0 && <span className="text-red-500 font-bold text-sm" title="Penalidade de Condição">-{penalty}</span>}
                        <div className={`text-2xl font-bold pr-2 ${penalty > 0 ? 'text-red-400' : (isModified ? 'text-emerald-300' : 'text-emerald-500')}`} title="Resultado Modificado pela Classe e Condições">
                            {displayValue}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="flex flex-col">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-xl border-b border-emerald-900/50 pb-2 mb-4 hover:text-emerald-300 transition-colors w-full text-left font-bold"
            >
                {isOpen ? <ChevronDown size={20} className="text-emerald-600" /> : <ChevronRight size={20} className="text-emerald-600" />}
                {title}
            </button>
            {isOpen && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}


