import { TAU, rand, clamp, chance, fmt } from './utils.js';
import { UPGRADES, SHARD_UPGRADES, PERKS, MUTATORS, ENEMY_TYPES, CORE_R, ACHIEVEMENTS, PICKUPS, BOSS_VARIANTS, WORLD_EVENTS, BUILDINGS, BOUNTIES, CLASSES, ARTIFACTS, RARITY, TECH_TREE, GEAR_SLOTS, GEAR_MODS, GEAR_RARITY, GEAR_CAP } from './config.js';
import { Particles } from './particles.js';

const SAVE_KEY = 'novaCoreSave_v1';

export class Game {
  constructor(audio) {
    this.audio = audio;
    this.view = { w: 800, h: 600 };
    this.particles = new Particles();

    this.gold = 0;
    this.shards = 0;
    this.bestWave = 1;
    this.up = {};       // gold upgrade levels (reset on prestige)
    this.shardUp = {};  // shard upgrade levels (permanent)
    this.speed = 1;     // time multiplier: 1, 2 or 3
    this.paused = false;
    this.timeMult = 1;  // slow-mo envelope, read by main loop for particles
    this.opts = { shake: true, dmgText: true, quality: 'high', theme: 'nova' };
    this.life = { kills: 0, bossKills: 0, ults: 0, runs: 0, maxCombo: 0, maxGold: 0 };
    this.ach = {}; // unlocked achievement ids
    this.coreClass = 'assault';
    this.classesOwned = { assault: true };
    this.artifacts = {};  // id -> copies owned
    this.equipped = [];   // up to 3 artifact ids
    this.daily = { last: null, streak: 0 };
    this.offlineEarn = 0; // shown by the welcome popup
    this.dailyShards = 0;
    this.tp = 0;          // ⚛ tech points
    this.tech = {};       // purchased tech node ids
    this.gearInv = [];    // inventory items
    this.gearEq = {};     // slot -> item id
    this.scrap = 0;
    this.nextGearId = 1;

    this.onWave = null;        // (waveNum, isBossWave, mutatorName) => void
    this.onGameOver = null;    // (shardsEarned, sacrificed) => void
    this.onPerkOffer = null;   // (choices: perk defs) => void
    this.onAchievement = null; // (def) => void
    this.onEvent = null;       // (eventName) => void
    this.onArtifact = null;    // (def, isDupe, dupShards) => void
    this.onGear = null;        // (item, autoScrap) => void

    this.load();
    this.welcomeBack();
    this.applyOpts();
    this.startRun(this.savedWave);
  }

  // Offline earnings + daily streak — computed once on boot, surfaced by the UI.
  welcomeBack() {
    const now = Date.now();
    if (this.savedTs && this.savedWave > 1) {
      const away = (now - this.savedTs) / 1000;
      if (away > 90) {
        const capped = Math.min(away, 8 * 3600); // 8h cap
        const waveGold = 4 * Math.pow(1.105, this.savedWave - 1);
        const rate = (this.up.battery || 0) * 2 * Math.pow(1.105, this.savedWave - 1) + 0.6 * waveGold;
        this.offlineEarn = Math.round(capped * rate * 0.5);
        this.gold += this.offlineEarn;
      }
    }
    const today = new Date().toDateString();
    if (this.daily.last !== today) {
      const fresh = !this.savedTs || (now - this.savedTs) < 48 * 3600 * 1000;
      this.daily.streak = this.daily.last && fresh ? Math.min(7, this.daily.streak + 1) : 1;
      this.daily.last = today;
      this.dailyShards = 1 + this.daily.streak;
      this.shards += this.dailyShards;
    }
  }

  // ---------- classes & artifacts ----------

  unlockClass(id) {
    const def = CLASSES.find((c) => c.id === id);
    if (!def || this.classesOwned[id]) return false;
    if (this.shards < def.cost) { this.audio.play('deny'); return false; }
    this.shards -= def.cost;
    this.classesOwned[id] = true;
    this.audio.play('shard');
    this.save();
    return true;
  }

  selectClass(id) {
    if (!this.classesOwned[id]) return false;
    this.coreClass = id;
    this.computeStats();
    this.save();
    return true;
  }

  dropArtifact() {
    let total = 0;
    for (const a of ARTIFACTS) total += RARITY[a.rarity].weight;
    let roll = Math.random() * total;
    let pick = ARTIFACTS[0];
    for (const a of ARTIFACTS) {
      roll -= RARITY[a.rarity].weight;
      if (roll <= 0) { pick = a; break; }
    }
    const had = this.artifacts[pick.id] || 0;
    this.artifacts[pick.id] = had + 1;
    let dupShards = 0;
    if (had > 0) {
      dupShards = RARITY[pick.rarity].dupShards;
      this.shards += dupShards;
    }
    if (this.onArtifact) this.onArtifact(pick, had > 0, dupShards);
    this.audio.play('shard');
    this.save();
  }

  toggleArtifact(id) {
    if (!this.artifacts[id]) return false;
    const i = this.equipped.indexOf(id);
    if (i >= 0) this.equipped.splice(i, 1);
    else if (this.equipped.length < 3) this.equipped.push(id);
    else return false;
    this.computeStats();
    this.save();
    return true;
  }

  applyOpts() {
    this.particles.shakeOn = this.opts.shake;
    this.particles.quality = this.opts.quality === 'low' ? 0.5 : 1;
  }

  // ---------- stats ----------

  computeStats() {
    const l = (id) => this.up[id] || 0;
    const sh = (id) => this.shardUp[id] || 0;
    const p = (id) => this.perks[id] || 0;
    const art = (id) => this.equipped.indexOf(id) >= 0;
    const cls = this.coreClass || 'assault';

    const damage = 8 * Math.pow(1.26, l('damage'))
      * (1 + 0.25 * sh('power'))
      * (1 + 0.35 * p('heavy'))
      * (1 + 0.60 * p('glass'))
      * (cls === 'assault' ? 1.10 : 1);
    const vit = 1 + 0.4 * sh('vitality');
    const bulwark = 1 + 0.4 * p('bulwark');
    const singLvl = l('singularity');
    const odLvl = l('overdrive');

    this.stats = {
      damage,
      fireRate: 1.6 * (1 + 0.10 * l('firerate')) * (1 + 0.10 * sh('overclock'))
        * (1 + 0.25 * p('adrenaline')) * (1 + 0.10 * p('swift'))
        * (art('flux') ? 1.08 : 1) * (cls === 'pyro' ? 0.9 : 1),
      multishot: 1 + l('multishot') + (art('forge') ? 1 : 0),
      pierce: l('pierce'),
      projSpeed: 430 * (1 + 0.08 * sh('overclock')) * (1 + 0.20 * p('swift')),
      critChance: clamp(0.05 + 0.04 * l('crit'), 0, 0.8),
      critMult: 2.5 + 0.5 * l('critdmg'),
      bounces: l('bounce') + p('chain'),
      explosionPct: Math.max(0.20 * l('explosive') + 0.15 * p('cluster'), cls === 'pyro' ? 0.25 : 0),
      explosionRadius: 50 + 8 * l('explosive'),
      frostSlow: Math.min(0.65, Math.max(0.08 * l('frost') + 0.10 * p('stasis'), cls === 'cryo' ? 0.15 : 0)),
      knockback: 140 * (1 + 0.35 * l('knockback')) * (1 + 0.5 * p('momentum')),
      blastDamage: damage * 5 * (1 + 0.35 * l('blast')) * (1 + 0.5 * p('novasurge')),
      blastRadius: (125 + 11 * l('blast')) * (cls === 'cryo' ? 1.2 : 1),
      blastCooldown: Math.max(1.6, (5 - 0.15 * l('blast')) * Math.pow(0.85, p('novasurge')))
        * (art('chrono') ? 0.85 : 1),
      repulsorLvl: l('repulsor'),
      repulsorRadius: 90 + 14 * l('repulsor'),
      repulsorDps: damage * 0.10 * l('repulsor'),
      repulsorForce: 260 + 40 * l('repulsor'),
      coreMaxHp: 120 * Math.pow(1.35, l('corehp')) * vit * bulwark * Math.pow(0.75, p('glass'))
        * (cls === 'vampire' ? 0.85 : 1) * (art('titan') ? 1.15 : 1),
      regen: (1 + 1.5 * l('regen')) * (1 + 0.5 * sh('vitality')) * (cls === 'vampire' ? 1.5 : 1),
      shieldMax: l('shield') > 0 ? 30 * Math.pow(1.4, l('shield') - 1) * vit * bulwark : 0,
      lifesteal: 0.004 * l('lifesteal') + 0.005 * p('vampiric')
        + (cls === 'vampire' ? 0.006 : 0) + (art('fang') ? 0.004 : 0),
      goldMult: (1 + 0.25 * l('gold')) * (1 + 0.25 * sh('wealth')) * (1 + 0.30 * p('magnet'))
        * (art('gilded') ? 1.10 : 1),
      batteryLvl: l('battery'),
      orbitals: l('orbital') + p('twin'),
      turrets: l('turret') + p('sentry'),
      drones: l('drone'),
      mirror: p('mirror'),
      autoBlast: sh('autoblast') > 0,
      cull: p('executioner') > 0,
      // artifact effects
      orbDmg: 0.65 * (art('razor') ? 1.25 : 1),
      blastEcho: art('echo'),
      chainChance: art('storm') ? 0.05 : 0,
      dropMult: art('magnet') ? 1.5 : 1,
      // singularity ability
      singLvl,
      singDuration: 2.5 + 0.25 * singLvl,
      singDps: damage * (0.5 + 0.1 * singLvl),
      singForce: 700 + 80 * singLvl,
      singCooldown: Math.max(12, 24 - singLvl) * (art('chrono') ? 0.85 : 1),
      // overdrive ability
      odLvl,
      odDuration: 4 + 0.4 * odLvl,
      odMult: 2 + 0.15 * odLvl,
      odCooldown: Math.max(15, 30 - 1.2 * odLvl) * (art('chrono') ? 0.85 : 1),
      // ultimate (charged by kills)
      ultNeed: Math.max(20, Math.round(60 * Math.pow(0.75, p('overcharge')))),
      comboWindow: 2.5 + 1.5 * p('bounty'),
      reactive: p('reactive'),
      frostNova: p('frostnova') > 0,
    };
    this.applyMeta();
  }

  // Tech tree + equipped gear apply on top of the computed stats.
  applyMeta() {
    const s = this.stats;
    const t = (id) => (this.tech[id] ? 1 : 0);

    // sum equipped gear modifiers (enhance level adds +8% per step)
    const g = {};
    for (const slot in this.gearEq) {
      const item = this.gearById(this.gearEq[slot]);
      if (!item) continue;
      const enhMult = 1 + 0.08 * (item.enh || 0);
      for (const st of item.stats) {
        g[st.k] = (g[st.k] || 0) + st.v * enhMult;
      }
    }
    const gp = (k) => (g[k] || 0) / 100;

    const dmgF = (1 + 0.10 * t('bal1') + 0.15 * t('bal2') + 0.20 * t('bal3') + 0.25 * t('annihilate'))
      * (1 + gp('dmg'));
    s.damage *= dmgF;
    s.blastDamage *= dmgF * (1 + gp('blast'));
    s.singDps *= dmgF;
    s.repulsorDps *= dmgF;
    s.fireRate *= (1 + 0.08 * t('rapid')) * (1 + gp('fr'));
    s.pierce += t('penetrator');
    s.multishot += t('twinbarrel');
    s.critChance = clamp(s.critChance + 0.05 * t('critsys') + gp('crit'), 0, 0.85);
    s.critMult *= (1 + 0.10 * t('annihilate')) * (1 + gp('critd'));
    s.projSpeed *= 1 + gp('pspd');
    s.coreMaxHp *= (1 + 0.15 * t('plat1') + 0.20 * t('plat2') + 0.25 * t('plat3')) * (1 + gp('hp'));
    s.shieldMax *= (1 + 0.20 * t('coils')) * (1 + gp('shield'));
    s.regen *= (1 + 0.25 * t('nano')) * (1 + gp('regen'));
    s.coreDr = Math.min(0.5, 0.05 * t('deflector') + 0.10 * t('fortress') + gp('dr'));
    s.shieldDelayBase = 6 - 2 * t('vent');
    s.goldMult *= (1 + 0.10 * t('eco1')) * (1 + 0.15 * t('eco2')) * (1 + 0.20 * t('eco3')) * (1 + gp('gold'));
    s.dropMult *= (1 + 0.15 * t('magnetics')) * (1 + gp('drop'));
    const cdr = Math.min(0.5, 0.10 * t('overclock2') + gp('cdr'));
    s.blastCooldown *= 1 - cdr;
    s.singCooldown *= 1 - cdr;
    s.odCooldown *= 1 - cdr;
    s.ultNeed = Math.max(15, Math.round(s.ultNeed * (1 - Math.min(0.5, 0.20 * t('singeng') + gp('ult')))));
    s.comboWindow += g.combo || 0;
    s.knockback *= 1 + gp('kb');
    s.orbDmg *= 1 + gp('orb');
    s.barrierHpMult = 1 + 0.5 * t('fortress');
    s.buildCostMult = 1 - 0.20 * t('logistics');
    s.scrapMult = (1 + 0.20 * t('salvaging')) * (1 + gp('scrap'));
  }

  // ---------- tech tree ----------

  buyTech(id) {
    const def = TECH_TREE.find((n) => n.id === id);
    if (!def || this.tech[id]) return false;
    if (def.req && !this.tech[def.req]) { this.audio.play('deny'); return false; }
    if (this.tp < def.cost) { this.audio.play('deny'); return false; }
    this.tp -= def.cost;
    this.tech[id] = true;
    const oldHp = this.stats.coreMaxHp;
    this.computeStats();
    this.coreHp += Math.max(0, this.stats.coreMaxHp - oldHp);
    this.audio.play('shard');
    this.save();
    return true;
  }

  // ---------- gear / inventory ----------

  gearById(id) {
    return this.gearInv.find((i) => i.id === id) || null;
  }

  dropGear() {
    // weighted rarity roll
    let total = 0;
    for (const k in GEAR_RARITY) total += GEAR_RARITY[k].weight;
    let roll = Math.random() * total;
    let rarity = 'common';
    for (const k in GEAR_RARITY) {
      roll -= GEAR_RARITY[k].weight;
      if (roll <= 0) { rarity = k; break; }
    }
    const slots = Object.keys(GEAR_SLOTS);
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const R = GEAR_RARITY[rarity];
    const pool = GEAR_SLOTS[slot].mods.slice();
    const stats = [];
    for (let i = 0; i < R.stats && pool.length; i++) {
      const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const m = GEAR_MODS[k];
      let v = rand(m.min, m.max) * R.mult * (1 + this.wave * 0.03);
      v = m.pct ? Math.round(v) : Math.min(2, Math.round(v * 10) / 10);
      stats.push({ k, v });
    }
    const names = GEAR_SLOTS[slot].names;
    const item = {
      id: this.nextGearId++,
      slot, rarity,
      lvl: this.wave,
      enh: 0,
      name: R.prefix + names[Math.floor(Math.random() * names.length)],
      stats,
    };
    if (this.gearInv.length >= GEAR_CAP) {
      // inventory full — auto-scrap the find
      const s = Math.round(R.salvage * this.stats.scrapMult);
      this.scrap += s;
      if (this.onGear) this.onGear(item, s);
    } else {
      this.gearInv.push(item);
      if (this.onGear) this.onGear(item, 0);
    }
    this.save();
  }

  equipGear(id) {
    const item = this.gearById(id);
    if (!item) return false;
    this.gearEq[item.slot] = id;
    this.computeStats();
    this.audio.play('buy');
    this.save();
    return true;
  }

  unequipGear(slot) {
    delete this.gearEq[slot];
    this.computeStats();
    this.save();
  }

  salvageGear(id) {
    const idx = this.gearInv.findIndex((i) => i.id === id);
    if (idx < 0) return 0;
    const item = this.gearInv[idx];
    if (this.gearEq[item.slot] === id) delete this.gearEq[item.slot];
    this.gearInv.splice(idx, 1);
    const s = Math.round(GEAR_RARITY[item.rarity].salvage * this.stats.scrapMult * (1 + (item.enh || 0) * 0.5));
    this.scrap += s;
    this.computeStats();
    this.audio.play('kill');
    this.save();
    return s;
  }

  enhanceCost(item) {
    return Math.round(8 * Math.pow(2, item.enh || 0));
  }

  enhanceGear(id) {
    const item = this.gearById(id);
    if (!item || item.enh >= 10) return false;
    const cost = this.enhanceCost(item);
    if (this.scrap < cost) { this.audio.play('deny'); return false; }
    this.scrap -= cost;
    item.enh = (item.enh || 0) + 1;
    this.computeStats();
    this.audio.play('shard');
    this.save();
    return true;
  }

  startWave() {
    return 1 + 2 * (this.shardUp.headstart || 0);
  }

  shardPreview() {
    return Math.floor(Math.pow(this.wave / 3, 1.6));
  }

  spawnRadius() {
    return Math.hypot(this.view.w, this.view.h) / 2 + 60;
  }

  comboMult() {
    return 1 + Math.min(0.5, this.combo * 0.01);
  }

  // ---------- run lifecycle ----------

  startRun(resumeWave) {
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.turretState = [];
    this.orbitalPos = [];
    this.perks = (resumeWave > 0 && this.savedPerks) ? this.savedPerks : {};
    this.perkChoices = null;
    this.nextId = 1;
    this.kills = 0;
    this.time = 0;
    this.fireTimer = 0;
    this.blastTimer = 0;
    this.singTimer = 0;
    this.singActive = null;
    this.odTimer = 0;
    this.odActive = 0;
    this.goldFrac = 0;
    this.combo = 0;
    this.comboT = 0;
    this.muzzle = null;
    this.slowMo = 0;
    this.alarmT = 0;
    this.pickups = [];
    this.frenzyT = 0;
    this.quadT = 0;
    this.ultCharge = 0;
    this.ultFlash = 0;
    this.achT = 2;
    this.grab = null;
    this.meteors = [];
    this.droneState = [];
    this.eventActive = null;
    this.eventTimer = rand(45, 80);
    this.buildings = [];
    this.buildSelect = null; // building type armed for placement
    this.zaps = [];          // tesla lightning flashes for the renderer
    this.echoBlast = null;
    this.computeStats();
    this.coreHp = this.stats.coreMaxHp;
    this.shield = this.stats.shieldMax;
    this.shieldDelay = 0;
    this.state = 'play';
    const sw = this.startWave();
    this.beginWave(Math.max(sw, resumeWave || 0), true);
  }

  beginWave(n, silent = false) {
    this.wave = n;
    if (n > this.bestWave) this.bestWave = n;

    const isBoss = n % 10 === 0 && n > 0;
    this.mutator = null;
    if (n >= 6 && chance(0.35)) {
      const pool = MUTATORS.filter((m) => !(isBoss && m.id === 'titans'));
      this.mutator = pool[Math.floor(Math.random() * pool.length)];
    }
    const mut = this.mutator || { spdM: 1, hpM: 1, goldM: 1, countM: 1 };

    const count = Math.round(Math.min(9 + Math.round(n * 1.8), 55) * mut.countM);
    const q = [];
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      let t = 'grunt';
      if (n >= 3 && r < 0.25) t = 'runner';
      else if (n >= 5 && r >= 0.25 && r < 0.40) t = 'splitter';
      else if (n >= 7 && r >= 0.40 && r < 0.55) t = 'tank';
      else if (n >= 9 && r >= 0.55 && r < 0.65) t = 'armored';
      else if (n >= 13 && r >= 0.65 && r < 0.75) t = 'wraith';
      else if (n >= 11 && r >= 0.75 && r < 0.83) t = 'spitter';
      q.push(t);
    }
    if (isBoss) {
      this.bossVariant = BOSS_VARIANTS[(n / 10 - 1) % BOSS_VARIANTS.length];
      for (let i = 0; i < 1 + Math.floor(n / 30); i++) q.push('boss');
    } else {
      this.bossVariant = null;
    }
    this.queue = q;
    this.waveTotal = q.length;
    this.waveKills = 0;
    // per-wave bounty
    this.blastKillsWave = 0;
    this.flingKillsWave = 0;
    this.pickupsWave = 0;
    this.comboPeakWave = 0;
    this.coreDamagedWave = false;
    this.waveStart = this.time;
    const eligible = BOUNTIES.filter((b) => n >= b.minWave);
    if (eligible.length > 0 && n >= 2) {
      const def = eligible[Math.floor(Math.random() * eligible.length)];
      this.bounty = {
        id: def.id,
        live: !!def.live,
        end: !!def.end,
        shard: !!def.shard,
        target: def.target ? def.target(n) : 0,
        prog: 0,
        done: false,
      };
    } else {
      this.bounty = null;
    }
    this.surges = n >= 4 ? 1 + Math.floor(n / 12) : 0;
    this.surgeTimer = rand(7, 13);
    this.warning = null;
    this.spawnInterval = Math.max(0.28, Math.pow(0.975, n));
    this.spawnTimer = silent ? 1.0 : 2.4; // breather between waves
    if (!silent) this.audio.play('wave');
    if (this.onWave) {
      this.onWave(n, isBoss, this.mutator ? this.mutator.name : null,
        this.bossVariant ? this.bossVariant.name : null);
    }
  }

  // ---------- perks (run evolutions) ----------

  offerPerks() {
    const owned = this.perks;
    const pool = PERKS.filter((pk) => !(pk.once && owned[pk.id]));
    const choices = [];
    while (choices.length < 3 && pool.length > 0) {
      const i = Math.floor(Math.random() * pool.length);
      choices.push(pool.splice(i, 1)[0]);
    }
    this.perkChoices = choices;
    this.state = 'perk';
    if (this.onPerkOffer) this.onPerkOffer(choices);
  }

  choosePerk(id) {
    if (this.state !== 'perk') return;
    this.perks[id] = (this.perks[id] || 0) + 1;
    if (id === 'secondwind') {
      this.coreHp = Math.min(this.stats.coreMaxHp, this.coreHp + this.stats.coreMaxHp * 0.5);
      this.particles.ring(0, 0, '#4dff88', 140, 4);
    }
    this.computeStats();
    this.coreHp = Math.min(this.coreHp, this.stats.coreMaxHp); // glass cannon may shrink max
    this.shield = Math.min(this.shield, this.stats.shieldMax || this.shield);
    this.perkChoices = null;
    this.state = 'play';
    this.audio.play('shard');
    this.save();
    this.beginWave(this.wave + 1);
  }

  gameOver(sacrificed = false) {
    if (this.state === 'over') return;
    this.state = 'over';
    const earned = this.shardPreview();
    this.shards += earned;
    this.particles.spark(0, 0, '#7df9ff', 60, 420, 4, 1.2);
    this.particles.ring(0, 0, '#ff5a5a', 320, 6);
    this.particles.addShake(18);
    this.audio.play('over');
    this.save();
    if (this.onGameOver) this.onGameOver(earned, sacrificed);
  }

  rebuild() {
    this.gold = 0;
    this.up = {};
    this.savedWave = 0;
    this.savedPerks = null;
    this.life.runs++;
    this.startRun(0);
    this.save();
  }

  // ---------- economy ----------

  upCost(def, lvl) {
    return Math.floor(def.baseCost * Math.pow(def.growth, lvl));
  }

  // qty: a number, or 'max'. Buys as many levels as affordable, returns count bought.
  buyUpgrade(id, qty = 1) {
    const def = UPGRADES.find((d) => d.id === id);
    if (!def) return 0;
    let bought = 0;
    const limit = qty === 'max' ? 1000 : qty;
    while (bought < limit) {
      const lvl = this.up[id] || 0;
      if (lvl >= def.max) break;
      const cost = this.upCost(def, lvl);
      if (this.gold < cost) break;
      this.gold -= cost;
      this.up[id] = lvl + 1;
      bought++;
    }
    if (bought > 0) {
      const oldHp = this.stats.coreMaxHp;
      const oldSh = this.stats.shieldMax;
      this.computeStats();
      this.coreHp += Math.max(0, this.stats.coreMaxHp - oldHp);       // heal by the HP gained
      this.shield = Math.min(this.stats.shieldMax, this.shield + Math.max(0, this.stats.shieldMax - oldSh));
      this.audio.play('buy');
    } else {
      this.audio.play('deny');
    }
    return bought;
  }

  buyShardUpgrade(id) {
    const def = SHARD_UPGRADES.find((d) => d.id === id);
    const lvl = this.shardUp[id] || 0;
    if (!def || lvl >= def.max) return false;
    const cost = this.upCost(def, lvl);
    if (this.shards < cost) { this.audio.play('deny'); return false; }
    this.shards -= cost;
    this.shardUp[id] = lvl + 1;
    this.computeStats();
    this.audio.play('shard');
    this.save();
    return true;
  }

  addGold(g) {
    this.gold += g;
    if (this.gold > this.life.maxGold) this.life.maxGold = this.gold;
  }

  checkAchievements() {
    for (const a of ACHIEVEMENTS) {
      if (this.ach[a.id]) continue;
      let hit = false;
      try { hit = a.check(this); } catch (e) { /* defensive */ }
      if (hit) {
        this.ach[a.id] = true;
        this.shards += a.reward;
        this.audio.play('shard');
        if (this.onAchievement) this.onAchievement(a);
        this.save();
      }
    }
  }

  // ---------- spawning ----------

  spawnEnemy(type, x, y) {
    const T = ENEMY_TYPES[type];
    if (x === undefined) {
      const a = rand(0, TAU);
      const R = this.spawnRadius();
      x = Math.cos(a) * R;
      y = Math.sin(a) * R;
    }
    const w = this.wave;
    const mut = this.mutator || { spdM: 1, hpM: 1, goldM: 1 };
    let hp = T.hp * 15 * Math.pow(1.16, w - 1) * (1 + Math.max(0, w - 20) * 0.015) * mut.hpM;
    let gold = T.gold * 4 * Math.pow(1.105, w - 1) * mut.goldM;
    let r = T.r;
    let mass = T.mass;
    // elites: rare super-charged variants from wave 12 on
    const elite = w >= 12 && type !== 'boss' && type !== 'mini' && chance(0.10);
    if (elite) {
      hp *= 4;
      gold *= 3;
      r *= 1.3;
      mass *= 1.6;
    }
    this.enemies.push({
      id: this.nextId++,
      type, x, y, vx: 0, vy: 0,
      r, mass,
      speed: T.speed * rand(0.85, 1.15) * mut.spdM,
      hp, maxHp: hp, gold,
      dmg: T.dmg * (5 + w * 1.3) * (elite ? 2 : 1),
      color: T.color, sides: T.sides,
      rot: rand(0, TAU), rotSpd: rand(-1.6, 1.6),
      phase: rand(0, TAU),
      wob: T.wob || 0.3,
      range: T.range || 0,
      fireCd: T.fireCd || 0,
      fireT: T.fireCd ? rand(1, T.fireCd) : 0,
      variant: type === 'boss' && this.bossVariant ? this.bossVariant.id : null,
      auxT: 4,
      orbCd: 0,
      // enemies slowly build knockback resistance as waves climb — no infinite stunlock
      kbResist: Math.min(0.6, (T.kbResist || 0) + (w - 1) * 0.008),
      dr: T.dr || 0,
      elite,
      slow: 0, slowT: 0,
      flash: 0,
      dead: false,
    });
  }

  // ---------- combat ----------

  nearestEnemy(x, y) {
    let best = null, bd = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  shoot(sx, sy, muzzle, target, dmg, count, pierce) {
    const st = this.stats;
    const base = Math.atan2(target.y - sy, target.x - sx);
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * 0.12;
      const nx = Math.cos(a), ny = Math.sin(a);
      this.projectiles.push({
        x: sx + nx * muzzle, y: sy + ny * muzzle,
        vx: nx * st.projSpeed, vy: ny * st.projSpeed,
        nx, ny, dmg, pierce,
        bounce: st.bounces,
        wallB: st.mirror,
        color: st.explosionPct > 0 ? '#ffb13d' : '#aef6ff',
        r: 4, life: 1.8,
        hits: new Set(),
        dead: false,
      });
    }
    return base;
  }

  enemyShoot(e) {
    const shots = e.type === 'boss' ? 3 : 1;
    const base = Math.atan2(-e.y, -e.x);
    for (let i = 0; i < shots; i++) {
      const a = base + (i - (shots - 1) / 2) * 0.22;
      this.enemyProjectiles.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
        dmg: e.dmg * 0.5,
        r: 5, life: 7,
        dead: false,
      });
    }
  }

  damageEnemy(e, dmg, kx, ky, crit = false, silent = false, src = 'gun') {
    if (e.dead) return;
    e.lastSrc = src; // kill attribution for bounties
    dmg *= 1 - e.dr; // armored enemies shrug some off
    e.hp -= dmg;
    const kb = (1 - e.kbResist) / e.mass;
    e.vx += kx * kb;
    e.vy += ky * kb;
    if (this.stats.frostSlow > 0 && !silent) {
      e.slow = this.stats.frostSlow;
      e.slowT = 2;
    }
    if (!silent) {
      e.flash = 0.12;
      if (this.opts.dmgText) {
        this.particles.text(e.x, e.y - e.r, fmt(dmg), crit ? '#ffd24d' : '#dce6ff', crit);
      }
    }
    // executioner: finish off the weak
    if (!e.dead && e.hp > 0 && this.stats.cull && e.type !== 'boss' && e.hp < e.maxHp * 0.1) {
      e.hp = 0;
    }
    if (e.hp <= 0) this.killEnemy(e);
    else if (!silent) this.audio.play('hit');
  }

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.waveKills++;
    this.life.kills++;
    this.combo++;
    this.comboT = this.stats.comboWindow;
    if (this.combo > this.life.maxCombo) this.life.maxCombo = this.combo;
    if (this.combo > this.comboPeakWave) this.comboPeakWave = this.combo;
    if (e.lastSrc === 'blast') this.blastKillsWave++;
    else if (e.lastSrc === 'fling') this.flingKillsWave++;
    this.ultCharge = Math.min(this.stats.ultNeed, this.ultCharge + 1);
    const g = Math.round(e.gold * this.stats.goldMult * this.comboMult());
    this.addGold(g);
    // power-up drops
    const dropChance = (e.type === 'boss' ? 1 : e.elite ? 0.25 : 0.035) * this.stats.dropMult;
    if (chance(dropChance)) this.dropPickup(e.x, e.y);
    // bosses can drop artifacts — the long-term collection chase
    if (e.type === 'boss' && chance(0.35)) this.dropArtifact();
    if (this.stats.lifesteal > 0) {
      this.coreHp = Math.min(this.stats.coreMaxHp, this.coreHp + this.stats.lifesteal * this.stats.coreMaxHp);
    }
    this.particles.spark(e.x, e.y, e.color, e.type === 'boss' ? 40 : 10, e.type === 'boss' ? 380 : 200, 3);
    this.particles.coin(e.x, e.y, e.type === 'boss' ? 8 : e.gold > 12 ? 3 : 1);
    if (e.type === 'splitter') {
      this.waveTotal += 3;
      for (let i = 0; i < 3; i++) {
        this.spawnEnemy('mini', e.x + rand(-10, 10), e.y + rand(-10, 10));
        const m = this.enemies[this.enemies.length - 1];
        m.vx = rand(-160, 160);
        m.vy = rand(-160, 160);
      }
    }
    if (e.type === 'boss' || e.type === 'tank' || e.elite) {
      this.particles.ring(e.x, e.y, e.color, e.r * 4, 4);
      this.particles.shard(e.x, e.y, e.color, e.type === 'boss' ? 10 : 6);
      this.particles.text(e.x, e.y - e.r - 14, '+' + fmt(g), '#ffd24d', true);
    }
    if (e.type === 'boss') {
      this.particles.addShake(14);
      this.slowMo = Math.max(this.slowMo, 0.2); // savor the moment
      this.life.bossKills++;
      this.tp += 5;
      this.audio.play('boss');
    } else {
      this.audio.play('kill');
    }
    // gear drops: elites sometimes, bosses usually
    if (e.type === 'boss' ? chance(0.6) : e.elite && chance(0.10)) this.dropGear();
  }

  // ---------- pickups ----------

  dropPickup(x, y) {
    if (this.pickups.length >= 6) return;
    const keys = Object.keys(PICKUPS);
    let total = 0;
    for (const k of keys) total += PICKUPS[k].weight;
    let roll = Math.random() * total;
    let type = keys[0];
    for (const k of keys) {
      roll -= PICKUPS[k].weight;
      if (roll <= 0) { type = k; break; }
    }
    this.pickups.push({ type, x, y, t: 10, phase: rand(0, TAU) });
  }

  collectPickup(pu) {
    const st = this.stats;
    switch (pu.type) {
      case 'gold': {
        const g = Math.round(25 * Math.pow(1.105, this.wave - 1) * st.goldMult);
        this.addGold(g);
        this.particles.text(0, -CORE_R - 30, '+' + fmt(g), '#ffd24d', true);
        break;
      }
      case 'heal':
        this.coreHp = Math.min(st.coreMaxHp, this.coreHp + st.coreMaxHp * 0.18);
        this.particles.text(0, -CORE_R - 30, '+18% HP', '#4dff88', true);
        this.particles.ring(0, 0, '#4dff88', 90, 3);
        break;
      case 'frenzy':
        this.frenzyT = 6;
        this.particles.text(0, -CORE_R - 30, 'FRENZY!', '#ff9d3d', true);
        break;
      case 'freeze':
        for (const e of this.enemies) {
          if (e.dead) continue;
          e.slow = 0.95;
          e.slowT = 3;
        }
        this.particles.text(0, -CORE_R - 30, 'FREEZE!', '#7df9ff', true);
        this.particles.ring(0, 0, '#7df9ff', this.spawnRadius() * 0.5, 4);
        break;
      case 'quad':
        this.quadT = 6;
        this.particles.text(0, -CORE_R - 30, '3× DAMAGE!', '#c77dff', true);
        break;
    }
    this.particles.spark(pu.x, pu.y, PICKUPS[pu.type].color, 10, 200, 3, 0.5);
    this.pickupsWave++;
    this.audio.play('pickup');
  }

  // shield-then-hull damage to the core, shared by contact hits and enemy bullets
  applyCoreDamage(dmg) {
    dmg *= 1 - (this.stats.coreDr || 0);
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
      if (this.shield <= 0) {
        this.shield = 0;
        this.particles.ring(0, 0, '#4da6ff', 110, 5);
        this.particles.text(0, -CORE_R - 44, 'SHIELD DOWN', '#4da6ff', true);
        this.audio.play('break');
        // frost nova perk: the break flash-freezes the swarm
        if (this.stats.frostNova) {
          for (const e of this.enemies) {
            if (e.dead) continue;
            if (Math.hypot(e.x, e.y) < 220) {
              e.slow = 0.9;
              e.slowT = 2.5;
            }
          }
          this.particles.ring(0, 0, '#7df9ff', 220, 4);
        }
      }
    }
    this.shieldDelay = this.stats.shieldDelayBase || 6;
    this.coreHp -= dmg;
    this.coreDamagedWave = true;
    this.audio.play('hurt');
    if (this.coreHp <= 0) {
      this.coreHp = 0;
      this.gameOver(false);
    } else if (this.coreHp / this.stats.coreMaxHp < 0.3) {
      this.slowMo = Math.max(this.slowMo, 0.5); // near-death slow-mo
    }
  }

  coreHit(e) {
    e.hp = 0;
    this.killEnemy(e); // pay out the kill — it died on your shield
    this.particles.ring(0, 0, '#ff5a5a', 70, 4);
    this.particles.addShake(6);
    this.applyCoreDamage(e.dmg);
    // reactive plating perk: hits trigger a retaliatory shockwave
    if (this.stats.reactive > 0 && this.state === 'play') {
      const dmg = this.stats.damage * 2 * this.stats.reactive;
      for (const o of this.enemies) {
        if (o.dead) continue;
        const d = Math.hypot(o.x, o.y) || 1;
        if (d < 170) {
          this.damageEnemy(o, dmg, (o.x / d) * 600, (o.y / d) * 600);
        }
      }
      this.particles.ring(0, 0, '#ffb13d', 170, 4);
    }
  }

  activateUltimate() {
    const st = this.stats;
    if (this.state !== 'play' || this.ultCharge < st.ultNeed) return false;
    this.ultCharge = 0;
    this.life.ults++;
    const dmg = st.damage * 12;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x, e.y) || 1;
      this.damageEnemy(e, dmg, (e.x / d) * 1400, (e.y / d) * 1400);
    }
    for (const ep of this.enemyProjectiles) ep.dead = true;
    this.ultFlash = 0.45;
    this.slowMo = Math.max(this.slowMo, 0.35);
    this.particles.ring(0, 0, '#ffffff', this.spawnRadius() * 0.7, 8);
    this.particles.ring(0, 0, '#7df9ff', this.spawnRadius() * 0.45, 5);
    this.particles.spark(0, 0, '#ffffff', 50, 600, 4, 1);
    this.particles.addShake(16);
    this.audio.play('ult');
    return true;
  }

  tryBlast(x, y) {
    if (this.state !== 'play' || this.blastTimer > 0) return false;
    const st = this.stats;
    this.blastTimer = st.blastCooldown;
    const R = st.blastRadius;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y;
      const d = Math.hypot(dx, dy);
      if (d < R + e.r) {
        const fall = 1 - 0.6 * Math.min(1, d / R);
        const imp = (1 - 0.7 * Math.min(1, d / R)) * 1100;
        const nx = d > 0.01 ? dx / d : 1, ny = d > 0.01 ? dy / d : 0;
        this.damageEnemy(e, st.blastDamage * fall, nx * imp, ny * imp, false, false, 'blast');
      }
    }
    // echo crystal artifact: the blast repeats at 40% power
    if (st.blastEcho) this.echoBlast = { x, y, t: 0.5 };
    // the shockwave also clears incoming enemy fire
    for (const ep of this.enemyProjectiles) {
      const d = Math.hypot(ep.x - x, ep.y - y);
      if (d < R) {
        ep.dead = true;
        this.particles.spark(ep.x, ep.y, '#ff8a5a', 4, 140, 2, 0.3);
      }
    }
    this.particles.ring(x, y, '#7df9ff', R, 5);
    this.particles.ring(x, y, '#ffffff', R * 0.55, 2);
    this.particles.spark(x, y, '#7df9ff', 22, 320, 3, 0.6);
    this.particles.addShake(8);
    this.audio.play('blast');
    return true;
  }

  activateSingularity() {
    const st = this.stats;
    if (this.state !== 'play' || st.singLvl <= 0 || this.singTimer > 0 || this.singActive) return false;
    const target = this.findClusterTarget() || this.nearestEnemy(0, 0);
    if (!target) return false;
    this.singActive = { x: target.x, y: target.y, t: st.singDuration };
    this.singTimer = st.singCooldown;
    this.particles.ring(target.x, target.y, '#c77dff', 200, 4);
    this.audio.play('sing');
    return true;
  }

  activateOverdrive() {
    const st = this.stats;
    if (this.state !== 'play' || st.odLvl <= 0 || this.odTimer > 0 || this.odActive > 0) return false;
    this.odActive = st.odDuration;
    this.odTimer = st.odCooldown;
    this.particles.ring(0, 0, '#ffb13d', 120, 4);
    this.audio.play('odrive');
    return true;
  }

  // ---------- bounties ----------

  completeBounty() {
    const b = this.bounty;
    if (!b || b.done) return;
    b.done = true;
    const g = Math.round(45 * Math.pow(1.12, this.wave) * this.stats.goldMult);
    this.addGold(g);
    if (b.shard) this.shards += 1;
    this.particles.text(0, -CORE_R - 56, '★ BOUNTY +' + fmt(g) + (b.shard ? ' +1◆' : ''), '#ffd24d', true);
    this.audio.play('shard');
  }

  // ---------- deployable buildings ----------

  goldUnit() {
    return 4 * Math.pow(1.105, this.wave - 1);
  }

  buildingCost(type) {
    return Math.round(BUILDINGS[type].costU * this.goldUnit() * (this.stats.buildCostMult || 1));
  }

  buildingCount(type) {
    let n = 0;
    for (const b of this.buildings) if (b.type === type) n++;
    return n;
  }

  tryBuild(type, x, y) {
    if (this.state !== 'play' || !BUILDINGS[type]) return false;
    const cost = this.buildingCost(type);
    if (this.gold < cost) { this.audio.play('deny'); return false; }
    if (this.buildingCount(type) >= BUILDINGS[type].limit) { this.audio.play('deny'); return false; }
    if (Math.hypot(x, y) < 65) { this.audio.play('deny'); return false; } // not on the core
    for (const b of this.buildings) {
      if (Math.hypot(b.x - x, b.y - y) < 32) { this.audio.play('deny'); return false; }
    }
    this.gold -= cost;
    const w = this.wave;
    const b = { type, x, y, dead: false };
    if (type === 'mine') {
      b.r = 9;
    } else if (type === 'tesla') {
      b.r = 10;
      b.t = 30;     // lifetime
      b.zapT = 0.3;
    } else if (type === 'barrier') {
      b.r = 22;
      b.hp = 15 * Math.pow(1.16, w - 1) * 8 * (this.stats.barrierHpMult || 1);
      b.maxHp = b.hp;
    }
    this.buildings.push(b);
    this.particles.ring(x, y, '#7df9ff', 40, 3);
    this.audio.play('buy');
    return true;
  }

  // ---------- grab & fling physics ----------

  startGrab(x, y) {
    if (this.state !== 'play') return false;
    let best = null, bd = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < e.r + 28 && d < bd) { bd = d; best = e; }
    }
    if (!best) return false;
    this.grab = { id: best.id, x, y };
    return true;
  }

  moveGrab(x, y) {
    if (this.grab) {
      this.grab.x = x;
      this.grab.y = y;
    }
  }

  endGrab(vx, vy) {
    if (!this.grab) return;
    const e = this.enemies.find((o) => o.id === this.grab.id);
    if (e && !e.dead) {
      const mass = 3 / (e.mass + 2); // heavier enemies fly less
      e.vx = clamp(vx * mass, -1600, 1600);
      e.vy = clamp(vy * mass, -1600, 1600);
      if (Math.hypot(e.vx, e.vy) > 350) e.flungT = 1.2;
    }
    this.grab = null;
  }

  // ---------- world events ----------

  startEvent() {
    const def = WORLD_EVENTS[Math.floor(Math.random() * WORLD_EVENTS.length)];
    this.eventActive = {
      id: def.id,
      t: def.id === 'meteor' ? 4 : def.id === 'gravstorm' ? 6 : def.id === 'flare' ? 4 : 0.1,
      spawnT: 0,
    };
    if (def.id === 'lucky') {
      for (let i = 0; i < 4; i++) {
        const a = rand(0, TAU);
        const d = rand(120, 260);
        this.dropPickup(Math.cos(a) * d, Math.sin(a) * d);
      }
    }
    this.audio.play('event');
    if (this.onEvent) this.onEvent(def.name);
  }

  dropMeteor() {
    const a = rand(0, TAU);
    const d = rand(60, Math.min(this.view.w, this.view.h) * 0.42);
    this.meteors.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, t: 0.85, r: 75 });
  }

  // Pick the enemy sitting in the thickest crowd — target for Auto-Nova / Singularity.
  findClusterTarget() {
    const es = this.enemies;
    const R2 = this.stats.blastRadius * this.stats.blastRadius;
    const step = es.length > 120 ? 2 : 1;
    let best = null, bestScore = -1;
    for (let i = 0; i < es.length; i += step) {
      const a = es[i];
      if (a.dead) continue;
      let c = 0;
      for (let j = 0; j < es.length; j += step) {
        const b = es[j];
        if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        if (dx * dx + dy * dy < R2) c++;
      }
      if (c > bestScore) { bestScore = c; best = a; }
    }
    return best;
  }

  // ---------- main update ----------

  update(dt) {
    this.timeMult = this.slowMo > 0 ? 0.35 : 1;
    if (this.state !== 'play') return;
    if (this.slowMo > 0) this.slowMo -= dt;
    dt *= this.speed * this.timeMult;
    const st = this.stats;
    this.time += dt;

    this.coreHp = Math.min(st.coreMaxHp, this.coreHp + st.regen * dt);
    this.blastTimer = Math.max(0, this.blastTimer - dt);
    this.singTimer = Math.max(0, this.singTimer - dt);
    this.odTimer = Math.max(0, this.odTimer - dt);
    if (this.odActive > 0) this.odActive -= dt;
    if (this.frenzyT > 0) this.frenzyT -= dt;
    if (this.quadT > 0) this.quadT -= dt;
    if (this.ultFlash > 0) this.ultFlash -= dt;

    // achievement sweep
    this.achT -= dt;
    if (this.achT <= 0) {
      this.achT = 2;
      this.checkAchievements();
    }

    // live bounty progress
    if (this.bounty && !this.bounty.done && this.bounty.live) {
      const b = this.bounty;
      b.prog = b.id === 'blastkills' ? this.blastKillsWave
        : b.id === 'fling' ? this.flingKillsWave
        : b.id === 'pickups' ? this.pickupsWave
        : b.id === 'combo' ? this.comboPeakWave : 0;
      if (b.prog >= b.target) this.completeBounty();
    }

    // echo crystal: delayed mini-blast
    if (this.echoBlast) {
      this.echoBlast.t -= dt;
      if (this.echoBlast.t <= 0) {
        const eb = this.echoBlast;
        this.echoBlast = null;
        const R = st.blastRadius * 0.8;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - eb.x, dy = e.y - eb.y;
          const d = Math.hypot(dx, dy);
          if (d < R + e.r) {
            const nx = d > 0.01 ? dx / d : 1, ny = d > 0.01 ? dy / d : 0;
            this.damageEnemy(e, st.blastDamage * 0.4, nx * 500, ny * 500, false, false, 'blast');
          }
        }
        this.particles.ring(eb.x, eb.y, '#c77dff', R, 3);
        this.audio.play('blast');
      }
    }

    // -- deployed buildings --
    for (const b of this.buildings) {
      if (b.type === 'mine') {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 14) {
            b.dead = true;
            const dmg = 15 * Math.pow(1.16, this.wave - 1) * 1.8;
            for (const o of this.enemies) {
              if (o.dead) continue;
              const dx = o.x - b.x, dy = o.y - b.y;
              const d = Math.hypot(dx, dy) || 1;
              if (d < 95 + o.r) this.damageEnemy(o, dmg, (dx / d) * 550, (dy / d) * 550);
            }
            this.particles.ring(b.x, b.y, '#ff5a5a', 100, 5);
            this.particles.spark(b.x, b.y, '#ff9d3d', 14, 280, 3, 0.5);
            this.particles.addShake(5);
            this.audio.play('meteor');
            break;
          }
        }
      } else if (b.type === 'tesla') {
        b.t -= dt;
        if (b.t <= 0) {
          b.dead = true;
          this.particles.spark(b.x, b.y, '#7df9ff', 8, 160, 2, 0.4);
          continue;
        }
        b.zapT -= dt;
        if (b.zapT <= 0) {
          const target = this.nearestEnemy(b.x, b.y);
          if (target && Math.hypot(target.x - b.x, target.y - b.y) < 190) {
            b.zapT = 0.8;
            this.damageEnemy(target, st.damage * 1.3, 0, 0, false, false, 'tesla');
            this.zaps.push({ x1: b.x, y1: b.y, x2: target.x, y2: target.y, t: 0.12 });
            this.audio.play('zap');
          }
        }
      } else if (b.type === 'barrier') {
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - b.x, dy = e.y - b.y;
          const rs = b.r + e.r;
          const d2 = dx * dx + dy * dy;
          if (d2 < rs * rs && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const nx = dx / d, ny = dy / d;
            e.x = b.x + nx * rs;
            e.y = b.y + ny * rs;
            const vn = e.vx * nx + e.vy * ny;
            if (vn < 0) { // cancel inward velocity
              e.vx -= vn * nx;
              e.vy -= vn * ny;
            }
            b.hp -= e.dmg * 0.6 * dt; // they gnaw it down
          }
        }
        if (b.hp <= 0) {
          b.dead = true;
          this.particles.shard(b.x, b.y, '#9ab0c8', 8);
          this.particles.ring(b.x, b.y, '#9ab0c8', 60, 3);
          this.audio.play('break');
        }
      }
    }
    this.buildings = this.buildings.filter((b) => !b.dead);
    for (const z of this.zaps) z.t -= dt;
    this.zaps = this.zaps.filter((z) => z.t > 0);

    // -- pickups drift home --
    for (const pu of this.pickups) {
      pu.t -= dt;
      const d = Math.hypot(pu.x, pu.y) || 1;
      const sp = d < 140 ? 220 : 45;
      pu.x += (-pu.x / d) * sp * dt;
      pu.y += (-pu.y / d) * sp * dt;
      if (d < CORE_R + 16) {
        this.collectPickup(pu);
        pu.t = 0;
      }
    }
    this.pickups = this.pickups.filter((p) => p.t > 0);

    // -- world events --
    if (!this.eventActive) {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0 && this.wave >= 5) this.startEvent();
    } else {
      const ev = this.eventActive;
      ev.t -= dt;
      if (ev.id === 'meteor') {
        ev.spawnT -= dt;
        if (ev.spawnT <= 0) {
          ev.spawnT = 0.45;
          this.dropMeteor();
        }
      } else if (ev.id === 'flare') {
        for (const e of this.enemies) {
          if (e.dead) continue;
          this.damageEnemy(e, e.maxHp * 0.06 * dt, 0, 0, false, true);
          if (chance(dt * 2)) this.particles.spark(e.x, e.y, '#ff9d3d', 2, 90, 2, 0.3);
        }
      } else if (ev.id === 'gravstorm') {
        for (const e of this.enemies) {
          if (e.dead) continue;
          e.vx += Math.sin(this.time * 3 + e.phase) * 420 * dt;
          e.vy += Math.cos(this.time * 2.3 + e.phase) * 420 * dt;
        }
      }
      if (ev.t <= 0) {
        this.eventActive = null;
        this.eventTimer = rand(50, 90);
      }
    }

    // -- falling meteors --
    for (const m of this.meteors) {
      m.t -= dt;
      if (m.t <= 0) {
        const dmg = 15 * Math.pow(1.16, this.wave - 1) * 2.2; // ~2 grunts worth, always relevant
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - m.x, dy = e.y - m.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < m.r + e.r) {
            this.damageEnemy(e, dmg, (dx / d) * 500, (dy / d) * 500);
          }
        }
        this.particles.ring(m.x, m.y, '#ff9d3d', m.r * 1.4, 5);
        this.particles.spark(m.x, m.y, '#ff9d3d', 16, 300, 3, 0.6);
        this.particles.addShake(7);
        this.audio.play('meteor');
      }
    }
    this.meteors = this.meteors.filter((m) => m.t > 0);

    // -- grab spring: dragged enemy chases the pointer --
    if (this.grab) {
      const e = this.enemies.find((o) => o.id === this.grab.id);
      if (!e || e.dead) {
        this.grab = null;
      } else {
        const sluggish = 8 / (e.mass + 7);
        e.vx += (this.grab.x - e.x) * 16 * dt * sluggish * 8;
        e.vy += (this.grab.y - e.y) * 16 * dt * sluggish * 8;
        e.vx *= 1 - 4 * dt;
        e.vy *= 1 - 4 * dt;
      }
    }
    if (this.muzzle) {
      this.muzzle.t -= dt;
      if (this.muzzle.t <= 0) this.muzzle = null;
    }

    // shield recharge after 6s without taking a hit
    if (st.shieldMax > 0) {
      if (this.shieldDelay > 0) this.shieldDelay -= dt;
      else this.shield = Math.min(st.shieldMax, this.shield + (st.shieldMax / 4) * dt);
    }

    // low-hp alarm heartbeat
    if (this.coreHp / st.coreMaxHp < 0.2) {
      this.alarmT -= dt;
      if (this.alarmT <= 0) {
        this.alarmT = 1.4;
        this.audio.play('alarm');
      }
    }

    // combo decay
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }

    // reactor passive income
    if (st.batteryLvl > 0) {
      this.goldFrac += st.batteryLvl * 2 * Math.pow(1.105, this.wave - 1) * dt;
      if (this.goldFrac >= 1) {
        const g = Math.floor(this.goldFrac);
        this.goldFrac -= g;
        this.addGold(g);
      }
    }

    // -- surge events: a swarm bursts in from one direction --
    if (this.warning) {
      this.warning.t -= dt;
      if (this.warning.t <= 0) {
        const n = Math.min(14, 5 + Math.floor(this.wave / 4));
        for (let i = 0; i < n; i++) {
          const a = this.warning.angle + rand(-0.25, 0.25);
          const R = this.spawnRadius() + rand(0, 60);
          this.spawnEnemy(this.wave >= 3 && chance(0.35) ? 'runner' : 'grunt', Math.cos(a) * R, Math.sin(a) * R);
        }
        this.waveTotal += n;
        this.particles.addShake(4);
        this.warning = null;
      }
    } else if (this.surges > 0) {
      // don't stall the wave waiting on a far-off surge
      if (this.queue.length === 0 && this.enemies.length === 0) {
        this.surgeTimer = Math.min(this.surgeTimer, 0.4);
      }
      this.surgeTimer -= dt;
      if (this.surgeTimer <= 0) {
        this.surges--;
        this.surgeTimer = rand(8, 14);
        this.warning = { angle: rand(0, TAU), t: 1.3 };
        this.audio.play('warn');
      }
    }

    // -- spawn queue --
    if (this.queue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.enemies.length < 200) {
        this.spawnEnemy(this.queue.shift());
        this.spawnTimer = this.spawnInterval * rand(0.5, 1.5);
      }
    } else if (this.enemies.length === 0 && this.surges <= 0 && !this.warning) {
      // judge end-of-wave bounties before moving on
      if (this.bounty && !this.bounty.done && this.bounty.end) {
        if (this.bounty.id === 'nodamage' && !this.coreDamagedWave) this.completeBounty();
        else if (this.bounty.id === 'speed' && (this.time - this.waveStart) < this.bounty.target) this.completeBounty();
      }
      const bonus = Math.round(15 * Math.pow(1.12, this.wave) * st.goldMult);
      this.addGold(bonus);
      this.tp += 1 + Math.floor(this.wave / 10);
      this.particles.text(0, -CORE_R - 30, 'WAVE CLEAR +' + fmt(bonus), '#ffd24d', true);
      this.save();
      if (this.wave % 5 === 0 && this.onPerkOffer) {
        this.offerPerks(); // beginWave happens after the pick
        return;
      }
      this.beginWave(this.wave + 1);
    }

    // -- enemies: steer toward core (spitters hold range), integrate --
    const grabId = this.grab ? this.grab.id : -1;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x, e.y) || 1;
      if (e.flungT > 0) e.flungT -= dt;
      if (e.id === grabId) {
        // player has this one by the scruff — no AI, just physics
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.rot += e.rotSpd * 3 * dt;
        e.flash = Math.max(0, e.flash - dt);
        if (!e.dead && d < CORE_R + e.r) this.coreHit(e);
        continue;
      }
      const wob = Math.sin(this.time * 2 + e.phase) * e.wob;
      let dx, dy;
      let spd = e.speed;
      if (e.range > 0 && d < e.range) {
        // strafe sideways at standoff range, drift out if too close
        const out = d < e.range * 0.7 ? 0.7 : 0;
        dx = (-e.y / d) * 0.8 + (e.x / d) * out;
        dy = (e.x / d) * 0.8 + (e.y / d) * out;
        spd *= 0.5;
      } else {
        dx = -e.x / d;
        dy = -e.y / d;
      }
      const cos = Math.cos(wob), sin = Math.sin(wob);
      const ax = dx * cos - dy * sin;
      const ay = dx * sin + dy * cos;
      if (e.slowT > 0) e.slowT -= dt;
      if (e.slowT > 0) spd *= 1 - e.slow;
      if (e.type === 'boss') spd *= 1 + (1 - e.hp / e.maxHp) * 1.2; // bosses enrage as they bleed
      const steer = Math.min(1, dt * 2.2);
      e.vx += (ax * spd - e.vx) * steer;
      e.vy += (ay * spd - e.vy) * steer;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.rot += e.rotSpd * dt;
      e.flash = Math.max(0, e.flash - dt);
      // ranged attackers
      if (e.fireCd > 0 && !e.dead && (e.type === 'boss' || (e.range > 0 && d < e.range * 1.2))) {
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = e.fireCd;
          this.enemyShoot(e);
        }
      }
      // boss variant tricks
      if (e.type === 'boss' && !e.dead && e.variant) {
        e.auxT -= dt;
        if (e.auxT <= 0) {
          if (e.variant === 'widow') {
            e.auxT = 5;
            this.waveTotal += 2;
            for (let k = 0; k < 2; k++) {
              this.spawnEnemy('grunt', e.x + rand(-30, 30), e.y + rand(-30, 30));
            }
            this.particles.ring(e.x, e.y, '#ff3df0', e.r * 2, 3);
          } else if (e.variant === 'phantom') {
            e.auxT = 6;
            this.particles.ring(e.x, e.y, '#ff3df0', e.r * 2.5, 3);
            const na = rand(0, TAU);
            const nd = Math.max(160, d * 0.85);
            e.x = Math.cos(na) * nd;
            e.y = Math.sin(na) * nd;
            e.vx = 0;
            e.vy = 0;
            this.particles.ring(e.x, e.y, '#ff3df0', e.r * 2.5, 3);
            this.audio.play('warn');
          } else {
            e.auxT = 99; // goliath relies on brute force
          }
        }
      }
      if (!e.dead && d < CORE_R + e.r) this.coreHit(e);
    }
    if (this.state !== 'play') return; // core may have just died

    // -- enemy bullets --
    for (const ep of this.enemyProjectiles) {
      ep.x += ep.vx * dt;
      ep.y += ep.vy * dt;
      ep.life -= dt;
      if (ep.life <= 0) { ep.dead = true; continue; }
      if (Math.hypot(ep.x, ep.y) < CORE_R + ep.r) {
        ep.dead = true;
        this.particles.ring(0, 0, '#ff8a5a', 50, 3);
        this.particles.addShake(3);
        this.applyCoreDamage(ep.dmg);
        if (this.state !== 'play') return;
      }
    }

    // -- enemy/enemy collisions (soft body push) --
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.dead) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const rs = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rs * rs || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const overlap = rs - d;
        const tot = a.mass + b.mass;
        a.x -= nx * overlap * (b.mass / tot);
        a.y -= ny * overlap * (b.mass / tot);
        b.x += nx * overlap * (a.mass / tot);
        b.y += ny * overlap * (a.mass / tot);
        const push = overlap * 4;
        a.vx -= nx * push * (b.mass / tot);
        a.vy -= ny * push * (b.mass / tot);
        b.vx += nx * push * (a.mass / tot);
        b.vy += ny * push * (a.mass / tot);
        // flung enemies are wrecking balls: high-speed impacts hurt both
        if (a.flungT > 0 || b.flungT > 0) {
          const relV = Math.hypot(a.vx - b.vx, a.vy - b.vy);
          if (relV > 320) {
            const dmg = this.stats.damage * (relV / 320);
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            this.particles.spark(mx, my, '#ffffff', 6, 220, 2, 0.4);
            this.damageEnemy(a, dmg, 0, 0, false, false, 'fling');
            this.damageEnemy(b, dmg, 0, 0, false, false, 'fling');
          }
        }
      }
    }

    // -- repulsor aura --
    if (st.repulsorLvl > 0) {
      const R = st.repulsorRadius;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x, e.y) || 1;
        if (d < R + e.r) {
          const f = (1 - Math.min(1, d / R)) * st.repulsorForce * dt;
          const kb = (1 - e.kbResist) / e.mass;
          e.vx += (e.x / d) * f * kb;
          e.vy += (e.y / d) * f * kb;
          this.damageEnemy(e, st.repulsorDps * dt, 0, 0, false, true);
        }
      }
    }

    // -- singularity: drag everything in, then detonate --
    if (this.singActive) {
      const s = this.singActive;
      s.t -= dt;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = s.x - e.x, dy = s.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 300) {
          const pull = (1 - d / 320) * st.singForce * dt / Math.sqrt(e.mass);
          e.vx += (dx / d) * pull;
          e.vy += (dy / d) * pull;
          this.damageEnemy(e, st.singDps * dt, 0, 0, false, true);
        }
      }
      if (chance(dt * 18)) {
        const a = rand(0, TAU);
        this.particles.spark(s.x + Math.cos(a) * 60, s.y + Math.sin(a) * 60, '#c77dff', 2, 120, 2, 0.4);
      }
      if (s.t <= 0) {
        // collapse explosion
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - s.x, dy = e.y - s.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 150) {
            this.damageEnemy(e, st.damage * 4, (dx / d) * 700, (dy / d) * 700);
          }
        }
        this.particles.ring(s.x, s.y, '#c77dff', 170, 6);
        this.particles.spark(s.x, s.y, '#c77dff', 26, 360, 3, 0.7);
        this.particles.addShake(10);
        this.audio.play('blast');
        this.singActive = null;
      }
    }

    // -- core gun (overdrive / frenzy multiply fire rate, quad multiplies damage) --
    const fireRate = st.fireRate
      * (this.odActive > 0 ? st.odMult : 1)
      * (this.frenzyT > 0 ? 1.8 : 1);
    const bulletDmg = st.damage * (this.quadT > 0 ? 3 : 1);
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      const target = this.nearestEnemy(0, 0);
      if (target) {
        this.fireTimer = 1 / fireRate;
        const aim = this.shoot(0, 0, CORE_R + 4, target, bulletDmg, st.multishot, st.pierce);
        this.muzzle = { a: aim, t: 0.07 };
        this.audio.play('shoot');
      } else {
        this.fireTimer = 0;
      }
    }

    // -- turrets --
    while (this.turretState.length < st.turrets) this.turretState.push({ cd: 0, aim: 0 });
    this.turretState.length = st.turrets;
    for (let i = 0; i < this.turretState.length; i++) {
      const t = this.turretState[i];
      const ang = TAU * i / Math.max(1, st.turrets) + Math.PI / 4;
      t.x = Math.cos(ang) * 52;
      t.y = Math.sin(ang) * 52;
      t.cd -= dt;
      if (t.cd <= 0) {
        const target = this.nearestEnemy(t.x, t.y);
        if (target) {
          t.cd = 1 / (fireRate * 0.6);
          t.aim = Math.atan2(target.y - t.y, target.x - t.x);
          this.shoot(t.x, t.y, 10, target, bulletDmg * 0.5, 1, 0);
        }
      }
    }

    // -- drones: fetch pickups, otherwise patrol and shoot --
    while (this.droneState.length < st.drones) {
      this.droneState.push({ x: 0, y: -60, vx: 0, vy: 0, cd: 0, aim: 0 });
    }
    this.droneState.length = st.drones;
    for (let i = 0; i < this.droneState.length; i++) {
      const dr = this.droneState[i];
      // nearest pickup wins its attention
      let tx, ty, fetching = null;
      let bd = Infinity;
      for (const pu of this.pickups) {
        const d2 = (pu.x - dr.x) ** 2 + (pu.y - dr.y) ** 2;
        if (d2 < bd) { bd = d2; fetching = pu; }
      }
      if (fetching) {
        tx = fetching.x;
        ty = fetching.y;
      } else {
        const a = this.time * 0.9 + TAU * i / Math.max(1, st.drones);
        tx = Math.cos(a) * 130;
        ty = Math.sin(a) * 130;
      }
      dr.vx += ((tx - dr.x) * 4 - dr.vx) * Math.min(1, dt * 3);
      dr.vy += ((ty - dr.y) * 4 - dr.vy) * Math.min(1, dt * 3);
      dr.x += dr.vx * dt;
      dr.y += dr.vy * dt;
      if (fetching && Math.hypot(fetching.x - dr.x, fetching.y - dr.y) < 18) {
        this.collectPickup(fetching);
        fetching.t = 0;
      }
      dr.cd -= dt;
      if (dr.cd <= 0) {
        const target = this.nearestEnemy(dr.x, dr.y);
        if (target && Math.hypot(target.x - dr.x, target.y - dr.y) < 340) {
          dr.cd = 1 / (fireRate * 0.5);
          dr.aim = Math.atan2(target.y - dr.y, target.x - dr.x);
          this.shoot(dr.x, dr.y, 8, target, bulletDmg * 0.5, 1, 0);
        }
      }
    }

    // -- orbitals --
    const nOrb = st.orbitals;
    this.orbitalPos = [];
    for (let i = 0; i < nOrb; i++) {
      const ang = this.time * 2.2 + TAU * i / nOrb;
      const ox = Math.cos(ang) * 82;
      const oy = Math.sin(ang) * 82;
      this.orbitalPos.push({ x: ox, y: oy });
      for (const e of this.enemies) {
        if (e.dead || this.time < e.orbCd) continue;
        const dx = e.x - ox, dy = e.y - oy;
        const rs = e.r + 10;
        if (dx * dx + dy * dy < rs * rs) {
          e.orbCd = this.time + 0.35;
          const d = Math.hypot(e.x, e.y) || 1;
          this.damageEnemy(e, st.damage * st.orbDmg, (e.x / d) * st.knockback * 2, (e.y / d) * st.knockback * 2);
          this.particles.spark(ox, oy, '#c77dff', 5, 200, 2, 0.3);
        }
      }
    }

    // -- projectiles --
    const maxD = this.spawnRadius() + 100;
    const w2 = this.view.w / 2, h2 = this.view.h / 2;
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      // mirror rounds reflect off the screen edges
      if (p.wallB > 0) {
        if ((p.x < -w2 && p.vx < 0) || (p.x > w2 && p.vx > 0)) {
          p.vx = -p.vx;
          p.nx = -p.nx;
          p.wallB--;
          this.particles.spark(p.x, p.y, p.color, 3, 120, 2, 0.3);
        } else if ((p.y < -h2 && p.vy < 0) || (p.y > h2 && p.vy > 0)) {
          p.vy = -p.vy;
          p.ny = -p.ny;
          p.wallB--;
          this.particles.spark(p.x, p.y, p.color, 3, 120, 2, 0.3);
        }
      }
      if (p.life <= 0 || Math.abs(p.x) > maxD || Math.abs(p.y) > maxD) {
        p.dead = true;
        continue;
      }
      for (const e of this.enemies) {
        if (e.dead || p.hits.has(e.id)) continue;
        const dx = e.x - p.x, dy = e.y - p.y;
        const rs = e.r + p.r;
        if (dx * dx + dy * dy < rs * rs) {
          p.hits.add(e.id);
          const crit = chance(st.critChance);
          const dmg = p.dmg * (crit ? st.critMult : 1);
          this.damageEnemy(e, dmg, p.nx * st.knockback, p.ny * st.knockback, crit);

          // storm eye artifact: chain lightning arcs to nearby enemies
          if (st.chainChance > 0 && chance(st.chainChance)) {
            let arcs = 0;
            for (const o of this.enemies) {
              if (o === e || o.dead || arcs >= 2) continue;
              const od = Math.hypot(o.x - e.x, o.y - e.y);
              if (od < 160) {
                arcs++;
                this.damageEnemy(o, dmg * 0.5, 0, 0, false, false, 'tesla');
                this.zaps.push({ x1: e.x, y1: e.y, x2: o.x, y2: o.y, t: 0.12 });
              }
            }
            if (arcs > 0) this.audio.play('zap');
          }

          // explosive rounds: AoE splash around the impact
          if (st.explosionPct > 0) {
            const eR = st.explosionRadius;
            for (const o of this.enemies) {
              if (o === e || o.dead) continue;
              const ox = o.x - p.x, oy = o.y - p.y;
              const od2 = ox * ox + oy * oy;
              const oRs = eR + o.r;
              if (od2 < oRs * oRs) {
                const od = Math.sqrt(od2) || 1;
                this.damageEnemy(o, p.dmg * st.explosionPct, (ox / od) * st.knockback * 0.5, (oy / od) * st.knockback * 0.5, false, true);
              }
            }
            if (this.particles.rings.length < 18) this.particles.ring(p.x, p.y, '#ffb13d', eR * 0.8, 2);
          }

          if (p.pierce > 0) {
            p.pierce--;
          } else if (p.bounce > 0) {
            // ricochet to the nearest enemy this bullet hasn't touched
            p.bounce--;
            let nt = null, nd = 260 * 260;
            for (const o of this.enemies) {
              if (o.dead || p.hits.has(o.id)) continue;
              const ox = o.x - p.x, oy = o.y - p.y;
              const od2 = ox * ox + oy * oy;
              if (od2 < nd) { nd = od2; nt = o; }
            }
            if (nt) {
              const a = Math.atan2(nt.y - p.y, nt.x - p.x);
              p.nx = Math.cos(a);
              p.ny = Math.sin(a);
              const spd = Math.hypot(p.vx, p.vy);
              p.vx = p.nx * spd;
              p.vy = p.ny * spd;
            } else {
              p.dead = true;
              break;
            }
          } else {
            p.dead = true;
            break;
          }
        }
      }
    }

    // -- auto-nova: fire itself at the densest cluster --
    if (st.autoBlast && this.blastTimer <= 0) {
      const near = this.nearestEnemy(0, 0);
      const threatened = near && Math.hypot(near.x, near.y) < CORE_R + 90;
      if (this.enemies.length >= 6 || threatened) {
        const target = threatened ? near : this.findClusterTarget();
        if (target) this.tryBlast(target.x, target.y);
      }
    }

    // -- cleanup --
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.enemyProjectiles = this.enemyProjectiles.filter((p) => !p.dead);
  }

  // ---------- persistence ----------

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1,
        gold: this.gold,
        up: this.up,
        shards: this.shards,
        shardUp: this.shardUp,
        bestWave: this.bestWave,
        wave: this.wave,
        perks: this.perks,
        speed: this.speed,
        opts: this.opts,
        life: this.life,
        ach: this.ach,
        coreClass: this.coreClass,
        classesOwned: this.classesOwned,
        artifacts: this.artifacts,
        equipped: this.equipped,
        daily: this.daily,
        tp: this.tp,
        tech: this.tech,
        gearInv: this.gearInv,
        gearEq: this.gearEq,
        scrap: this.scrap,
        nextGearId: this.nextGearId,
        ts: Date.now(),
        mute: !this.audio.enabled,
      }));
    } catch (e) { /* storage unavailable */ }
  }

  load() {
    this.savedWave = 0;
    this.savedPerks = null;
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d) return;
      this.gold = d.gold || 0;
      this.up = d.up || {};
      this.shards = d.shards || 0;
      this.shardUp = d.shardUp || {};
      this.bestWave = d.bestWave || 1;
      this.savedWave = d.wave || 0;
      this.savedPerks = d.perks || null;
      this.speed = d.speed || 1;
      if (d.opts) this.opts = Object.assign(this.opts, d.opts);
      if (d.life) this.life = Object.assign(this.life, d.life);
      this.ach = d.ach || {};
      this.coreClass = d.coreClass || 'assault';
      this.classesOwned = d.classesOwned || { assault: true };
      this.artifacts = d.artifacts || {};
      this.equipped = d.equipped || [];
      if (d.daily) this.daily = d.daily;
      this.tp = d.tp || 0;
      this.tech = d.tech || {};
      this.gearInv = d.gearInv || [];
      this.gearEq = d.gearEq || {};
      this.scrap = d.scrap || 0;
      this.nextGearId = d.nextGearId || 1;
      this.savedTs = d.ts || 0;
      this.audio.enabled = !d.mute;
    } catch (e) { /* corrupt save — start fresh */ }
  }
}
