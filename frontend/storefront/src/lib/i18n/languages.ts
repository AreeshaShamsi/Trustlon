/**
 * Languages the storefront offers, the same set as large Indian marketplaces. To add one: add it
 * here, add the value to the Language enum in the API (auth.prisma), and add a dictionary file.
 */
export const LANGUAGES = [
  { code: 'en', api: 'EN', name: 'English', native: 'English', sample: 'Shop with confidence' },
  { code: 'hi', api: 'HI', name: 'Hindi', native: 'हिन्दी', sample: 'भरोसे के साथ खरीदारी करें' },
  { code: 'bn', api: 'BN', name: 'Bengali', native: 'বাংলা', sample: 'নিশ্চিন্তে কেনাকাটা করুন' },
  { code: 'mr', api: 'MR', name: 'Marathi', native: 'मराठी', sample: 'विश्वासाने खरेदी करा' },
  { code: 'ta', api: 'TA', name: 'Tamil', native: 'தமிழ்', sample: 'நம்பிக்கையுடன் வாங்குங்கள்' },
  { code: 'te', api: 'TE', name: 'Telugu', native: 'తెలుగు', sample: 'నమ్మకంతో షాపింగ్ చేయండి' },
  { code: 'kn', api: 'KN', name: 'Kannada', native: 'ಕನ್ನಡ', sample: 'ವಿಶ್ವಾಸದಿಂದ ಖರೀದಿಸಿ' },
  { code: 'ml', api: 'ML', name: 'Malayalam', native: 'മലയാളം', sample: 'വിശ്വാസത്തോടെ വാങ്ങൂ' },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];
export type ApiLanguage = (typeof LANGUAGES)[number]['api'];

export const isLanguage = (value: string): value is Language =>
  LANGUAGES.some((language) => language.code === value);

export const toApiLanguage = (language: Language): ApiLanguage =>
  LANGUAGES.find((l) => l.code === language)!.api;

export const fromApiLanguage = (api: string): Language =>
  LANGUAGES.find((l) => l.api === api)?.code ?? 'en';
