import { ChatWidget } from "@/components/widget/ChatWidget";
import { LeadCaptureWidget } from "@/components/widget/LeadCaptureWidget";

export default async function WidgetPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
    const { locale } = await params;
    const query = await searchParams;

    const boatId = query.boatId ? parseInt(query.boatId, 10) : undefined;
    const locationId = query.locationId ? parseInt(query.locationId, 10) : undefined;
    const widgetMode = query.widgetMode ?? (boatId ? "smart" : "chat");
    const accentColor = query.accentColor;
    const themePreset = (query.themePreset as "ocean" | "violet" | "sunset") || "ocean";
    const welcomeText = query.welcomeText;
    const sourceUrl = query.sourceUrl;

    // Lead capture widget for Schepenkring
    if (widgetMode === "lead") {
        return (
            <main className="h-full w-full relative">
                <LeadCaptureWidget
                    boatId={boatId}
                    locationId={locationId}
                    sourceUrl={sourceUrl}
                    isEmbedded={true}
                    locale={locale}
                />
            </main>
        );
    }

    return (
        <main className="h-full w-full relative">
            <ChatWidget
                boatId={boatId}
                locationId={locationId}
                accentColor={accentColor}
                themePreset={themePreset}
                welcomeText={welcomeText}
                sourceUrl={sourceUrl}
                isEmbedded={true}
                locale={locale}
                widgetMode={widgetMode as "chat" | "smart" | "auction"}
            />
        </main>
    );
}
