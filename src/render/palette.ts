// ENDESGA 32 パレット。画面のすべての色をこの 32 色に限る。
export const P = {
  rust: '#be4a2f',
  orange0: '#d77643',
  sand0: '#ead4aa',
  sand1: '#e4a672',
  sand2: '#b86f50',
  brown0: '#733e39',
  brown1: '#3e2731',
  red0: '#a22633',
  red1: '#e43b44',
  orange1: '#f77622',
  gold0: '#feae34',
  gold1: '#fee761',
  green0: '#63c74d',
  green1: '#3e8948',
  green2: '#265c42',
  teal0: '#193c3e',
  blue0: '#124e89',
  blue1: '#0099db',
  cyan: '#2ce8f5',
  white: '#ffffff',
  gray0: '#c0cbdc',
  gray1: '#8b9bb4',
  gray2: '#5a6988',
  gray3: '#3a4466',
  navy0: '#262b44',
  ink: '#181425',
  hotpink: '#ff0044',
  plum: '#68386c',
  pink0: '#b55088',
  pink1: '#f6757a',
  skin0: '#e8b796',
  skin1: '#c28569',
} as const;

export type CoatKey = 'brown' | 'gray' | 'pale' | 'pup';

/** 毛色ごとの [輪郭, 影, 地, ハイライト] */
export const COATS: Record<CoatKey, { o: string; d: string; b: string; h: string }> = {
  brown: { o: P.ink, d: P.brown1, b: P.brown0, h: P.sand2 },
  gray: { o: P.ink, d: P.navy0, b: P.gray3, h: P.gray2 },
  pale: { o: P.gray3, d: P.gray1, b: P.gray0, h: P.white },
  pup: { o: P.ink, d: P.ink, b: P.navy0, h: P.gray3 },
};
