import WardenClient from "@/components/WardenClient";

interface PageProps {
    params: Promise<{
        room_id: string;
    }>;
}

export default async function WardenPage({ params }: PageProps) {
    const resolvedParams = await params;

    return (
        <div className="min-h-screen bg-zinc-950 text-emerald-500 font-mono p-4 sm:p-6 lg:p-8">
            <WardenClient roomId={resolvedParams.room_id} />
        </div>
    );
}
