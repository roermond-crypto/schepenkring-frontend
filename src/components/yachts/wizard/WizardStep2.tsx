"use client";

import React from "react";
import {
  Coins,
  Waves,
  Ship,
  Zap,
  Bed,
  Compass,
  Shield,
  Box,
  Anchor,
  Wind,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

import { CatalogAutocomplete } from "@/components/ui/CatalogAutocomplete";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BoatCreationAssistant } from "@/components/yachts/BoatCreationAssistant";
import { ConfigurableBoatFieldBlock } from "@/components/yachts/ConfigurableBoatFieldBlock";
import { CorrectionLabel } from "@/components/yachts/FieldCorrectionControls";
import { BoatFormConfigBlock } from "@/lib/api/boat-form-config";

import {
  DESCRIPTION_LANGS,
  DESCRIPTION_LANGUAGE_BADGES,
  DESCRIPTION_LANGUAGE_LABELS,
  DESCRIPTION_LANGUAGE_LOCALES,
  FieldLabel,
  WizardInput as Input,
  SelectField,
  YachtFieldWrapper,
  TriStateSelect,
  SectionHeader,
  AiEvidenceHover,
  hasFilledFieldValue,
  isOptionalTriStateField,
  getConfigBlockExpansionKey,
  sanitizeScalarFieldValue,
  OPTIONAL_TRI_STATE_FIELDS
} from "./WizardHelpers";

interface WizardStep2Props {
  selectedYacht: any;
  setSelectedYacht: React.Dispatch<React.SetStateAction<any>>;
  formKey: number;
  setFormKey: React.Dispatch<React.SetStateAction<number>>;
  isClientRole: boolean;
  harbors: any[];
  preferredHarborId: string | number | null;
  currentUserHarborName: string | null | undefined;
  currentUserHarborCode: string | null | undefined;
  selectedBrandId: number | null;
  setSelectedBrandId: (id: number | null) => void;
  selectedHarborLocationId: number | null;
  setSelectedHarborLocationId: (id: number | null) => void;
  
  // Localization helpers
  labelText: (key: any, fallback: string) => any;
  commonText: (key: any, fallback: string) => any;
  resolveFieldHelpText: (fieldName: string, label: string, type?: any) => string | null;
  extraLabelText: (key: any, fallback: string) => any;
  sectionText: (key: any, fallback: string) => any;
  placeholderText: (key: any, fallback: string) => any;
  localizeFieldLabel: (fieldName: string, label: string) => string;

  // Logic helpers
  needsConfirm: (fieldName: string) => boolean;
  handleFieldCorrectionLabelChange: (fieldName: string, label: CorrectionLabel | null) => void;
  fieldCorrectionLabels: Record<string, CorrectionLabel | null>;
  selectedYachtStatusForForm: string;

  // Dynamic Blocks
  hullConfigBlock: BoatFormConfigBlock | null;
  engineConfigBlock: BoatFormConfigBlock | null;
  accommodationConfigBlock: BoatFormConfigBlock | null;
  navigationConfigBlock: BoatFormConfigBlock | null;
  safetyConfigBlock: BoatFormConfigBlock | null;
  electricalConfigBlock: BoatFormConfigBlock | null;
  comfortConfigBlock: BoatFormConfigBlock | null;
  deckConfigBlock: BoatFormConfigBlock | null;
  riggingConfigBlock: BoatFormConfigBlock | null;
  
  shouldUseDynamicHullBlock: boolean;
  shouldUseDynamicEngineBlock: boolean;
  shouldUseDynamicAccommodationBlock: boolean;
  shouldUseDynamicNavigationBlock: boolean;
  shouldUseDynamicSafetyBlock: boolean;
  shouldUseDynamicElectricalBlock: boolean;
  shouldUseDynamicComfortBlock: boolean;
  shouldUseDynamicDeckBlock: boolean;
  shouldUseDynamicRiggingBlock: boolean;
  
  selectedYachtId: string | number | undefined;
  
  // Consts/Utility
  OPTIONAL_TRI_STATE_FIELDS: string[] | readonly string[];
  getConfigBlockExpansionKey: (block: any, values: any, triStateFields: string[] | readonly string[]) => string;
  sanitizeScalarFieldValue: (val: any) => any;
  isOptionalTriStateField: (fieldName: string) => boolean;
  yachtFormText: any;
}

export function WizardStep2({
  selectedYacht,
  setSelectedYacht,
  formKey,
  setFormKey,
  isClientRole,
  harbors,
  preferredHarborId,
  currentUserHarborName,
  currentUserHarborCode,
  selectedBrandId,
  setSelectedBrandId,
  selectedHarborLocationId,
  setSelectedHarborLocationId,
  
  labelText,
  commonText,
  resolveFieldHelpText,
  extraLabelText,
  sectionText,
  placeholderText,
  localizeFieldLabel,

  needsConfirm,
  handleFieldCorrectionLabelChange,
  fieldCorrectionLabels,
  selectedYachtStatusForForm,

  hullConfigBlock,
  engineConfigBlock,
  accommodationConfigBlock,
  navigationConfigBlock,
  safetyConfigBlock,
  electricalConfigBlock,
  comfortConfigBlock,
  deckConfigBlock,
  riggingConfigBlock,
  
  shouldUseDynamicHullBlock,
  shouldUseDynamicEngineBlock,
  shouldUseDynamicAccommodationBlock,
  shouldUseDynamicNavigationBlock,
  shouldUseDynamicSafetyBlock,
  shouldUseDynamicElectricalBlock,
  shouldUseDynamicComfortBlock,
  shouldUseDynamicDeckBlock,
  shouldUseDynamicRiggingBlock,
  
  selectedYachtId,
  
  OPTIONAL_TRI_STATE_FIELDS,
  getConfigBlockExpansionKey,
  sanitizeScalarFieldValue,
  isOptionalTriStateField,
  yachtFormText
}: WizardStep2Props) {
  return (
    <div
      key={`step2-${formKey}`}
      className="space-y-6 lg:space-y-8 pt-2 [&_input]:border-amber-300 [&_input]:bg-amber-50/50 [&_select]:border-amber-300 [&_select]:bg-amber-50/50 [&_[data-slot='select-trigger']]:border-amber-300 [&_[data-slot='select-trigger']]:bg-amber-50/50"
    >
      {/* AI extraction summary intentionally hidden in Step 2 */}

      {/* --- SECTION 2: CORE SPECS --- */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Coins size={20} className="text-blue-600" />{" "}
            {labelText(
              "essentialRegistryData",
              "Essential Registry Data",
            )}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText("vesselName", "Vessel Name *")}
              helpText={resolveFieldHelpText(
                "boat_name",
                labelText("vesselName", "Vessel Name *"),
              )}
            />
            <Input
              name="boat_name"
              defaultValue={selectedYacht?.boat_name}
              required
              needsConfirmation={needsConfirm("boat_name")}
            />
          </div>
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText("manufacturer", "Manufacturer / Make")}
              helpText={resolveFieldHelpText(
                "manufacturer",
                labelText("manufacturer", "Manufacturer / Make"),
              )}
            />
            <CatalogAutocomplete
              endpoint="/api/autocomplete/brands"
              name="manufacturer"
              defaultValue={selectedYacht?.manufacturer}
              needsConfirmation={needsConfirm("manufacturer")}
              onSelect={(id, name) => {
                setSelectedBrandId(Number(id));
                setSelectedYacht((prev: any) => ({
                  ...prev,
                  manufacturer: name,
                }));
              }}
            />
          </div>
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText("model", "Model")}
              helpText={resolveFieldHelpText(
                "model",
                labelText("model", "Model"),
              )}
            />
            <CatalogAutocomplete
              endpoint="/api/autocomplete/models"
              name="model"
              defaultValue={selectedYacht?.model}
              dependsOn="brand_id"
              dependsOnValue={selectedBrandId}
              needsConfirmation={needsConfirm("model")}
              onSelect={(_id, name) => {
                // When model changes, we update the state so the assistant picks it up
                setSelectedYacht((prev: any) => ({
                  ...prev,
                  model: name,
                }));
              }}
            />
          </div>

          <div className="space-y-2 group">
            <FieldLabel
              label={labelText(
                "harborLocation",
                "Sales Location (Harbor) *",
              )}
              fieldName="ref_harbor_id"
              helpText={resolveFieldHelpText(
                "ref_harbor_id",
                labelText(
                  "harborLocation",
                  "Sales Location (Harbor) *",
                ),
                "select",
              )}
            />
            {isClientRole ? (
              <div className="flex min-h-11 items-center rounded-md border border-amber-300 bg-amber-50/60 px-4 text-sm font-medium text-slate-700">
                {(() => {
                  const currentHarbor = harbors.find(
                    (harbor) =>
                      Number(harbor?.id) ===
                      Number(
                        selectedYacht?.ref_harbor_id ??
                          preferredHarborId,
                      ),
                  );

                  if (!currentHarbor) {
                    if (
                      currentUserHarborName &&
                      currentUserHarborCode
                    ) {
                      return `${currentUserHarborName} (${currentUserHarborCode})`;
                    }

                    if (currentUserHarborName) {
                      return currentUserHarborName;
                    }

                    return labelText(
                      "locationAssignedAutomatically",
                      "Location is assigned automatically from your account.",
                    );
                  }

                  return `${currentHarbor.name} (${currentHarbor.code})`;
                })()}
              </div>
            ) : (
              <>
                <LocationAutocomplete
                  value={selectedYacht?.vessel_lying || selectedYacht?.where || ''}
                  placeholder={commonText("searchLocation", "Search city or harbor name...")}
                  onSelectPlace={(place) => {
                    setSelectedYacht((prev: any) => ({
                      ...prev,
                      where: place.formattedAddress,
                      vessel_lying: place.formattedAddress,
                      location_city: place.city,
                      location_lat: place.lat,
                      location_lng: place.lng,
                      ref_harbor_id: null,
                      ref_harbor_location_id: null
                    }));
                    setSelectedHarborLocationId(null);
                  }}
                />
                <div className="mt-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    {commonText("orSelectHarbor", "Or select internal harbor:")}
                  </p>
                  <Select
                    value={selectedYacht?.ref_harbor_id?.toString() || ""}
                    onValueChange={(val) => {
                      setSelectedYacht((prev: any) => ({
                        ...prev,
                        ref_harbor_id: Number(val),
                        ref_harbor_location_id: null
                      }));
                      setSelectedHarborLocationId(null);
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-11 border-slate-200",
                        hasFilledFieldValue(selectedYacht?.ref_harbor_id) &&
                          "border-amber-300 bg-amber-50/50",
                      )}
                    >
                      <SelectValue
                        placeholder={commonText(
                          "selectLocation",
                          "Select location...",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {harbors.map((h) => (
                        <SelectItem key={h.id} value={h.id.toString()}>
                          {h.name} ({h.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hidden fields for geo-coordinates */}
                <input type="hidden" name="where" value={selectedYacht?.where || ''} />
                <input type="hidden" name="vessel_lying" value={selectedYacht?.vessel_lying || ''} />
                <input type="hidden" name="location_city" value={selectedYacht?.location_city || ''} />
                <input type="hidden" name="location_lat" value={selectedYacht?.location_lat || ''} />
                <input type="hidden" name="location_lng" value={selectedYacht?.location_lng || ''} />
                <input
                  type="hidden"
                  name="ref_harbor_location_id"
                  value={selectedHarborLocationId?.toString() || ""}
                  readOnly
                />
              </>
            )}
          </div>

          {/* ── AI ASSISTANT ── */}
          <div className="md:col-span-2 lg:col-span-3">
            <BoatCreationAssistant
              manufacturer={selectedYacht?.manufacturer || ""}
              model={selectedYacht?.model || ""}
              autoApply
              onApply={(specs, mode = "manual") => {
                const isAuto = mode === "auto";
                const isEmpty = (value: unknown) =>
                  sanitizeScalarFieldValue(value) === null;

                setSelectedYacht((prev: any) => {
                  const base = { ...(prev || {}) };
                  const normalizedSpecs = {
                    ...specs,
                    loa: specs.loa ?? specs.length_m,
                    beam: specs.beam ?? specs.beam_m ?? specs.width,
                    draft:
                      specs.draft ?? specs.draft_m ?? specs.draught,
                  };

                  Object.entries(normalizedSpecs).forEach(
                    ([field, value]) => {
                      const sanitizedValue =
                        sanitizeScalarFieldValue(value);
                      if (sanitizedValue === null)
                        return;
                      if (isAuto && !isEmpty(base[field])) return;
                      base[field] = sanitizedValue;
                    },
                  );

                  return base;
                });
                setFormKey((k) => k + 1); // Refresh form to show new defaultValues
                if (!isAuto) {
                  toast.success("AI suggestions applied to form!");
                }
              }}
            />
          </div>
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText("price", "Price (€)")}
              helpText={resolveFieldHelpText(
                "price",
                labelText("price", "Price (€)"),
                "number",
              )}
            />
            <Input
              name="price"
              type="number"
              defaultValue={selectedYacht?.price}
              needsConfirmation={needsConfirm("price")}
            />
          </div>
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText(
                "minBidAmount",
                "Minimum Bid Amount (€)",
              )}
              helpText={resolveFieldHelpText(
                "min_bid_amount",
                labelText("minBidAmount", "Minimum Bid Amount (€)"),
                "number",
              )}
            />
            <Input
              name="min_bid_amount"
              type="number"
              defaultValue={selectedYacht?.min_bid_amount || ""}
              step="1000"
            />
          </div>
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText("yearBuilt", "Year Built")}
              helpText={resolveFieldHelpText(
                "year",
                labelText("yearBuilt", "Year Built"),
                "number",
              )}
            />
            <Input
              name="year"
              type="number"
              defaultValue={selectedYacht?.year}
              needsConfirmation={needsConfirm("year")}
            />
          </div>
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText("boatType", "Boat Type")}
              helpText={resolveFieldHelpText(
                "boat_type",
                labelText("boatType", "Boat Type"),
              )}
            />
            <CatalogAutocomplete
              endpoint="/api/autocomplete/types"
              name="boat_type"
              defaultValue={selectedYacht?.boat_type}
              needsConfirmation={needsConfirm("boat_type")}
            />
          </div>
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText("boatCategory", "Boat Category")}
              helpText={resolveFieldHelpText(
                "boat_category",
                labelText("boatCategory", "Boat Category"),
              )}
            />
            <Input
              name="boat_category"
              defaultValue={selectedYacht?.boat_category}
              needsConfirmation={needsConfirm("boat_category")}
            />
          </div>
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText("newOrUsed", "New or Used")}
              helpText={resolveFieldHelpText(
                "new_or_used",
                labelText("newOrUsed", "New or Used"),
                "select",
              )}
            />
            <SelectField
              name="new_or_used"
              defaultValue={selectedYacht?.new_or_used || ""}
            >
              <option value="">
                {commonText("select", "Select...")}
              </option>
              <option value="new">
                {commonText("conditionNew", "New")}
              </option>
              <option value="used">
                {commonText("conditionUsed", "Used")}
              </option>
            </SelectField>
          </div>
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText("loa", "LOA (Length Overall)")}
              helpText={resolveFieldHelpText(
                "loa",
                labelText("loa", "LOA (Length Overall)"),
                "number",
              )}
            />
            <Input
              name="loa"
              defaultValue={selectedYacht?.loa}
              needsConfirmation={needsConfirm("loa")}
            />
          </div>
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText("lwl", "LWL (Waterline Length)")}
              helpText={resolveFieldHelpText(
                "lwl",
                labelText("lwl", "LWL (Waterline Length)"),
                "number",
              )}
            />
            <Input name="lwl" defaultValue={selectedYacht?.lwl} />
          </div>
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText("shipyard", "Shipyard / Werf")}
              helpText={resolveFieldHelpText(
                "where",
                labelText("shipyard", "Shipyard / Werf"),
              )}
            />
            <Input name="where" defaultValue={selectedYacht?.where} />
          </div>
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText("ceCategory", "CE Category")}
              helpText={resolveFieldHelpText(
                "ce_category",
                labelText("ceCategory", "CE Category"),
                "select",
              )}
            />
            <SelectField
              name="ce_category"
              defaultValue={selectedYacht?.ce_category || ""}
            >
              <option value="">
                {commonText("select", "Select...")}
              </option>
              <option value="A">
                A - {commonText("ceOcean", "Ocean")}
              </option>
              <option value="B">
                B - {commonText("ceOffshore", "Offshore")}
              </option>
              <option value="C">
                C - {commonText("ceInshore", "Inshore")}
              </option>
              <option value="D">
                D - {commonText("ceSheltered", "Sheltered Waters")}
              </option>
            </SelectField>
          </div>
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText("status", "Status")}
              helpText={resolveFieldHelpText(
                "status",
                labelText("status", "Status"),
                "select",
              )}
            />
            <SelectField
              name="status"
              defaultValue={selectedYachtStatusForForm}
            >
              <option value="For Sale">
                {commonText("statusForSale", "For Sale")}
              </option>
              <option value="For Bid">
                {commonText("statusForBid", "For Bid")}
              </option>
              <option value="Sold">
                {commonText("statusSold", "Sold")}
              </option>
              <option value="Draft">
                {commonText("statusDraft", "Draft")}
              </option>
            </SelectField>
          </div>
          <div className="space-y-2 group">
            <FieldLabel
              label={labelText(
                "passengerCapacity",
                "Passenger Capacity",
              )}
              helpText={resolveFieldHelpText(
                "passenger_capacity",
                labelText("passengerCapacity", "Passenger Capacity"),
                "number",
              )}
            />
            <Input
              name="passenger_capacity"
              type="number"
              defaultValue={selectedYacht?.passenger_capacity}
            />
          </div>
        </div>
      </div>

      {/* --- SECTION 3: TECHNICAL DOSSIER --- */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-10">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
          <Waves size={20} className="text-blue-600" />{" "}
          {labelText("technicalDossier", "Technical Dossier")}
        </h3>

        {/* Sub-Section: General & Hull */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-5">
            {shouldUseDynamicHullBlock && hullConfigBlock ? (
              <ConfigurableBoatFieldBlock
                key={getConfigBlockExpansionKey(
                  hullConfigBlock,
                  selectedYacht,
                  OPTIONAL_TRI_STATE_FIELDS,
                )}
                block={hullConfigBlock}
                icon={<Ship size={16} />}
                title={labelText("hullDimensions", "Hull & Dimensions")}
                values={selectedYacht}
                yachtId={Number(selectedYachtId)}
                needsConfirm={needsConfirm}
                optionalTriStateFields={OPTIONAL_TRI_STATE_FIELDS}
                correctionLabels={fieldCorrectionLabels}
                onCorrectionLabelChange={
                  handleFieldCorrectionLabelChange
                }
                yesLabel={(commonText as any)("yes", "Yes")}
                noLabel={(commonText as any)("no", "No")}
                unknownLabel={(commonText as any)("unknown", "Unknown")}
                gridClassName="md:grid-cols-2"
              />
            ) : (
              <>
                <SectionHeader
                  icon={<Ship size={16} />}
                  title={labelText(
                    "hullDimensions",
                    "Hull & Dimensions",
                  )}
                />
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1 group">
                    <FieldLabel label={labelText("beam", "Beam (Width)")} />
                    <Input
                      name="beam"
                      defaultValue={selectedYacht?.beam}
                      placeholder="e.g. 8.5m"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel label={labelText("draft", "Draft (Depth)")} />
                    <Input
                      name="draft"
                      defaultValue={selectedYacht?.draft}
                      placeholder="e.g. 2.1m"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("airDraft", "Air Draft (Clearance)")}
                    />
                    <Input
                      name="air_draft"
                      defaultValue={selectedYacht?.air_draft}
                      placeholder="e.g. 4.5m"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={extraLabelText("displacement", "Displacement")}
                    />
                    <Input
                      name="displacement"
                      defaultValue={selectedYacht?.displacement}
                      placeholder="e.g. 12000 kg"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel label={labelText("ballast", "Ballast")} />
                    <Input
                      name="ballast"
                      defaultValue={selectedYacht?.ballast}
                      placeholder="e.g. 3500 kg"
                      needsConfirmation={needsConfirm("ballast")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel label={labelText("hullType", "Hull Type")} />
                    <Input
                      name="hull_type"
                      defaultValue={selectedYacht?.hull_type}
                      placeholder="e.g. Monohull"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText(
                        "hullConstruction",
                        "Hull Construction",
                      )}
                    />
                    <Input
                      name="hull_construction"
                      defaultValue={selectedYacht?.hull_construction}
                      placeholder="e.g. GRP / Polyester"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("hullColour", "Hull Colour")}
                    />
                    <Input
                      name="hull_colour"
                      defaultValue={selectedYacht?.hull_colour}
                      placeholder="White"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("hullNumber", "Hull Number")}
                    />
                    <Input
                      name="hull_number"
                      defaultValue={selectedYacht?.hull_number}
                      placeholder="e.g. HULL001"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel label={labelText("designer", "Designer")} />
                    <Input
                      name="designer"
                      defaultValue={selectedYacht?.designer}
                      placeholder="e.g. Philippe Briand"
                      needsConfirmation={needsConfirm("designer")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel label={labelText("builder", "Builder")} />
                    <Input
                      name="builder"
                      defaultValue={selectedYacht?.builder}
                      placeholder="e.g. Beneteau"
                      needsConfirmation={needsConfirm("builder")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("deckColour", "Deck Colour")}
                    />
                    <Input
                      name="deck_colour"
                      defaultValue={selectedYacht?.deck_colour}
                      placeholder="e.g. White"
                      needsConfirmation={needsConfirm("deck_colour")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText(
                        "deckConstruction",
                        "Deck Construction",
                      )}
                    />
                    <Input
                      name="deck_construction"
                      defaultValue={selectedYacht?.deck_construction}
                      placeholder="e.g. GRP with teak"
                      needsConfirmation={needsConfirm(
                        "deck_construction",
                      )}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText(
                        "superStructureColour",
                        "Superstructure Colour",
                      )}
                    />
                    <Input
                      name="super_structure_colour"
                      defaultValue={
                        selectedYacht?.super_structure_colour
                      }
                      placeholder="e.g. White"
                      needsConfirmation={needsConfirm(
                        "super_structure_colour",
                      )}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText(
                        "superStructureConstruction",
                        "Superstructure Construction",
                      )}
                    />
                    <Input
                      name="super_structure_construction"
                      defaultValue={
                        selectedYacht?.super_structure_construction
                      }
                      placeholder="e.g. GRP"
                      needsConfirmation={needsConfirm(
                        "super_structure_construction",
                      )}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="space-y-5">
            {shouldUseDynamicEngineBlock && engineConfigBlock ? (
              <ConfigurableBoatFieldBlock
                key={getConfigBlockExpansionKey(
                  engineConfigBlock,
                  selectedYacht,
                  OPTIONAL_TRI_STATE_FIELDS,
                )}
                block={engineConfigBlock}
                icon={<Zap size={16} />}
                title={labelText(
                  "enginePerformance",
                  "Engine & Performance",
                )}
                values={selectedYacht}
                yachtId={Number(selectedYachtId)}
                needsConfirm={needsConfirm}
                optionalTriStateFields={OPTIONAL_TRI_STATE_FIELDS}
                correctionLabels={fieldCorrectionLabels}
                onCorrectionLabelChange={
                  handleFieldCorrectionLabelChange
                }
                yesLabel={(commonText as any)("yes", "Yes")}
                noLabel={(commonText as any)("no", "No")}
                unknownLabel={(commonText as any)("unknown", "Unknown")}
                gridClassName="md:grid-cols-2"
              />
            ) : (
              <>
                <SectionHeader
                  icon={<Zap size={16} />}
                  title={labelText(
                    "enginePerformance",
                    "Engine & Performance",
                  )}
                />
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText(
                        "engineManufacturer",
                        "Engine Manufacturer",
                      )}
                    />
                    <Input
                      name="engine_manufacturer"
                      defaultValue={selectedYacht?.engine_manufacturer}
                      placeholder="e.g. CAT / MTU"
                      needsConfirmation={needsConfirm(
                        "engine_manufacturer",
                      )}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("engineModel", "Engine Model")}
                    />
                    <Input
                      name="engine_model"
                      defaultValue={selectedYacht?.engine_model}
                      placeholder="e.g. C32 ACERT"
                      needsConfirmation={needsConfirm("engine_model")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("engineType", "Engine Type")}
                    />
                    <SelectField
                      name="engine_type"
                      defaultValue={selectedYacht?.engine_type || ""}
                    >
                      <option value="">Select…</option>
                      <option value="inboard">Inboard</option>
                      <option value="outboard">Outboard</option>
                      <option value="saildrive">Saildrive</option>
                      <option value="sterndrive">Sterndrive</option>
                    </SelectField>
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("horsePower", "Horse Power")}
                    />
                    <Input
                      name="horse_power"
                      defaultValue={selectedYacht?.horse_power}
                      placeholder="e.g. 2x 1500HP"
                      needsConfirmation={needsConfirm("horse_power")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("engineHours", "Engine Hours")}
                    />
                    <Input
                      name="hours"
                      defaultValue={selectedYacht?.hours}
                      placeholder="e.g. 450 hrs"
                      needsConfirmation={needsConfirm("hours")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel label={labelText("fuelType", "Fuel Type")} />
                    <Input
                      name="fuel"
                      defaultValue={selectedYacht?.fuel}
                      placeholder="Diesel"
                      needsConfirmation={needsConfirm("fuel")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("engineQuantity", "Engine Quantity")}
                    />
                    <Input
                      name="engine_quantity"
                      defaultValue={selectedYacht?.engine_quantity}
                      placeholder="e.g. 1, 2, 3"
                      needsConfirmation={needsConfirm(
                        "engine_quantity",
                      )}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("engineYear", "Engine Year")}
                    />
                    <Input
                      name="engine_year"
                      type="number"
                      defaultValue={selectedYacht?.engine_year}
                      placeholder="e.g. 2020"
                      needsConfirmation={needsConfirm("engine_year")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel label={labelText("maxSpeed", "Max Speed")} />
                    <Input
                      name="max_speed"
                      defaultValue={selectedYacht?.max_speed}
                      placeholder="e.g. 35 kn"
                      needsConfirmation={needsConfirm("max_speed")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("cruisingSpeed", "Cruising Speed")}
                    />
                    <Input
                      name="cruising_speed"
                      defaultValue={selectedYacht?.cruising_speed}
                      placeholder="e.g. 25 kn"
                      needsConfirmation={needsConfirm("cruising_speed")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("driveType", "Drive Type")}
                    />
                    <Input
                      name="drive_type"
                      defaultValue={selectedYacht?.drive_type}
                      placeholder="e.g. Shaft, V-drive, Pod"
                      needsConfirmation={needsConfirm("drive_type")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={extraLabelText("propulsion", "Propulsion")}
                    />
                    <Input
                      name="propulsion"
                      defaultValue={selectedYacht?.propulsion}
                      placeholder="e.g. Fixed prop, Folding, Saildrive"
                      needsConfirmation={needsConfirm("propulsion")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("gallonsPerHour", "Gallons per Hour")}
                    />
                    <Input
                      name="gallons_per_hour"
                      defaultValue={selectedYacht?.gallons_per_hour}
                      placeholder="e.g. 50"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={extraLabelText("tankage", "Tankage")}
                    />
                    <Input
                      name="tankage"
                      defaultValue={selectedYacht?.tankage}
                      placeholder="e.g. 2000L"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {/* --- SECTION 2: CORE SPECS --- */}
      <div className="bg-white p-8 lg:p-10 border border-slate-200 shadow-sm space-y-8">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.3em] flex items-center gap-2 border-b border-slate-200 pb-4 italic">
          <Coins size={18} />{" "}
          {labelText(
            "essentialRegistryData",
            "Essential Registry Data",
          )}
        </h3>

        {/* Sub-Section: Accommodation */}
        {shouldUseDynamicAccommodationBlock &&
        accommodationConfigBlock ? (
          <ConfigurableBoatFieldBlock
            key={getConfigBlockExpansionKey(
              accommodationConfigBlock,
              selectedYacht,
              OPTIONAL_TRI_STATE_FIELDS,
            )}
            block={accommodationConfigBlock}
            icon={<Bed size={16} />}
            title={labelText(
              "accommodationFacilities",
              "Accommodation & Facilities",
            )}
            values={selectedYacht}
            yachtId={Number(selectedYachtId)}
            needsConfirm={needsConfirm}
            optionalTriStateFields={OPTIONAL_TRI_STATE_FIELDS}
            yesLabel={(commonText as any)("yes", "Yes")}
            noLabel={(commonText as any)("no", "No")}
            unknownLabel={(commonText as any)("unknown", "Unknown")}
          />
        ) : (
          <div className="space-y-5">
            <SectionHeader
              icon={<Bed size={16} />}
              title={labelText(
                "accommodationFacilities",
                "Accommodation & Facilities",
              )}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <div className="space-y-1 group">
                <FieldLabel label={labelText("cabins", "Cabins")} />
                <Input
                  name="cabins"
                  type="number"
                  defaultValue={selectedYacht?.cabins}
                  placeholder="3"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={extraLabelText("berths", "Berths")} />
                <Input
                  name="berths"
                  defaultValue={selectedYacht?.berths}
                  placeholder="6"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={extraLabelText("toilet", "Toilet")} />
                <TriStateSelect
                  name="toilet"
                  defaultValue={selectedYacht?.toilet}
                  needsConfirmation={needsConfirm("toilet")}
                  yesLabel={yachtFormText.common.yes}
                  noLabel={yachtFormText.common.no}
                  unknownLabel={yachtFormText.common.unknown}
                  confirmLabel={yachtFormText.common.confirm}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("berthsFixed", "Berths (Fixed)")}
                />
                <Input
                  name="berths_fixed"
                  type="number"
                  defaultValue={selectedYacht?.berths_fixed}
                  placeholder="4"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("berthsExtra", "Berths (Extra)")}
                />
                <Input
                  name="berths_extra"
                  type="number"
                  defaultValue={selectedYacht?.berths_extra}
                  placeholder="2"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("berthsCrew", "Berths (Crew)")}
                />
                <Input
                  name="berths_crew"
                  type="number"
                  defaultValue={selectedYacht?.berths_crew}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={extraLabelText("shower", "Shower")} />
                <Input
                  name="shower"
                  defaultValue={selectedYacht?.shower}
                  placeholder="2"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={extraLabelText("bath", "Bath")} />
                <Input
                  name="bath"
                  defaultValue={selectedYacht?.bath}
                  placeholder="1"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("interiorType", "Interior Type")}
                />
                <Input
                  name="interior_type"
                  defaultValue={selectedYacht?.interior_type}
                  placeholder="Classic, wood"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={extraLabelText("saloon", "Saloon")} />
                <Input
                  name="saloon"
                  defaultValue={selectedYacht?.saloon}
                  placeholder={yachtFormText.common.yes}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={extraLabelText("headroom", "Headroom")} />
                <Input
                  name="headroom"
                  defaultValue={selectedYacht?.headroom}
                  placeholder="1.95m"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText(
                    "separateDiningArea",
                    "Separate Dining Area",
                  )}
                />
                <Input
                  name="separate_dining_area"
                  defaultValue={selectedYacht?.separate_dining_area}
                  placeholder="Yes"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={extraLabelText("engineRoom", "Engine Room")}
                />
                <Input
                  name="engine_room"
                  defaultValue={selectedYacht?.engine_room}
                  placeholder={yachtFormText.common.yes}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={extraLabelText("spacesInside", "Spaces Inside")}
                />
                <Input
                  name="spaces_inside"
                  defaultValue={selectedYacht?.spaces_inside}
                  placeholder="3"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("upholsteryColor", "Upholstery Color")}
                />
                <Input
                  name="upholstery_color"
                  defaultValue={selectedYacht?.upholstery_color}
                  placeholder="Blue"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={extraLabelText("matrasses", "Matrasses")}
                />
                <Input
                  name="matrasses"
                  defaultValue={selectedYacht?.matrasses}
                  placeholder={yachtFormText.common.yes}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={extraLabelText("cushions", "Cushions")} />
                <Input
                  name="cushions"
                  defaultValue={selectedYacht?.cushions}
                  placeholder={yachtFormText.common.yes}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={extraLabelText("curtains", "Curtains")} />
                <Input
                  name="curtains"
                  defaultValue={selectedYacht?.curtains}
                  placeholder="White"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={extraLabelText("heating", "Heating")} />
                <TriStateSelect
                  name="heating"
                  defaultValue={selectedYacht?.heating}
                  needsConfirmation={needsConfirm("heating")}
                  yesLabel={yachtFormText.common.yes}
                  noLabel={yachtFormText.common.no}
                  unknownLabel={yachtFormText.common.unknown}
                  confirmLabel={yachtFormText.common.confirm}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("cockpitType", "Cockpit Type")}
                />
                <Input
                  name="cockpit_type"
                  defaultValue={selectedYacht?.cockpit_type}
                  placeholder={placeholderText(
                    "cockpitType",
                    "Aft cockpit",
                  )}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={labelText("waterTank", "Water Tank")} />
                <Input
                  name="water_tank"
                  defaultValue={selectedYacht?.water_tank}
                  placeholder={placeholderText("waterTank", "200L")}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("waterTankGauge", "Water Tank Gauge")}
                />
                <Input
                  name="water_tank_gauge"
                  defaultValue={selectedYacht?.water_tank_gauge}
                  placeholder={placeholderText("waterTankGauge", "Yes")}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={labelText("waterMaker", "Water Maker")} />
                <Input
                  name="water_maker"
                  defaultValue={selectedYacht?.water_maker}
                  placeholder={placeholderText("waterMaker", "60 L/h")}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("wasteWaterTank", "Waste Water Tank")}
                />
                <Input
                  name="waste_water_tank"
                  defaultValue={selectedYacht?.waste_water_tank}
                  placeholder={placeholderText("wasteWaterTank", "80L")}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("wasteWaterGauge", "Waste Water Gauge")}
                />
                <Input
                  name="waste_water_tank_gauge"
                  defaultValue={selectedYacht?.waste_water_tank_gauge}
                  placeholder={placeholderText(
                    "wasteWaterGauge",
                    "Yes",
                  )}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText(
                    "wasteTankDrainPump",
                    "Waste Tank Drain Pump",
                  )}
                />
                <Input
                  name="waste_water_tank_drainpump"
                  defaultValue={
                    selectedYacht?.waste_water_tank_drainpump
                  }
                  placeholder={placeholderText(
                    "wasteTankDrainPump",
                    "Electric",
                  )}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("deckSuction", "Deck Suction")}
                />
                <Input
                  name="deck_suction"
                  defaultValue={selectedYacht?.deck_suction}
                  placeholder={placeholderText("deckSuction", "Yes")}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("waterSystem", "Water System")}
                />
                <Input
                  name="water_system"
                  defaultValue={selectedYacht?.water_system}
                  placeholder={placeholderText(
                    "waterSystem",
                    "Pressurized",
                  )}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={labelText("hotWater", "Hot Water")} />
                <Input
                  name="hot_water"
                  defaultValue={selectedYacht?.hot_water}
                  placeholder={placeholderText("hotWater", "Boiler")}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("seaWaterPump", "Sea Water Pump")}
                />
                <Input
                  name="sea_water_pump"
                  defaultValue={selectedYacht?.sea_water_pump}
                  placeholder={placeholderText("seaWaterPump", "Yes")}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={labelText("television", "Television")} />
                <TriStateSelect
                  name="television"
                  defaultValue={selectedYacht?.television}
                  needsConfirmation={needsConfirm("television")}
                  yesLabel={yachtFormText.common.yes}
                  noLabel={yachtFormText.common.no}
                  unknownLabel={yachtFormText.common.unknown}
                  confirmLabel={yachtFormText.common.confirm}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("cdPlayer", "Radio / CD Player")}
                />
                <Input
                  name="cd_player"
                  defaultValue={selectedYacht?.cd_player}
                  placeholder="Pioneer"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText(
                    "satelliteReception",
                    "Satellite Reception",
                  )}
                />
                <Input
                  name="satellite_reception"
                  defaultValue={selectedYacht?.satellite_reception}
                  placeholder="KVH TracVision"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={labelText("cooker", "Cooker")} />
                <Input
                  name="cooker"
                  defaultValue={selectedYacht?.cooker}
                  placeholder="3-burner"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("cookingFuel", "Cooking Fuel")}
                />
                <Input
                  name="cooking_fuel"
                  defaultValue={selectedYacht?.cooking_fuel}
                  placeholder="Gas"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={labelText("oven", "Oven")} />
                <TriStateSelect
                  name="oven"
                  defaultValue={selectedYacht?.oven}
                  needsConfirmation={needsConfirm("oven")}
                  yesLabel={yachtFormText.common.yes}
                  noLabel={yachtFormText.common.no}
                  unknownLabel={yachtFormText.common.unknown}
                  confirmLabel={yachtFormText.common.confirm}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={labelText("microwave", "Microwave")} />
                <TriStateSelect
                  name="microwave"
                  defaultValue={selectedYacht?.microwave}
                  needsConfirmation={needsConfirm("microwave")}
                  yesLabel={yachtFormText.common.yes}
                  noLabel={yachtFormText.common.no}
                  unknownLabel={yachtFormText.common.unknown}
                  confirmLabel={yachtFormText.common.confirm}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={labelText("fridge", "Fridge")} />
                <TriStateSelect
                  name="fridge"
                  defaultValue={selectedYacht?.fridge}
                  needsConfirmation={needsConfirm("fridge")}
                  yesLabel={yachtFormText.common.yes}
                  noLabel={yachtFormText.common.no}
                  unknownLabel={yachtFormText.common.unknown}
                  confirmLabel={yachtFormText.common.confirm}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={labelText("freezer", "Freezer")} />
                <TriStateSelect
                  name="freezer"
                  defaultValue={selectedYacht?.freezer}
                  needsConfirmation={needsConfirm("freezer")}
                  yesLabel={yachtFormText.common.yes}
                  noLabel={yachtFormText.common.no}
                  unknownLabel={yachtFormText.common.unknown}
                  confirmLabel={yachtFormText.common.confirm}
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={labelText("hotAir", "Hot Air Heating")} />
                <Input
                  name="hot_air"
                  defaultValue={selectedYacht?.hot_air}
                  placeholder="Webasto"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel label={labelText("stove", "Stove Heating")} />
                <Input
                  name="stove"
                  defaultValue={selectedYacht?.stove}
                  placeholder="Refleks"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("centralHeating", "Central Heating")}
                />
                <Input
                  name="central_heating"
                  defaultValue={selectedYacht?.central_heating}
                  placeholder="Kabola"
                />
              </div>
              <div className="space-y-1 group">
                <FieldLabel
                  label={labelText("controlType", "Control Type")}
                />
                <Input
                  name="control_type"
                  defaultValue={selectedYacht?.control_type}
                  placeholder="e.g. Wheel / Joystick"
                />
              </div>
              <div className="col-span-2 md:col-span-4 border-t border-slate-100 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("airConditioning", "Air Conditioning")}
                    />
                    <TriStateSelect
                      name="air_conditioning"
                      defaultValue={selectedYacht?.air_conditioning}
                      needsConfirmation={needsConfirm(
                        "air_conditioning",
                      )}
                      yesLabel={yachtFormText.common.yes}
                      noLabel={yachtFormText.common.no}
                      unknownLabel={yachtFormText.common.unknown}
                      confirmLabel={yachtFormText.common.confirm}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel label={labelText("flybridge", "Flybridge")} />
                    <TriStateSelect
                      name="flybridge"
                      defaultValue={selectedYacht?.flybridge}
                      needsConfirmation={needsConfirm("flybridge")}
                      yesLabel={yachtFormText.common.yes}
                      noLabel={yachtFormText.common.no}
                      unknownLabel={yachtFormText.common.unknown}
                      confirmLabel={yachtFormText.common.confirm}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("deckWashPump", "Deck Wash Pump")}
                    />
                    <TriStateSelect
                      name="deck_wash_pump"
                      defaultValue={selectedYacht?.deck_wash_pump}
                      needsConfirmation={needsConfirm("deck_wash_pump")}
                      yesLabel={yachtFormText.common.yes}
                      noLabel={yachtFormText.common.no}
                      unknownLabel={yachtFormText.common.unknown}
                      confirmLabel={yachtFormText.common.confirm}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <FieldLabel
                      label={labelText("deckShower", "Deck Shower")}
                    />
                    <TriStateSelect
                      name="deck_shower"
                      defaultValue={selectedYacht?.deck_shower}
                      needsConfirmation={needsConfirm("deck_shower")}
                      yesLabel={yachtFormText.common.yes}
                      noLabel={yachtFormText.common.no}
                      unknownLabel={yachtFormText.common.unknown}
                      confirmLabel={yachtFormText.common.confirm}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sub-Section: Navigation Equipment */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
        {shouldUseDynamicNavigationBlock && navigationConfigBlock ? (
          <ConfigurableBoatFieldBlock
            key={getConfigBlockExpansionKey(
              navigationConfigBlock,
              selectedYacht,
              OPTIONAL_TRI_STATE_FIELDS,
            )}
            block={navigationConfigBlock}
            icon={<Compass size={16} />}
            title={labelText(
              "navigationElectronics",
              "Navigation & Electronics",
            )}
            values={selectedYacht}
            yachtId={Number(selectedYachtId)}
            needsConfirm={needsConfirm}
            optionalTriStateFields={OPTIONAL_TRI_STATE_FIELDS}
            correctionLabels={fieldCorrectionLabels}
            onCorrectionLabelChange={handleFieldCorrectionLabelChange}
            yesLabel={(commonText as any)("yes", "Yes")}
            noLabel={(commonText as any)("no", "No")}
            unknownLabel={(commonText as any)("unknown", "Unknown")}
            gridClassName="md:grid-cols-3"
          />
        ) : (
          <>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Compass size={20} className="text-blue-600" />{" "}
              {labelText(
                "navigationElectronics",
                "Navigation & Electronics",
              )}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {[
                {
                  name: "compass",
                  label: "Compass",
                  ph: "e.g. Ritchie Globemaster",
                },
                {
                  name: "depth_instrument",
                  label: "Depth Instrument",
                  ph: "e.g. Simrad IS42",
                },
                {
                  name: "wind_instrument",
                  label: "Wind Instrument",
                  ph: "e.g. B&G WS310",
                },
                {
                  name: "navigation_lights",
                  label: "Navigation Lights",
                  ph: "e.g. Aqua Signal Series 40",
                },
                {
                  name: "autopilot",
                  label: "Autopilot",
                  ph: "e.g. Raymarine EV-200",
                },
                {
                  name: "gps",
                  label: "GPS",
                  ph: "e.g. Garmin GPSMap 922xs",
                },
                {
                  name: "vhf",
                  label: "VHF / Marifoon",
                  ph: "e.g. Icom IC-M506",
                },
                {
                  name: "plotter",
                  label: "Chart Plotter",
                  ph: "e.g. Raymarine Axiom 9",
                },
                {
                  name: "speed_instrument",
                  label: "Log / Speed",
                  ph: "e.g. Simrad IS42",
                },
                {
                  name: "radar",
                  label: "Radar",
                  ph: "e.g. Furuno DRS4DL+",
                },
                {
                  name: "fishfinder",
                  label: "Fishfinder",
                  ph: "e.g. Garmin Striker 7sv",
                },
                { name: "ais", label: "AIS", ph: "e.g. em-trak B954" },
                {
                  name: "log_speed",
                  label: "Log / Speed",
                  ph: "e.g. Simrad IS42",
                },
                {
                  name: "rudder_position_indicator",
                  label: "Rudder Position Indicator",
                  ph: "Yes",
                },
                {
                  name: "turn_indicator",
                  label: "Turn Indicator",
                  ph: "Yes",
                },
                {
                  name: "ssb_receiver",
                  label: "SSB Receiver",
                  ph: "Yes",
                },
                {
                  name: "shortwave_radio",
                  label: "Shortwave Radio",
                  ph: "Yes",
                },
                {
                  name: "short_band_transmitter",
                  label: "Short Band Transmitter",
                  ph: "Yes",
                },
                {
                  name: "satellite_communication",
                  label: "Satellite Communication",
                  ph: "Yes",
                },
                {
                  name: "weatherfax_navtex",
                  label: "Weatherfax / Navtex",
                  ph: "Yes",
                },
                {
                  name: "charts_guides",
                  label: "Charts / Guides",
                  ph: "Yes",
                },
              ].map((f) => (
                <YachtFieldWrapper
                  key={f.name}
                  label={localizeFieldLabel(f.name, f.label)}
                  yachtId={Number(selectedYachtId)}
                  fieldName={f.name}
                  helpText={resolveFieldHelpText(
                    f.name,
                    localizeFieldLabel(f.name, f.label),
                  )}
                  correctionLabel={fieldCorrectionLabels[f.name]}
                  onCorrectionLabelChange={(label) =>
                    handleFieldCorrectionLabelChange(f.name, label)
                  }
                >
                  {isOptionalTriStateField(f.name) ? (
                    <TriStateSelect
                      name={f.name}
                      defaultValue={selectedYacht?.[f.name]}
                      needsConfirmation={needsConfirm(f.name)}
                      yesLabel={yachtFormText.common.yes}
                      noLabel={yachtFormText.common.no}
                      unknownLabel={yachtFormText.common.unknown}
                      confirmLabel={yachtFormText.common.confirm}
                    />
                  ) : (
                    <Input
                      name={f.name}
                      defaultValue={selectedYacht?.[f.name]}
                      placeholder={f.ph}
                      needsConfirmation={needsConfirm(f.name)}
                    />
                  )}
                </YachtFieldWrapper>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sub-Section: Safety Equipment */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
        {shouldUseDynamicSafetyBlock && safetyConfigBlock ? (
          <ConfigurableBoatFieldBlock
            key={getConfigBlockExpansionKey(
              safetyConfigBlock,
              selectedYacht,
              OPTIONAL_TRI_STATE_FIELDS,
            )}
            block={safetyConfigBlock}
            icon={<Shield size={16} />}
            title={labelText("safetyEquipment", "Safety Equipment")}
            values={selectedYacht}
            yachtId={Number(selectedYachtId)}
            needsConfirm={needsConfirm}
            optionalTriStateFields={OPTIONAL_TRI_STATE_FIELDS}
            correctionLabels={fieldCorrectionLabels}
            onCorrectionLabelChange={handleFieldCorrectionLabelChange}
            yesLabel={(commonText as any)("yes", "Yes")}
            noLabel={(commonText as any)("no", "No")}
            unknownLabel={(commonText as any)("unknown", "Unknown")}
            gridClassName="md:grid-cols-3"
          />
        ) : (
          <>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Shield size={20} className="text-blue-600" />{" "}
              {labelText("safetyEquipment", "Safety Equipment")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {[
                {
                  name: "life_raft",
                  label: "Life Raft",
                  ph: "e.g. Viking 6-person",
                },
                {
                  name: "epirb",
                  label: "EPIRB",
                  ph: "e.g. ACR GlobalFix V4",
                },
                {
                  name: "bilge_pump",
                  label: "Bilge Pump",
                  ph: "e.g. Rule 2000 GPH",
                },
                {
                  name: "bilge_pump_manual",
                  label: "Bilge Pump (Manual)",
                  ph: "Yes",
                },
                {
                  name: "bilge_pump_electric",
                  label: "Bilge Pump (Electric)",
                  ph: "Yes",
                },
                {
                  name: "fire_extinguisher",
                  label: "Fire Extinguisher",
                  ph: "e.g. 2x ABC 2kg",
                },
                {
                  name: "mob_system",
                  label: "MOB System",
                  ph: "e.g. Jonbuoy MK5",
                },
                {
                  name: "life_jackets",
                  label: "Life Jackets",
                  ph: "e.g. 6x Spinlock 150N",
                },
                {
                  name: "radar_reflector",
                  label: "Radar Reflector",
                  ph: "e.g. Echomax EM230",
                },
                {
                  name: "flares",
                  label: "Flares",
                  ph: "e.g. Ikaros set",
                },
                {
                  name: "life_buoy",
                  label: "Life Buoy",
                  ph: "Yes",
                },
                {
                  name: "watertight_door",
                  label: "Watertight Door",
                  ph: "Yes",
                },
                {
                  name: "gas_bottle_locker",
                  label: "Gas Bottle Locker",
                  ph: "Yes",
                },
                {
                  name: "self_draining_cockpit",
                  label: "Self Draining Cockpit",
                  ph: "Yes",
                },
              ].map((f) => (
                <YachtFieldWrapper
                  key={f.name}
                  label={localizeFieldLabel(f.name, f.label)}
                  yachtId={Number(selectedYachtId)}
                  fieldName={f.name}
                  helpText={resolveFieldHelpText(
                    f.name,
                    localizeFieldLabel(f.name, f.label),
                  )}
                  correctionLabel={fieldCorrectionLabels[f.name]}
                  onCorrectionLabelChange={(label) =>
                    handleFieldCorrectionLabelChange(f.name, label)
                  }
                >
                  {isOptionalTriStateField(f.name) ? (
                    <TriStateSelect
                      name={f.name}
                      defaultValue={selectedYacht?.[f.name]}
                      needsConfirmation={needsConfirm(f.name)}
                      yesLabel={yachtFormText.common.yes}
                      noLabel={yachtFormText.common.no}
                      unknownLabel={yachtFormText.common.unknown}
                      confirmLabel={yachtFormText.common.confirm}
                    />
                  ) : (
                    <Input
                      name={f.name}
                      defaultValue={selectedYacht?.[f.name]}
                      placeholder={f.ph}
                      needsConfirmation={needsConfirm(f.name)}
                    />
                  )}
                </YachtFieldWrapper>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sub-Section: Electrical System */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
        {shouldUseDynamicElectricalBlock && electricalConfigBlock ? (
          <ConfigurableBoatFieldBlock
            key={getConfigBlockExpansionKey(
              electricalConfigBlock,
              selectedYacht,
              OPTIONAL_TRI_STATE_FIELDS,
            )}
            block={electricalConfigBlock}
            icon={<Zap size={16} />}
            title={sectionText("electricalSystem", "Electrical System")}
            values={selectedYacht}
            yachtId={Number(selectedYachtId)}
            needsConfirm={needsConfirm}
            optionalTriStateFields={OPTIONAL_TRI_STATE_FIELDS}
            correctionLabels={fieldCorrectionLabels}
            onCorrectionLabelChange={handleFieldCorrectionLabelChange}
            yesLabel={(commonText as any)("yes", "Yes")}
            noLabel={(commonText as any)("no", "No")}
            unknownLabel={(commonText as any)("unknown", "Unknown")}
            gridClassName="md:grid-cols-3"
          />
        ) : (
          <>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Zap size={20} className="text-blue-600" />{" "}
              {sectionText("electricalSystem", "Electrical System")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {[
                {
                  name: "battery",
                  label: labelText("battery", "Batteries"),
                  ph: placeholderText(
                    "battery",
                    "e.g. 4x 12V 125Ah AGM",
                  ),
                },
                {
                  name: "battery_charger",
                  label: labelText("batteryCharger", "Battery Charger"),
                  ph: placeholderText(
                    "batteryCharger",
                    "e.g. Victron Blue Smart 30A",
                  ),
                },
                {
                  name: "generator",
                  label: labelText("generator", "Generator"),
                  ph: placeholderText("generator", "e.g. Onan 9kW"),
                },
                {
                  name: "inverter",
                  label: labelText("inverter", "Inverter"),
                  ph: placeholderText(
                    "inverter",
                    "e.g. Victron Phoenix 3000W",
                  ),
                },
                {
                  name: "shorepower",
                  label: labelText("shorepower", "Shorepower"),
                  ph: placeholderText("shorepower", "e.g. 230V 16A"),
                },
                {
                  name: "solar_panel",
                  label: labelText("solarPanel", "Solar Panel"),
                  ph: placeholderText(
                    "solarPanel",
                    "e.g. 2x 100W flexible",
                  ),
                },
                {
                  name: "wind_generator",
                  label: labelText("windGenerator", "Wind Generator"),
                  ph: placeholderText(
                    "windGenerator",
                    "e.g. Silentwind 400+",
                  ),
                },
                {
                  name: "voltage",
                  label: labelText("voltage", "Voltage"),
                  ph: placeholderText("voltage", "e.g. 12V / 230V"),
                },
                {
                  name: "dynamo",
                  label: labelText("dynamo", "Dynamo"),
                  ph: yachtFormText.common.yes,
                },
                {
                  name: "accumonitor",
                  label: labelText("accumonitor", "Accumonitor"),
                  ph: yachtFormText.common.yes,
                },
                {
                  name: "voltmeter",
                  label: labelText("voltmeter", "Voltmeter"),
                  ph: yachtFormText.common.yes,
                },
                {
                  name: "shore_power_cable",
                  label: labelText(
                    "shorePowerCable",
                    "Shore Power Cable",
                  ),
                  ph: yachtFormText.common.yes,
                },
                {
                  name: "consumption_monitor",
                  label: labelText(
                    "consumptionMonitor",
                    "Consumption Monitor",
                  ),
                  ph: yachtFormText.common.yes,
                },
                {
                  name: "control_panel",
                  label: labelText("controlPanel", "Control Panel"),
                  ph: yachtFormText.common.yes,
                },
                {
                  name: "fuel_tank_gauge",
                  label: labelText("fuelTankGauge", "Fuel Tank Gauge"),
                  ph: yachtFormText.common.yes,
                },
                {
                  name: "tachometer",
                  label: labelText("tachometer", "Tachometer"),
                  ph: yachtFormText.common.yes,
                },
                {
                  name: "oil_pressure_gauge",
                  label: labelText(
                    "oilPressureGauge",
                    "Oil Pressure Gauge",
                  ),
                  ph: yachtFormText.common.yes,
                },
                {
                  name: "temperature_gauge",
                  label: labelText(
                    "temperatureGauge",
                    "Temperature Gauge",
                  ),
                  ph: yachtFormText.common.yes,
                },
              ].map((f) => (
                <YachtFieldWrapper
                  key={f.name}
                  label={localizeFieldLabel(f.name, f.label)}
                  yachtId={Number(selectedYachtId)}
                  fieldName={f.name}
                  helpText={resolveFieldHelpText(
                    f.name,
                    localizeFieldLabel(f.name, f.label),
                  )}
                  correctionLabel={fieldCorrectionLabels[f.name]}
                  onCorrectionLabelChange={(label) =>
                    handleFieldCorrectionLabelChange(f.name, label)
                  }
                >
                  {isOptionalTriStateField(f.name) ? (
                    <TriStateSelect
                      name={f.name}
                      defaultValue={selectedYacht?.[f.name]}
                      needsConfirmation={needsConfirm(f.name)}
                      yesLabel={yachtFormText.common.yes}
                      noLabel={yachtFormText.common.no}
                      unknownLabel={yachtFormText.common.unknown}
                      confirmLabel={yachtFormText.common.confirm}
                    />
                  ) : (
                    <Input
                      name={f.name}
                      defaultValue={selectedYacht?.[f.name]}
                      placeholder={f.ph}
                      needsConfirmation={needsConfirm(f.name)}
                    />
                  )}
                </YachtFieldWrapper>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sub-Section: Kitchen & Comfort */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
        {shouldUseDynamicComfortBlock && comfortConfigBlock ? (
          <ConfigurableBoatFieldBlock
            key={getConfigBlockExpansionKey(
              comfortConfigBlock,
              selectedYacht,
              OPTIONAL_TRI_STATE_FIELDS,
            )}
            block={comfortConfigBlock}
            icon={<Box size={16} />}
            title={sectionText("kitchenComfort", "Kitchen & Comfort")}
            values={selectedYacht}
            yachtId={Number(selectedYachtId)}
            needsConfirm={needsConfirm}
            optionalTriStateFields={OPTIONAL_TRI_STATE_FIELDS}
            correctionLabels={fieldCorrectionLabels}
            onCorrectionLabelChange={handleFieldCorrectionLabelChange}
            yesLabel={(commonText as any)("yes", "Yes")}
            noLabel={(commonText as any)("no", "No")}
            unknownLabel={(commonText as any)("unknown", "Unknown")}
            gridClassName="md:grid-cols-3"
          />
        ) : (
          <>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Box size={20} className="text-blue-600" />{" "}
              {sectionText("kitchenComfort", "Kitchen & Comfort")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {[
                {
                  name: "oven",
                  label: labelText("oven", "Oven"),
                  ph: "e.g. Force 10 gas oven",
                },
                {
                  name: "microwave",
                  label: labelText("microwave", "Microwave"),
                  ph: "e.g. Samsung 23L",
                },
                {
                  name: "fridge",
                  label: labelText("fridge", "Fridge"),
                  ph: "e.g. Isotherm Cruise 130L",
                },
                {
                  name: "freezer",
                  label: labelText("freezer", "Freezer"),
                  ph: "e.g. Isotherm 65L top-loading",
                },
                {
                  name: "cooker",
                  label: labelText("cooker", "Cooker"),
                  ph: "e.g. 4-burner gas",
                },
                {
                  name: "television",
                  label: labelText("television", "Television"),
                  ph: placeholderText(
                    "television",
                    'e.g. Samsung 32" Smart TV',
                  ),
                },
                {
                  name: "cd_player",
                  label: labelText("cdPlayer", "Radio / CD Player"),
                  ph: placeholderText(
                    "cdPlayer",
                    "e.g. Fusion MS-RA770",
                  ),
                },
                {
                  name: "dvd_player",
                  label: labelText("dvdPlayer", "DVD Player"),
                  ph: placeholderText(
                    "dvdPlayer",
                    "e.g. Sony DVP-SR210P",
                  ),
                },
                {
                  name: "satellite_reception",
                  label: labelText(
                    "satelliteReception",
                    "Satellite Reception",
                  ),
                  ph: placeholderText(
                    "satelliteReception",
                    "e.g. KVH TracVision TV5",
                  ),
                },
                {
                  name: "water_tank",
                  label: labelText("waterTank", "Water Tank"),
                  ph: placeholderText("waterTank", "200L"),
                },
                {
                  name: "water_tank_gauge",
                  label: labelText(
                    "waterTankGauge",
                    "Water Tank Gauge",
                  ),
                  ph: placeholderText("waterTankGauge", "Yes"),
                },
                {
                  name: "water_maker",
                  label: labelText("waterMaker", "Water Maker"),
                  ph: placeholderText("waterMaker", "60 L/h"),
                },
                {
                  name: "waste_water_tank",
                  label: labelText(
                    "wasteWaterTank",
                    "Waste Water Tank",
                  ),
                  ph: placeholderText("wasteWaterTank", "80L"),
                },
                {
                  name: "waste_water_tank_gauge",
                  label: labelText(
                    "wasteWaterGauge",
                    "Waste Water Gauge",
                  ),
                  ph: placeholderText("wasteWaterGauge", "Yes"),
                },
                {
                  name: "waste_water_tank_drainpump",
                  label: labelText(
                    "wasteTankDrainPump",
                    "Waste Tank Drain Pump",
                  ),
                  ph: placeholderText("wasteTankDrainPump", "Yes"),
                },
                {
                  name: "deck_suction",
                  label: labelText("deckSuction", "Deck Suction"),
                  ph: placeholderText("deckSuction", "Yes"),
                },
                {
                  name: "water_system",
                  label: labelText("waterSystem", "Water System"),
                  ph: placeholderText("waterSystem", "Pressurized"),
                },
                {
                  name: "hot_water",
                  label: labelText("hotWater", "Hot Water"),
                  ph: placeholderText("hotWater", "Boiler"),
                },
                {
                  name: "sea_water_pump",
                  label: labelText("seaWaterPump", "Sea Water Pump"),
                  ph: placeholderText("seaWaterPump", "Yes"),
                },
                {
                  name: "deck_wash_pump",
                  label: labelText("deckWashPump", "Deck Wash Pump"),
                  ph: yachtFormText.common.yes,
                },
                {
                  name: "deck_shower",
                  label: labelText("deckShower", "Deck Shower"),
                  ph: yachtFormText.common.yes,
                },
                {
                  name: "hot_air",
                  label: labelText("hotAir", "Hot Air Heating"),
                  ph: placeholderText("hotAir", "Yes"),
                },
                {
                  name: "stove",
                  label: labelText("stove", "Stove Heating"),
                  ph: placeholderText("stove", "Yes"),
                },
                {
                  name: "central_heating",
                  label: labelText("centralHeating", "Central Heating"),
                  ph: placeholderText("centralHeating", "Yes"),
                },
              ].map((f) => (
                <div key={f.name} className="space-y-1 group">
                  <FieldLabel
                    label={f.label}
                    helpText={resolveFieldHelpText(f.name, f.label)}
                  />
                  <Input
                    name={f.name}
                    defaultValue={selectedYacht?.[f.name]}
                    needsConfirmation={needsConfirm(f.name)}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sub-Section: Deck Equipment */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
        {shouldUseDynamicDeckBlock && deckConfigBlock ? (
          <ConfigurableBoatFieldBlock
            key={getConfigBlockExpansionKey(
              deckConfigBlock,
              selectedYacht,
              OPTIONAL_TRI_STATE_FIELDS,
            )}
            block={deckConfigBlock}
            icon={<Anchor size={16} />}
            title={labelText("deckEquipment", "Deck Equipment")}
            values={selectedYacht}
            yachtId={Number(selectedYachtId)}
            needsConfirm={needsConfirm}
            optionalTriStateFields={OPTIONAL_TRI_STATE_FIELDS}
            correctionLabels={fieldCorrectionLabels}
            onCorrectionLabelChange={handleFieldCorrectionLabelChange}
            yesLabel={(commonText as any)("yes", "Yes")}
            noLabel={(commonText as any)("no", "No")}
            unknownLabel={(commonText as any)("unknown", "Unknown")}
            gridClassName="md:grid-cols-3"
          />
        ) : (
          <>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Anchor size={20} className="text-blue-600" />{" "}
              {labelText("deckEquipment", "Deck Equipment")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {[
                {
                  name: "anchor",
                  label: "Anchor",
                  ph: "e.g. 2x Bruce 25kg + 50m chain",
                },
                {
                  name: "bow_thruster",
                  label: "Bow Thruster",
                  ph: "yes / no / unknown",
                },
                {
                  name: "anchor_winch",
                  label: "Anchor Winch",
                  ph: "e.g. Lofrans Tigres 1500W",
                },
                {
                  name: "spray_hood",
                  label: "Spray Hood",
                  ph: "e.g. Sunbrella fabric",
                },
                {
                  name: "bimini",
                  label: "Bimini",
                  ph: "e.g. Stainless frame + canvas",
                },
                {
                  name: "swimming_platform",
                  label: "Swimming Platform",
                  ph: "e.g. Teak with ladder",
                },
                {
                  name: "swimming_ladder",
                  label: "Swimming Ladder",
                  ph: "e.g. 4-step stainless",
                },
                {
                  name: "teak_deck",
                  label: "Teak Deck",
                  ph: "e.g. Burmese teak",
                },
                {
                  name: "cockpit_table",
                  label: "Cockpit Table",
                  ph: "e.g. Folding teak",
                },
                {
                  name: "dinghy",
                  label: "Dinghy",
                  ph: "e.g. Highfield CL310 RIB",
                },
                {
                  name: "trailer",
                  label: "Trailer",
                  ph: "yes / no / unknown",
                },
                {
                  name: "covers",
                  label: "Covers",
                  ph: "e.g. Full winter cover",
                },
                {
                  name: "fenders",
                  label: "Fenders & Lines",
                  ph: "e.g. 6x Polyform F4",
                },
                {
                  name: "anchor_connection",
                  label: "Anchor Connection",
                  ph: "Chain / Rope",
                },
                {
                  name: "stern_anchor",
                  label: "Stern Anchor",
                  ph: "Yes",
                },
                {
                  name: "spud_pole",
                  label: "Spud Pole",
                  ph: "Yes",
                },
                {
                  name: "cockpit_tent",
                  label: "Cockpit Tent",
                  ph: "Yes",
                },
                {
                  name: "outdoor_cushions",
                  label: extraLabelText(
                    "outdoorCushions",
                    "Outdoor Cushions",
                  ),
                  ph: "Yes",
                },
                {
                  name: "sea_rails",
                  label: "Sea Rails",
                  ph: "Yes",
                },
                {
                  name: "pushpit_pullpit",
                  label: "Pushpit / Pullpit",
                  ph: "Yes",
                },
                {
                  name: "sail_lowering_system",
                  label: "Sail Lowering System",
                  ph: "Yes",
                },
                {
                  name: "crutch",
                  label: "Crutch (Schaar)",
                  ph: "Yes",
                },
                {
                  name: "dinghy_brand",
                  label: "Dinghy Brand",
                  ph: "Yes",
                },
                {
                  name: "outboard_engine",
                  label: "Outboard Engine",
                  ph: "Yes",
                },
                {
                  name: "crane",
                  label: "Crane",
                  ph: "Yes",
                },
                {
                  name: "davits",
                  label: "Davits",
                  ph: "Yes",
                },
              ].map((f) => (
                <YachtFieldWrapper
                  key={f.name}
                  label={localizeFieldLabel(f.name, f.label)}
                  yachtId={Number(selectedYachtId)}
                  fieldName={f.name}
                  helpText={resolveFieldHelpText(
                    f.name,
                    localizeFieldLabel(f.name, f.label),
                  )}
                  correctionLabel={fieldCorrectionLabels[f.name]}
                  onCorrectionLabelChange={(label) =>
                    handleFieldCorrectionLabelChange(f.name, label)
                  }
                >
                  {isOptionalTriStateField(f.name) ? (
                    <TriStateSelect
                      name={f.name}
                      defaultValue={selectedYacht?.[f.name]}
                      needsConfirmation={needsConfirm(f.name)}
                      yesLabel={yachtFormText.common.yes}
                      noLabel={yachtFormText.common.no}
                      unknownLabel={yachtFormText.common.unknown}
                      confirmLabel={yachtFormText.common.confirm}
                    />
                  ) : (
                    <Input
                      name={f.name}
                      defaultValue={selectedYacht?.[f.name]}
                      placeholder={f.ph}
                      needsConfirmation={needsConfirm(f.name)}
                    />
                  )}
                </YachtFieldWrapper>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sub-Section: Rigging & Sails */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
        {shouldUseDynamicRiggingBlock && riggingConfigBlock ? (
          <ConfigurableBoatFieldBlock
            key={getConfigBlockExpansionKey(
              riggingConfigBlock,
              selectedYacht,
              OPTIONAL_TRI_STATE_FIELDS,
            )}
            block={riggingConfigBlock}
            icon={<Wind size={16} />}
            title={labelText("riggingSails", "Rigging & Sails")}
            values={selectedYacht}
            yachtId={Number(selectedYachtId)}
            needsConfirm={needsConfirm}
            optionalTriStateFields={OPTIONAL_TRI_STATE_FIELDS}
            correctionLabels={fieldCorrectionLabels}
            onCorrectionLabelChange={handleFieldCorrectionLabelChange}
            yesLabel={(commonText as any)("yes", "Yes")}
            noLabel={(commonText as any)("no", "No")}
            unknownLabel={(commonText as any)("unknown", "Unknown")}
            gridClassName="md:grid-cols-3"
          />
        ) : (
          <>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Wind size={20} className="text-blue-600" />{" "}
              {labelText("riggingSails", "Rigging & Sails")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {[
                {
                  name: "sailplan_type",
                  label: "Sailplan Type",
                  ph: "e.g. Sloop / Cutter / Ketch",
                },
                {
                  name: "number_of_masts",
                  label: "Number of Masts",
                  ph: "e.g. 1 / 2",
                },
                {
                  name: "spars_material",
                  label: "Spars Material",
                  ph: "e.g. Aluminum / Carbon",
                },
                { name: "bowsprit", label: "Bowsprit", ph: "Yes / No" },
                {
                  name: "standing_rig",
                  label: "Standing Rig",
                  ph: "e.g. SS Wire / Rod",
                },
                {
                  name: "main_sail",
                  label: "Main Sail",
                  ph: "Yes / No",
                },
                {
                  name: "furling_mainsail",
                  label: "Furling Mainsail",
                  ph: "Yes / No",
                },
                { name: "jib", label: "Jib", ph: "Yes / No" },
                { name: "genoa", label: "Genoa", ph: "Yes / No" },
                {
                  name: "spinnaker",
                  label: "Spinnaker",
                  ph: "Yes / No",
                },
                { name: "gennaker", label: "Gennaker", ph: "Yes / No" },
                { name: "mizzen", label: "Mizzen", ph: "Yes / No" },
                { name: "winches", label: "Winches", ph: "Yes" },
                {
                  name: "electric_winches",
                  label: "Electric Winches",
                  ph: "Yes",
                },
                {
                  name: "manual_winches",
                  label: "Manual Winches",
                  ph: "Yes",
                },
              ].map((f) => (
                <YachtFieldWrapper
                  key={f.name}
                  label={localizeFieldLabel(f.name, f.label)}
                  yachtId={Number(selectedYachtId)}
                  fieldName={f.name}
                  helpText={resolveFieldHelpText(
                    f.name,
                    localizeFieldLabel(f.name, f.label),
                  )}
                  correctionLabel={fieldCorrectionLabels[f.name]}
                  onCorrectionLabelChange={(label) =>
                    handleFieldCorrectionLabelChange(f.name, label)
                  }
                >
                  {isOptionalTriStateField(f.name) ? (
                    <TriStateSelect
                      name={f.name}
                      defaultValue={selectedYacht?.[f.name]}
                      needsConfirmation={needsConfirm(f.name)}
                      yesLabel={yachtFormText.common.yes}
                      noLabel={yachtFormText.common.no}
                      unknownLabel={yachtFormText.common.unknown}
                      confirmLabel={yachtFormText.common.confirm}
                    />
                  ) : (
                    <Input
                      name={f.name}
                      defaultValue={selectedYacht?.[f.name]}
                      placeholder={f.ph}
                      needsConfirmation={needsConfirm(f.name)}
                    />
                  )}
                </YachtFieldWrapper>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sub-Section: Registry & Comments */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
          <FileText size={20} className="text-blue-600" />{" "}
          {labelText("registryComments", "Registry & Comments")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1 group">
            <FieldLabel
              label={labelText("ownerComment", "Owner's Comment")}
              fieldName="owners_comment"
              helpText={resolveFieldHelpText(
                "owners_comment",
                labelText("ownerComment", "Owner's Comment"),
                "textarea",
              )}
            />
            <textarea
              name="owners_comment"
              defaultValue={selectedYacht?.owners_comment || ""}
              className="w-full bg-white border border-slate-200 rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none h-24"
            />
          </div>
          <div className="space-y-1 group">
            <FieldLabel
              label={labelText("knownDefects", "Known Defects")}
              fieldName="known_defects"
              helpText={resolveFieldHelpText(
                "known_defects",
                labelText("knownDefects", "Known Defects"),
                "textarea",
              )}
            />
            <textarea
              name="known_defects"
              defaultValue={selectedYacht?.known_defects || ""}
              className="w-full bg-white border border-slate-200 rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none h-24"
            />
          </div>
          <div className="space-y-1 group">
            <FieldLabel
              label={labelText(
                "registrationDetails",
                "Registration Details",
              )}
              helpText={resolveFieldHelpText(
                "reg_details",
                labelText(
                  "registrationDetails",
                  "Registration Details",
                ),
              )}
            />
            <Input
              name="reg_details"
              defaultValue={selectedYacht?.reg_details}
              needsConfirmation={needsConfirm("reg_details")}
            />
          </div>
          <div className="space-y-1 group">
            <FieldLabel
              label={labelText("lastServiced", "Last Serviced")}
              helpText={resolveFieldHelpText(
                "last_serviced",
                labelText("lastServiced", "Last Serviced"),
              )}
            />
            <Input
              name="last_serviced"
              defaultValue={selectedYacht?.last_serviced}
              needsConfirmation={needsConfirm("last_serviced")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
