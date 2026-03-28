export type ThemeName = 'hookah' | 'midnight' | 'jade'

export const THEMES = {
  hookah: {
    name: 'Hookah',
    emoji: '🪔',
    bg: 'radial-gradient(ellipse at 30% 20%, #1a0c03 0%, #0a0800 60%, #000 100%)',
    bgSolid: '#0a0800',
    gold: '#d4aa50',
    goldDim: '#a07830',
    goldGlow: 'rgba(212,170,80,0.4)',
    panel: 'rgba(22,16,4,0.92)',
    panelBorder: 'rgba(212,170,80,0.22)',
    text: '#f2e2b0',
    textSub: '#c8a86a',
    smoke: 'rgba(201,168,76,0.055)',
  },
  midnight: {
    name: 'Midnight',
    emoji: '🌙',
    bg: 'radial-gradient(ellipse at 30% 20%, #0a0318 0%, #060012 60%, #000 100%)',
    bgSolid: '#060012',
    gold: '#b090f0',
    goldDim: '#7058b0',
    goldGlow: 'rgba(176,144,240,0.4)',
    panel: 'rgba(10,4,24,0.92)',
    panelBorder: 'rgba(176,144,240,0.22)',
    text: '#eae0ff',
    textSub: '#b8a8e0',
    smoke: 'rgba(155,127,232,0.055)',
  },
  jade: {
    name: 'Jade',
    emoji: '🍃',
    bg: 'radial-gradient(ellipse at 30% 20%, #011a0a 0%, #000e05 60%, #000 100%)',
    bgSolid: '#000e05',
    gold: '#5ec47a',
    goldDim: '#2e8048',
    goldGlow: 'rgba(94,196,122,0.4)',
    panel: 'rgba(0,18,8,0.92)',
    panelBorder: 'rgba(94,196,122,0.22)',
    text: '#d8f0e0',
    textSub: '#96d0aa',
    smoke: 'rgba(76,173,110,0.055)',
  },
}

export function getTheme(name: ThemeName) {
  return THEMES[name] || THEMES.hookah
}
