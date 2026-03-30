import PlayerSheetClient from "@/components/PlayerSheetClient";



interface PageProps {
    params: Promise<{
        room_id: string;
        player_id: string;
    }>;
}

export default async function PlayerPage({ params }: PageProps) {
    const resolvedParams = await params;

    return (
        <div className="min-h-screen bg-zinc-950 text-emerald-500 font-mono p-4 sm:p-6 lg:p-8">
            <PlayerSheetClient roomId={resolvedParams.room_id} playerId={resolvedParams.player_id} />
        </div>
    );

}
