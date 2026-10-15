/** Original, unmodified SVG exports from Figma node 48:2301. */
export const assets = {
  profile: 'img24SolidProfileCircle',
  statistics: 'imgVuesaxBoldChartSquare',
  food: 'img24SolidForkKnife',
  steps: 'img24SolidWalking',
  weight: 'img24SolidScales',
  plus: 'img24OutlinePlus',
  smallSteps: 'img24SolidWalking1',
  training: 'img24OutlineDumbbell',
  help: 'imgCircleQuestionMark',
  foodTrack: 'imgTrack',
  activityTrack: 'imgTrack1',
  activityProgress: 'imgProgress',
  waterTrack: 'imgTrack2',
  waterProgress: 'imgProgress1',
  foodProgress: 'imgProgress2',
  foodComplete: 'imgTrack',
  activityComplete: 'imgTrack1',
  waterComplete: 'imgTrack2',
  gradient: 'imgBgGradient',
  batteryCap: 'imgCap',
  wifi: 'imgWifi',
  cellular: 'imgCellularConnection',
  report: 'imgVuesaxBoldChartSquare1',
  calendar: 'img24SolidCalendar',
  calendarDivider: 'imgVector234255998',
  focusFood: 'img24SolidForkKnife1',
  focusWater: 'img24SolidCupWater',
  focusActivity: 'img24SolidFire',
  activity: 'img24SolidFire1',
  activityDivider: 'imgVector234255960',
  water: 'img24SolidCupWater1',
  dropFull: 'imgFrame2147224712',
  dropEmpty: 'imgFrame2147224715',
  sleep: 'img24SolidSleep',
  coach: 'imgTabbarIconChatAi',
} as const;

export type Asset = keyof typeof assets;

/** Local visual variants; original Figma exports stay intact. */
const semanticAssets = new Set<Asset>([
  'food', 'focusFood', 'foodProgress',
  'activity', 'focusActivity', 'activityProgress',
  'water', 'focusWater', 'waterProgress',
  'foodComplete', 'activityComplete', 'waterComplete',
  'steps', 'sleep', 'plus',
]);

/** Changed static exports from the gradient concept (156:3131). */
const conceptAssets = new Set<Asset>(['batteryCap', 'wifi', 'cellular', 'coach', 'calendarDivider', 'activityDivider', 'help']);

export function assetUrl(name: Asset): string {
  const folder = conceptAssets.has(name) ? 'concept-156' : semanticAssets.has(name) ? 'semantic' : 'figma';
  return `${import.meta.env.BASE_URL}assets/${folder}/${assets[name]}.svg`;
}

export function image(name: Asset, className = ''): string {
  return `<img src="${assetUrl(name)}" class="asset ${className}" alt="" draggable="false" data-asset="${name}" />`;
}
