import CombatHUD from "@/components/TacticalMap/CombatHUD";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageProps {
    params: Promise<{
        room_id: string;
    }>;
}

export default async function DirectorTacticalPage({ params }: PageProps) {
    const resolvedParams = await params;

    return (
        <div className="min-h-screen bg-zinc-950 text-emerald-500 font-mono flex flex-col">
            <header className="bg-zinc-950/80 border-b border-emerald-900/50 p-4 flex items-center justify-between z-10 shrink-0 relative">
                <Link href={`/sala/${resolvedParams.room_id}/diretor`} className="flex items-center gap-2 text-emerald-600 hover:text-emerald-400 font-bold uppercase tracking-widest transition-colors">
                    <ArrowLeft size={18} /> Voltar ao Painel
                </Link>
                <div className="text-xl font-bold uppercase tracking-widest text-emerald-400">
                    SISTEMA TÁTICO MESTRE // {resolvedParams.room_id}
                </div>
                <div className="w-[150px]"></div>
            </header>
            <main className="flex-1 relative bg-black">
                <CombatHUD roomId={resolvedParams.room_id} isWarden={true} />
            </main>
        </div>
    );
}
