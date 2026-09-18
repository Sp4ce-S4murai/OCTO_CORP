"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Group, Line, Rect, Text, Circle } from "react-konva";
import type Konva from "konva";
import { CharacterSheet, GridObstacle, GridToken, NpcData } from "@/types/character";
import {
    TILE_W, TILE_H, gridToScreen, screenToCell, diamondPoints,
    boardOffset, boardPixelSize, depth, tailwindToHex,
    cubeFaces, shade, obstacleHeight,
} from "@/lib/isoUtils";

export interface IsometricGridProps {
    gridSize: number;
    tokens: Record<string, GridToken>;
    obstacles: Record<string, GridObstacle>;
    players: Record<string, CharacterSheet>;
    npcs: Record<string, NpcData>;
    currentTurnId: string | null;
    selectedTokenId: string | null;
    targetedTokenId: string | null;
    /** Diretor ve ameacas ocultas (esmaecidas); jogador nao ve nada nesta celula. */
    isWarden: boolean;
    /** Token cujo alcance de ataque deve ser destacado. */
    activeToken: GridToken | null;
    /**
     * Celulas realmente alcancaveis, "x,y" -> custo em passos. Vem de fora
     * porque quem calcula e o tacticalUtils, contornando paredes — nao da para
     * deduzir isso aqui so com a distancia ate o destino.
     */
    reachable: Map<string, number>;
    activeTokenMaxRange: number;
    canHighlight: boolean;
    onCellClick: (x: number, y: number) => void;
    onTokenClick: (tokenId: string) => void;
}

const chebyshev = (ax: number, ay: number, bx: number, by: number) =>
    Math.max(Math.abs(ax - bx), Math.abs(ay - by));

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;

export default function IsometricGrid(props: IsometricGridProps) {
    const {
        gridSize, tokens, obstacles, players, npcs, currentTurnId,
        selectedTokenId, targetedTokenId, isWarden, activeToken, reachable,
        activeTokenMaxRange, canHighlight, onCellClick, onTokenClick,
    } = props;

    const wrapperRef = useRef<HTMLDivElement>(null);
    const groupRef = useRef<Konva.Group>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    // Falso ate o jogador arrastar ou dar zoom manualmente. Enquanto for falso,
    // o enquadramento acompanha o container — essencial porque redimensionar a
    // JANELA (nao so o dispositivo) chega exatamente pelo mesmo ResizeObserver
    // que o primeiro carregamento, e sem reagir a isso o mapa fica com a escala
    // congelada do tamanho antigo: reduzir a janela so encolhe o canvas ao
    // redor de um tabuleiro que nao encolheu junto, cortando as bordas dele.
    const userAdjusted = useRef(false);

    const offset = useMemo(() => boardOffset(gridSize), [gridSize]);
    const board = useMemo(() => boardPixelSize(gridSize), [gridSize]);

    // O palco acompanha o tamanho real do container. Num celular ele e estreito
    // e o tabuleiro isometrico espalha na diagonal, entao sem medir isto o mapa
    // nasce cortado.
    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        measure();
        return () => ro.disconnect();
    }, []);

    const fitToScreen = () => {
        if (!size.width || !size.height) return;
        const fit = Math.min(size.width / board.width, size.height / board.height) * 0.9;
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fit));
        setScale(next);
        setPos({
            x: (size.width - board.width * next) / 2,
            y: (size.height - board.height * next) / 2,
        });
    };

    // Reenquadra sempre que o container muda de tamanho — inclusive quando o
    // container encolhe porque a JANELA foi redimensionada, nao so na medida
    // inicial. Bug que isto corrige: antes o fit rodava uma unica vez (uma
    // ref "didFit"); reduzir a janela depois disso encolhia o canvas mas
    // deixava escala e posicao congeladas na medida antiga, entao o tabuleiro
    // ficava maior que o canvas ao redor dele — cortado nas bordas.
    //
    // So para de seguir o container depois que o jogador mexeu a mao nisso
    // (arrastar ou dar zoom): dai o enquadramento e dele, e o "Centrar" que o
    // devolve ao automatico.
    useEffect(() => {
        if (userAdjusted.current || !size.width || !size.height) return;
        fitToScreen();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size, board]);

    /** Ponto da tela para celula do tabuleiro, desfazendo pan e zoom. */
    const pointerToCell = (stage: Konva.Stage) => {
        const pointer = stage.getPointerPosition();
        const group = groupRef.current;
        if (!pointer || !group) return null;
        const local = group.getAbsoluteTransform().copy().invert().point(pointer);
        const cell = screenToCell(local.x, local.y);
        if (cell.x < 0 || cell.y < 0 || cell.x >= gridSize || cell.y >= gridSize) return null;
        return cell;
    };

    // Arrastar o mapa termina em mouseup, que o Konva tambem reporta como
    // clique. Sem isto, so de dar pan o jogador moveria o proprio token para
    // onde soltou o dedo.
    const didDrag = useRef(false);

    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (didDrag.current) {
            didDrag.current = false;
            return;
        }
        // Tokens e blocos tratam o proprio clique; aqui so chegam cliques no
        // chao vazio. O alvo do evento e a forma interna (o pino, uma face do
        // cubo), nao o Group nomeado, por isso a checagem sobe a arvore.
        //
        // Sem isto o clique valia duas vezes: mirar um inimigo movia o token
        // para cima dele, e apagar uma parede com a borracha pintava outra na
        // casa atras, porque o topo do cubo e desenhado uma casa acima.
        if (e.target.findAncestor(".token", true)) return;
        if (e.target.findAncestor(".obstacle", true)) return;
        const stage = e.target.getStage();
        if (!stage) return;
        const cell = pointerToCell(stage);
        if (cell) onCellClick(cell.x, cell.y);
    };

    const zoomAround = (pointer: { x: number; y: number }, factor: number) => {
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
        if (next === scale) return;
        userAdjusted.current = true;
        // Mantem sob o dedo o mesmo ponto do mapa durante o zoom.
        setPos({
            x: pointer.x - (pointer.x - pos.x) * (next / scale),
            y: pointer.y - (pointer.y - pos.y) * (next / scale),
        });
        setScale(next);
    };

    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const pointer = e.target.getStage()?.getPointerPosition();
        if (!pointer) return;
        zoomAround(pointer, e.evt.deltaY > 0 ? 0.92 : 1.08);
    };

    // Pinch-zoom: essencial porque um mapa 20x20 em isometrico ja tem 1280px de
    // largura e nao cabe inteiro em celular nenhum.
    const lastPinch = useRef<number | null>(null);
    const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
        const t = e.evt.touches;
        if (t.length !== 2) return;
        e.evt.preventDefault();
        const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
        const rect = wrapperRef.current?.getBoundingClientRect();
        const center = {
            x: (t[0].clientX + t[1].clientX) / 2 - (rect?.left ?? 0),
            y: (t[0].clientY + t[1].clientY) / 2 - (rect?.top ?? 0),
        };
        if (lastPinch.current) zoomAround(center, dist / lastPinch.current);
        lastPinch.current = dist;
    };
    const endPinch = () => { lastPinch.current = null; };

    // O chao inteiro e nao-interativo: o clique e resolvido uma vez no palco,
    // convertendo a posicao do ponteiro em celula. Com listeners por celula, um
    // mapa 100x100 teria 10 mil alvos de hit-test.
    const cells = useMemo(() => {
        // So o chao. Obstaculos com volume sao desenhados junto dos tokens,
        // para poderem ser ordenados por profundidade entre si.
        const hazards = new Map<string, GridObstacle>();
        const spawns = new Set<string>();
        Object.values(obstacles || {}).forEach(o => {
            if (obstacleHeight(o.type) > 0) return;
            const key = `${Number(o.x)},${Number(o.y)}`;
            if (o.type === 'spawn') spawns.add(key);
            else hazards.set(key, o);
        });

        const pts = diamondPoints();
        const spawnRing = diamondPoints(TILE_W * 0.55, TILE_H * 0.55);
        const out: React.ReactElement[] = [];

        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const key = `${x},${y}`;
                const s = gridToScreen(x, y);
                const isSpawn = spawns.has(key);

                let fill = "#0a0f0d";
                let stroke = "rgba(16,185,129,0.14)";

                if (canHighlight) {
                    // Verde: da para chegar de fato, ja descontando o contorno
                    // de paredes. Vermelho: dentro do alcance de ataque, que e
                    // Chebyshev puro — a linha de visao e checada no disparo.
                    if (reachable.has(key)) {
                        fill = "rgba(16,185,129,0.18)";
                        stroke = "rgba(16,185,129,0.45)";
                    } else if (activeToken) {
                        const dist = chebyshev(activeToken.x, activeToken.y, x, y);
                        if (dist > 0 && dist <= activeTokenMaxRange) {
                            fill = "rgba(239,68,68,0.13)";
                            stroke = "rgba(239,68,68,0.35)";
                        }
                    }
                }

                // Perigo e marcacao de chao, nao bloco: fica rente ao piso.
                const hazard = hazards.get(key);
                if (hazard) {
                    fill = tailwindToHex(hazard.color);
                    stroke = "#000";
                }

                // Ponto de entrada: cor fixa, ignora a cor escolhida no editor —
                // sua identidade importa mais que combinar com a paleta do mapa.
                if (isSpawn) {
                    fill = "rgba(16,185,129,0.12)";
                    stroke = "#10b981";
                }

                out.push(
                    <Line
                        key={`c${x}_${y}`}
                        points={pts}
                        x={s.x}
                        y={s.y}
                        closed
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={1}
                        opacity={hazard ? 0.6 : 1}
                        listening={false}
                        perfectDrawEnabled={false}
                    />
                );

                if (isSpawn) {
                    out.push(
                        <Line
                            key={`sp${x}_${y}`}
                            points={spawnRing}
                            x={s.x}
                            y={s.y}
                            closed
                            stroke="#34d399"
                            strokeWidth={1.5}
                            dash={[4, 3]}
                            listening={false}
                            perfectDrawEnabled={false}
                        />
                    );
                }
            }
        }
        return out;
    }, [gridSize, obstacles, activeToken, reachable, activeTokenMaxRange, canHighlight]);

    /**
     * Blocos e tokens saem na mesma lista, ordenados por profundidade: uma
     * parede a frente precisa cobrir quem esta atras dela, o que e impossivel
     * se as paredes forem todas desenhadas antes de todos os tokens.
     */
    const scenery = useMemo(() => {
        type Prop = { key: string; d: number; tie: number; node: React.ReactElement };
        const props: Prop[] = [];

        Object.values(obstacles || {}).forEach(o => {
            const h = obstacleHeight(o.type);
            if (h <= 0) return; // perigo ja foi desenhado no chao
            const x = Number(o.x);
            const y = Number(o.y);
            const s = gridToScreen(x, y);
            const c = tailwindToHex(o.color);
            const f = cubeFaces(h);

            props.push({
                key: `o${o.id}`,
                d: depth(x, y),
                tie: 0,
                node: (
                    <Group
                        key={`o${o.id}`}
                        x={s.x}
                        y={s.y}
                        name="obstacle"
                        // Clicar no bloco vale pela celula DELE. Sem isto o clique
                        // cairia onde o topo do cubo foi desenhado — uma casa atras —
                        // e a borracha apagaria a parede errada.
                        onClick={() => onCellClick(x, y)}
                        onTap={() => onCellClick(x, y)}
                    >
                        <Line points={f.left} closed fill={shade(c, 0.55)} stroke="#000" strokeWidth={1} perfectDrawEnabled={false} />
                        <Line points={f.right} closed fill={shade(c, 0.78)} stroke="#000" strokeWidth={1} perfectDrawEnabled={false} />
                        <Line points={f.top} closed fill={c} stroke="#000" strokeWidth={1} perfectDrawEnabled={false} />
                    </Group>
                ),
            });
        });

        Object.entries(tokens || {}).forEach(([id, token]) => {
            const npc = id.startsWith("npc_") ? npcs?.[id] : null;
            // Ameaca oculta some do grid do jogador; o Diretor continua vendo,
            // esmaecida, para lembrar que ela existe e esta escondida.
            if (npc?.hidden && !isWarden) return;

            props.push({
                key: id,
                d: depth(token.x, token.y),
                tie: 1, // token fica na frente de bloco na mesma casa
                node: renderToken(id, token),
            });
        });

        props.sort((a, b) => a.d - b.d || a.tie - b.tie);
        return props.map(p => p.node);
    }, [tokens, obstacles, npcs, players, currentTurnId, selectedTokenId, targetedTokenId, isWarden, onTokenClick, onCellClick]);

    function renderToken(id: string, token: GridToken) {
        {
                const s = gridToScreen(token.x, token.y);
                const isNpc = id.startsWith("npc_");
                const npc = isNpc ? npcs?.[id] : null;
                const isCorpse = isNpc && (npc?.isDead || (npc?.hp ?? 1) <= 0);
                // So chega aqui esmaecido quando e o Diretor olhando (o
                // jogador nunca ve este token — filtrado antes, no scenery).
                const isHiddenToWarden = isNpc && npc?.hidden && isWarden;
                const isTurn = currentTurnId === id;
                const isHighlighted = selectedTokenId === id || targetedTokenId === id;
                const hpPct = npc && npc.maxHp > 0 ? Math.max(0, npc.hp / npc.maxHp) : 1;

                const base = isCorpse
                    ? "#3f3f46"
                    : isNpc
                        ? tailwindToHex(npc?.color, "#ef4444")
                        : tailwindToHex(token.color, "#10b981");

                const label = isCorpse
                    ? "💀"
                    : isNpc
                        ? (npc?.icon || "👾")
                        : (players?.[id]?.name?.substring(0, 2).toUpperCase() || "??");

                const outline = isTurn ? "#fbbf24" : isHighlighted ? "#ffffff" : "rgba(0,0,0,0.7)";
                const outlineW = isTurn || isHighlighted ? 2.5 : 1;

                return (
                    <Group
                        key={id}
                        x={s.x}
                        y={s.y}
                        name="token"
                        onClick={() => onTokenClick(id)}
                        onTap={() => onTokenClick(id)}
                    >
                        {/* Base no chao, para o token nao parecer flutuando sobre o losango */}
                        <Line
                            points={diamondPoints(TILE_W * 0.7, TILE_H * 0.7)}
                            closed
                            fill={base}
                            opacity={isCorpse ? 0.45 : isHiddenToWarden ? 0.35 : 0.85}
                            stroke={outline}
                            strokeWidth={outlineW}
                            dash={isHiddenToWarden ? [3, 3] : undefined}
                            perfectDrawEnabled={false}
                        />
                        {/* Corpo: um pino vertical, na escala aproximada de uma pessoa no tile */}
                        <Circle
                            y={-TILE_H * 0.75}
                            radius={TILE_W * 0.22}
                            fill={base}
                            opacity={isCorpse ? 0.5 : isHiddenToWarden ? 0.4 : 1}
                            stroke={outline}
                            strokeWidth={outlineW}
                            dash={isHiddenToWarden ? [3, 3] : undefined}
                            perfectDrawEnabled={false}
                        />
                        <Text
                            y={-TILE_H * 0.75 - 8}
                            x={-TILE_W * 0.35}
                            width={TILE_W * 0.7}
                            align="center"
                            text={label}
                            fontSize={isNpc || isCorpse ? 15 : 11}
                            fontStyle="bold"
                            fill={isCorpse ? "#a1a1aa" : "#09090b"}
                            listening={false}
                        />

                        {isNpc && npc && !isCorpse && (
                            <>
                                <Rect x={-16} y={-TILE_H * 1.55} width={32} height={4} fill="#000" opacity={0.85} listening={false} />
                                <Rect
                                    x={-16}
                                    y={-TILE_H * 1.55}
                                    width={32 * hpPct}
                                    height={4}
                                    fill={hpPct > 0.5 ? "#34d399" : hpPct > 0.25 ? "#facc15" : "#f87171"}
                                    listening={false}
                                />
                            </>
                        )}

                        {!isNpc && (
                            <Text
                                y={TILE_H * 0.45}
                                x={-TILE_W * 0.35}
                                width={TILE_W * 0.7}
                                align="center"
                                text={`${token.movementPoints.current}/${token.movementPoints.max}`}
                                fontSize={9}
                                fill="#34d399"
                                listening={false}
                            />
                        )}
                    </Group>
                );
        }
    }

    return (
        <div ref={wrapperRef} className="w-full h-full relative bg-black touch-none">
            <Stage
                width={size.width || 1}
                height={size.height || 1}
                scaleX={scale}
                scaleY={scale}
                x={pos.x}
                y={pos.y}
                draggable
                onDragStart={() => { didDrag.current = true; userAdjusted.current = true; }}
                onDragEnd={(e) => setPos({ x: e.target.x(), y: e.target.y() })}
                onClick={handleStageClick}
                onTap={handleStageClick}
                onWheel={handleWheel}
                onTouchMove={handleTouchMove}
                onTouchEnd={endPinch}
            >
                <Layer>
                    <Group ref={groupRef} x={offset.x} y={offset.y}>
                        {cells}
                        {scenery}
                    </Group>
                </Layer>
            </Stage>

            <div className="absolute bottom-2 right-2 flex gap-1 z-10">
                <button
                    onClick={() => zoomAround({ x: size.width / 2, y: size.height / 2 }, 1.25)}
                    className="bg-zinc-950/90 border border-emerald-900 text-emerald-400 w-8 h-8 text-lg leading-none"
                >+</button>
                <button
                    onClick={() => zoomAround({ x: size.width / 2, y: size.height / 2 }, 0.8)}
                    className="bg-zinc-950/90 border border-emerald-900 text-emerald-400 w-8 h-8 text-lg leading-none"
                >−</button>
                <button
                    onClick={() => { userAdjusted.current = false; fitToScreen(); }}
                    className="bg-zinc-950/90 border border-emerald-900 text-emerald-400 px-2 h-8 text-[10px] uppercase tracking-widest"
                    title="Reenquadra e volta a acompanhar o tamanho da janela"
                >Centrar</button>
            </div>
        </div>
    );
}
