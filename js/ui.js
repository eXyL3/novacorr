import { UPGRADES, SHARD_UPGRADES, ACHIEVEMENTS, THEMES, CLASSES, ARTIFACTS, RARITY, BUILDINGS, TECH_TREE, TECH_BRANCHES, GEAR_SLOTS, GEAR_MODS, GEAR_RARITY } from './config.js';
import { fmt } from './utils.js';

const $ = (id) => document.getElementById(id);

export function initUI(game, audio) {
  const goldVal = $('goldVal'), waveVal = $('waveVal'), shardVal = $('shardVal'), bestVal = $('bestVal');
  const shop = $('shop'), shopGrid = $('shopGrid'), shopToggle = $('shopToggle');
  const banner = $('waveBanner'), hint = $('hint');
  const overlay = $('overlay'), shardGrid = $('shardGrid');
  const waveProg = $('waveProg');

  // ---------- upgrade shop: tabs + quantity ----------

  let currentTab = 'offense';
  const QTYS = [1, 10, 'max'];
  let qtyIdx = 0;

  const cards = new Map();
  for (const def of UPGRADES) {
    const btn = document.createElement('button');
    btn.className = 'card';
    btn.dataset.cat = def.cat;
    btn.innerHTML = `
      <div class="cTop"><span>${def.icon} ${def.name}</span><span class="cLvl"></span></div>
      <div class="cDesc"></div>
      <div class="cCost"></div>`;
    btn.addEventListener('click', () => {
      audio.ensure();
      if (game.buyUpgrade(def.id, QTYS[qtyIdx]) > 0) refreshShop();
    });
    shopGrid.appendChild(btn);
    cards.set(def.id, {
      btn, def,
      lvl: btn.querySelector('.cLvl'),
      desc: btn.querySelector('.cDesc'),
      cost: btn.querySelector('.cCost'),
    });
  }

  function bundleCost(def, lvl, count) {
    let total = 0;
    for (let i = 0; i < count; i++) total += game.upCost(def, lvl + i);
    return total;
  }

  function maxInfo(def, lvl) {
    let n = 0, total = 0, g = game.gold, l = lvl;
    while (l < def.max && n < 1000) {
      const c = game.upCost(def, l);
      if (g < c) break;
      g -= c;
      total += c;
      n++;
      l++;
    }
    return { n, total };
  }

  function refreshShop() {
    const qty = QTYS[qtyIdx];
    for (const { btn, def, lvl: lvlEl, desc, cost } of cards.values()) {
      btn.style.display = def.cat === currentTab ? '' : 'none';
      if (def.cat !== currentTab) continue;
      const lvl = game.up[def.id] || 0;
      const maxed = lvl >= def.max;
      lvlEl.textContent = 'LV ' + lvl + (def.max <= 30 ? '/' + def.max : '');
      desc.textContent = def.desc(game.stats);
      btn.classList.remove('affordable', 'maxed');
      if (maxed) {
        cost.textContent = 'MAXED';
        btn.classList.add('maxed');
      } else if (qty === 'max') {
        const m = maxInfo(def, lvl);
        if (m.n > 0) {
          cost.textContent = `×${m.n} 🜚 ${fmt(m.total)}`;
          btn.classList.add('affordable');
        } else {
          cost.textContent = '🜚 ' + fmt(game.upCost(def, lvl));
        }
      } else {
        const k = Math.min(qty, def.max - lvl);
        const total = bundleCost(def, lvl, k);
        cost.textContent = '🜚 ' + fmt(total) + (k > 1 ? ` (×${k})` : '');
        if (game.gold >= total) btn.classList.add('affordable');
      }
    }
  }

  for (const tab of document.querySelectorAll('#shopTabs .tab')) {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab;
      for (const t of document.querySelectorAll('#shopTabs .tab')) {
        t.classList.toggle('active', t === tab);
      }
      refreshShop();
    });
  }

  const qtyBtn = $('qtyBtn');
  qtyBtn.addEventListener('click', () => {
    qtyIdx = (qtyIdx + 1) % QTYS.length;
    qtyBtn.textContent = QTYS[qtyIdx] === 'max' ? 'MAX' : '×' + QTYS[qtyIdx];
    refreshShop();
  });

  shopToggle.addEventListener('click', () => {
    audio.ensure();
    const open = shop.classList.toggle('open');
    document.body.classList.toggle('shopOpen', open);
    shopToggle.textContent = open ? '▼ CLOSE' : '▲ UPGRADES';
    if (open) refreshShop();
  });

  // ---------- build bar ----------

  const buildBtns = Array.from(document.querySelectorAll('.buildBtn'));
  for (const btn of buildBtns) {
    btn.addEventListener('click', () => {
      audio.ensure();
      const type = btn.dataset.build;
      game.buildSelect = game.buildSelect === type ? null : type;
      syncBuildBar();
    });
  }

  function syncBuildBar() {
    for (const btn of buildBtns) {
      const type = btn.dataset.build;
      const cost = game.buildingCost(type);
      const count = game.buildingCount(type);
      const limit = BUILDINGS[type].limit;
      btn.querySelector('.bCost').textContent = count >= limit ? `${count}/${limit}` : fmt(cost);
      btn.classList.toggle('selected', game.buildSelect === type);
      btn.classList.toggle('affordable', game.gold >= cost && count < limit);
    }
  }

  // ---------- top buttons ----------

  const speedBtn = $('speedBtn');
  const syncSpeed = () => {
    speedBtn.textContent = game.speed + '×';
    speedBtn.classList.toggle('fast', game.speed > 1);
  };
  syncSpeed();
  speedBtn.addEventListener('click', () => {
    audio.ensure();
    game.speed = (game.speed % 3) + 1;
    syncSpeed();
    game.save();
  });

  const pauseBtn = $('pauseBtn');
  const pausedLabel = $('pausedLabel');
  const syncPause = () => {
    pauseBtn.textContent = game.paused ? '▶' : '⏸';
    pausedLabel.classList.toggle('hidden', !game.paused);
  };
  pauseBtn.addEventListener('click', () => {
    audio.ensure();
    game.paused = !game.paused;
    syncPause();
  });

  const muteBtn = $('muteBtn');
  const syncMute = () => { muteBtn.textContent = audio.enabled ? '🔊' : '🔇'; };
  syncMute();
  muteBtn.addEventListener('click', () => {
    audio.enabled = !audio.enabled;
    if (audio.enabled) audio.ensure();
    syncMute();
    game.save();
  });

  $('sacrificeBtn').addEventListener('click', () => {
    if (game.state !== 'play') return;
    const earned = game.shardPreview();
    if (confirm(`Sacrifice your core now?\n\nYou will earn ${earned} shard${earned === 1 ? '' : 's'} and restart with permanent shard upgrades. Gold and gold upgrades are lost.`)) {
      audio.ensure();
      game.gameOver(true);
    }
  });

  // ---------- settings ----------

  const settings = $('settings');
  let pausedBeforeSettings = false;

  function syncSettings() {
    $('setSound').textContent = audio.enabled ? 'ON' : 'OFF';
    $('setSound').classList.toggle('on', audio.enabled);
    $('setShake').textContent = game.opts.shake ? 'ON' : 'OFF';
    $('setShake').classList.toggle('on', game.opts.shake);
    $('setDmg').textContent = game.opts.dmgText ? 'ON' : 'OFF';
    $('setDmg').classList.toggle('on', game.opts.dmgText);
    $('setQual').textContent = game.opts.quality === 'high' ? 'HIGH' : 'LOW';
    $('setQual').classList.toggle('on', game.opts.quality === 'high');
    const th = THEMES.find((x) => x.id === game.opts.theme) || THEMES[0];
    $('setTheme').textContent = th.name.toUpperCase();
    $('setTheme').classList.add('on');
  }

  $('settingsBtn').addEventListener('click', () => {
    audio.ensure();
    pausedBeforeSettings = game.paused;
    game.paused = true;
    syncPause();
    pausedLabel.classList.add('hidden');
    syncSettings();
    settings.classList.remove('hidden');
  });

  $('closeSettings').addEventListener('click', () => {
    settings.classList.add('hidden');
    game.paused = pausedBeforeSettings;
    syncPause();
    game.save();
  });

  $('setSound').addEventListener('click', () => {
    audio.enabled = !audio.enabled;
    if (audio.enabled) audio.ensure();
    syncMute();
    syncSettings();
  });
  $('setShake').addEventListener('click', () => {
    game.opts.shake = !game.opts.shake;
    game.applyOpts();
    syncSettings();
  });
  $('setDmg').addEventListener('click', () => {
    game.opts.dmgText = !game.opts.dmgText;
    syncSettings();
  });
  $('setQual').addEventListener('click', () => {
    game.opts.quality = game.opts.quality === 'high' ? 'low' : 'high';
    game.applyOpts();
    syncSettings();
  });
  $('setTheme').addEventListener('click', () => {
    const idx = THEMES.findIndex((x) => x.id === game.opts.theme);
    for (let i = 1; i <= THEMES.length; i++) {
      const cand = THEMES[(idx + i) % THEMES.length];
      if (game.bestWave >= cand.need) {
        game.opts.theme = cand.id;
        break;
      }
    }
    syncSettings();
  });

  $('resetSave').addEventListener('click', () => {
    if (!confirm('Reset ALL progress? Gold, shards and every upgrade will be wiped.')) return;
    if (!confirm('Really? This cannot be undone.')) return;
    try { localStorage.removeItem('novaCoreSave_v1'); } catch (e) { /* ignore */ }
    location.reload();
  });

  // ---------- wave banner & events ----------

  let bannerTimer = null;
  function showBanner(txt, cls) {
    banner.textContent = txt;
    banner.classList.remove('hidden', 'boss', 'event');
    if (cls) banner.classList.add(cls);
    banner.style.animation = 'none';
    void banner.offsetWidth;
    banner.style.animation = '';
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.add('hidden'), 1900);
  }

  game.onWave = (n, isBoss, mutName, bossName) => {
    let txt = isBoss ? `⚠ ${bossName || 'BOSS'} — WAVE ${n} ⚠` : `WAVE ${n}`;
    if (mutName) txt += ` — ${mutName}`;
    showBanner(txt, isBoss ? 'boss' : null);
  };

  game.onEvent = (name) => showBanner(name, 'event');

  // ---------- perk draft ----------

  const perkOverlay = $('perkOverlay');
  const perkGrid = $('perkGrid');
  game.onPerkOffer = (choices) => {
    perkGrid.innerHTML = '';
    for (const pk of choices) {
      const owned = game.perks[pk.id] || 0;
      const btn = document.createElement('button');
      btn.className = 'perkOpt';
      btn.innerHTML = `
        <span class="pIcon">${pk.icon}</span>
        <span class="pName">${pk.name}</span>
        <span class="pDesc">${pk.desc}</span>
        ${owned ? `<span class="pOwn">OWNED ×${owned}</span>` : ''}`;
      btn.addEventListener('click', () => {
        audio.ensure();
        perkOverlay.classList.add('hidden');
        game.choosePerk(pk.id);
      });
      perkGrid.appendChild(btn);
    }
    perkOverlay.classList.remove('hidden');
  };

  // ---------- ability bar ----------

  const abSing = $('abSing'), abOd = $('abOd'), abUlt = $('abUlt');
  const abSingCd = abSing.querySelector('.abCd'), abOdCd = abOd.querySelector('.abCd');
  const abUltCd = abUlt.querySelector('.abCd');
  abSing.addEventListener('click', () => { audio.ensure(); game.activateSingularity(); });
  abOd.addEventListener('click', () => { audio.ensure(); game.activateOverdrive(); });
  abUlt.addEventListener('click', () => { audio.ensure(); game.activateUltimate(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === '1') game.activateSingularity();
    else if (e.key === '2') game.activateOverdrive();
    else if (e.key === '3') game.activateUltimate();
    else if (e.key === 'Escape') {
      game.buildSelect = null;
      syncBuildBar();
    } else if (e.key === ' ' && game.state === 'play') {
      e.preventDefault();
      const t = game.findClusterTarget();
      game.tryBlast(t ? t.x : 0, t ? t.y : 0);
    }
  });

  function tickAbility(btn, cdEl, lvl, timer, active) {
    btn.classList.toggle('hidden', lvl <= 0);
    if (lvl <= 0) return;
    btn.classList.toggle('ready', timer <= 0 && !active);
    btn.classList.toggle('active', !!active);
    cdEl.textContent = active ? '' : timer > 0 ? Math.ceil(timer) : '';
  }

  // ---------- achievements & lifetime stats ----------

  const achOverlay = $('achievements');
  const achList = $('achList');
  const toast = $('toast');

  function showToast(html) {
    toast.innerHTML = html;
    toast.classList.remove('hidden');
    toast.style.animation = 'none';
    void toast.offsetWidth;
    toast.style.animation = '';
  }

  function buildAchList() {
    const L = game.life;
    $('lifeStats').innerHTML =
      `${fmt(L.kills)} kills • ${L.bossKills} bosses • best combo ×${L.maxCombo}<br>` +
      `${L.runs} rebuilds • ${L.ults} ultimates • best wave ${game.bestWave}`;
    achList.innerHTML = '';
    for (const a of ACHIEVEMENTS) {
      const done = !!game.ach[a.id];
      const row = document.createElement('div');
      row.className = 'achRow' + (done ? ' done' : '');
      row.innerHTML = `
        <div><div class="aName">${done ? '🏆' : '🔒'} ${a.name}</div><div class="aDesc">${a.desc}</div></div>
        <div class="aReward">${done ? '✓' : '+' + a.reward + ' ◆'}</div>`;
      achList.appendChild(row);
    }
  }

  $('achBtn').addEventListener('click', () => {
    audio.ensure();
    buildAchList();
    achOverlay.classList.remove('hidden');
  });
  $('closeAch').addEventListener('click', () => achOverlay.classList.add('hidden'));

  game.onAchievement = (a) => showToast(`🏆 ${a.name} &nbsp;+${a.reward} ◆`);

  // ---------- artifacts ----------

  const artPanel = $('artifactsPanel');
  const artGrid = $('artGrid');

  function buildArtGrid() {
    artGrid.innerHTML = '';
    for (const a of ARTIFACTS) {
      const owned = game.artifacts[a.id] || 0;
      const equipped = game.equipped.indexOf(a.id) >= 0;
      const btn = document.createElement('button');
      btn.className = 'artBtn' + (owned ? '' : ' locked') + (equipped ? ' equipped' : '');
      btn.style.borderColor = owned ? RARITY[a.rarity].color : '';
      btn.innerHTML = `
        <span class="aIcon">${owned ? a.icon : '❓'}</span>
        <span class="aName" style="color:${RARITY[a.rarity].color}">${owned ? a.name : '???'}</span>
        <span class="aDesc">${owned ? a.desc : a.rarity.toUpperCase() + ' — defeat bosses'}</span>
        ${equipped ? '<span class="aDesc" style="color:#4dff88">EQUIPPED</span>' : ''}`;
      if (owned) {
        btn.addEventListener('click', () => {
          game.toggleArtifact(a.id);
          buildArtGrid();
        });
      }
      artGrid.appendChild(btn);
    }
  }

  $('artBtn').addEventListener('click', () => {
    audio.ensure();
    buildArtGrid();
    artPanel.classList.remove('hidden');
  });
  $('closeArt').addEventListener('click', () => artPanel.classList.add('hidden'));

  game.onArtifact = (a, dupe, dupShards) => {
    showToast(dupe
      ? `🎒 ${a.name} (dupe) → +${dupShards} ◆`
      : `🎒 NEW ARTIFACT: <span style="color:${RARITY[a.rarity].color}">${a.name}</span>`);
  };

  // ---------- tech tree ----------

  const techPanel = $('techPanel');
  const techCols = $('techCols');

  function buildTechTree() {
    $('tpBal').textContent = `— ${fmt(game.tp)} ⚛`;
    techCols.innerHTML = '';
    for (const br of TECH_BRANCHES) {
      const col = document.createElement('div');
      col.className = 'techBranch';
      col.innerHTML = `<div class="tbName" style="color:${br.color}">${br.name}</div>`;
      for (const node of TECH_TREE.filter((n) => n.branch === br.id)) {
        const bought = !!game.tech[node.id];
        const reqOk = !node.req || !!game.tech[node.req];
        const btn = document.createElement('button');
        btn.className = 'techNode ' + (bought ? 'bought' : !reqOk ? 'locked' : game.tp >= node.cost ? 'avail' : 'locked');
        btn.innerHTML = `
          <span class="tnName" style="color:${br.color}">${node.icon} ${node.name}</span>
          <span class="tnDesc">${node.desc}</span>
          <span class="tnCost">${bought ? '✓ RESEARCHED' : '⚛ ' + node.cost}</span>`;
        if (!bought && reqOk) {
          btn.addEventListener('click', () => {
            if (game.buyTech(node.id)) buildTechTree();
          });
        }
        col.appendChild(btn);
      }
      techCols.appendChild(col);
    }
  }

  $('techBtn').addEventListener('click', () => {
    audio.ensure();
    buildTechTree();
    techPanel.classList.remove('hidden');
  });
  $('closeTech').addEventListener('click', () => techPanel.classList.add('hidden'));

  // ---------- gear / inventory ----------

  const gearPanel = $('gearPanel');
  const gearSlotsEl = $('gearSlots');
  const gearGrid = $('gearGrid');
  const gearDetail = $('gearDetail');
  let selGear = null;

  function modLine(item, s) {
    const m = GEAR_MODS[s.k];
    const v = s.v * (1 + 0.08 * (item.enh || 0));
    return `+${m.pct ? Math.round(v) + '%' : v.toFixed(1) + 's'} ${m.label}`;
  }

  function buildGearPanel() {
    $('scrapBal').textContent = `— ${fmt(game.scrap)} 🔩 scrap`;
    // equip slots
    gearSlotsEl.innerHTML = '';
    for (const slot in GEAR_SLOTS) {
      const def = GEAR_SLOTS[slot];
      const item = game.gearEq[slot] ? game.gearById(game.gearEq[slot]) : null;
      const div = document.createElement('button');
      div.className = 'gearSlot' + (item ? ' filled' : '');
      if (item) div.style.borderColor = GEAR_RARITY[item.rarity].color;
      div.innerHTML = `
        <span class="gsIcon">${def.icon}</span>
        <span class="gsName" style="color:${item ? GEAR_RARITY[item.rarity].color : ''}">${item ? item.name : def.name}</span>`;
      div.addEventListener('click', () => {
        if (item) { selGear = item.id; buildGearPanel(); }
      });
      gearSlotsEl.appendChild(div);
    }
    // detail
    const sel = selGear ? game.gearById(selGear) : null;
    gearDetail.classList.toggle('hidden', !sel);
    if (sel) {
      const R = GEAR_RARITY[sel.rarity];
      const equipped = game.gearEq[sel.slot] === sel.id;
      gearDetail.innerHTML = `
        <div class="gdName" style="color:${R.color}">${GEAR_SLOTS[sel.slot].icon} ${sel.name}
          ${sel.enh ? '+' + sel.enh : ''} <span style="color:var(--dim)">· LV ${sel.lvl} ${sel.rarity.toUpperCase()}</span></div>
        ${sel.stats.map((s) => `<div class="gdStat">${modLine(sel, s)}</div>`).join('')}
        <div class="gdBtns">
          <button id="gdEquip">${equipped ? 'UNEQUIP' : 'EQUIP'}</button>
          <button id="gdEnh">ENHANCE 🔩${fmt(game.enhanceCost(sel))}</button>
          <button id="gdSalv">SALVAGE +🔩</button>
        </div>`;
      $('gdEquip').addEventListener('click', () => {
        if (equipped) game.unequipGear(sel.slot);
        else game.equipGear(sel.id);
        buildGearPanel();
      });
      $('gdEnh').addEventListener('click', () => {
        game.enhanceGear(sel.id);
        buildGearPanel();
      });
      $('gdSalv').addEventListener('click', () => {
        game.salvageGear(sel.id);
        selGear = null;
        buildGearPanel();
      });
    }
    // inventory
    gearGrid.innerHTML = '';
    const sorted = game.gearInv.slice().sort((a, b) =>
      Object.keys(GEAR_RARITY).indexOf(b.rarity) - Object.keys(GEAR_RARITY).indexOf(a.rarity) || b.lvl - a.lvl);
    for (const item of sorted) {
      const R = GEAR_RARITY[item.rarity];
      const equipped = game.gearEq[item.slot] === item.id;
      const btn = document.createElement('button');
      btn.className = 'gearItem' + (equipped ? ' equippedItem' : '') + (selGear === item.id ? ' selItem' : '');
      btn.style.borderColor = R.color;
      btn.innerHTML = `
        <span class="giName" style="color:${R.color}">${GEAR_SLOTS[item.slot].icon} ${item.name}${item.enh ? ' +' + item.enh : ''}</span>
        <span class="giSub">LV ${item.lvl}${equipped ? ' · EQUIPPED' : ''}</span>`;
      btn.addEventListener('click', () => {
        selGear = item.id;
        buildGearPanel();
      });
      gearGrid.appendChild(btn);
    }
    if (game.gearInv.length === 0) {
      gearGrid.innerHTML = '<span style="color:var(--dim);font-size:12px">No gear yet — elites and bosses drop equipment.</span>';
    }
  }

  $('gearBtn').addEventListener('click', () => {
    audio.ensure();
    buildGearPanel();
    gearPanel.classList.remove('hidden');
  });
  $('closeGear').addEventListener('click', () => gearPanel.classList.add('hidden'));

  game.onGear = (item, autoScrap) => {
    const R = GEAR_RARITY[item.rarity];
    showToast(autoScrap > 0
      ? `🎽 ${item.name} → bag full, +${autoScrap} 🔩`
      : `🎽 LOOT: <span style="color:${R.color}">${item.name}</span>`);
  };

  // ---------- classes (game over screen) ----------

  const classRow = $('classRow');

  function buildClassRow() {
    classRow.innerHTML = '';
    for (const c of CLASSES) {
      const owned = !!game.classesOwned[c.id];
      const sel = game.coreClass === c.id;
      const btn = document.createElement('button');
      btn.className = 'classBtn' + (sel ? ' sel' : '') + (owned ? '' : ' locked');
      btn.innerHTML = `
        <span class="clName">${c.icon} ${c.name}</span>
        <span class="clDesc">${c.desc}</span>
        ${owned ? (sel ? '<span class="clCost">SELECTED</span>' : '') : `<span class="clCost">◆ ${c.cost}</span>`}`;
      btn.addEventListener('click', () => {
        if (owned) game.selectClass(c.id);
        else if (game.unlockClass(c.id)) game.selectClass(c.id);
        buildClassRow();
        refreshShards();
      });
      classRow.appendChild(btn);
    }
  }

  // ---------- game over / prestige ----------

  const shardCards = new Map();
  for (const def of SHARD_UPGRADES) {
    const btn = document.createElement('button');
    btn.className = 'card shardCard';
    btn.innerHTML = `
      <div class="cTop"><span>${def.icon} ${def.name}</span><span class="cLvl"></span></div>
      <div class="cDesc"></div>
      <div class="cCost"></div>`;
    btn.addEventListener('click', () => {
      if (game.buyShardUpgrade(def.id)) refreshShards();
    });
    shardGrid.appendChild(btn);
    shardCards.set(def.id, {
      btn,
      lvl: btn.querySelector('.cLvl'),
      desc: btn.querySelector('.cDesc'),
      cost: btn.querySelector('.cCost'),
    });
  }

  function refreshShards() {
    $('overShardBal').textContent = `— ${fmt(game.shards)} ◆ available`;
    for (const def of SHARD_UPGRADES) {
      const c = shardCards.get(def.id);
      const lvl = game.shardUp[def.id] || 0;
      const maxed = lvl >= def.max;
      c.lvl.textContent = 'LV ' + lvl;
      c.desc.textContent = def.desc(lvl) + (maxed ? '' : ` → ${def.desc(lvl + 1).toLowerCase()}`);
      if (maxed) {
        c.cost.textContent = 'MAXED';
        c.btn.className = 'card shardCard maxed';
      } else {
        const cost = game.upCost(def, lvl);
        c.cost.textContent = '◆ ' + fmt(cost);
        c.btn.className = 'card shardCard' + (game.shards >= cost ? ' affordable' : '');
      }
    }
  }

  game.onGameOver = (earned, sacrificed) => {
    $('overTitle').textContent = sacrificed ? 'CORE SACRIFICED' : 'CORE DESTROYED';
    $('overStats').innerHTML =
      `Reached wave <b>${game.wave}</b> &nbsp;•&nbsp; ${fmt(game.kills)} kills &nbsp;•&nbsp; best wave <b>${game.bestWave}</b>`;
    $('overShards').textContent = `+${earned} ◆ CORE SHARDS`;
    buildClassRow();
    refreshShards();
    shop.classList.remove('open');
    document.body.classList.remove('shopOpen');
    shopToggle.textContent = '▲ UPGRADES';
    overlay.classList.remove('hidden');
  };

  $('rebuildBtn').addEventListener('click', () => {
    audio.ensure();
    overlay.classList.add('hidden');
    game.rebuild();
    refreshShop();
  });

  // ---------- welcome back (offline + daily) ----------

  if (game.offlineEarn > 0 || game.dailyShards > 0) {
    const lines = [];
    if (game.offlineEarn > 0) {
      lines.push(`Your core kept fighting while you were away:<br><span class="big">+${fmt(game.offlineEarn)} 🜚</span>`);
    }
    if (game.dailyShards > 0) {
      lines.push(`Daily reward — day ${game.daily.streak} streak:<br><span class="big">+${game.dailyShards} ◆ shards</span>`);
    }
    $('welcomeBody').innerHTML = lines.join('<br><br>');
    const welcome = $('welcome');
    welcome.classList.remove('hidden');
    game.paused = true;
    syncPause();
    pausedLabel.classList.add('hidden');
    $('claimBtn').addEventListener('click', () => {
      welcome.classList.add('hidden');
      game.paused = false;
      syncPause();
      audio.ensure();
      audio.play('shard');
    }, { once: true });
  }

  // ---------- per-frame HUD ----------

  const combo = $('combo');
  const buffsEl = $('buffs');
  const bountyLine = $('bountyLine');
  let hudT = 0;
  let hintT = 0;
  let hintGone = false;

  function bountyText(b) {
    switch (b.id) {
      case 'blastkills': return `★ BOUNTY: BLAST-KILL ${b.prog}/${b.target}`;
      case 'fling':      return `★ BOUNTY: FLING-KILL ${b.prog}/${b.target}`;
      case 'pickups':    return `★ BOUNTY: COLLECT ${b.prog}/${b.target} POWER-UPS`;
      case 'combo':      return `★ BOUNTY: REACH ×${b.target} COMBO (${b.prog})`;
      case 'nodamage':   return '★ BOUNTY: TAKE NO CORE DAMAGE (+1◆)';
      case 'speed':      return `★ BOUNTY: CLEAR IN ${Math.max(0, Math.ceil(b.target - (game.time - game.waveStart)))}s (+1◆)`;
      default: return '';
    }
  }

  function tick(dt) {
    hudT += dt;
    if (hudT < 0.12) return;
    hudT = 0;
    goldVal.textContent = fmt(game.gold);
    waveVal.textContent = game.wave;
    shardVal.textContent = fmt(game.shards);
    $('tpVal').textContent = fmt(game.tp);
    bestVal.textContent = game.bestWave;
    waveProg.style.width = (game.waveTotal > 0
      ? Math.min(100, 100 * game.waveKills / game.waveTotal)
      : 0) + '%';
    if (game.bounty && game.state === 'play') {
      bountyLine.classList.remove('hidden');
      bountyLine.classList.toggle('done', game.bounty.done);
      bountyLine.textContent = game.bounty.done ? '✔ BOUNTY COMPLETE' : bountyText(game.bounty);
    } else {
      bountyLine.classList.add('hidden');
    }
    if (game.combo >= 5 && game.state === 'play') {
      combo.textContent = `COMBO ×${game.combo} — +${Math.round((game.comboMult() - 1) * 100)}% GOLD`;
      combo.classList.remove('hidden');
    } else {
      combo.classList.add('hidden');
    }
    tickAbility(abSing, abSingCd, game.stats.singLvl, game.singTimer, game.singActive);
    tickAbility(abOd, abOdCd, game.stats.odLvl, game.odTimer, game.odActive > 0);
    const ultPct = Math.min(100, Math.round(100 * game.ultCharge / game.stats.ultNeed));
    abUlt.classList.toggle('charged', ultPct >= 100);
    abUltCd.textContent = ultPct >= 100 ? '' : ultPct + '%';
    const b = [];
    if (game.frenzyT > 0) b.push(`<span style="color:#ff9d3d">⚡ FRENZY ${Math.ceil(game.frenzyT)}s</span>`);
    if (game.quadT > 0) b.push(`<span style="color:#c77dff">✦ 3× DMG ${Math.ceil(game.quadT)}s</span>`);
    if (game.odActive > 0) b.push(`<span style="color:#ffb13d">🔥 OVERDRIVE ${Math.ceil(game.odActive)}s</span>`);
    buffsEl.innerHTML = b.join('');
    syncBuildBar();
    if (shop.classList.contains('open')) refreshShop();
    if (!hintGone) {
      hintT += 0.12;
      if (hintT > 9) hideHint();
    }
  }

  function hideHint() {
    if (hintGone) return;
    hintGone = true;
    hint.classList.add('faded');
  }

  refreshShop();
  syncBuildBar();
  return { tick, hideHint, syncBuildBar };
}
