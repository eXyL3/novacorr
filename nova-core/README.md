# NOVA CORE — incremental physics tower defense

Your core sits in the center of the arena. Enemies swarm in from every direction.
Survive waves, earn gold, buy upgrades, and when the core finally falls, convert
your run into **Core Shards** — permanent upgrades that make the next run stronger.

## How to run

ES modules need a local server (opening the file directly won't work):

```
python -m http.server 8377
```

Then open **http://localhost:8377/nova-core/** — works on desktop and mobile
(open it from your phone via your PC's LAN IP, e.g. `http://192.168.x.x:8377/nova-core/`).

## How to play

- The core auto-fires at the nearest enemy. You don't aim — you **build**.
- **Tap / click anywhere** to fire a Nova Blast: AoE damage + a physics shockwave
  that hurls enemies away. Watch the outer ring around the core for its cooldown.
- Use the **1×/2×/3× button** to speed up time, **⏸** to pause, **⚙** for
  settings (shake, damage numbers, effects quality, reset).
- Open **▲ UPGRADES** at the bottom — 20 upgrades across three tabs
  (OFFENSE / TACTICAL / CORE), with ×1 / ×10 / MAX buying. Highlights:
  ricochet, explosive rounds, cryo slow, repulsor aura, orbitals, turrets,
  the rechargeable Aegis shield, leech, and a passive-income reactor.
- **Surges**: red warning arrows mean a swarm is about to burst in from one
  direction. Bosses enrage as they bleed, and dropping below 30% core HP
  triggers slow-motion.
- **Evolution drafts**: every 5 waves, pick 1 of 3 run-only perks (Glass
  Cannon, Executioner, Second Wind...). Each run builds differently.
- **Wave mutators**: ⚡ FRENZY, 👥 HORDE, 🗿 TITANS and 💰 GOLD RUSH waves
  shake up the rhythm from wave 6 on.
- **Active abilities** (bottom-left buttons, or keys 1/2; space fires the
  blast at the densest cluster): 🌑 Singularity drags enemies into a black
  hole that detonates; 🔥 Overdrive multiplies fire rate for a few seconds.
  Unlock and level both in the TACTICAL tab.
- **Spitters** (yellow pentagons, wave 11+) hold range and shell your core —
  bosses fire volleys too. Your Nova Blast clears incoming fire.
- **Power-up drops**: enemies occasionally drop pickups that drift to your core
  — gold caches, heals, ⚡ Frenzy (fire rate), ❄ Freeze (stops everything),
  ✦ 3× damage. Bosses always drop one.
- **⚡ Ultimate**: kills charge the top ability button; at 100% unleash a
  screen-wide nuke (key 3).
- **Named bosses**: GOLIATH (brute force), THE WIDOW (births minions),
  PHANTOM KING (teleports) — rotating every 10 waves.
- **🏆 Achievements**: 14 lifetime goals that pay out shards once each.
- **Core themes**: new core colors unlock at best-wave milestones (Aurum at 10,
  Crimson at 20... Prism at 50) — switch in settings.
- **Grab & fling**: press directly ON an enemy and drag — it follows your
  finger on a spring. Release to hurl it; high-speed impacts damage both the
  projectile-enemy and whatever it crashes into. (Don't drag them into your
  own core.)
- **World events** (random, from wave 5): ☄ METEOR STORM rains friendly
  meteors, ☀ SOLAR FLARE burns every enemy, 🍀 LUCKY STARS drops pickups,
  🌪 GRAVITY STORM scrambles enemy movement.
- **🛸 Drone** (CORE tab): a wingman that auto-fetches power-ups and shoots.
- **Mirror Rounds perk**: your bullets ricochet off the screen edges.
- **Deployables** (bottom-right bar): arm a 💣 Mine, ⚡ Tesla pylon, or ⬣
  Barrier, then tap the field to place it. Mines explode, teslas zap for 30s,
  barriers physically block enemies until chewed down.
- **★ Wave bounties**: every wave sets a mini-objective (blast-kills,
  fling-kills, no-damage, speed clear...) for a big gold payout — the hard
  ones pay shards.
- **Core classes** (rebuild screen): Assault, Cryo, Pyro, Vampire — unlock
  with shards, each warps your whole build.
- **🎒 Artifacts**: bosses drop collectible artifacts (common/rare/epic).
  Equip up to 3 for powerful passives; duplicates convert to shards.
- **Offline earnings**: your core keeps earning while you're away (8h cap),
  and a **daily reward streak** pays shards every day you return.
- Enemies have mass: tanks barely flinch, runners go flying. They shove each
  other around, splitters burst into minis, armored foes resist damage, wraiths
  zigzag and phase, elites appear from wave 12, and every 10th wave brings a boss.
- **Kill combos**: chain kills within 2.5s for up to +50% bonus gold.
- When the core is destroyed (or you press **☠** to sacrifice early), you earn
  shards based on the wave reached and spend them on permanent upgrades —
  including Overclock (fire rate) and Auto-Nova (the blast fires itself).

Progress auto-saves to localStorage every few seconds.

## Files

```
index.html       page shell + HUD/shop/overlay DOM
css/style.css    all styling (mobile-friendly, safe-area aware)
js/main.js       bootstrap, canvas sizing, game loop, input
js/game.js       game state, physics, combat, waves, prestige, saving
js/render.js     all canvas drawing (glow, particles, shake)
js/ui.js         HUD, upgrade shop, banners, game-over screen
js/config.js     balance: upgrades, shard upgrades, enemy types
js/particles.js  sparks, shockwave rings, floating numbers, screen shake
js/audio.js      tiny WebAudio synth sound effects (no asset files)
js/utils.js      math + number formatting helpers
```
