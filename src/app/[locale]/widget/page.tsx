import { ChatWidget } from "@/components/widget/ChatWidget";

export default async function WidgetPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
    const params = await searchParams;

    const harborId = params.harborId;
    const harborName = params.harborName;
    const locationId = params.locationId ? parseInt(params.locationId, 10) : undefined;
    const accentColor = params.accentColor;
    const themePreset = (params.themePreset as "ocean" | "violet" | "sunset") || "ocean";
    const welcomeText = params.welcomeText;
    const sourceUrl = params.sourceUrl;

    return (
        <main className="h-full w-full relative">
            <ChatWidget
                harborId={harborId}
                harborName={harborName}
                locationId={locationId}
                accentColor={accentColor}
                themePreset={themePreset}
                welcomeText={welcomeText}
                sourceUrl={sourceUrl}
                isEmbedded={true}
            />
        </main>
    );
}
