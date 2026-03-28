export type ThemeName = 'hookah' | 'midnight' | 'jade'

export const THEMES = {
  hookah: {
    name: 'Hookah',
    emoji: '🪔',
    bg: 'radial-gradient(ellipse at 30% 20%, #1a0c03 0%, #0a0800 60%, #000 100%)',
    bgSolid: '#0a0800',
    gold: '#c9a84c',
    goldDim: '#7a6020',
    goldGlow: 'rgba(201,168,76,0.35)',
    panel: 'rgba(18,14,4,0.88)',
    panelBorder: 'rgba(201,168,76,0.18)',
    text: '#e8d5a3',
    smoke: 'rgba(201,168,76,0.055)',
  },
  midnight: {
    name: 'Midnight',
    emoji: '🌙',
    bg: 'radial-gradient(ellipse at 30% 20%, #0a0318 0%, #060012 60%, #000 100%)',
    bgSolid: '#060012',
    gold: '#9b7fe8',
    goldDim: '#4a3880',
    goldGlow: 'rgba(155,127,232,0.35)',
    panel: 'rgba(6,0,18,0.9)',
    panelBorder: 'rgba(155,127,232,0.18)',
    text: '#d4c8f0',
    smoke: 'rgba(155,127,232,0.055)',
  },
  jade: {
    name: 'Jade',
    emoji: '🍃',
    bg: 'radial-gradient(ellipse at 30% 20%, #011a0a 0%, #000e05 60%, #000 100%)',
    bgSolid: '#000e05',
    gold: '#4cad6e',
    goldDim: '#1e5c35',
    goldGlow: 'rgba(76,173,110,0.35)',
    panel: 'rgba(0,14,5,0.9)',
    panelBorder: 'rgba(76,173,110,0.18)',
    text: '#c8e8d0',
    smoke: 'rgba(76,173,110,0.055)',
  },
}

export function getTheme(name: ThemeName) {
  return THEMES[name] || THEMES.hookah
}
