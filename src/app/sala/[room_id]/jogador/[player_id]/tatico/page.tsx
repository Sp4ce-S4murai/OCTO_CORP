import PlayerTacticalClient from "@/components/PlayerTacticalClient";

interface PageProps {
    params: Promise<{
        room_id: string;
        player_id: string;
    }>;
}

export default async function PlayerTacticalPage({ params }: PageProps) {
    const resolvedParams = await params;

    return (
        <div className="min-h-screen bg-zinc-950 text-emerald-500 font-mono flex flex-col">
            <PlayerTacticalClient roomId={resolvedParams.room_id} playerId={resolvedParams.player_id} />
        </div>
    );
}
