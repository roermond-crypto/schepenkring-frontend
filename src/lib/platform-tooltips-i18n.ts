import type { AppLocale } from "@/lib/i18n";

// Static, hand-authored field explanations for the Platform Configuration
// editor's (i) tooltips. Standalone module rather than the JSON locale
// dictionaries — same reasoning as audit-i18n.ts: this is high-volume
// structured content (per field: explanation/example/mistakes/required/doc),
// not a handful of template strings.

export interface PlatformFieldTooltip {
  explanation: string;
  example: string;
  commonMistakes: string;
  required: boolean;
  docLink?: string;
}

export type PlatformFieldKey =
  | "name"
  | "slug"
  | "logo"
  | "website_url"
  | "category"
  | "priority"
  | "is_active"
  | "supported_countries"
  | "supported_languages"
  | "export_method"
  | "feed_url"
  | "contact_name"
  | "contact_email"
  | "notes";

type TooltipDictionary = Record<PlatformFieldKey, Record<AppLocale, PlatformFieldTooltip>>;

const T: TooltipDictionary = {
  name: {
    nl: {
      explanation: "De naam van het platform zoals die intern en in rapportages wordt getoond.",
      example: "Boat24",
      commonMistakes: "Gebruik de officiële naam van het platform, geen afkorting die alleen intern bekend is.",
      required: true,
    },
    en: {
      explanation: "The platform's name, shown internally and in reports.",
      example: "Boat24",
      commonMistakes: "Use the platform's official name, not an internal-only abbreviation.",
      required: true,
    },
    de: {
      explanation: "Der Name der Plattform, wie er intern und in Berichten angezeigt wird.",
      example: "Boat24",
      commonMistakes: "Verwenden Sie den offiziellen Namen der Plattform, keine nur intern bekannte Abkürzung.",
      required: true,
    },
    fr: {
      explanation: "Le nom de la plateforme, affiché en interne et dans les rapports.",
      example: "Boat24",
      commonMistakes: "Utilisez le nom officiel de la plateforme, pas une abréviation connue uniquement en interne.",
      required: true,
    },
  },
  slug: {
    nl: {
      explanation: "Een unieke, technische identifier voor dit platform (kleine letters, koppeltekens). Wordt gebruikt in links en systeemreferenties en kan niet dubbel voorkomen.",
      example: "boat24",
      commonMistakes: "Wijzig de slug niet meer nadat het platform gekoppeld is aan exports — bestaande koppelingen kunnen dan breken.",
      required: true,
    },
    en: {
      explanation: "A unique, technical identifier for this platform (lowercase, hyphens). Used in links and system references — must be unique.",
      example: "boat24",
      commonMistakes: "Avoid changing the slug once the platform is linked to live exports — existing links can break.",
      required: true,
    },
    de: {
      explanation: "Eine eindeutige, technische Kennung für diese Plattform (Kleinbuchstaben, Bindestriche). Wird in Links und Systemverweisen verwendet und darf nicht doppelt vorkommen.",
      example: "boat24",
      commonMistakes: "Ändern Sie den Slug nicht mehr, nachdem die Plattform mit Exporten verknüpft wurde — bestehende Verknüpfungen könnten sonst brechen.",
      required: true,
    },
    fr: {
      explanation: "Un identifiant technique unique pour cette plateforme (minuscules, tirets). Utilisé dans les liens et références système — doit être unique.",
      example: "boat24",
      commonMistakes: "Évitez de modifier le slug une fois la plateforme liée à des exports actifs — les liens existants peuvent se casser.",
      required: true,
    },
  },
  logo: {
    nl: {
      explanation: "Het logo van het platform, getoond in overzichten en op de publieke site waar dit platform genoemd wordt.",
      example: "Een PNG of SVG met transparante achtergrond, minimaal 200×200px.",
      commonMistakes: "Upload geen logo met een witte achtergrond — dit oogt slecht op een donkere kaart.",
      required: false,
    },
    en: {
      explanation: "The platform's logo, shown in overviews and on the public site wherever this platform is referenced.",
      example: "A PNG or SVG with a transparent background, at least 200×200px.",
      commonMistakes: "Avoid uploading a logo with a solid white background — it looks wrong on a dark card.",
      required: false,
    },
    de: {
      explanation: "Das Logo der Plattform, angezeigt in Übersichten und auf der öffentlichen Website, wo diese Plattform erwähnt wird.",
      example: "Ein PNG oder SVG mit transparentem Hintergrund, mindestens 200×200px.",
      commonMistakes: "Laden Sie kein Logo mit weißem Hintergrund hoch — das sieht auf einer dunklen Karte schlecht aus.",
      required: false,
    },
    fr: {
      explanation: "Le logo de la plateforme, affiché dans les aperçus et sur le site public partout où cette plateforme est mentionnée.",
      example: "Un PNG ou SVG à fond transparent, au moins 200×200px.",
      commonMistakes: "Évitez un logo à fond blanc uni — cela rend mal sur une carte au fond sombre.",
      required: false,
    },
  },
  website_url: {
    nl: {
      explanation: "De publieke website van het platform. Wordt getoond als externe link in overzichten.",
      example: "https://www.boat24.com",
      commonMistakes: "Vergeet niet https:// voor de URL te zetten.",
      required: false,
    },
    en: {
      explanation: "The platform's public website. Shown as an external link in overviews.",
      example: "https://www.boat24.com",
      commonMistakes: "Don't forget the https:// prefix.",
      required: false,
    },
    de: {
      explanation: "Die öffentliche Website der Plattform. Wird als externer Link in Übersichten angezeigt.",
      example: "https://www.boat24.com",
      commonMistakes: "Vergessen Sie nicht das https:// vor der URL.",
      required: false,
    },
    fr: {
      explanation: "Le site web public de la plateforme. Affiché comme lien externe dans les aperçus.",
      example: "https://www.boat24.com",
      commonMistakes: "N'oubliez pas le préfixe https://.",
      required: false,
    },
  },
  category: {
    nl: {
      explanation: "De rol van dit platform: een marktplaats waar boten publiek getoond worden, een brancheportaal, een samenwerkingspartner, of een eigen website.",
      example: "Marktplaats",
      commonMistakes: "Kies 'Partner' voor systemen die data synchroniseren (zoals YachtShift) — niet 'Marktplaats', ook al lijkt dat de standaardkeuze.",
      required: true,
    },
    en: {
      explanation: "This platform's role: a marketplace where boats are shown publicly, an industry portal, a sync partner, or your own website.",
      example: "Marketplace",
      commonMistakes: "Choose 'Partner' for systems that sync data (like YachtShift) — not 'Marketplace', even though that looks like the default choice.",
      required: true,
    },
    de: {
      explanation: "Die Rolle dieser Plattform: ein Marktplatz, auf dem Boote öffentlich angezeigt werden, ein Branchenportal, ein Sync-Partner oder eine eigene Website.",
      example: "Marktplatz",
      commonMistakes: "Wählen Sie 'Partner' für Systeme, die Daten synchronisieren (wie YachtShift) — nicht 'Marktplatz', auch wenn das wie die Standardwahl wirkt.",
      required: true,
    },
    fr: {
      explanation: "Le rôle de cette plateforme : une place de marché où les bateaux sont affichés publiquement, un portail sectoriel, un partenaire de synchronisation, ou votre propre site.",
      example: "Place de marché",
      commonMistakes: "Choisissez 'Partenaire' pour les systèmes qui synchronisent des données (comme YachtShift) — pas 'Place de marché', même si cela semble être le choix par défaut.",
      required: true,
    },
  },
  priority: {
    nl: {
      explanation: "Bepaalt de volgorde waarin platforms getoond worden. Een lager getal betekent hogere prioriteit (bovenaan).",
      example: "1 (hoogste prioriteit)",
      commonMistakes: "Gebruik geen dubbele prioriteitswaarden als de volgorde ertoe doet — bij gelijke waarde wordt op naam gesorteerd.",
      required: false,
    },
    en: {
      explanation: "Controls the display order of platforms. A lower number means higher priority (shown first).",
      example: "1 (highest priority)",
      commonMistakes: "Avoid duplicate priority values if ordering matters — ties are broken alphabetically by name.",
      required: false,
    },
    de: {
      explanation: "Bestimmt die Anzeigereihenfolge der Plattformen. Eine niedrigere Zahl bedeutet höhere Priorität (wird zuerst angezeigt).",
      example: "1 (höchste Priorität)",
      commonMistakes: "Vermeiden Sie doppelte Prioritätswerte, wenn die Reihenfolge wichtig ist — bei Gleichstand wird alphabetisch nach Namen sortiert.",
      required: false,
    },
    fr: {
      explanation: "Détermine l'ordre d'affichage des plateformes. Un nombre plus petit signifie une priorité plus élevée (affiché en premier).",
      example: "1 (priorité la plus élevée)",
      commonMistakes: "Évitez les valeurs de priorité en double si l'ordre compte — en cas d'égalité, le tri se fait par nom.",
      required: false,
    },
  },
  is_active: {
    nl: {
      explanation: "Alleen actieve platforms worden meegenomen in exports en synchronisatie. Zet een platform op inactief om het tijdelijk te pauzeren zonder de configuratie te verliezen.",
      example: "Actief",
      commonMistakes: "Vergeet niet dat een inactief platform ook uit lopende exports verdwijnt, niet alleen uit nieuwe.",
      required: true,
    },
    en: {
      explanation: "Only active platforms are included in exports and syncing. Set a platform to inactive to pause it temporarily without losing its configuration.",
      example: "Active",
      commonMistakes: "Remember that an inactive platform also drops out of in-progress exports, not just future ones.",
      required: true,
    },
    de: {
      explanation: "Nur aktive Plattformen werden in Exporten und Synchronisationen berücksichtigt. Setzen Sie eine Plattform auf inaktiv, um sie vorübergehend zu pausieren, ohne die Konfiguration zu verlieren.",
      example: "Aktiv",
      commonMistakes: "Beachten Sie, dass eine inaktive Plattform auch aus laufenden Exporten verschwindet, nicht nur aus zukünftigen.",
      required: true,
    },
    fr: {
      explanation: "Seules les plateformes actives sont incluses dans les exports et la synchronisation. Désactivez une plateforme pour la mettre en pause temporairement sans perdre sa configuration.",
      example: "Actif",
      commonMistakes: "N'oubliez pas qu'une plateforme inactive disparaît aussi des exports en cours, pas seulement des futurs.",
      required: true,
    },
  },
  supported_countries: {
    nl: {
      explanation: "De landen waar dit platform boten publiceert of actief is. Wordt gebruikt om te bepalen welke boten in aanmerking komen voor export naar dit platform.",
      example: "Nederland, België, Duitsland",
      commonMistakes: "Vergeet niet ook de landen toe te voegen waar het platform van herkomst is, niet alleen de doellanden.",
      required: false,
    },
    en: {
      explanation: "The countries where this platform publishes boats or is active. Used to determine which boats are eligible for export to this platform.",
      example: "Netherlands, Belgium, Germany",
      commonMistakes: "Don't forget to include the platform's home country, not just its target markets.",
      required: false,
    },
    de: {
      explanation: "Die Länder, in denen diese Plattform Boote veröffentlicht oder aktiv ist. Wird verwendet, um zu bestimmen, welche Boote für den Export zu dieser Plattform infrage kommen.",
      example: "Niederlande, Belgien, Deutschland",
      commonMistakes: "Vergessen Sie nicht, auch das Heimatland der Plattform hinzuzufügen, nicht nur die Zielmärkte.",
      required: false,
    },
    fr: {
      explanation: "Les pays où cette plateforme publie des bateaux ou est active. Utilisé pour déterminer quels bateaux sont éligibles à l'export vers cette plateforme.",
      example: "Pays-Bas, Belgique, Allemagne",
      commonMistakes: "N'oubliez pas d'inclure le pays d'origine de la plateforme, pas seulement ses marchés cibles.",
      required: false,
    },
  },
  supported_languages: {
    nl: {
      explanation: "De talen waarin dit platform boot-advertenties accepteert. Bepaalt welke taalversie van de boottekst wordt geëxporteerd.",
      example: "Nederlands, Engels, Duits",
      commonMistakes: "Als een taal ontbreekt, valt de export terug op de standaardtaal — controleer of dat de bedoeling is.",
      required: false,
    },
    en: {
      explanation: "The languages this platform accepts boat listings in. Determines which language version of the boat text gets exported.",
      example: "Dutch, English, German",
      commonMistakes: "If a language is missing, the export falls back to the default language — check that's really intended.",
      required: false,
    },
    de: {
      explanation: "Die Sprachen, in denen diese Plattform Bootsanzeigen akzeptiert. Bestimmt, welche Sprachversion des Boottexts exportiert wird.",
      example: "Niederländisch, Englisch, Deutsch",
      commonMistakes: "Fehlt eine Sprache, fällt der Export auf die Standardsprache zurück — prüfen Sie, ob das wirklich beabsichtigt ist.",
      required: false,
    },
    fr: {
      explanation: "Les langues dans lesquelles cette plateforme accepte les annonces de bateaux. Détermine quelle version linguistique du texte du bateau est exportée.",
      example: "Néerlandais, Anglais, Allemand",
      commonMistakes: "Si une langue manque, l'export utilise la langue par défaut — vérifiez que c'est bien voulu.",
      required: false,
    },
  },
  export_method: {
    nl: {
      explanation: "Hoe boten naar dit platform verstuurd worden: via een OpenMarine-feed, een eigen XML-feed, een directe API-koppeling, of volledig handmatig.",
      example: "OpenMarine 2.0",
      commonMistakes: "Kies 'API' alleen als het platform daadwerkelijk een API-koppeling met ons ondersteunt — controleer dit bij het platform zelf.",
      required: true,
    },
    en: {
      explanation: "How boats are sent to this platform: via an OpenMarine feed, a custom XML feed, a direct API connection, or fully manual.",
      example: "OpenMarine 2.0",
      commonMistakes: "Only choose 'API' if the platform actually supports a direct API connection with us — confirm this with the platform first.",
      required: true,
    },
    de: {
      explanation: "Wie Boote an diese Plattform gesendet werden: über einen OpenMarine-Feed, einen eigenen XML-Feed, eine direkte API-Anbindung oder vollständig manuell.",
      example: "OpenMarine 2.0",
      commonMistakes: "Wählen Sie 'API' nur, wenn die Plattform tatsächlich eine direkte API-Anbindung mit uns unterstützt — bestätigen Sie dies zuerst bei der Plattform.",
      required: true,
    },
    fr: {
      explanation: "Comment les bateaux sont envoyés vers cette plateforme : via un flux OpenMarine, un flux XML personnalisé, une connexion API directe, ou entièrement manuel.",
      example: "OpenMarine 2.0",
      commonMistakes: "Ne choisissez 'API' que si la plateforme prend réellement en charge une connexion API directe avec nous — confirmez-le d'abord auprès de la plateforme.",
      required: true,
    },
  },
  feed_url: {
    nl: {
      explanation: "De URL waarop het platform onze feed ophaalt. Alleen relevant bij OpenMarine of XML-feed als exportmethode.",
      example: "https://feed.boat24.com/schepenkring/2.0",
      commonMistakes: "Deze URL wordt door ons aangeboden aan het platform, niet andersom — vul geen URL van het platform zelf in.",
      required: false,
    },
    en: {
      explanation: "The URL where the platform fetches our feed from. Only relevant when the export method is OpenMarine or XML feed.",
      example: "https://feed.boat24.com/schepenkring/2.0",
      commonMistakes: "This URL is served by us to the platform, not the other way around — don't enter the platform's own URL here.",
      required: false,
    },
    de: {
      explanation: "Die URL, unter der die Plattform unseren Feed abruft. Nur relevant bei OpenMarine oder XML-Feed als Exportmethode.",
      example: "https://feed.boat24.com/schepenkring/2.0",
      commonMistakes: "Diese URL wird von uns für die Plattform bereitgestellt, nicht umgekehrt — tragen Sie hier nicht die eigene URL der Plattform ein.",
      required: false,
    },
    fr: {
      explanation: "L'URL à laquelle la plateforme récupère notre flux. Pertinent uniquement si la méthode d'export est OpenMarine ou flux XML.",
      example: "https://feed.boat24.com/schepenkring/2.0",
      commonMistakes: "Cette URL est fournie par nous à la plateforme, pas l'inverse — n'y indiquez pas l'URL propre de la plateforme.",
      required: false,
    },
  },
  contact_name: {
    nl: {
      explanation: "De contactpersoon bij het platform voor technische of zakelijke vragen.",
      example: "Jan de Vries",
      commonMistakes: "Vul bij voorkeur een persoon in, geen algemeen team-e-mailadres — dat hoort bij het veld hieronder.",
      required: false,
    },
    en: {
      explanation: "The contact person at the platform for technical or business questions.",
      example: "Jan de Vries",
      commonMistakes: "Prefer a named person here, not a generic team inbox — that belongs in the field below.",
      required: false,
    },
    de: {
      explanation: "Der Ansprechpartner bei der Plattform für technische oder geschäftliche Fragen.",
      example: "Jan de Vries",
      commonMistakes: "Tragen Sie hier bevorzugt eine Person ein, kein allgemeines Team-Postfach — das gehört in das Feld darunter.",
      required: false,
    },
    fr: {
      explanation: "La personne de contact chez la plateforme pour les questions techniques ou commerciales.",
      example: "Jan de Vries",
      commonMistakes: "Préférez le nom d'une personne, pas une boîte mail d'équipe générique — cela va dans le champ ci-dessous.",
      required: false,
    },
  },
  contact_email: {
    nl: {
      explanation: "E-mailadres van de contactpersoon of het supportteam bij het platform.",
      example: "support@boat24.com",
      commonMistakes: "Controleer of het adres nog actief is — verouderde contactgegevens vertragen support bij storingen.",
      required: false,
    },
    en: {
      explanation: "Email address of the contact person or support team at the platform.",
      example: "support@boat24.com",
      commonMistakes: "Confirm the address is still active — stale contact details slow down support during outages.",
      required: false,
    },
    de: {
      explanation: "E-Mail-Adresse des Ansprechpartners oder des Support-Teams bei der Plattform.",
      example: "support@boat24.com",
      commonMistakes: "Prüfen Sie, ob die Adresse noch aktiv ist — veraltete Kontaktdaten verzögern den Support bei Störungen.",
      required: false,
    },
    fr: {
      explanation: "Adresse e-mail de la personne de contact ou de l'équipe support chez la plateforme.",
      example: "support@boat24.com",
      commonMistakes: "Vérifiez que l'adresse est toujours active — des coordonnées obsolètes ralentissent le support en cas d'incident.",
      required: false,
    },
  },
  notes: {
    nl: {
      explanation: "Interne notities over dit platform: bijzonderheden, afspraken, of instructies voor collega's.",
      example: "Contract loopt tot december 2026, verlenging via account manager.",
      commonMistakes: "Zet hier geen wachtwoorden of API-sleutels — gebruik daarvoor de velden op het Geavanceerd-tabblad.",
      required: false,
    },
    en: {
      explanation: "Internal notes about this platform: quirks, agreements, or instructions for colleagues.",
      example: "Contract runs until December 2026, renewal via account manager.",
      commonMistakes: "Don't put passwords or API keys here — use the fields on the Advanced tab for those.",
      required: false,
    },
    de: {
      explanation: "Interne Notizen zu dieser Plattform: Besonderheiten, Vereinbarungen oder Anweisungen für Kollegen.",
      example: "Vertrag läuft bis Dezember 2026, Verlängerung über den Account Manager.",
      commonMistakes: "Tragen Sie hier keine Passwörter oder API-Schlüssel ein — nutzen Sie dafür die Felder im Tab 'Erweitert'.",
      required: false,
    },
    fr: {
      explanation: "Notes internes sur cette plateforme : particularités, accords, ou instructions pour les collègues.",
      example: "Contrat valable jusqu'en décembre 2026, renouvellement via le gestionnaire de compte.",
      commonMistakes: "N'y mettez pas de mots de passe ni de clés API — utilisez les champs de l'onglet Avancé pour cela.",
      required: false,
    },
  },
};

export function getPlatformFieldTooltip(field: PlatformFieldKey, locale: AppLocale): PlatformFieldTooltip {
  return T[field][locale] ?? T[field].en;
}
