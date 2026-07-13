import type { AppLocale } from "@/lib/i18n";

// Static, hand-authored field explanations for the Integration Center's
// (i) tooltips — same pattern and reasoning as platform-tooltips-i18n.ts:
// a handful of genuinely new technical concepts this build introduces,
// explained for a non-technical admin. No live AI call.

export interface IntegrationTooltip {
  explanation: string;
  example: string;
  commonMistakes: string;
  required: boolean;
}

export type IntegrationFieldKey =
  | "mappingPath"
  | "defaultValue"
  | "isDefaultConnection"
  | "feedSourceAssignment"
  | "regressionRun"
  | "confidenceScore";

type TooltipDictionary = Record<IntegrationFieldKey, Record<AppLocale, IntegrationTooltip>>;

const T: TooltipDictionary = {
  mappingPath: {
    nl: {
      explanation: "Het pad binnen de OpenMarine XML waar dit Schepenkring-veld naartoe wordt geschreven. Gebruikt puntnotatie voor geneste elementen; eindigt op [@naam] voor een XML-attribuut in plaats van een element.",
      example: "boat.dimensions.loa",
      commonMistakes: "Twee mappings met hetzelfde pad kunnen niet naast elkaar bestaan — het pad moet uniek zijn.",
      required: true,
    },
    en: {
      explanation: "The location inside the OpenMarine XML this Schepenkring field is written to. Uses dot notation for nested elements; ending in [@name] means an XML attribute instead of an element.",
      example: "boat.dimensions.loa",
      commonMistakes: "Two mappings can't share the same path — it must be unique.",
      required: true,
    },
    de: {
      explanation: "Der Ort innerhalb des OpenMarine-XML, an den dieses Schepenkring-Feld geschrieben wird. Verwendet Punktnotation für verschachtelte Elemente; endet auf [@name] für ein XML-Attribut statt eines Elements.",
      example: "boat.dimensions.loa",
      commonMistakes: "Zwei Mappings können sich nicht denselben Pfad teilen — er muss eindeutig sein.",
      required: true,
    },
    fr: {
      explanation: "L'emplacement dans le XML OpenMarine où ce champ Schepenkring est écrit. Utilise la notation par points pour les éléments imbriqués ; se terminant par [@nom] pour un attribut XML plutôt qu'un élément.",
      example: "boat.dimensions.loa",
      commonMistakes: "Deux mappings ne peuvent pas partager le même chemin — il doit être unique.",
      required: true,
    },
  },
  defaultValue: {
    nl: {
      explanation: "De waarde die wordt geëxporteerd wanneer het Schepenkring-veld leeg is, of een vaste constante wanneer er geen veld is gekoppeld (bijv. munteenheid = EUR).",
      example: "EUR",
      commonMistakes: "Laat dit leeg voor velden die écht ontbrekend moeten blijken in plaats van een verzonnen waarde te tonen.",
      required: false,
    },
    en: {
      explanation: "The value exported when the Schepenkring field is empty, or a fixed constant when no field is linked at all (e.g. currency = EUR).",
      example: "EUR",
      commonMistakes: "Leave this empty for fields that should genuinely show as missing rather than a made-up value.",
      required: false,
    },
    de: {
      explanation: "Der Wert, der exportiert wird, wenn das Schepenkring-Feld leer ist, oder eine feste Konstante, wenn gar kein Feld verknüpft ist (z. B. Währung = EUR).",
      example: "EUR",
      commonMistakes: "Lassen Sie dies für Felder leer, die tatsächlich als fehlend erscheinen sollen, statt eines erfundenen Werts.",
      required: false,
    },
    fr: {
      explanation: "La valeur exportée lorsque le champ Schepenkring est vide, ou une constante fixe lorsqu'aucun champ n'est lié du tout (ex. devise = EUR).",
      example: "EUR",
      commonMistakes: "Laissez ce champ vide pour les données qui doivent réellement apparaître comme manquantes plutôt qu'une valeur inventée.",
      required: false,
    },
  },
  isDefaultConnection: {
    nl: {
      explanation: "De connectie die standaard wordt voorgesteld wanneer er geen expliciet platform is gekozen, bijvoorbeeld bij een test-export. Er kan maar één standaardconnectie tegelijk zijn.",
      example: "OpenMarine hoofdfeed",
      commonMistakes: "Het wijzigen van de standaard heeft geen effect op reeds lopende exports, alleen op nieuwe acties zonder expliciete platformkeuze.",
      required: false,
    },
    en: {
      explanation: "The connection preselected when no platform is explicitly chosen, e.g. for a test export. Only one connection can be default at a time.",
      example: "OpenMarine main feed",
      commonMistakes: "Changing the default doesn't affect exports already in progress, only new actions without an explicit platform choice.",
      required: false,
    },
    de: {
      explanation: "Die Verbindung, die vorausgewählt wird, wenn keine Plattform explizit gewählt wurde, z. B. bei einem Test-Export. Es kann jeweils nur eine Standardverbindung geben.",
      example: "OpenMarine-Hauptfeed",
      commonMistakes: "Das Ändern des Standards wirkt sich nicht auf bereits laufende Exporte aus, sondern nur auf neue Aktionen ohne explizite Plattformwahl.",
      required: false,
    },
    fr: {
      explanation: "La connexion présélectionnée lorsqu'aucune plateforme n'est explicitement choisie, par exemple pour un export de test. Une seule connexion peut être par défaut à la fois.",
      example: "Flux principal OpenMarine",
      commonMistakes: "Changer la connexion par défaut n'affecte pas les exports déjà en cours, seulement les nouvelles actions sans choix explicite de plateforme.",
      required: false,
    },
  },
  feedSourceAssignment: {
    nl: {
      explanation: "Koppelt een marktplaats aan de connectie waarvan zij haar gegevens ontvangt. Dit is puur organisatorisch — het verandert niet welke gegevens worden verstuurd, maar helpt om te zien welke marktplaatsen bij welke feed horen.",
      example: "Boat24 → OpenMarine hoofdfeed",
      commonMistakes: "Een marktplaats zonder koppeling is niet 'kapot' — het betekent alleen dat zij als eigen, onafhankelijke connectie wordt behandeld.",
      required: false,
    },
    en: {
      explanation: "Links a marketplace to the connection it receives its data from. This is purely organizational — it doesn't change what data is sent, it just shows which marketplaces belong to which feed.",
      example: "Boat24 → OpenMarine main feed",
      commonMistakes: "A marketplace with no assignment isn't 'broken' — it just means it's treated as its own independent connection.",
      required: false,
    },
    de: {
      explanation: "Verknüpft einen Marktplatz mit der Verbindung, von der er seine Daten erhält. Dies ist rein organisatorisch — es ändert nicht, welche Daten gesendet werden, sondern zeigt nur, welche Marktplätze zu welchem Feed gehören.",
      example: "Boat24 → OpenMarine-Hauptfeed",
      commonMistakes: "Ein Marktplatz ohne Zuordnung ist nicht 'defekt' — es bedeutet nur, dass er als eigene, unabhängige Verbindung behandelt wird.",
      required: false,
    },
    fr: {
      explanation: "Relie une place de marché à la connexion dont elle reçoit ses données. C'est purement organisationnel — cela ne change pas les données envoyées, cela montre seulement quelles places de marché appartiennent à quel flux.",
      example: "Boat24 → Flux principal OpenMarine",
      commonMistakes: "Une place de marché sans association n'est pas 'cassée' — cela signifie seulement qu'elle est traitée comme sa propre connexion indépendante.",
      required: false,
    },
  },
  regressionRun: {
    nl: {
      explanation: "Controleert een steekproef van echte, exporteerbare boten opnieuw tegen de huidige mapping-configuratie, zodat je kunt zien of een mappingwijziging iets heeft gebroken vóórdat het een echte export beïnvloedt. Test-jachten tellen hier nooit in mee.",
      example: "248 van de 250 boten geslaagd",
      commonMistakes: "Een mislukte boot in een testrun betekent niet automatisch dat de laatste mappingwijziging de oorzaak is — bekijk de specifieke foutmelding per boot.",
      required: false,
    },
    en: {
      explanation: "Re-checks a sample of real, exportable yachts against the current mapping configuration, so you can see whether a mapping change broke anything before it affects a real export. Test yachts are never included.",
      example: "248 of 250 yachts passed",
      commonMistakes: "A failed yacht in a test run doesn't automatically mean the latest mapping change is the cause — check that yacht's specific error.",
      required: false,
    },
    de: {
      explanation: "Prüft eine Stichprobe echter, exportierbarer Yachten erneut gegen die aktuelle Mapping-Konfiguration, damit Sie sehen können, ob eine Mapping-Änderung etwas beschädigt hat, bevor sie einen echten Export beeinflusst. Test-Yachten werden nie einbezogen.",
      example: "248 von 250 Yachten bestanden",
      commonMistakes: "Eine fehlgeschlagene Yacht in einem Testlauf bedeutet nicht automatisch, dass die letzte Mapping-Änderung die Ursache ist — prüfen Sie den spezifischen Fehler dieser Yacht.",
      required: false,
    },
    fr: {
      explanation: "Revérifie un échantillon de bateaux réels et exportables par rapport à la configuration de mapping actuelle, afin de voir si une modification a cassé quelque chose avant qu'elle n'affecte un export réel. Les bateaux de test ne sont jamais inclus.",
      example: "248 bateaux sur 250 réussis",
      commonMistakes: "Un bateau échoué dans un test ne signifie pas automatiquement que la dernière modification de mapping en est la cause — vérifiez l'erreur spécifique de ce bateau.",
      required: false,
    },
  },
  confidenceScore: {
    nl: {
      explanation: "Een berekend percentage op basis van hoeveel het veld qua naam lijkt op al gekoppelde velden binnen dezelfde groep — geen live AI-aanroep, puur tekstuele overeenkomst.",
      example: "82% zekerheid",
      commonMistakes: "Een lage score betekent niet dat de suggestie fout is, alleen dat er weinig naamovereenkomst is gevonden — controleer het voorgestelde pad zelf.",
      required: false,
    },
    en: {
      explanation: "A computed percentage based on how similar the field's name is to already-mapped fields in the same group — no live AI call, purely textual similarity.",
      example: "82% confidence",
      commonMistakes: "A low score doesn't mean the suggestion is wrong, just that little name overlap was found — check the suggested path itself.",
      required: false,
    },
    de: {
      explanation: "Ein berechneter Prozentsatz, basierend darauf, wie ähnlich der Feldname bereits zugeordneten Feldern in derselben Gruppe ist — kein Live-KI-Aufruf, rein textuelle Ähnlichkeit.",
      example: "82 % Sicherheit",
      commonMistakes: "Ein niedriger Wert bedeutet nicht, dass der Vorschlag falsch ist, sondern nur, dass wenig Namensübereinstimmung gefunden wurde — prüfen Sie den vorgeschlagenen Pfad selbst.",
      required: false,
    },
    fr: {
      explanation: "Un pourcentage calculé selon la similarité du nom du champ avec les champs déjà mappés dans le même groupe — aucun appel IA en direct, uniquement une similarité textuelle.",
      example: "82 % de confiance",
      commonMistakes: "Un score faible ne signifie pas que la suggestion est erronée, seulement que peu de similarité de nom a été trouvée — vérifiez le chemin suggéré lui-même.",
      required: false,
    },
  },
};

export function getIntegrationTooltip(field: IntegrationFieldKey, locale: AppLocale): IntegrationTooltip {
  return T[field][locale];
}
