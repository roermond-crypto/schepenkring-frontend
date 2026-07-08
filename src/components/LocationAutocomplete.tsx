"use client";
import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, MapPin } from "lucide-react";

interface LocationAutocompleteProps {
  value?: string;
  onChange?: (value: string) => void;
  onSelectPlace?: (place: {
    lat: number;
    lng: number;
    city: string;
    formattedAddress: string;
    placeId: string;
  }) => void;
  placeholder?: string;
  className?: string;
}

export function LocationAutocomplete({
  value = "",
  onChange,
  onSelectPlace,
  placeholder = "Search location...",
  className,
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [internalValue, setInternalValue] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  // Uses the legacy google.maps.places JS surface (AutocompleteService +
  // PlacesService), not the newer Places API (New) fetchAutocompleteSuggestions
  // surface — the Google Cloud project only has the legacy Places API
  // enabled, so the newer surface fails silently. Two other working
  // implementations in this codebase (LocationFormPage.tsx, BoatIntakePage.tsx)
  // already rely on this same legacy surface.
  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  useEffect(() => {
    let active = true;
    const initPlaces = () => {
      const google = typeof window !== "undefined" ? (window as any).google : undefined;
      if (google?.maps?.places) {
        if (active) {
          autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
          placesServiceRef.current = new google.maps.places.PlacesService(
            document.createElement("div"),
          );
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        }
      } else {
        setTimeout(initPlaces, 500);
      }
    };
    initPlaces();
    return () => {
      active = false;
    };
  }, []);

  // Debounced search
  useEffect(() => {
    if (
      !autocompleteServiceRef.current ||
      !internalValue ||
      internalValue === value
    ) {
      setSuggestions([]);
      return;
    }

    const fetchTimer = setTimeout(() => {
      setLoading(true);
      autocompleteServiceRef.current.getPlacePredictions(
        { input: internalValue, sessionToken: sessionTokenRef.current },
        (predictions: any[] | null, status: string) => {
          setLoading(false);
          if (status !== "OK" || !predictions) {
            setSuggestions([]);
            return;
          }
          setSuggestions(predictions);
          setShowDropdown(true);
        },
      );
    }, 300);

    return () => clearTimeout(fetchTimer);
  }, [internalValue, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (suggestion: any) => {
    setShowDropdown(false);

    const textContext = suggestion.description;
    if (!textContext) return;

    setInternalValue(textContext);
    if (onChange) onChange(textContext);

    const placeId = suggestion.place_id;
    if (!placesServiceRef.current || !onSelectPlace || !placeId) return;

    placesServiceRef.current.getDetails(
      {
        placeId,
        fields: ["geometry", "name", "formatted_address", "address_components"],
        sessionToken: sessionTokenRef.current,
      },
      (place: any, status: string) => {
        if (status !== "OK" || !place) {
          console.error("Error fetching place details", status);
          return;
        }

        let city = place.name;
        place.address_components?.forEach((component: any) => {
          if (component.types.includes("locality")) {
            city = component.long_name;
          }
        });

        // Renew session token
        const google = (window as any).google;
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();

        onSelectPlace({
          lat: place.geometry?.location?.lat() ?? 0,
          lng: place.geometry?.location?.lng() ?? 0,
          city: city || textContext,
          formattedAddress: place.formatted_address || textContext,
          placeId,
        });
      },
    );
  };

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
        <Search className="h-4 w-4 text-slate-400" />
      </div>
      <Input
        ref={inputRef}
        type="text"
        className={`pl-10 relative bg-white border-slate-200 text-slate-800 focus:ring-amber-300 focus:border-amber-300 ${
          className || ""
        }`}
        placeholder={placeholder}
        value={internalValue}
        onChange={(e) => {
          setInternalValue(e.target.value);
          onChange?.(e.target.value);
          if (!e.target.value) setShowDropdown(false);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setShowDropdown(true);
        }}
      />
      {loading && internalValue && internalValue !== value && (
        <div className="absolute inset-y-0 right-3 flex items-center">
          <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
        </div>
      )}

      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {suggestions.map((suggestion, idx) => {
            const placeId = suggestion.place_id;
            const mainText =
              suggestion.structured_formatting?.main_text ?? suggestion.description;
            const secondaryText = suggestion.structured_formatting?.secondary_text;

            return (
              <div
                key={placeId || idx}
                onClick={() => handleSelect(suggestion)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
              >
                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500">
                  <MapPin size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">
                    {mainText}
                  </div>
                  {secondaryText && (
                    <div className="text-xs text-slate-500 truncate">
                      {secondaryText}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
