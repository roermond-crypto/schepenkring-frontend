import { ChatWidget } from "@/components/widget/ChatWidget";

export default async function WidgetPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
    const params = await searchParams;

    const harborId = params.harborId;
    const harborName = params.harborName;
    const locationIdParam = params.locationId;
    const accentColor = params.accentColor;
    const themePreset = (params.themePreset as "ocean" | "violet" | "sunset") || "ocean";

    const locationId = locationIdParam ? parseInt(locationIdParam, 10) : undefined;

    return (
        <main className="h-full w-full relative">
            <ChatWidget
                harborId={harborId}
                harborName={harborName}
                locationId={locationId}
                accentColor={accentColor}
                themePreset={themePreset}
                isEmbedded={true}
            />
        </main>
    );
}
