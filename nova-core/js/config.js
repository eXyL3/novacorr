import { fmt } from './utils.js';

// Gold upgrades — reset on prestige. desc() receives the computed stats object.
// cat: which shop tab the upgrade lives in (offense / tactical / core).
export const UPGRADES = [
  // ----- OFFENSE -----
  { id: 'damage',    cat: 'offense', icon: '⚔', name: 'Damage',     baseCost: 15,  growth: 1.31, max: 999,
    desc: (s) => `${fmt(s.damage)} per bullet` },
  { id: 'firerate',  cat: 'offense', icon: '⚡', name: 'Fire Rate',  baseCost: 25,  growth: 1.40, max: 30,
    desc: (s) => `${s.fireRate.toFixed(1)} shots/sec` },
  { id: 'multishot', cat: 'offense', icon: '🔱', name: 'Multishot',  baseCost: 400, growth: 5.5,  max: 5,
    desc: (s) => `${s.multishot} projectiles` },
  { id: 'pierce',    cat: 'offense', icon: '➳', name: 'Pierce',     baseCost: 150, growth: 3.2,  max: 6,
    desc: (s) => `Pierces ${s.pierce} extra ${s.pierce === 1 ? 'enemy' : 'enemies'}` },
  { id: 'crit',      cat: 'offense', icon: '✦', name: 'Critical',   baseCost: 80,  growth: 1.65, max: 18,
    desc: (s) => `${Math.round(s.critChance * 100)}% crit chance` },
  { id: 'critdmg',   cat: 'offense', icon: '☠', name: 'Lethality',  baseCost: 120, growth: 1.75, max: 8,
    desc: (s) => `×${s.critMult.toFixed(1)} crit damage` },
  { id: 'bounce',    cat: 'offense', icon: '⤾', name: 'Ricochet',   baseCost: 350, growth: 4.0,  max: 4,
    desc: (s) => `Bullets bounce ${s.bounces}× to new targets` },
  { id: 'explosive', cat: 'offense', icon: '🧨', name: 'Explosive',  baseCost: 300, growth: 2.6,  max: 8,
    desc: (s) => `${Math.round(s.explosionPct * 100)}% AoE in ${Math.round(s.explosionRadius)}px` },

  // ----- TACTICAL -----
  { id: 'frost',     cat: 'tactical', icon: '❄', name: 'Cryo Rounds', baseCost: 130, growth: 1.9, max: 6,
    desc: (s) => `Hits slow enemies ${Math.round(s.frostSlow * 100)}% for 2s` },
  { id: 'knockback', cat: 'tactical', icon: '🌀', name: 'Knockback',   baseCost: 40,  growth: 1.5, max: 999,
    desc: (s) => `${fmt(s.knockback)} impact force` },
  { id: 'blast',     cat: 'tactical', icon: '💥', name: 'Nova Blast',  baseCost: 60,  growth: 1.6, max: 999,
    desc: (s) => `${fmt(s.blastDamage)} dmg • ${Math.round(s.blastRadius)}px • ${s.blastCooldown.toFixed(1)}s` },
  { id: 'repulsor',  cat: 'tactical', icon: '◎', name: 'Repulsor',    baseCost: 180, growth: 2.0, max: 8,
    desc: (s) => `${Math.round(s.repulsorRadius)}px aura • ${fmt(s.repulsorDps)} dmg/s` },
  { id: 'orbital',   cat: 'tactical', icon: '☄', name: 'Orbitals',    baseCost: 250, growth: 4.5, max: 8,
    desc: (s) => `${s.orbitals} orbiting ${s.orbitals === 1 ? 'blade' : 'blades'}` },
  { id: 'turret',    cat: 'tactical', icon: '🗼', name: 'Turrets',     baseCost: 600, growth: 5.0, max: 4,
    desc: (s) => `${s.turrets} auto-${s.turrets === 1 ? 'turret' : 'turrets'}` },
  { id: 'singularity', cat: 'tactical', icon: '🌑', name: 'Singularity', baseCost: 800, growth: 2.4, max: 8,
    desc: (s) => s.singLvl === 0
      ? 'Unlock: black hole that drags enemies in'
      : `${s.singDuration.toFixed(1)}s pull • ${fmt(s.singDps)} dmg/s • ${Math.round(s.singCooldown)}s cd` },
  { id: 'overdrive', cat: 'tactical', icon: '🔥', name: 'Overdrive', baseCost: 800, growth: 2.4, max: 8,
    desc: (s) => s.odLvl === 0
      ? 'Unlock: temporary fire-rate frenzy'
      : `×${s.odMult.toFixed(1)} fire rate for ${s.odDuration.toFixed(1)}s • ${Math.round(s.odCooldown)}s cd` },

  // ----- CORE -----
  { id: 'corehp',    cat: 'core', icon: '🛡', name: 'Core HP',  baseCost: 50,  growth: 1.55, max: 999,
    desc: (s) => `${fmt(s.coreMaxHp)} max HP` },
  { id: 'regen',     cat: 'core', icon: '♻', name: 'Regen',    baseCost: 90,  growth: 1.7,  max: 999,
    desc: (s) => `${s.regen.toFixed(1)} HP/sec` },
  { id: 'shield',    cat: 'core', icon: '🔰', name: 'Aegis',    baseCost: 220, growth: 1.7,  max: 999,
    desc: (s) => `${fmt(s.shieldMax)} shield, recharges after 6s calm` },
  { id: 'lifesteal', cat: 'core', icon: '🩸', name: 'Leech',    baseCost: 200, growth: 2.2,  max: 5,
    desc: (s) => `Kills heal ${(s.lifesteal * 100).toFixed(1)}% core HP` },
  { id: 'gold',      cat: 'core', icon: '🜚', name: 'Greed',    baseCost: 100, growth: 1.8,  max: 999,
    desc: (s) => `×${s.goldMult.toFixed(2)} gold from kills` },
  { id: 'battery',   cat: 'core', icon: '🔋', name: 'Reactor',  baseCost: 150, growth: 1.9,  max: 10,
    desc: (s) => `+${s.batteryLvl * 2} gold/s, scales with wave` },
  { id: 'drone',     cat: 'core', icon: '🛸', name: 'Drone',    baseCost: 1500, growth: 6.0, max: 2,
    desc: (s) => s.drones === 0
      ? 'Companion drone: shoots & fetches power-ups'
      : `${s.drones} ${s.drones === 1 ? 'drone' : 'drones'} fighting & fetching` },
];

// Shard upgrades — permanent across prestiges. desc() receives the level.
export const SHARD_UPGRADES = [
  { id: 'power',     icon: '⚔', name: 'Power',      baseCost: 3,  growth: 1.9, max: 999,
    desc: (l) => `+${l * 25}% all damage` },
  { id: 'wealth',    icon: '🜚', name: 'Wealth',     baseCost: 3,  growth: 1.9, max: 999,
    desc: (l) => `+${l * 25}% gold` },
  { id: 'vitality',  icon: '🛡', name: 'Vitality',   baseCost: 2,  growth: 1.8, max: 999,
    desc: (l) => `+${l * 40}% core HP & shield, +${l * 50}% regen` },
  { id: 'overclock', icon: '⚙', name: 'Overclock',  baseCost: 5,  growth: 2.0, max: 10,
    desc: (l) => `+${l * 10}% fire rate, +${l * 8}% bullet speed` },
  { id: 'headstart', icon: '⏩', name: 'Head Start', baseCost: 4,  growth: 2.2, max: 10,
    desc: (l) => `Start at wave ${1 + l * 2}` },
  { id: 'autoblast', icon: '🤖', name: 'Auto-Nova',  baseCost: 12, growth: 1.0, max: 1,
    desc: (l) => (l > 0 ? 'Nova Blast fires itself at clusters' : 'Unlock self-firing Nova Blast') },
];

// Run-only evolutions — pick 1 of 3 every 5 waves. Most stack.
export const PERKS = [
  { id: 'adrenaline',  icon: '⚡', name: 'Adrenaline',   desc: '+25% fire rate' },
  { id: 'heavy',       icon: '⚔', name: 'Heavy Rounds', desc: '+35% damage' },
  { id: 'glass',       icon: '💎', name: 'Glass Cannon', desc: '+60% damage, −25% core HP' },
  { id: 'vampiric',    icon: '🩸', name: 'Vampiric',     desc: 'Kills heal +0.5% core HP' },
  { id: 'cluster',     icon: '🧨', name: 'Cluster Bombs', desc: '+15% explosive AoE damage' },
  { id: 'chain',       icon: '⤾', name: 'Chain Shot',   desc: '+1 ricochet bounce' },
  { id: 'stasis',      icon: '❄', name: 'Stasis Field', desc: '+10% slow on every hit' },
  { id: 'bulwark',     icon: '🛡', name: 'Bulwark',      desc: '+40% core HP & shield' },
  { id: 'magnet',      icon: '🜚', name: 'Gold Magnet',  desc: '+30% gold' },
  { id: 'swift',       icon: '💨', name: 'Swift Death',  desc: '+20% bullet speed, +10% fire rate' },
  { id: 'twin',        icon: '☄', name: 'Twin Moons',   desc: '+1 orbital blade' },
  { id: 'sentry',      icon: '🗼', name: 'Sentry',       desc: '+1 auto-turret' },
  { id: 'novasurge',   icon: '💥', name: 'Nova Surge',   desc: 'Blast +50% damage, −15% cooldown' },
  { id: 'executioner', icon: '☠', name: 'Executioner',  desc: 'Enemies under 10% HP die instantly', once: true },
  { id: 'momentum',    icon: '🌀', name: 'Momentum',     desc: '+50% knockback' },
  { id: 'secondwind',  icon: '💖', name: 'Second Wind',  desc: 'Restore 50% core HP right now' },
  { id: 'reactive',    icon: '⛨', name: 'Reactive Plating', desc: 'Getting hit emits a damaging shockwave' },
  { id: 'frostnova',   icon: '🧊', name: 'Frost Nova',   desc: 'Shield break freezes nearby enemies', once: true },
  { id: 'bounty',      icon: '⏱', name: 'Bounty Hunter', desc: 'Combo window +1.5s' },
  { id: 'overcharge',  icon: '⚡', name: 'Overcharge',   desc: 'Ultimate charges 25% faster' },
  { id: 'mirror',      icon: '🪞', name: 'Mirror Rounds', desc: 'Bullets bounce off screen edges' },
];

// Deployable structures — placed on the field, cost scales with wave gold.
// costU is in "grunt gold units" so prices stay relevant forever.
export const BUILDINGS = {
  mine:    { icon: '💣', name: 'Mine',    costU: 6,  limit: 6 },
  tesla:   { icon: '⚡', name: 'Tesla',   costU: 20, limit: 3 },
  barrier: { icon: '⬣', name: 'Barrier', costU: 10, limit: 4 },
};

// Per-wave mini-objectives. live ones complete mid-wave, end ones are judged at wave clear.
export const BOUNTIES = [
  { id: 'blastkills', minWave: 2, live: true, target: (w) => 6 + Math.floor(w / 3) },
  { id: 'fling',      minWave: 3, live: true, target: () => 3 },
  { id: 'pickups',    minWave: 5, live: true, target: (w) => (w < 12 ? 1 : 2) },
  { id: 'combo',      minWave: 4, live: true, target: (w) => 12 + w },
  { id: 'nodamage',   minWave: 2, end: true,  shard: true },
  { id: 'speed',      minWave: 3, end: true,  shard: true, target: () => 35 },
];

// Core classes — pick one per run on the rebuild screen. Unlock with shards.
export const CLASSES = [
  { id: 'assault', icon: '🎯', name: 'Assault', cost: 0,
    desc: '+10% damage. Reliable.' },
  { id: 'cryo',    icon: '❄', name: 'Cryo',    cost: 15,
    desc: 'Bullets always slow 15%. +20% blast radius.' },
  { id: 'pyro',    icon: '🔥', name: 'Pyro',    cost: 25,
    desc: 'Bullets always explode (25% AoE). −10% fire rate.' },
  { id: 'vampire', icon: '🦇', name: 'Vampire', cost: 40,
    desc: 'Kills heal 0.6% HP. +50% regen. −15% core HP.' },
];

// Artifacts — rare boss drops, equip up to 3. Duplicates convert to shards.
export const ARTIFACTS = [
  { id: 'magnet', icon: '🧲', name: 'Magnet Coil',    rarity: 'common', desc: '+50% power-up drop chance' },
  { id: 'gilded', icon: '🪙', name: 'Gilded Husk',    rarity: 'common', desc: '+10% gold' },
  { id: 'flux',   icon: '⚙', name: 'Flux Capacitor', rarity: 'common', desc: '+8% fire rate' },
  { id: 'titan',  icon: '🗿', name: 'Titan Plate',    rarity: 'common', desc: '+15% core HP' },
  { id: 'razor',  icon: '🌀', name: 'Razor Halo',     rarity: 'rare',   desc: 'Orbitals deal +25% damage' },
  { id: 'echo',   icon: '🔮', name: 'Echo Crystal',   rarity: 'rare',   desc: 'Nova Blast echoes at 40% power' },
  { id: 'fang',   icon: '🦷', name: 'Vampire Fang',   rarity: 'rare',   desc: '+0.4% lifesteal' },
  { id: 'storm',  icon: '🌩', name: 'Storm Eye',      rarity: 'epic',   desc: 'Bullets 5% chance to chain lightning' },
  { id: 'chrono', icon: '⏳', name: 'Chrono Shard',   rarity: 'epic',   desc: 'Ability cooldowns −15%' },
  { id: 'forge',  icon: '⭐', name: 'Star Forge',     rarity: 'epic',   desc: '+1 multishot' },
];

export const RARITY = {
  common: { weight: 60, color: '#9ab0c8', dupShards: 2 },
  rare:   { weight: 30, color: '#7df9ff', dupShards: 4 },
  epic:   { weight: 10, color: '#c77dff', dupShards: 8 },
};

// Research tree — permanent, bought with ⚛ Tech Points (1/wave clear, 5/boss).
// Each node requires the previous node in its branch.
export const TECH_TREE = [
  // OFFENSE
  { id: 'bal1',       branch: 'offense', name: 'Ballistics I',    icon: '⚔', cost: 5,   req: null,          desc: '+10% damage' },
  { id: 'rapid',      branch: 'offense', name: 'Rapid Loaders',   icon: '⚡', cost: 10,  req: 'bal1',        desc: '+8% fire rate' },
  { id: 'bal2',       branch: 'offense', name: 'Ballistics II',   icon: '⚔', cost: 20,  req: 'rapid',       desc: '+15% damage' },
  { id: 'penetrator', branch: 'offense', name: 'Penetrators',     icon: '➳', cost: 35,  req: 'bal2',        desc: '+1 pierce' },
  { id: 'critsys',    branch: 'offense', name: 'Crit Systems',    icon: '✦', cost: 55,  req: 'penetrator',  desc: '+5% crit chance' },
  { id: 'bal3',       branch: 'offense', name: 'Ballistics III',  icon: '⚔', cost: 85,  req: 'critsys',     desc: '+20% damage' },
  { id: 'twinbarrel', branch: 'offense', name: 'Twin Barrels',    icon: '🔱', cost: 140, req: 'bal3',        desc: '+1 multishot' },
  { id: 'annihilate', branch: 'offense', name: 'Annihilation',    icon: '☠', cost: 240, req: 'twinbarrel',  desc: '+25% damage, +10% crit damage' },
  // DEFENSE
  { id: 'plat1',      branch: 'defense', name: 'Plating I',       icon: '🛡', cost: 5,   req: null,          desc: '+15% core HP' },
  { id: 'coils',      branch: 'defense', name: 'Field Coils',     icon: '🔰', cost: 10,  req: 'plat1',       desc: '+20% shield' },
  { id: 'nano',       branch: 'defense', name: 'Nano Repair',     icon: '♻', cost: 20,  req: 'coils',       desc: '+25% regen' },
  { id: 'plat2',      branch: 'defense', name: 'Plating II',      icon: '🛡', cost: 35,  req: 'nano',        desc: '+20% core HP' },
  { id: 'deflector',  branch: 'defense', name: 'Deflectors',      icon: '⛨', cost: 55,  req: 'plat2',       desc: '5% damage reduction' },
  { id: 'vent',       branch: 'defense', name: 'Emergency Vent',  icon: '💨', cost: 85,  req: 'deflector',   desc: 'Shield recharges 2s sooner' },
  { id: 'plat3',      branch: 'defense', name: 'Plating III',     icon: '🛡', cost: 140, req: 'vent',        desc: '+25% core HP' },
  { id: 'fortress',   branch: 'defense', name: 'Fortress',        icon: '🏰', cost: 240, req: 'plat3',       desc: '+10% DR, barriers +50% HP' },
  // UTILITY
  { id: 'eco1',       branch: 'utility', name: 'Economics I',     icon: '🜚', cost: 5,   req: null,          desc: '+10% gold' },
  { id: 'salvaging',  branch: 'utility', name: 'Salvaging',       icon: '🔩', cost: 10,  req: 'eco1',        desc: '+20% scrap from salvage' },
  { id: 'magnetics',  branch: 'utility', name: 'Magnetics',       icon: '🧲', cost: 20,  req: 'salvaging',   desc: '+15% power-up drops' },
  { id: 'eco2',       branch: 'utility', name: 'Economics II',    icon: '🜚', cost: 35,  req: 'magnetics',   desc: '+15% gold' },
  { id: 'logistics',  branch: 'utility', name: 'Logistics',       icon: '📦', cost: 55,  req: 'eco2',        desc: 'Buildings cost −20%' },
  { id: 'overclock2', branch: 'utility', name: 'Overclocking',    icon: '⚙', cost: 85,  req: 'logistics',   desc: 'Ability cooldowns −10%' },
  { id: 'eco3',       branch: 'utility', name: 'Economics III',   icon: '🜚', cost: 140, req: 'overclock2',  desc: '+20% gold' },
  { id: 'singeng',    branch: 'utility', name: 'Singularity Engine', icon: '🌌', cost: 240, req: 'eco3',     desc: 'Ultimate charges 20% faster' },
];

export const TECH_BRANCHES = [
  { id: 'offense', name: 'OFFENSE', color: '#ff6b6b' },
  { id: 'defense', name: 'DEFENSE', color: '#4dff88' },
  { id: 'utility', name: 'UTILITY', color: '#7df9ff' },
];

// ---- gear / inventory ----

export const GEAR_SLOTS = {
  weapon: { icon: '⚔', name: 'Weapon', mods: ['dmg', 'fr', 'crit', 'critd', 'pspd'],
    names: ['Pulse Cannon', 'Rail Driver', 'Nova Lance', 'Ion Repeater'] },
  armor:  { icon: '🛡', name: 'Armor',  mods: ['hp', 'regen', 'shield', 'dr'],
    names: ['Hull Plating', 'Aegis Frame', 'Bastion Shell', 'Ward Lattice'] },
  engine: { icon: '⚙', name: 'Engine', mods: ['gold', 'drop', 'cdr', 'scrap'],
    names: ['Fusion Engine', 'Warp Drive', 'Flux Reactor', 'Ion Turbine'] },
  chip:   { icon: '💾', name: 'Chip',   mods: ['combo', 'kb', 'blast', 'orb', 'ult'],
    names: ['Logic Chip', 'Quantum Chip', 'Neuro Core', 'Helix Module'] },
};

export const GEAR_MODS = {
  dmg:    { label: 'Damage',           min: 5,   max: 9,   pct: true },
  fr:     { label: 'Fire rate',        min: 3,   max: 6,   pct: true },
  crit:   { label: 'Crit chance',      min: 2,   max: 4,   pct: true },
  critd:  { label: 'Crit damage',      min: 8,   max: 15,  pct: true },
  pspd:   { label: 'Bullet speed',     min: 4,   max: 8,   pct: true },
  hp:     { label: 'Core HP',          min: 6,   max: 12,  pct: true },
  regen:  { label: 'Regen',            min: 8,   max: 16,  pct: true },
  shield: { label: 'Shield',           min: 8,   max: 16,  pct: true },
  dr:     { label: 'Damage reduction', min: 1,   max: 3,   pct: true },
  gold:   { label: 'Gold',             min: 4,   max: 9,   pct: true },
  drop:   { label: 'Drop chance',      min: 6,   max: 14,  pct: true },
  cdr:    { label: 'Cooldowns',        min: 2,   max: 5,   pct: true },
  scrap:  { label: 'Scrap find',       min: 5,   max: 12,  pct: true },
  combo:  { label: 'Combo window',     min: 0.1, max: 0.3, pct: false },
  kb:     { label: 'Knockback',        min: 6,   max: 14,  pct: true },
  blast:  { label: 'Blast damage',     min: 6,   max: 14,  pct: true },
  orb:    { label: 'Orbital damage',   min: 8,   max: 16,  pct: true },
  ult:    { label: 'Ult charge',       min: 4,   max: 10,  pct: true },
};

export const GEAR_RARITY = {
  common:    { weight: 55, mult: 1,   stats: 1, color: '#9ab0c8', prefix: '',          salvage: 2 },
  rare:      { weight: 28, mult: 1.4, stats: 2, color: '#7df9ff', prefix: 'Refined ',  salvage: 5 },
  epic:      { weight: 13, mult: 1.9, stats: 2, color: '#c77dff', prefix: 'Quantum ',  salvage: 12 },
  legendary: { weight: 4,  mult: 2.6, stats: 3, color: '#ffd24d', prefix: 'Celestial ', salvage: 30 },
};

export const GEAR_CAP = 30;

// Random world events — fire every ~50-90s from wave 5.
export const WORLD_EVENTS = [
  { id: 'meteor',    name: '☄ METEOR STORM' },
  { id: 'flare',     name: '☀ SOLAR FLARE' },
  { id: 'lucky',     name: '🍀 LUCKY STARS' },
  { id: 'gravstorm', name: '🌪 GRAVITY STORM' },
];

// Lifetime achievements — each pays out shards once.
export const ACHIEVEMENTS = [
  { id: 'kills100', name: 'First Blood',    desc: 'Destroy 100 enemies',        reward: 2,  check: (g) => g.life.kills >= 100 },
  { id: 'kills2k',  name: 'Slayer',         desc: 'Destroy 2,000 enemies',      reward: 5,  check: (g) => g.life.kills >= 2000 },
  { id: 'kills10k', name: 'Legion Ender',   desc: 'Destroy 10,000 enemies',     reward: 12, check: (g) => g.life.kills >= 10000 },
  { id: 'wave10',   name: 'Survivor',       desc: 'Reach wave 10',              reward: 3,  check: (g) => g.bestWave >= 10 },
  { id: 'wave20',   name: 'Veteran',        desc: 'Reach wave 20',              reward: 6,  check: (g) => g.bestWave >= 20 },
  { id: 'wave30',   name: 'Warlord',        desc: 'Reach wave 30',              reward: 10, check: (g) => g.bestWave >= 30 },
  { id: 'wave50',   name: 'Ascendant',      desc: 'Reach wave 50',              reward: 25, check: (g) => g.bestWave >= 50 },
  { id: 'combo25',  name: 'Chain Reaction', desc: 'Hit a ×25 combo',            reward: 4,  check: (g) => g.life.maxCombo >= 25 },
  { id: 'combo60',  name: 'Unstoppable',    desc: 'Hit a ×60 combo',            reward: 10, check: (g) => g.life.maxCombo >= 60 },
  { id: 'rich',     name: 'Hoarder',        desc: 'Hold 100K gold at once',     reward: 6,  check: (g) => g.life.maxGold >= 100000 },
  { id: 'boss10',   name: 'Giant Slayer',   desc: 'Destroy 10 bosses',          reward: 8,  check: (g) => g.life.bossKills >= 10 },
  { id: 'ult1',     name: 'Supernova',      desc: 'Unleash the Ultimate',       reward: 3,  check: (g) => g.life.ults >= 1 },
  { id: 'runs5',    name: 'Phoenix',        desc: 'Rebuild the core 5 times',   reward: 6,  check: (g) => g.life.runs >= 5 },
  { id: 'perk6',    name: 'Evolved',        desc: 'Hold 6 perks in one run',    reward: 6,
    check: (g) => Object.values(g.perks).reduce((a, b) => a + b, 0) >= 6 },
];

// Core color themes — unlocked by best wave reached.
export const THEMES = [
  { id: 'nova',    name: 'Nova Cyan', need: 0,  rgb: [125, 249, 255] },
  { id: 'aurum',   name: 'Aurum',     need: 10, rgb: [255, 210, 77] },
  { id: 'crimson', name: 'Crimson',   need: 20, rgb: [255, 90, 110] },
  { id: 'emerald', name: 'Emerald',   need: 30, rgb: [77, 255, 136] },
  { id: 'void',    name: 'Void',      need: 40, rgb: [199, 125, 255] },
  { id: 'prism',   name: 'Prism',     need: 50, rgb: null }, // cycles hue
];

// Battlefield power-up drops.
export const PICKUPS = {
  gold:   { icon: '🜚', color: '#ffd24d', weight: 30 },
  heal:   { icon: '✚', color: '#4dff88', weight: 20 },
  frenzy: { icon: '⚡', color: '#ff9d3d', weight: 20 },
  freeze: { icon: '❄', color: '#7df9ff', weight: 15 },
  quad:   { icon: '✦', color: '#c77dff', weight: 15 },
};

export const BOSS_VARIANTS = [
  { id: 'goliath', name: 'GOLIATH' },
  { id: 'widow',   name: 'THE WIDOW' },
  { id: 'phantom', name: 'PHANTOM KING' },
];

// Wave modifiers — 35% chance from wave 6 on.
export const MUTATORS = [
  { id: 'frenzy',   name: '⚡ FRENZY',    spdM: 1.4,  hpM: 1,    goldM: 1.3, countM: 1 },
  { id: 'horde',    name: '👥 HORDE',     spdM: 1,    hpM: 0.55, goldM: 0.8, countM: 1.8 },
  { id: 'titans',   name: '🗿 TITANS',    spdM: 0.85, hpM: 3,    goldM: 2.5, countM: 0.5 },
  { id: 'goldrush', name: '💰 GOLD RUSH', spdM: 1.1,  hpM: 1,    goldM: 2,   countM: 1 },
];

export const ENEMY_TYPES = {
  grunt:    { r: 11, hp: 1,    speed: 55,  gold: 1,   dmg: 1,   mass: 1,   sides: 0, color: '#ff5a5a' },
  runner:   { r: 8,  hp: 0.45, speed: 115, gold: 0.8, dmg: 0.6, mass: 0.6, sides: 3, color: '#ffb13d' },
  tank:     { r: 19, hp: 4.5,  speed: 30,  gold: 3.2, dmg: 2.5, mass: 4,   sides: 6, color: '#c44dff' },
  splitter: { r: 14, hp: 1.6,  speed: 48,  gold: 1.5, dmg: 1.2, mass: 1.4, sides: 4, color: '#4dff88' },
  mini:     { r: 7,  hp: 0.35, speed: 85,  gold: 0.4, dmg: 0.5, mass: 0.5, sides: 4, color: '#4dff88' },
  armored:  { r: 16, hp: 2.2,  speed: 34,  gold: 2.8, dmg: 1.8, mass: 3,   sides: 5, color: '#9ab0c8', dr: 0.5 },
  wraith:   { r: 10, hp: 0.8,  speed: 95,  gold: 1.6, dmg: 1,   mass: 0.8, sides: 3, color: '#a8c8ff', wob: 1.2 },
  spitter:  { r: 12, hp: 1.2,  speed: 60,  gold: 2.4, dmg: 1.5, mass: 1.2, sides: 5, color: '#ffe14d', range: 230, fireCd: 3 },
  boss:     { r: 36, hp: 35,   speed: 20,  gold: 40,  dmg: 10,  mass: 12,  sides: 8, color: '#ff3df0', kbResist: 0.85, fireCd: 4 },
};

export const CORE_R = 26;
