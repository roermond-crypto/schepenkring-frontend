import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type AppLocale = "nl" | "en" | "de" | "fr";
type FormLanguage = "nl" | "en" | "de";

type PageProps = {
  params: Promise<{
    locale: AppLocale;
    formLanguage: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type PartyKey = "seller" | "buyer";

type TemplateCopy = {
  title: string;
  memberLabel: string;
  contactLabel: string;
  memberEmailLabel: string;
  partyOrder: PartyKey[];
  partyLabels: Record<PartyKey, string>;
  nameLabel: string;
  addressLabel: string;
  postalCityLabel: string;
  phoneLabel: string;
  emailLabel: string;
  introLines: string[];
  agreementNumberLabel: string;
  agreementDateLabel?: string;
  deliveryLabel: string;
  totalAmountLabel: string;
  transferIntro: string;
  ibanLine: string;
  payoutIntro: string;
  payoutPayee: string;
  payoutIban: string;
  payoutAmount: string;
  serviceCostsLabel: string;
  draftedLabel: string;
  draftedInLabel: string;
  signatureBuyer: string;
  signatureMember: string;
  signatureLabel: string;
};

const templateByLanguage: Record<FormLanguage, TemplateCopy> = {
  nl: {
    title: "Formulier Derdengelden",
    memberLabel: "HISWA-RECRON-lid",
    contactLabel: "Contactpersoon",
    memberEmailLabel: "Emailadres",
    partyOrder: ["seller", "buyer"],
    partyLabels: {
      seller: "Verkoper",
      buyer: "Koper",
    },
    nameLabel: "(Bedrijf/persoons) naam",
    addressLabel: "Adres",
    postalCityLabel: "Postcode/Woonplaats",
    phoneLabel: "Telefoonnummer",
    emailLabel: "Emailadres",
    introLines: [
      "Koper maakt gebruik van de derdengeldrekening service van HISWA-RECRON (Stichting Beheer Derdengelden HISWA-RECRON) voor de (aan)betaling op basis van de getekende overeenkomst met",
    ],
    agreementNumberLabel: "nr",
    deliveryLabel: "in verband met de levering van",
    totalAmountLabel: "voor een totaalbedrag van",
    transferIntro:
      "welk bedrag de koper zal overmaken naar de bankrekening van de Stichting Beheer Derdengelden HISWA-RECRON:",
    ibanLine: "IBAN: NL24 ABNA 0574 8964 30 en BIC: ABNANL2A",
    payoutIntro:
      "HISWA-RECRON zal na ontvangst van de ‘Akte van levering’ of …. het hierna te noemen bedrag of bedragen overmaken aan de volgende partij(en):",
    payoutPayee: "Aan",
    payoutIban: "IBAN",
    payoutAmount: "Bedrag",
    serviceCostsLabel:
      "De kosten voor deze HISWA-RECRON service worden gedragen door",
    draftedLabel: "Opgemaakt op",
    draftedInLabel: "te",
    signatureBuyer: "Koper",
    signatureMember: "HISWA-RECRON lid",
    signatureLabel: "Handtekening",
  },
  en: {
    title: "Escrow account service form",
    memberLabel: "HISWA-RECRON member",
    contactLabel: "Contact",
    memberEmailLabel: "Email address",
    partyOrder: ["buyer", "seller"],
    partyLabels: {
      seller: "Seller",
      buyer: "Buyer",
    },
    nameLabel: "Name of company or individual",
    addressLabel: "Street address",
    postalCityLabel: "Postal code/City",
    phoneLabel: "Telephone number",
    emailLabel: "Email address",
    introLines: [
      "hereby request HISWA-RECRON to use the service of the escrow of HISWA RECRON in the payment based on the agreement",
    ],
    agreementNumberLabel: "nr",
    deliveryLabel: "in connection with the delivery of",
    totalAmountLabel: "for a total amount of",
    transferIntro:
      "which amount Buyer will credit in to the bank account of Stichting Beheer Derdengelden HISWA-RECRON",
    ibanLine: "IBAN: NL24 ABNA 0574 8964 30 and BIC: ABNANL2A",
    payoutIntro:
      "Following, after receiving the ‘Deed of transfer’ / …. , HISWA-RECRON will credit the amount or amounts referred below in the name of the individuals/companies:",
    payoutPayee: "Name",
    payoutIban: "IBAN",
    payoutAmount: "Amount",
    serviceCostsLabel: "The costs for the service of HISWA-RECRON will be paid by",
    draftedLabel: "Drawn up on",
    draftedInLabel: "in",
    signatureBuyer: "Buyer",
    signatureMember: "HISWA-RECRON member",
    signatureLabel: "Signature",
  },
  de: {
    title: "Auftragsformular",
    memberLabel: "HISWA-RECRON-Mitglied",
    contactLabel: "Name des Unternehmens",
    memberEmailLabel: "E-Mail-Adresse",
    partyOrder: ["buyer", "seller"],
    partyLabels: {
      seller: "Verkäufer",
      buyer: "Käufer",
    },
    nameLabel: "Name (des Unternehmens/der Person)",
    addressLabel: "Adresse",
    postalCityLabel: "PLZ/Wohnort",
    phoneLabel: "Telefon",
    emailLabel: "E-Mail-Adresse",
    introLines: [
      "Käufer ersucht um Vermittlung durch die Treuhandkonto Service des HISWA-RECRON (St. Beheer Derdengelden HISWA-RECRON) für die Zahlung aufgrund des unterzeichneten Vertrags mit",
    ],
    agreementNumberLabel: "Nr.",
    agreementDateLabel: "Datum",
    deliveryLabel: "im Zusammenhang mit der Übergabe von",
    totalAmountLabel: "für einen Gesamtbetrag von",
    transferIntro:
      "den der Käufer auf das Bankkonto der Stichting Beheer Derdengelden HISWA-RECRON überweisen wird:",
    ibanLine: "IBAN: NL24 ABNA 0574 8964 30 und BIC: ABNANL2A",
    payoutIntro:
      "HISWA-RECRON wird nach Erhalt des Liefervertrag / … die unten genannten Beträge(n) überweisen an die folgende(n) Partei(en):",
    payoutPayee: "Empfänger",
    payoutIban: "IBAN",
    payoutAmount: "Betrag",
    serviceCostsLabel: "Die Kosten für diesen HISWA-RECRON Service trägt",
    draftedLabel: "Erstellt am",
    draftedInLabel: "in",
    signatureBuyer: "Käufer",
    signatureMember: "HISWA-RECRON Mitglied",
    signatureLabel: "Unterschrift",
  },
};

function pick(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function fill(value: string) {
  return value.trim() || "………………………………";
}

function amount(value: string) {
  const trimmed = value.trim();
  return trimmed ? `€ ${trimmed}` : "€ ……………………";
}

function partyValues(
  searchParams: Record<string, string | string[] | undefined>,
  party: PartyKey,
) {
  return {
    name: pick(searchParams, `${party}Name`),
    address: pick(searchParams, `${party}Address`),
    postalCity: pick(searchParams, `${party}PostalCity`),
    phone: pick(searchParams, `${party}Phone`),
    email: pick(searchParams, `${party}Email`),
  };
}

export default async function EscrowContractLanguagePage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const formLanguage = resolvedParams.formLanguage as FormLanguage;

  if (!["nl", "en", "de"].includes(formLanguage)) {
    notFound();
  }

  const copy = templateByLanguage[formLanguage];
  const memberName = pick(resolvedSearchParams, "memberName");
  const contactName = pick(resolvedSearchParams, "contactName");
  const memberEmail = pick(resolvedSearchParams, "memberEmail");
  const agreementNumber = pick(resolvedSearchParams, "agreementNumber");
  const agreementDate = pick(resolvedSearchParams, "agreementDate");
  const deliveryDescription = pick(resolvedSearchParams, "deliveryDescription");
  const totalAmount = pick(resolvedSearchParams, "totalAmount");
  const paidBy = pick(resolvedSearchParams, "paidBy");
  const drawnUpDate = pick(resolvedSearchParams, "drawnUpDate");
  const drawnUpCity = pick(resolvedSearchParams, "drawnUpCity");
  const payouts = [1, 2, 3].map((index) => ({
    payee: pick(resolvedSearchParams, `payee${index}`),
    iban: pick(resolvedSearchParams, `iban${index}`),
    amount: pick(resolvedSearchParams, `amount${index}`),
  }));

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-[920px] px-6 py-10 print:px-8 print:py-8">
        <div className="space-y-10 text-[15px] leading-relaxed">
          <section className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight">
                {copy.title}
              </h1>
              <p className="text-lg">{copy.memberLabel}</p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-2">
                <p className="font-medium">{copy.contactLabel}</p>
                <div className="min-h-10 border-b border-black/70 pb-1">
                  {fill(contactName || memberName)}
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-medium">{copy.memberEmailLabel}</p>
                <div className="min-h-10 border-b border-black/70 pb-1">
                  {fill(memberEmail)}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-10 md:grid-cols-2">
            {copy.partyOrder.map((party) => {
              const values = partyValues(resolvedSearchParams, party);
              return (
                <div key={party} className="space-y-3">
                  <h2 className="text-xl font-semibold">
                    {copy.partyLabels[party]}
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm">{copy.nameLabel}</p>
                      <div className="min-h-10 border-b border-black/70 pb-1">
                        {fill(values.name)}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm">{copy.addressLabel}</p>
                      <div className="min-h-10 border-b border-black/70 pb-1">
                        {fill(values.address)}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm">{copy.postalCityLabel}</p>
                      <div className="min-h-10 border-b border-black/70 pb-1">
                        {fill(values.postalCity)}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm">{copy.phoneLabel}</p>
                      <div className="min-h-10 border-b border-black/70 pb-1">
                        {fill(values.phone)}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm">{copy.emailLabel}</p>
                      <div className="min-h-10 border-b border-black/70 pb-1">
                        {fill(values.email)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="space-y-4">
            {copy.introLines.map((line) => (
              <p key={line}>{line}</p>
            ))}

            <div className="space-y-3 pl-4">
              <p>
                {copy.agreementNumberLabel}: <span className="ml-2">{fill(agreementNumber)}</span>
              </p>
              {copy.agreementDateLabel ? (
                <p>
                  {copy.agreementDateLabel}: <span className="ml-2">{fill(agreementDate)}</span>
                </p>
              ) : null}
              <p>
                {copy.deliveryLabel}: <span className="ml-2">{fill(deliveryDescription)}</span>
              </p>
              <p>
                {copy.totalAmountLabel}: <span className="ml-2">{amount(totalAmount)}</span>
              </p>
            </div>

            <p>{copy.transferIntro}</p>
            <p className="font-medium">{copy.ibanLine}</p>
          </section>

          <section className="space-y-4">
            <p>{copy.payoutIntro}</p>
            <div className="overflow-hidden border border-black/70">
              <div className="grid grid-cols-[1.2fr_1fr_0.8fr] border-b border-black/70 bg-black/5 text-sm font-semibold">
                <div className="border-r border-black/70 px-3 py-2">
                  {copy.payoutPayee}
                </div>
                <div className="border-r border-black/70 px-3 py-2">
                  {copy.payoutIban}
                </div>
                <div className="px-3 py-2">{copy.payoutAmount}</div>
              </div>
              {payouts.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1.2fr_1fr_0.8fr] border-b border-black/50 last:border-b-0"
                >
                  <div className="border-r border-black/50 px-3 py-3">
                    <span className="mr-3 inline-block min-w-4">{index + 1}</span>
                    {fill(row.payee)}
                  </div>
                  <div className="border-r border-black/50 px-3 py-3">
                    {fill(row.iban)}
                  </div>
                  <div className="px-3 py-3">{amount(row.amount)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-8">
            <p>
              {copy.serviceCostsLabel}: <span className="ml-2">{fill(paidBy)}</span>
            </p>

            <p>
              {copy.draftedLabel} <span className="mx-2">{fill(drawnUpDate)}</span>
              {copy.draftedInLabel} <span className="mx-2">{fill(drawnUpCity)}</span>
            </p>

            <div className="grid gap-12 pt-10 md:grid-cols-2">
              <div className="space-y-10">
                <p className="font-medium">{copy.signatureBuyer}</p>
                <div className="space-y-2">
                  <div className="h-px bg-black/70" />
                  <p>{copy.signatureLabel}</p>
                </div>
              </div>
              <div className="space-y-10">
                <p className="font-medium">{copy.signatureMember}</p>
                <div className="space-y-2">
                  <div className="h-px bg-black/70" />
                  <p>{copy.signatureLabel}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
