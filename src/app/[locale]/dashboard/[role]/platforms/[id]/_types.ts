export interface PlatformCredentials {
  api_key?: string;
  api_secret?: string;
  webhook_url?: string;
  webhook_secret?: string;
  debug_mode?: boolean;
}

export interface PlatformForm {
  id?: number;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string;
  category: string;
  export_method: string;
  feed_url: string;
  api_url: string;
  credentials: PlatformCredentials;
  has_api_secret: boolean;
  has_webhook_secret: boolean;
  is_active: boolean;
  is_openmarine_enabled: boolean;
  openmarine_version: string;
  openmarine_dealer_id: string;
  openmarine_category_map: string;
  supported_countries: string[];
  supported_languages: string[];
  contact_name: string;
  contact_email: string;
  notes: string;
  priority: number;
}

export const MASK_PLACEHOLDER = "__unchanged__";

export const EMPTY_PLATFORM_FORM: PlatformForm = {
  name: "",
  slug: "",
  logo_url: null,
  website_url: "",
  category: "marketplace",
  export_method: "openmarine",
  feed_url: "",
  api_url: "",
  credentials: {},
  has_api_secret: false,
  has_webhook_secret: false,
  is_active: true,
  is_openmarine_enabled: true,
  openmarine_version: "2.0",
  openmarine_dealer_id: "",
  openmarine_category_map: "",
  supported_countries: ["NL"],
  supported_languages: ["nl"],
  contact_name: "",
  contact_email: "",
  notes: "",
  priority: 10,
};

export interface PlatformTabProps {
  form: PlatformForm;
  set: <K extends keyof PlatformForm>(key: K, value: PlatformForm[K]) => void;
}
