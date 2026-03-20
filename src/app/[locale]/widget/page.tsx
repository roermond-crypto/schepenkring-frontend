import { ChatWidget } from "@/components/widget/ChatWidget";

export default async function WidgetPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
    const { locale } = await params;
    const query = await searchParams;

    const harborId = query.harborId;
    const harborName = query.harborName;
    const boatId = query.boatId ? parseInt(query.boatId, 10) : undefined;
    const locationId = query.locationId ? parseInt(query.locationId, 10) : undefined;
    const widgetMode = (query.widgetMode as "chat" | "smart" | "auction") || (boatId ? "smart" : "chat");
    const accentColor = query.accentColor;
    const themePreset = (query.themePreset as "ocean" | "violet" | "sunset") || "ocean";
    const welcomeText = query.welcomeText;
    const sourceUrl = query.sourceUrl;

    return (
        <main className="h-full w-full relative">
            <ChatWidget
                harborId={harborId}
                harborName={harborName}
                boatId={boatId}
                locationId={locationId}
                accentColor={accentColor}
                themePreset={themePreset}
                welcomeText={welcomeText}
                sourceUrl={sourceUrl}
                isEmbedded={true}
                locale={locale}
                widgetMode={widgetMode}
            />
        </main>
    );
}
