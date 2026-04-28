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

  const placesLibraryRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  useEffect(() => {
    let active = true;
    const initPlaces = async () => {
      if (typeof window !== "undefined" && (window as any).google?.maps?.importLibrary) {
        try {
          const lib = (await (window as any).google.maps.importLibrary("places")) as any;
          if (active) {
            placesLibraryRef.current = lib;
            sessionTokenRef.current = new lib.AutocompleteSessionToken();
          }
        } catch (error) {
          console.error("Failed to load places library", error);
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
      !placesLibraryRef.current ||
      !internalValue ||
      internalValue === value
    ) {
      setSuggestions([]);
      return;
    }

    const { AutocompleteSuggestion } = placesLibraryRef.current;

    const fetchTimer = setTimeout(async () => {
      try {
        setLoading(true);
        const request = {
          input: internalValue,
          sessionToken: sessionTokenRef.current,
        };
        const { suggestions: results } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        setSuggestions(results || []);
        setShowDropdown(true);
      } catch (error) {
        console.error("Autocomplete fetch error", error);
      } finally {
        setLoading(false);
      }
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

  const handleSelect = async (suggestion: any) => {
    setShowDropdown(false);

    const textContext =
      suggestion.placePrediction?.text?.text ||
      suggestion.placePrediction?.mainText?.text;
    if (!textContext) return;

    setInternalValue(textContext);
    if (onChange) onChange(textContext);

    if (!placesLibraryRef.current || !onSelectPlace) return;

    try {
      const { Place } = placesLibraryRef.current;
      const placeId = suggestion.placePrediction.placeId;
      const place = new Place({ id: placeId });

      await place.fetchFields({
        fields: ["location", "displayName", "formattedAddress", "addressComponents"],
      });

      let city = place.displayName;
      place.addressComponents?.forEach((component: any) => {
        if (component.types.includes("locality")) {
          city = component.longText;
        }
      });

      // Renew session token
      sessionTokenRef.current = new (
        placesLibraryRef.current as any
      ).AutocompleteSessionToken();

      onSelectPlace({
        lat: place.location.lat(),
        lng: place.location.lng(),
        city: city || textContext,
        formattedAddress: place.formattedAddress || textContext,
        placeId: placeId,
      });
    } catch (e) {
      console.error("Error fetching place details", e);
    }
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
            const placeId = suggestion.placePrediction?.placeId;
            const mainText = suggestion.placePrediction?.mainText?.text;
            const secondaryText = suggestion.placePrediction?.secondaryText?.text;

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
