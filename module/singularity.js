/**
 * Singularity System for Foundry VTT
 */

import { SingularityActor } from "./actor/actor.js";
import { SingularityActorSheetHero } from "./actor/hero-sheet.js";
import { SingularityActorSheetNPC } from "./actor/npc-sheet.js";
import { SingularityItem } from "./item/item.js";
import { SingularityItemSheet } from "./item/item-sheet.js";
import { importVanguard } from "./utilities/import-pregens.js";

const syncTokenHpBars = async (actor) => {
  if (!actor) return;
  const value = actor.system?.combat?.hp?.value ?? 0;
  const max = actor.system?.combat?.hp?.max ?? 0;
  for (const scene of game.scenes) {
    const updates = [];
    for (const token of scene.tokens) {
      if (token.actorId !== actor.id) continue;
      // Only update linked tokens (unlinked tokens intentionally have independent HP)
      if (!token.actorLink) continue;
      const currentBar = token.bar1 || {};
      const currentValue = currentBar.value ?? null;
      const currentMax = currentBar.max ?? null;
      const currentAttr = currentBar.attribute ?? null;
      // If already matching and attribute is correct, skip
      if (currentValue === value && currentMax === max && currentAttr === "combat.hp") continue;
      // Ensure the token's bar attribute points to our system HP path and set values
      updates.push({
        _id: token.id,
        bar1: { attribute: "combat.hp", value, max }
      });
    }
    if (updates.length) {
      await scene.updateEmbeddedDocuments("Token", updates);
    }
  }
};

const hasProtectiveBarrierTalent = (actor) => {
  if (!actor) return false;
  const progression = actor.system?.progression || {};
  for (let lvl = 1; lvl <= 20; lvl++) {
    const levelKey = `level${lvl}`;
    const levelData = progression[levelKey] || {};
    const name = String(levelData.bastionTalentName || "").toLowerCase();
    if (name.includes("protective barrier")) {
      return true;
    }
  }
  return false;
};

const hasGuardianAuraTalent = (actor) => {
  if (!actor) return false;
  const progression = actor.system?.progression || {};
  for (let lvl = 1; lvl <= 20; lvl++) {
    const levelKey = `level${lvl}`;
    const levelData = progression[levelKey] || {};
    const name = String(levelData.bastionTalentName || "").toLowerCase();
    if (name.includes("guardian aura")) {
      return true;
    }
  }
  return false;
};

const hasUnbreakableTalent = (actor) => {
  if (!actor) return false;
  const progression = actor.system?.progression || {};
  for (let lvl = 1; lvl <= 20; lvl++) {
    const levelKey = `level${lvl}`;
    const levelData = progression[levelKey] || {};
    const name = String(levelData.bastionTalentName || "").toLowerCase();
    if (name.includes("unbreakable")) {
      return true;
    }
  }
  return false;
};

const getUnbreakableMaxUses = (actor) => {
  if (!actor) return 1;
  const getModifier = actor.getAbilityModifier?.bind(actor);
  let enduranceMod = 0;
  if (getModifier) {
    enduranceMod = Number(getModifier("endurance")) || 0;
  } else {
    const enduranceScore = Number(actor.system?.abilities?.endurance || 0);
    enduranceMod = Math.floor(enduranceScore / 2);
  }
  return Math.max(1, enduranceMod);
};

const isProtectiveBarrierActive = (actor) => {
  const powersetName = actor?.system?.progression?.level1?.powersetName || actor?.system?.basic?.powerset;
  if (powersetName !== "Bastion") return false;
  const active = actor?.system?.combat?.protectiveBarrier?.active === true;
  return active && hasProtectiveBarrierTalent(actor);
};

const getProtectiveBarrierBonus = (actor) => {
  const level = Number(actor?.system?.basic?.primeLevel || 1);
  if (level >= 20) return 3;
  if (level >= 15) return 2;
  return 1;
};

const getProtectiveBarrierRange = (actor) => {
  return hasGuardianAuraTalent(actor) ? 25 : 15;
};

const getTokenCenter = (tokenDoc) => {
  const token = tokenDoc?.object;
  if (token?.center) return token.center;
  const gridSize = canvas?.grid?.size || 1;
  const width = Number(tokenDoc?.width || 1) * gridSize;
  const height = Number(tokenDoc?.height || 1) * gridSize;
  return {
    x: Number(tokenDoc?.x || 0) + width / 2,
    y: Number(tokenDoc?.y || 0) + height / 2
  };
};

const measureTokenDistance = (tokenA, tokenB) => {
  if (!canvas?.grid) return Number.POSITIVE_INFINITY;
  const a = getTokenCenter(tokenA);
  const b = getTokenCenter(tokenB);
  return canvas.grid.measureDistance(a, b);
};

const getProtectiveBarrierEffect = (actor) => {
  if (!actor) return null;
  return actor.effects?.find(effect => effect.getFlag("singularity", "protectiveBarrier"));
};

const getGuardianAuraResistanceEffect = (actor) => {
  if (!actor) return null;
  return actor.effects?.find(effect => effect.getFlag("singularity", "guardianAuraResistance"));
};

const applyProtectiveBarrierEffect = async (actor, bonus) => {
  if (!actor) return;
  const existing = getProtectiveBarrierEffect(actor);
  if (!bonus || bonus <= 0) {
    if (existing) {
      await existing.delete();
    }
    return;
  }

  const changes = [
    {
      key: "system.combat.ac",
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      value: bonus
    }
  ];

  if (existing) {
    const currentBonus = Number(existing.getFlag("singularity", "protectiveBarrierBonus") ?? 0);
    if (currentBonus === bonus) return;
    await existing.update({
      changes,
      "flags.singularity.protectiveBarrier": true,
      "flags.singularity.protectiveBarrierBonus": bonus
    });
    return;
  }

  await actor.createEmbeddedDocuments("ActiveEffect", [
    {
      name: "Protective Barrier",
      icon: "icons/svg/shield.svg",
      changes,
      disabled: false,
      flags: {
        singularity: {
          protectiveBarrier: true,
          protectiveBarrierBonus: bonus
        }
      }
    }
  ]);
};

const applyGuardianAuraResistanceEffect = async (actor, active) => {
  if (!actor) return;
  const existing = getGuardianAuraResistanceEffect(actor);
  if (!active) {
    if (existing) {
      await existing.delete();
    }
    return;
  }

  if (existing) return;

  await actor.createEmbeddedDocuments("ActiveEffect", [
    {
      name: "Guardian Aura",
      icon: "icons/svg/shield.svg",
      changes: [],
      disabled: false,
      flags: {
        singularity: {
          guardianAuraResistance: true,
          guardianAuraResistanceValue: 5
        }
      }
    }
  ]);
};

const refreshProtectiveBarrierForScene = async (scene) => {
  if (!scene || !canvas?.scene || scene.id !== canvas.scene.id) return;
  const tokens = scene.tokens?.contents || [];
  if (!tokens.length) return;

  const bastionTokens = tokens.filter(tokenDoc => tokenDoc?.actor && isProtectiveBarrierActive(tokenDoc.actor));

  for (const tokenDoc of tokens) {
    const actor = tokenDoc?.actor;
    if (!actor) continue;
    let bestBonus = 0;
    let hasGuardianAura = false;
    for (const bastionToken of bastionTokens) {
      if (bastionToken.id === tokenDoc.id) continue;
      if (bastionToken.disposition !== tokenDoc.disposition) continue;
      const distance = measureTokenDistance(bastionToken, tokenDoc);
      const range = getProtectiveBarrierRange(bastionToken.actor);
      if (distance <= range) {
        bestBonus = Math.max(bestBonus, getProtectiveBarrierBonus(bastionToken.actor));
        if (hasGuardianAuraTalent(bastionToken.actor)) {
          hasGuardianAura = true;
        }
      }
    }
    await applyProtectiveBarrierEffect(actor, bestBonus);
    await applyGuardianAuraResistanceEffect(actor, hasGuardianAura);
  }
};

Hooks.on("preCreateActor", async function(actor, data, options, userId) {
  // Set default credits to 10 for new hero actors
  if (actor.type === "hero") {
    const currentCredits = actor.system?.equipment?.credits;
    // Set to 10 if credits is undefined, null, or 0 (for new actors)
    if (currentCredits === undefined || currentCredits === null || currentCredits === 0) {
      actor.updateSource({
        "system.equipment.credits": 10
      });
    }
  }
});

Hooks.on("updateActor", async function(actor, data, options, userId) {
  // Update token size when actor size changes
  if (data.system?.basic?.size !== undefined && actor.prototypeToken) {
    const size = data.system.basic.size || actor.system.basic.size || "Medium";
    
    // Size to grid space mapping
    const sizeToGrid = {
      "Infinitesimal": 0.5,
      "Microscopic": 0.5,
      "Minuscule": 0.5,
      "Tiny": 0.5,
      "Small": 0.5,
      "Medium": 1,
      "Large": 2,
      "Huge": 3,
      "Enormous": 4,
      "Titanic": 5,
      "Behemoth": 6
    };

    const gridSize = sizeToGrid[size] || 1;
    
    // Update prototype token
    await actor.prototypeToken.updateSource({
      width: gridSize,
      height: gridSize
    });
    
    // Update all existing tokens for this actor
    const tokens = actor.getActiveTokens();
    for (const token of tokens) {
      await token.document.update({
        width: gridSize,
        height: gridSize
      });
    }
  }
});

// Helper function to calculate initiative for an actor (defined at module level so it's accessible everywhere)
function calculateInitiative(actor) {
  if (!actor || !actor.system) return 0;
  
  const wits = actor.system?.abilities?.wits || 0;
  const initiativeData = actor.system?.combat?.initiative || { rank: "Novice", otherBonuses: 0 };
  const initiativeRank = initiativeData.rank || "Novice";
  const initiativeOtherBonuses = Number(initiativeData.otherBonuses) || 0;
  
  const initiativeTrainingBonuses = {
    "Novice": 0,
    "Apprentice": 4,
    "Competent": 8,
    "Masterful": 12,
    "Legendary": 16
  };
  const initiativeTrainingBonus = initiativeTrainingBonuses[initiativeRank] || 0;
  
  return wits + initiativeTrainingBonus + initiativeOtherBonuses;
}

Hooks.once("init", function() {
  console.log("Singularity | Initializing Singularity System");

  // Override Dialog's _getTitle method to prevent TYPES.Actor.hero format
  const originalGetTitle = Dialog.prototype._getTitle;
  Dialog.prototype._getTitle = function() {
    // If we have a stored correct title, ALWAYS use it
    if (this._singularityDialogTitle) {
      return this._singularityDialogTitle;
    }
    // Otherwise use original method
    const title = originalGetTitle.call(this);
    // If the title contains TYPES.Actor format, try to get from data.title
    if (title && (title.includes('TYPES.Actor') || title.includes('TYPES.'))) {
      // Try to get from data.title if it's a valid string
      if (this.data?.title && !this.data.title.includes('TYPES.')) {
        return this.data.title;
      }
      // Return a generic title as fallback
      return "Dialog";
    }
    return title;
  };
  
  // Override Dialog's _render method to fix title after render
  const originalRender = Dialog.prototype._render;
  Dialog.prototype._render = function(...args) {
    const storedTitle = this._singularityDialogTitle;
    const result = originalRender.apply(this, args);
    // After render, fix the title if we have a stored one
    if (storedTitle) {
      const fixTitle = () => {
        // Try multiple ways to find the dialog element
        const dialogSelectors = [
          this.element,
          this._element,
          document.querySelector('.window-app.dialog:last-of-type'),
          document.querySelector(`.window-app[data-appid="${this.appId}"]`)
        ];
        
        for (const dialogEl of dialogSelectors) {
          if (!dialogEl) continue;
          const $dialog = $(dialogEl);
          if (!$dialog.length) continue;
          
          // Check all possible title locations
          const titleSelectors = [
            '.window-header .window-title',
            'h4.window-title',
            '.window-title',
            '.window-header h4',
            'header h4',
            '.window-header h4.window-title',
            '[class*="window-title"]',
            'h4'
          ];
          
          titleSelectors.forEach(selector => {
            const titleElements = $dialog.find(selector);
            titleElements.each(function() {
              const $el = $(this);
              const currentTitle = $el.text();
              // If it contains TYPES or doesn't match our stored title, fix it
              if (currentTitle.includes('TYPES.') || currentTitle.includes('Actor.') || currentTitle !== storedTitle) {
                $el.text(storedTitle);
                $el.html(storedTitle);
                // Also set as attribute
                $el.attr('title', storedTitle);
                $el.attr('data-original-title', storedTitle);
              }
            });
          });
          
          // Also check the window element's title attribute
          const windowEl = $dialog[0];
          if (windowEl && windowEl.title) {
            if (windowEl.title.includes('TYPES.') || windowEl.title.includes('Actor.')) {
              windowEl.title = storedTitle;
            }
          }
        }
      };
      
      // Fix immediately and multiple times
      [0, 1, 5, 10, 25, 50, 100, 200, 500].forEach(delay => {
        setTimeout(fixTitle, delay);
      });
      
      // Continuous checking with requestAnimationFrame
      let frameId;
      const checkTitle = () => {
        fixTitle();
        // Only continue if dialog is still visible
        const dialogEl = this.element || this._element || document.querySelector('.window-app.dialog:last-of-type');
        if (dialogEl && $(dialogEl).is(':visible')) {
          frameId = requestAnimationFrame(checkTitle);
        }
      };
      setTimeout(() => {
        frameId = requestAnimationFrame(checkTitle);
      }, 10);
      
      // Clean up when dialog closes
      const originalClose = this.close;
      this.close = function(...args) {
        if (frameId) cancelAnimationFrame(frameId);
        return originalClose.apply(this, args);
      };
    }
    return result;
  };

  // Register custom system settings
  game.settings.register("singularity", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  const singularityStatusEffects = [
    {
      id: "scared",
      label: "Scared",
      icon: "icons/svg/terror.svg",
      flags: {
        core: { statusId: "scared" },
        singularity: {
          hasValue: true,
          description: "Penalty to attack rolls and ability checks equal to Scared value while you can see the source. Scared reduces by 1 at end of turn."
        }
      }
    },
    {
      id: "stunned",
      label: "Stunned",
      icon: "icons/svg/daze.svg",
      flags: {
        core: { statusId: "stunned" },
        singularity: {
          hasValue: false,
          description: "Cannot take actions or reactions. Cannot add Agility modifier to AC."
        }
      }
    },
    {
      id: "incorporeal",
      label: "Incorporeal",
      icon: "icons/svg/invisible.svg",
      flags: {
        core: { statusId: "incorporeal" },
        singularity: {
          hasValue: false,
          description: "Move through solid objects and creatures. Immune to all damage except Chaos. Deal half damage to corporeal creatures and cannot affect objects."
        }
      }
    },
    {
      id: "immobilized",
      label: "Immobilized",
      icon: "icons/svg/net.svg",
      flags: {
        core: { statusId: "immobilized" },
        singularity: {
          hasValue: false,
          description: "Cannot Move or Step and cannot move in any way, but can take other actions normally."
        }
      }
    },
    {
      id: "fatigued",
      label: "Fatigued",
      icon: "icons/svg/eye.svg",
      flags: {
        core: { statusId: "fatigued" },
        singularity: {
          hasValue: true,
          description: "Penalty to attack rolls, saving throws, and skill checks equal to Fatigued value."
        }
      }
    },
    {
      id: "paralyzed",
      label: "Paralyzed",
      icon: "icons/svg/paralysis.svg",
      flags: {
        core: { statusId: "paralyzed" },
        singularity: {
          hasValue: false,
          description: "Cannot take actions or reactions or move. Cannot add Agility modifier to AC. Enemies have advantage; Might and Agility saves are Extreme Failures."
        }
      }
    },
    {
      id: "staggered",
      label: "Staggered",
      icon: "icons/svg/clockwork.svg",
      flags: {
        core: { statusId: "staggered" },
        singularity: {
          hasValue: true,
          description: "At the start of your turn, reduce recovered Energy by the Staggered value."
        }
      }
    },
    {
      id: "prone",
      label: "Prone",
      icon: "icons/svg/falling.svg",
      flags: {
        core: { statusId: "prone" },
        singularity: {
          hasValue: false,
          description: "Cannot Move or Step; crawl at half Speed. -2 AC vs melee, +2 AC vs ranged, -2 to attack checks."
        }
      }
    },
    {
      id: "climbing",
      label: "Climbing",
      icon: "icons/svg/falling.svg",
      flags: {
        core: { statusId: "climbing" },
        singularity: {
          hasValue: false,
          description: "Climbing surfaces. -5 penalty to all ranged attack rolls while Climbing."
        }
      }
    },
    {
      id: "flying",
      label: "Flying",
      icon: "icons/svg/wing.svg",
      flags: {
        core: { statusId: "flying" },
        singularity: {
          hasValue: false,
          description: "Currently flying. -5 penalty to all ranged attack rolls while Flying."
        }
      }
    },
    {
      id: "deafened",
      label: "Deafened",
      icon: "icons/svg/deaf.svg",
      flags: {
        core: { statusId: "deafened" },
        singularity: {
          hasValue: false,
          description: "Automatically fail hearing-based Perception checks. Immune to auditory effects."
        }
      }
    },
    {
      id: "dazed",
      label: "Dazed",
      icon: "icons/svg/daze.svg",
      flags: {
        core: { statusId: "dazed" },
        singularity: {
          hasValue: false,
          description: "Cannot take reactions."
        }
      }
    },
    {
      id: "blinded",
      label: "Blinded",
      icon: "icons/svg/blind.svg",
      flags: {
        core: { statusId: "blinded" },
        singularity: {
          hasValue: false,
          description: "Cannot see. -10 to attack rolls and Perception. Ranged attacks impossible. All terrain is Difficult. Immune to Visual effects."
        }
      }
    },
    {
      id: "offbalance",
      label: "Off-balance",
      icon: "icons/svg/target.svg",
      flags: {
        core: { statusId: "offbalance" },
        singularity: {
          hasValue: false,
          description: "-2 penalty to AC while threatened from opposite sides."
        }
      }
    },
    {
      id: "dead",
      label: "Dead",
      icon: "icons/svg/skull.svg",
      flags: {
        core: { statusId: "dead" },
        singularity: {
          hasValue: false,
          description: "Defeated."
        }
      }
    }
  ];

  const sortedStatusEffects = [...singularityStatusEffects].sort((a, b) =>
    a.label.localeCompare(b.label)
  );

  CONFIG.singularity = CONFIG.singularity || {};
  CONFIG.singularity.statusEffects = sortedStatusEffects;
  CONFIG.singularity.statusEffectsMap = Object.fromEntries(
    sortedStatusEffects.map(effect => [effect.id, effect])
  );
  CONFIG.statusEffects = sortedStatusEffects.map(effect => ({
    id: effect.id,
    label: effect.label,
    icon: effect.icon,
    flags: effect.flags
  }));

  const ensureStatusSummary = () => {
    let el = document.getElementById("singularity-status-summary");
    if (!el) {
      el = document.createElement("div");
      el.id = "singularity-status-summary";
      el.classList.add("singularity-status-summary");
      document.body.appendChild(el);
      el.addEventListener("click", async (event) => {
        const target = event.target.closest(".status-item");
        if (!target) return;
        const statusId = target.dataset.statusId;
        const hasValue = target.dataset.hasValue === "true";
        if (!statusId || !hasValue) return;
        const active = canvas?.tokens?.controlled?.[0];
        const actor = active?.actor;
        if (!actor) return;
        const effect = actor.effects.find(e => e.getFlag("core", "statusId") === statusId);
        if (!effect) return;
        const currentValue = Number(effect.getFlag("singularity", "value") ?? 1);
        const nextValue = currentValue + 1;
        await effect.update({ "flags.singularity.value": nextValue });
        updateStatusSummary(active);
      });
      el.addEventListener("contextmenu", async (event) => {
        const target = event.target.closest(".status-item");
        if (!target) return;
        const statusId = target.dataset.statusId;
        const hasValue = target.dataset.hasValue === "true";
        if (!statusId) return;
        event.preventDefault();
        const active = canvas?.tokens?.controlled?.[0];
        const actor = active?.actor;
        if (!actor) return;
        const effect = actor.effects.find(e => e.getFlag("core", "statusId") === statusId);
        if (!effect) return;
        if (!hasValue) {
          await effect.delete();
          updateStatusSummary(active);
          return;
        }
        const currentValue = Number(effect.getFlag("singularity", "value") ?? 1);
        const nextValue = currentValue - 1;
        if (nextValue <= 0) {
          await effect.delete();
          updateStatusSummary(active);
          return;
        }
        await effect.update({ "flags.singularity.value": nextValue });
        updateStatusSummary(active);
      });
    }
    return el;
  };

  // Add a chat message renderer to allow heroes to roll damage from attack messages
  Hooks.on("renderChatMessageHTML", (message, html, data) => {
    try {
      // Normalize html to a jQuery object for compatibility with existing code
      const $html = html instanceof jQuery ? html : $(html);
      const attackFlag = message.getFlag("singularity", "attackRoll");
      if (!attackFlag) return;
      const actorId = message.speaker?.actor;
      if (!actorId) return;
      const actor = game.actors.get(actorId);
      if (!actor || actor.type !== "hero") return;

      const buildHeroSheetContext = (actor) => ({
        actor: actor,
        _getGadgetTuningBonus: SingularityActorSheetHero.prototype._getGadgetTuningBonus,
        _getGadgetDamageFormula: SingularityActorSheetHero.prototype._getGadgetDamageFormula,
        _getGadgetDamageFormulaFromBasic: SingularityActorSheetHero.prototype._getGadgetDamageFormulaFromBasic,
        _getGadgetDamageFormulaFromDescription: SingularityActorSheetHero.prototype._getGadgetDamageFormulaFromDescription,
        _getGadgetDamageTypeFromDescription: SingularityActorSheetHero.prototype._getGadgetDamageTypeFromDescription,
        _buildGadgetAttackFromUuid: SingularityActorSheetHero.prototype._buildGadgetAttackFromUuid
      });

      // Find a place to append a Roll Damage button (prefer .roll-flavor)
      const $flavor = $html.find('.roll-flavor').first().length ? $html.find('.roll-flavor').first() : $html.find('.message-content').first();
      if (!$flavor.length) return;

      // Add button if not present
      if ($flavor.find('.singularity-roll-damage').length === 0) {
        const attackId = attackFlag.attackId;
        const gadgetId = attackFlag.gadgetId || (Number.isFinite(Number(attackId)) ? null : attackId);
        const attackIdAttr = Number.isFinite(Number(attackId)) ? ` data-attack-id="${attackId}"` : "";
        const gadgetIdAttr = gadgetId ? ` data-gadget-id="${gadgetId}"` : "";
        const btnHtml = `<div class="chat-card-buttons" style="margin-top: 6px;"><button class="singularity-roll-damage"${attackIdAttr}${gadgetIdAttr} data-actor-id="${actorId}" style="padding:4px 8px; font-size:11px;">Roll Damage</button></div>`;
        $flavor.append(btnHtml);
      }

      // Delegate click handler (idempotent)
      $flavor.off('click.singularity-roll-damage').on('click.singularity-roll-damage', '.singularity-roll-damage', async (ev) => {
        ev.preventDefault();
        const attackId = ev.currentTarget.dataset.attackId;
        const gadgetId = ev.currentTarget.dataset.gadgetId;
        const actorId = ev.currentTarget.dataset.actorId;
        const actor = game.actors.get(actorId);
        if (!actor) return;
        try {
          // Call the Hero sheet damage handler with a minimal event-like object
          const sheetContext = buildHeroSheetContext(actor);
          await SingularityActorSheetHero.prototype._onRollDamage.call(
            sheetContext,
            { preventDefault: () => {}, currentTarget: { dataset: { attackId, gadgetId } } }
          );
        } catch (err) {
          console.warn("Singularity | Failed to open Roll Damage from chat:", err);
        }
      });
    } catch (err) {
      console.warn("Singularity | renderChatMessageHTML hook failed:", err);
    }
  });

  // Add an Apply Healing button to healing roll messages
  Hooks.on("renderChatMessageHTML", (message, html) => {
    try {
      const $html = html instanceof jQuery ? html : $(html);
      const healFlag = message.getFlag("singularity", "healRoll");
      if (!healFlag) return;
      const $flavor = $html.find('.roll-flavor').first().length ? $html.find('.roll-flavor').first() : $html.find('.message-content').first();
      if (!$flavor.length) return;

      if ($flavor.find('.singularity-apply-healing').length === 0) {
        const btnHtml = `<div class="chat-card-buttons" style="margin-top: 6px;"><button class="singularity-apply-healing" data-heal-total="${healFlag.total}" style="padding:4px 8px; font-size:11px;">Apply Healing</button></div>`;
        $flavor.append(btnHtml);
      }

      $flavor.off('click.singularity-apply-healing').on('click.singularity-apply-healing', '.singularity-apply-healing', async (ev) => {
        ev.preventDefault();
        const healTotal = Number(ev.currentTarget.dataset.healTotal) || 0;
        const targets = Array.from(game.user?.targets || []);
        const targetToken = targets[0];
        const targetActor = targetToken?.actor;
        if (!targetActor) {
          ui.notifications.warn("Select a target to apply healing.");
          return;
        }
        const currentHp = Number(targetActor.system?.combat?.hp?.value ?? 0);
        const maxHp = Number(targetActor.system?.combat?.hp?.max ?? 0);
        const newHp = maxHp > 0 ? Math.min(maxHp, currentHp + healTotal) : currentHp + healTotal;
        await targetActor.update({ "system.combat.hp.value": newHp });
        const targetName = targetToken.name || targetActor.name || "Target";
        ui.notifications.info(`${targetName} healed for ${healTotal} HP.`);
      });
    } catch (err) {
      console.warn("Singularity | renderChatMessageHTML heal hook failed:", err);
    }
  });

  // Add gadget action buttons to chat item cards (attack, damage, heal)
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const $html = html instanceof jQuery ? html : $(html);
    const getActorFromDataset = (datasetActorId) => {
      const actorId = datasetActorId || message.speaker?.actor;
      return actorId ? game.actors.get(actorId) : null;
    };

    const parseHealingFromDescription = (description) => {
      const raw = String(description || "");
      if (!raw) return "";
      const text = raw
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) return "";

      const diceMatch = text.match(/(?:heal(?:s|ing)?|healing|regain(?:s|ing)?|restore(?:s|d|ing)?)[^0-9d]*([0-9]+d[0-9]+(?:\s*[+-]\s*[0-9]+)*)/i);
      if (diceMatch?.[1]) {
        return diceMatch[1].replace(/\s+/g, "");
      }

      const flatMatch = text.match(/(?:heal(?:s|ing)?|healing|regain(?:s|ing)?|restore(?:s|d|ing)?)[^0-9]*([0-9]+)(?!d)/i);
      if (flatMatch?.[1]) {
        return flatMatch[1];
      }

      return "";
    };

    const getHealingFormulaFromItem = (item) => {
      if (!item?.system) return "";
      const basic = item.system.basic || {};
      const direct = basic.healing || basic.healingFormula || basic.heal || basic.healFormula || basic.healingRoll;
      if (direct) return String(direct).trim();

      const flatValue = basic.healingValue ?? basic.healValue ?? basic.healAmount ?? null;
      const dice = basic.healingDice || basic.healDice || basic.healingDie || basic.healDie;
      const diceCount = basic.healingDiceCount || basic.healDiceCount || basic.healingCount || basic.healCount;
      let formula = "";

      if (dice) {
        const diceText = String(dice).trim();
        if (diceText.includes("d")) {
          formula = diceText;
        } else if (diceCount) {
          formula = `${diceCount}d${diceText}`;
        } else {
          formula = `1d${diceText}`;
        }
      } else if (flatValue !== null && flatValue !== undefined && flatValue !== "") {
        return String(flatValue);
      }

      const bonus = Number(basic.healingBonus ?? basic.healBonus ?? basic.healingMod ?? basic.healMod ?? 0);
      if (formula && Number.isFinite(bonus) && bonus !== 0) {
        formula += bonus > 0 ? `+${bonus}` : `${bonus}`;
      }

      if (formula) return formula;
      return parseHealingFromDescription(item.system.description || item.system.details?.description || "");
    };

    const buildHeroSheetContext = (actor) => ({
      actor: actor,
      _getGadgetTuningBonus: SingularityActorSheetHero.prototype._getGadgetTuningBonus,
      _getGadgetDamageFormula: SingularityActorSheetHero.prototype._getGadgetDamageFormula,
      _getGadgetDamageFormulaFromBasic: SingularityActorSheetHero.prototype._getGadgetDamageFormulaFromBasic,
      _getGadgetDamageFormulaFromDescription: SingularityActorSheetHero.prototype._getGadgetDamageFormulaFromDescription,
      _getGadgetDamageTypeFromDescription: SingularityActorSheetHero.prototype._getGadgetDamageTypeFromDescription,
      _buildGadgetAttackFromUuid: SingularityActorSheetHero.prototype._buildGadgetAttackFromUuid
    });

    const savingThrowRankBonuses = {
      "Novice": 0,
      "Apprentice": 4,
      "Competent": 8,
      "Masterful": 12,
      "Legendary": 16
    };

    const computeAbilityScoreFromProgression = (actor, ability) => {
      const actorData = actor?.system || {};
      const progression = actorData.progression || {};
      if (!progression || Object.keys(progression).length === 0) return null;

      const abilityBonuses = {
        might: 0,
        agility: 0,
        endurance: 0,
        wits: 0,
        charm: 0
      };

      if (progression.level1?.humanAbilityBoost) {
        const boostAbility = progression.level1.humanAbilityBoost;
        if (abilityBonuses.hasOwnProperty(boostAbility)) {
          abilityBonuses[boostAbility] += 1;
        }
      }
      if (progression.level1?.terranAbilityBoost) {
        const boostAbility = progression.level1.terranAbilityBoost;
        if (abilityBonuses.hasOwnProperty(boostAbility)) {
          abilityBonuses[boostAbility] += 1;
        }
      }
      if (progression.level1?.backgroundAbilityBoost) {
        const boostAbility = progression.level1.backgroundAbilityBoost;
        if (abilityBonuses.hasOwnProperty(boostAbility)) {
          abilityBonuses[boostAbility] += 1;
        }
      }
      if (progression.level1?.genericAbilityBoost) {
        const boostAbility = progression.level1.genericAbilityBoost;
        if (abilityBonuses.hasOwnProperty(boostAbility)) {
          abilityBonuses[boostAbility] += 1;
        }
      }

      const powersetName = progression.level1?.powersetName || actorData.basic?.powerset;
      if (powersetName === "Bastion") {
        abilityBonuses.endurance += 1;
        if (progression.level1?.bastionAbilityBoost1) {
          const boostAbility = progression.level1.bastionAbilityBoost1;
          if (abilityBonuses.hasOwnProperty(boostAbility) && boostAbility !== "endurance") {
            abilityBonuses[boostAbility] += 1;
          }
        }
        if (progression.level1?.bastionAbilityBoost2) {
          const boostAbility = progression.level1.bastionAbilityBoost2;
          if (abilityBonuses.hasOwnProperty(boostAbility) && boostAbility !== "endurance") {
            abilityBonuses[boostAbility] += 1;
          }
        }
      } else if (powersetName === "Paragon") {
        abilityBonuses.might += 1;
        if (progression.level1?.paragonAbilityBoost1) {
          const boostAbility = progression.level1.paragonAbilityBoost1;
          if (abilityBonuses.hasOwnProperty(boostAbility) && boostAbility !== "might") {
            abilityBonuses[boostAbility] += 1;
          }
        }
        if (progression.level1?.paragonAbilityBoost2) {
          const boostAbility = progression.level1.paragonAbilityBoost2;
          if (abilityBonuses.hasOwnProperty(boostAbility) && boostAbility !== "might") {
            abilityBonuses[boostAbility] += 1;
          }
        }
      } else if (powersetName === "Gadgeteer") {
        abilityBonuses.wits += 1;
        if (progression.level1?.gadgeteerAbilityBoost1) {
          const boostAbility = progression.level1.gadgeteerAbilityBoost1;
          if (abilityBonuses.hasOwnProperty(boostAbility) && boostAbility !== "wits") {
            abilityBonuses[boostAbility] += 1;
          }
        }
        if (progression.level1?.gadgeteerAbilityBoost2) {
          const boostAbility = progression.level1.gadgeteerAbilityBoost2;
          if (abilityBonuses.hasOwnProperty(boostAbility) && boostAbility !== "wits") {
            abilityBonuses[boostAbility] += 1;
          }
        }
      } else if (powersetName === "Marksman") {
        abilityBonuses.agility += 1;
        if (progression.level1?.marksmanAbilityBoost1) {
          const boostAbility = progression.level1.marksmanAbilityBoost1;
          if (abilityBonuses.hasOwnProperty(boostAbility) && boostAbility !== "agility") {
            abilityBonuses[boostAbility] += 1;
          }
        }
        if (progression.level1?.marksmanAbilityBoost2) {
          const boostAbility = progression.level1.marksmanAbilityBoost2;
          if (abilityBonuses.hasOwnProperty(boostAbility) && boostAbility !== "agility") {
            abilityBonuses[boostAbility] += 1;
          }
        }
      }

      for (let lvl = 2; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        if (levelData.humanAbilityBoost) {
          const boostAbility = levelData.humanAbilityBoost;
          if (abilityBonuses.hasOwnProperty(boostAbility)) {
            abilityBonuses[boostAbility] += 1;
          }
        }
        if (levelData.terranAbilityBoost) {
          const boostAbility = levelData.terranAbilityBoost;
          if (abilityBonuses.hasOwnProperty(boostAbility)) {
            abilityBonuses[boostAbility] += 1;
          }
        }
        if (levelData.genericAbilityBoost) {
          const boostAbility = levelData.genericAbilityBoost;
          if (abilityBonuses.hasOwnProperty(boostAbility)) {
            abilityBonuses[boostAbility] += 1;
          }
        }
        if (levelData.abilityScoreImprovement1) {
          const boostAbility = levelData.abilityScoreImprovement1;
          if (abilityBonuses.hasOwnProperty(boostAbility)) {
            abilityBonuses[boostAbility] += 1;
          }
        }
        if (levelData.abilityScoreImprovement2) {
          const boostAbility = levelData.abilityScoreImprovement2;
          if (abilityBonuses.hasOwnProperty(boostAbility)) {
            abilityBonuses[boostAbility] += 1;
          }
        }
      }

      return abilityBonuses[ability] ?? 0;
    };

    const computeAbilityScore = (actor, ability) => {
      const fromProgression = computeAbilityScoreFromProgression(actor, ability);
      if (fromProgression !== null && fromProgression !== undefined) {
        return Number(fromProgression) || 0;
      }
      const raw = actor?.system?.abilities?.[ability];
      return Number(raw) || 0;
    };

    const hasEnoughPrepTimeTalent = (actor) => {
      const progression = actor?.system?.progression || {};
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        const gadgeteerTalentName = levelData.gadgeteerTalentName || "";
        if (gadgeteerTalentName && gadgeteerTalentName.toLowerCase().includes("enough prep time")) {
          return true;
        }
      }
      return false;
    };

    const hasGadgetMasteryTalent = (actor) => {
      const progression = actor?.system?.progression || {};
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        const gadgeteerTalentName = levelData.gadgeteerTalentName || "";
        if (gadgeteerTalentName && gadgeteerTalentName.toLowerCase().includes("gadget mastery")) {
          return true;
        }
      }
      return false;
    };

    const hasSuperiorEngineeringTalent = (actor) => {
      const progression = actor?.system?.progression || {};
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        const gadgeteerTalentName = levelData.gadgeteerTalentName || "";
        if (gadgeteerTalentName && gadgeteerTalentName.toLowerCase().includes("superior engineering")) {
          return true;
        }
      }
      return false;
    };

    const hasSustainedTuningTalent = (actor) => {
      const progression = actor?.system?.progression || {};
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        const gadgeteerTalentName = levelData.gadgeteerTalentName || "";
        if (gadgeteerTalentName && gadgeteerTalentName.toLowerCase().includes("sustained tuning")) {
          return true;
        }
      }
      return false;
    };

    const hasGadgetArsenalTalent = (actor) => {
      const progression = actor?.system?.progression || {};
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        const gadgeteerTalentName = levelData.gadgeteerTalentName || "";
        if (gadgeteerTalentName && gadgeteerTalentName.toLowerCase().includes("gadget arsenal")) {
          return true;
        }
      }
      return false;
    };

    const computeGadgetTuningDC = (actor) => {
      const witsScore = computeAbilityScore(actor, "wits");
      const gadgetTuningSkill = actor?.system?.skills?.["Gadget Tuning"] || {};
      const gadgetTuningRank = gadgetTuningSkill.rank || "Novice";
      const rankModifiers = {
        "Novice": 0,
        "Apprentice": 2,
        "Competent": 5,
        "Masterful": 9,
        "Legendary": 14
      };
      let dc = 10 + witsScore + (rankModifiers[gadgetTuningRank] || 0);
      const enoughPrepTimeData = actor?.system?.combat?.enoughPrepTime || { active: false };
      if (enoughPrepTimeData.active && hasEnoughPrepTimeTalent(actor)) {
        const primeLevel = Number(actor?.system?.basic?.primeLevel || 1);
        dc += primeLevel;
      }
      if (hasGadgetMasteryTalent(actor)) {
        dc += hasSuperiorEngineeringTalent(actor) ? 4 : 2;
      }
      if (hasSustainedTuningTalent(actor)) {
        const maintainedCount = Number(actor?.system?.combat?.sustainedTuning?.maintainedCount ?? 0);
        dc += maintainedCount;
      }
      return dc;
    };

    const applyStatusEffect = async (actor, statusId, value, rounds = 1) => {
      if (!actor || !statusId) return;
      const statusDef = CONFIG.singularity?.statusEffectsMap?.[statusId];
      if (!statusDef) return;

      const existing = actor.effects.find(effect => effect.getFlag("core", "statusId") === statusId);
      if (existing) {
        if (Number.isFinite(value)) {
          const currentValue = Number(existing.getFlag("singularity", "value") ?? 0);
          const nextValue = Math.max(currentValue, Number(value));
          await existing.update({ "flags.singularity.value": nextValue });
        }
        return;
      }

      const flags = foundry.utils.deepClone(statusDef.flags || {});
      if (Number.isFinite(value)) {
        flags.singularity = flags.singularity || {};
        flags.singularity.value = Number(value);
      }

      const duration = {};
      if (game.combat) {
        duration.rounds = rounds;
        duration.startRound = game.combat.round;
        duration.startTurn = game.combat.turn;
      }

      const effectData = {
        name: statusDef.label || statusId,
        icon: statusDef.icon || "icons/svg/aura.svg",
        flags: flags,
        disabled: false,
        duration: duration
      };

      await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    };

    $html.off("click.singularity-gadget-attack").on("click.singularity-gadget-attack", ".singularity-gadget-attack-roll", async (ev) => {
      ev.preventDefault();
      const gadgetId = ev.currentTarget.dataset.gadgetId;
      const actor = getActorFromDataset(ev.currentTarget.dataset.actorId);
      if (!actor || !gadgetId) return;
      try {
        const sheetContext = buildHeroSheetContext(actor);
        await SingularityActorSheetHero.prototype._onRollAttack.call(sheetContext, {
          preventDefault: () => {},
          currentTarget: { dataset: { gadgetId } }
        });
      } catch (err) {
        console.warn("Singularity | Failed to roll gadget attack from chat:", err);
      }
    });

    $html.off("click.singularity-gadget-damage").on("click.singularity-gadget-damage", ".singularity-gadget-damage-roll", async (ev) => {
      ev.preventDefault();
      const gadgetId = ev.currentTarget.dataset.gadgetId;
      const actor = getActorFromDataset(ev.currentTarget.dataset.actorId);
      if (!actor || !gadgetId) return;
      try {
        const sheetContext = buildHeroSheetContext(actor);
        await SingularityActorSheetHero.prototype._onRollDamage.call(sheetContext, {
          preventDefault: () => {},
          currentTarget: { dataset: { gadgetId } }
        });
      } catch (err) {
        console.warn("Singularity | Failed to roll gadget damage from chat:", err);
      }
    });

    $html.off("click.singularity-gadget-heal").on("click.singularity-gadget-heal", ".singularity-gadget-heal", async (ev) => {
      ev.preventDefault();
      const button = ev.currentTarget;
      const gadgetId = button.dataset.gadgetId;
      const actor = getActorFromDataset(button.dataset.actorId);
      const gadgetName = button.dataset.gadgetName || "Gadget";
      if (!actor) return;

      const getTargetToken = () => {
        const targets = Array.from(game.user?.targets || []);
        return targets[0] || null;
      };

      const appendBonus = (baseFormula, bonus) => {
        const trimmed = String(baseFormula || "").trim();
        if (!trimmed || !Number.isFinite(bonus) || bonus === 0) return trimmed;
        return `${trimmed}${bonus > 0 ? "+" : ""}${bonus}`;
      };

      let formula = String(button.dataset.healFormula || "").trim();
      let item = null;
      if (!formula && gadgetId) {
        try {
          item = await fromUuid(gadgetId);
          formula = getHealingFormulaFromItem(item);
        } catch (err) {
          console.warn("Singularity | Failed to load gadget for healing:", err);
        }
      }

      const sheetContext = buildHeroSheetContext(actor);
      const tuningBonus = typeof sheetContext?._getGadgetTuningBonus === "function"
        ? Number(sheetContext._getGadgetTuningBonus.call(sheetContext)) || 0
        : 0;
      const rawDescription = String(item?.system?.description || item?.system?.details?.description || "");
      const needsTuningBonus = /gadget\s*tuning/i.test(rawDescription) || /trauma\s*stabilizer/i.test(item?.name || gadgetName);
      if (needsTuningBonus && !/gadget\s*tuning/i.test(formula)) {
        formula = appendBonus(formula, tuningBonus);
      }

      if (!formula) {
        ui.notifications.warn(`${gadgetName} has no healing formula to roll.`);
        return;
      }

      const dialogContent = `
        <form class="singularity-roll-dialog">
          <div class="roll-fields-row">
            <div class="form-group-inline">
              <label>Healing Formula:</label>
              <input type="text" id="heal-formula" value="${formula}" readonly class="readonly-input"/>
            </div>
          </div>
          <p class="help-text">Select a target token. Click "Roll Healing" and then use "Apply Healing" in chat.</p>
        </form>
      `;

      const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
      let dialog;
      const getDialogRoot = () => {
        const el = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
        return el instanceof HTMLElement ? el : document;
      };

      const rollHealing = async (root) => {
        const targetToken = getTargetToken();
        if (!targetToken) {
          ui.notifications.warn("Select a target to roll healing.");
          return;
        }

        const rollFormula = String(root.querySelector("#heal-formula")?.value ?? "").trim();
        if (!rollFormula) {
          ui.notifications.warn("No healing formula found.");
          return;
        }

        const roll = new Roll(rollFormula);
        await roll.evaluate();

        const targetName = targetToken.name || targetToken.actor?.name || "Target";
        const flavor = `<div class="roll-flavor"><b>${gadgetName}</b><br>${targetName} heals for <strong>${roll.total}</strong> (${rollFormula})</div>`;
        const message = await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: flavor
        });
        await message.setFlag("singularity", "healRoll", {
          total: roll.total,
          formula: rollFormula,
          gadgetName: gadgetName,
          healerActorId: actor.id
        });
      };

      const dialogOptions = DialogClass?.name === "DialogV2"
        ? {
            title: `Roll Healing: ${gadgetName}`,
            content: dialogContent,
            buttons: [
              {
                action: "roll",
                icon: '<i class="fas fa-dice"></i>',
                label: "Roll Healing",
                callback: async () => {
                  const root = getDialogRoot();
                  await rollHealing(root);
                }
              },
              {
                action: "cancel",
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
              }
            ],
            default: "roll"
          }
        : {
            title: `Roll Healing: ${gadgetName}`,
            content: dialogContent,
            buttons: {
              roll: {
                icon: '<i class="fas fa-dice"></i>',
                label: "Roll Healing",
                callback: async (html) => {
                  const root = html instanceof jQuery ? html[0] : html;
                  await rollHealing(root);
                }
              },
              cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel",
                callback: () => {}
              }
            },
            default: "roll",
            close: () => {}
          };
      dialogOptions.position = { width: 520 };
      dialogOptions.window = { resizable: true };
      dialog = new DialogClass(dialogOptions);
      await dialog.render(true);
    });

    $html.off("click.singularity-gadget-save").on("click.singularity-gadget-save", ".singularity-gadget-save-roll", async (ev) => {
      ev.preventDefault();
      const gadgetId = ev.currentTarget.dataset.gadgetId;
      const actor = getActorFromDataset(ev.currentTarget.dataset.actorId);
      const saveAbility = (ev.currentTarget.dataset.saveAbility || "agility").toLowerCase();
      if (!actor || !gadgetId) return;

      const targets = Array.from(game.user?.targets || []);
      if (targets.length === 0) {
        ui.notifications.warn("Select one or more targets to roll saving throws.");
        return;
      }

      let gadgetName = "Sonic Grenade";
      try {
        const gadgetDoc = await fromUuid(gadgetId);
        gadgetName = gadgetDoc?.name || gadgetName;
      } catch (err) {
        console.warn("Singularity | Failed to load gadget for save roll:", err);
      }
      const isSonicGrenade = String(gadgetName || "").trim().toLowerCase() === "sonic grenade";

      const dc = computeGadgetTuningDC(actor);
      const results = [];

      for (const targetToken of targets) {
        const targetActor = targetToken.actor;
        if (!targetActor) continue;
        if (targetActor.id === actor.id) continue;

        const savingThrow = targetActor.system?.savingThrows?.[saveAbility] || {};
        const rank = savingThrow.rank || "Novice";
        const trainingBonus = savingThrowRankBonuses[rank] || 0;
        const otherBonuses = Number(savingThrow.otherBonuses) || 0;
        const abilityScore = computeAbilityScore(targetActor, saveAbility);

        const roll = new Roll(`1d20 + ${abilityScore} + ${trainingBonus} + ${otherBonuses}`);
        await roll.evaluate();

        let degree = "Failure";
        if (roll.total >= dc + 10) {
          degree = "Extreme Success";
        } else if (roll.total >= dc) {
          degree = "Success";
        } else if (roll.total <= dc - 10) {
          degree = "Extreme Failure";
        }

        const effectsApplied = [];
        if (isSonicGrenade) {
          if (degree === "Success") {
            if (targetActor.isOwner || game.user.isGM) {
              await applyStatusEffect(targetActor, "dazed");
              effectsApplied.push("Dazed");
            }
          } else if (degree === "Failure") {
            if (targetActor.isOwner || game.user.isGM) {
              await applyStatusEffect(targetActor, "staggered", 1);
              await applyStatusEffect(targetActor, "dazed");
              effectsApplied.push("Staggered 1", "Dazed");
            }
          } else if (degree === "Extreme Failure") {
            if (targetActor.isOwner || game.user.isGM) {
              await applyStatusEffect(targetActor, "staggered", 2);
              await applyStatusEffect(targetActor, "dazed");
              await applyStatusEffect(targetActor, "deafened");
              effectsApplied.push("Staggered 2", "Dazed", "Deafened");
            }
          }
        }

        results.push({
          name: targetToken.name || targetActor.name || "Target",
          total: roll.total,
          degree: degree,
          effects: effectsApplied
        });
      }

      const resultLines = results
        .map(result => {
          const effectsText = result.effects.length
            ? ` - <em>Applied:</em> ${result.effects.join(", ")}`
            : "";
          return `<li><strong>${result.name}</strong>: ${result.total} vs DC ${dc} (${result.degree})${effectsText}</li>`;
        })
        .join("");

      const saveLabel = saveAbility.charAt(0).toUpperCase() + saveAbility.slice(1);
      const content = `
        <div class="roll-flavor">
          <b>${gadgetName}</b><br>
          ${saveLabel} Saving Throw (DC ${dc})
          <ul>${resultLines}</ul>
        </div>
      `;

      await ChatMessage.create({
        content: content,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    });

    $html.off("click.singularity-talent-meteor-slam").on("click.singularity-talent-meteor-slam", ".singularity-talent-meteor-slam", async (ev) => {
      ev.preventDefault();
      const actor = getActorFromDataset(ev.currentTarget.dataset.actorId);
      if (!actor) return;

      const isFlying = actor.effects?.some(effect => effect.getFlag("core", "statusId") === "flying");
      if (!isFlying) {
        ui.notifications.warn("Meteor Slam requires you to be flying.");
        return;
      }

      const targets = Array.from(game.user?.targets || []);
      if (targets.length === 0) {
        ui.notifications.warn("Select a target to use Meteor Slam.");
        return;
      }

      const targetToken = targets[0];
      const targetActor = targetToken?.actor;
      if (!targetActor) return;

      const targetAirborne = targetActor.effects?.some(effect => {
        const statusId = effect.getFlag("core", "statusId");
        return statusId === "flying" || statusId === "climbing";
      });
      if (!targetAirborne) {
        ui.notifications.warn("Meteor Slam can only target a creature that is not on the ground (flying or climbing).");
        return;
      }

      const hasImprovedMeteorSlam = (() => {
        if (actor.items?.some(item => item.type === "talent" && String(item.name || "").toLowerCase().includes("improved meteor slam"))) {
          return true;
        }
        const progression = actor.system?.progression || {};
        for (let lvl = 1; lvl <= 20; lvl++) {
          const levelData = progression[`level${lvl}`] || {};
          const names = [levelData.paragonTalentName, levelData.powersetTalentName].filter(Boolean);
          if (names.some(name => String(name).toLowerCase().includes("improved meteor slam"))) {
            return true;
          }
        }
        return false;
      })();

      const computeSavingThrowDc = (actorRef, ability) => {
        const savingThrow = actorRef.system?.savingThrows?.[ability] || {};
        const rank = savingThrow.rank || "Novice";
        const trainingBonus = savingThrowRankBonuses[rank] || 0;
        const otherBonuses = Number(savingThrow.otherBonuses) || 0;
        const abilityScore = computeAbilityScore(actorRef, ability);
        return 10 + abilityScore + trainingBonus + otherBonuses;
      };

      const computeSkillDc = (actorRef, skillName) => {
        if (typeof actorRef.getSkillModifier === "function") {
          const skillMod = Number(actorRef.getSkillModifier(skillName)) || 0;
          return 10 + skillMod;
        }
        return 10 + computeAbilityScore(actorRef, skillName === "Athletics" ? "might" : "agility");
      };

      const mightDc = computeSavingThrowDc(targetActor, "might");
      const agilityDc = computeSavingThrowDc(targetActor, "agility");
      const athleticsDc = computeSkillDc(targetActor, "Athletics");
      const acrobaticsDc = computeSkillDc(targetActor, "Acrobatics");

      const baseDc = Math.max(mightDc, agilityDc);
      const skillDc = Math.max(athleticsDc, acrobaticsDc);
      const useSkillDc = skillDc > baseDc;
      const targetDc = useSkillDc ? skillDc : baseDc;
      const dcLabel = (() => {
        if (useSkillDc) {
          return athleticsDc >= acrobaticsDc ? "Athletics" : "Acrobatics";
        }
        return mightDc >= agilityDc ? "Might" : "Agility";
      })();

      const actorName = actor.name || "Attacker";
      const targetName = targetToken?.name || targetActor.name || "Target";
      const canUseAthletics = (actor.system?.skills?.["Athletics"]?.rank || "Novice") !== "Novice";

      const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
      let dialog;
      const getDialogRoot = () => {
        const el = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
        return el instanceof HTMLElement ? el : document;
      };

      const rollMeteorSlam = async (root) => {
        const useAthletics = root?.querySelector("#meteor-slam-check")?.value === "athletics";
        const checkLabel = useAthletics ? "Athletics" : "Might";
        const baseModifier = useAthletics && typeof actor.getSkillModifier === "function"
          ? Number(actor.getSkillModifier("Athletics")) || 0
          : computeAbilityScore(actor, "might");

        const fatiguedEffect = actor.effects?.find(effect => effect.getFlag("core", "statusId") === "fatigued");
        const fatiguedPenalty = Math.max(0, Number(fatiguedEffect?.getFlag("singularity", "value") ?? 0));
        const penaltyText = fatiguedPenalty ? ` - ${fatiguedPenalty}` : "";

        const roll = new Roll(`1d20 + ${baseModifier}${penaltyText}`);
        await roll.evaluate();

        let degree = "Failure";
        if (roll.total >= targetDc + 10) {
          degree = "Extreme Success";
        } else if (roll.total >= targetDc) {
          degree = "Success";
        } else if (roll.total <= targetDc - 10) {
          degree = "Extreme Failure";
        }

        const mightScore = computeAbilityScore(actor, "might");
        const baseDistance = Math.max(0, Number(mightScore) || 0) * 5;
        const improvedMultiplier = hasImprovedMeteorSlam ? 2 : 1;
        const slamDistance = degree === "Extreme Success"
          ? baseDistance * 2 * improvedMultiplier
          : baseDistance * improvedMultiplier;

        const effects = [];
        if (degree === "Extreme Failure") {
          if (actor.isOwner || game.user.isGM) {
            await applyStatusEffect(actor, "offbalance", null, 1);
            effects.push("Off-balance (1 round)");
          }
        }

        const distanceText = (degree === "Success" || degree === "Extreme Success")
          ? `Drive ${targetName} downward <strong>${slamDistance} feet</strong>. If they hit a solid surface, they take falling damage for that distance and are knocked Prone.`
          : "No movement occurs.";

        const effectsText = effects.length ? `<br><em>Applied:</em> ${effects.join(", ")}` : "";
        const flavor = `
          <div class="roll-flavor">
            <b>Meteor Slam</b><br>
            ${actorName} vs ${targetName}<br>
            ${checkLabel} Check: ${roll.total} vs ${dcLabel} DC ${targetDc} (${degree})${effectsText}
            <br>${distanceText}
          </div>
        `;

        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: flavor
        });
      };

      const dialogContent = `
        <form class="singularity-roll-dialog">
          <div class="roll-fields-row">
            <div class="form-group-inline">
              <label>Check:</label>
              <select id="meteor-slam-check" class="editable-input">
                <option value="might">Might</option>
                ${canUseAthletics ? "<option value=\"athletics\">Athletics</option>" : ""}
              </select>
            </div>
            <div class="form-group-inline">
              <label>Target DC:</label>
              <input type="text" value="${dcLabel} DC ${targetDc}" readonly class="readonly-input" />
            </div>
          </div>
          <p class="help-text">Cost: 2 energy. Target must be flying or climbing.</p>
        </form>
      `;

      const dialogOptions = DialogClass?.name === "DialogV2"
        ? {
            title: "Meteor Slam",
            content: dialogContent,
            buttons: [
              {
                action: "roll",
                icon: '<i class="fas fa-dice-d20"></i>',
                label: "Roll",
                callback: async () => {
                  const root = getDialogRoot();
                  await rollMeteorSlam(root);
                }
              },
              {
                action: "cancel",
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
              }
            ],
            default: "roll"
          }
        : {
            title: "Meteor Slam",
            content: dialogContent,
            buttons: {
              roll: {
                icon: '<i class="fas fa-dice-d20"></i>',
                label: "Roll",
                callback: async (html) => {
                  const root = html instanceof jQuery ? html[0] : html;
                  await rollMeteorSlam(root);
                }
              },
              cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel",
                callback: () => {}
              }
            },
            default: "roll"
          };

      dialogOptions.position = { width: 520 };
      dialogOptions.window = { resizable: true };
      dialog = new DialogClass(dialogOptions);
      await dialog.render(true);
    });

    $html.off("click.singularity-talent-thunderclap").on("click.singularity-talent-thunderclap", ".singularity-talent-thunderclap", async (ev) => {
      ev.preventDefault();
      const actor = getActorFromDataset(ev.currentTarget.dataset.actorId);
      if (!actor) return;

      if (actor.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed")) {
        ui.notifications.warn("Paralyzed: you cannot take actions or reactions.");
        return;
      }

      const targets = Array.from(game.user?.targets || []);
      if (targets.length === 0) {
        ui.notifications.warn("Select one or more targets for Thunderclap.");
        return;
      }

      const computeSavingThrowDc = (actorRef, ability) => {
        const savingThrow = actorRef.system?.savingThrows?.[ability] || {};
        const rank = savingThrow.rank || "Novice";
        const trainingBonus = savingThrowRankBonuses[rank] || 0;
        const otherBonuses = Number(savingThrow.otherBonuses) || 0;
        const abilityScore = computeAbilityScore(actorRef, ability);
        return 10 + abilityScore + trainingBonus + otherBonuses;
      };

      const mightScore = computeAbilityScore(actor, "might");
      const dc = computeSavingThrowDc(actor, "might");
      const results = [];

      for (const targetToken of targets) {
        const targetActor = targetToken.actor;
        if (!targetActor) continue;
        if (targetActor.id === actor.id) continue;

        const savingThrow = targetActor.system?.savingThrows?.might || {};
        const rank = savingThrow.rank || "Novice";
        const trainingBonus = savingThrowRankBonuses[rank] || 0;
        const otherBonuses = Number(savingThrow.otherBonuses) || 0;
        const abilityScore = computeAbilityScore(targetActor, "might");

        const roll = new Roll(`1d20 + ${abilityScore} + ${trainingBonus} + ${otherBonuses}`);
        await roll.evaluate();

        let degree = "Failure";
        if (roll.total >= dc + 10) {
          degree = "Extreme Success";
        } else if (roll.total >= dc) {
          degree = "Success";
        } else if (roll.total <= dc - 10) {
          degree = "Extreme Failure";
        }

        let damageTotal = 0;
        let damageFormula = "";
        if (degree !== "Extreme Success") {
          damageFormula = `2d6${mightScore >= 0 ? "+" : ""}${mightScore}`;
          const damageRoll = new Roll(damageFormula);
          await damageRoll.evaluate();
          damageTotal = damageRoll.total;
          if (degree === "Success") {
            damageTotal = Math.floor(damageTotal / 2);
          }
        }

        const effectsApplied = [];
        if (degree === "Extreme Failure") {
          if (targetActor.isOwner || game.user.isGM) {
            await applyStatusEffect(targetActor, "prone", null, 1);
            effectsApplied.push("Prone");
          } else {
            effectsApplied.push("Prone");
          }
        }

        const pushDistance = degree === "Failure" ? 10 : degree === "Extreme Failure" ? 15 : 0;
        const resultText = degree === "Extreme Success"
          ? "No damage, no push."
          : degree === "Success"
            ? `Half damage (${damageTotal}) and no push.`
            : `Damage ${damageTotal}${pushDistance ? `, push ${pushDistance} ft` : ""}${degree === "Extreme Failure" ? ", knocked Prone" : ""}.`;

        results.push({
          name: targetToken.name || targetActor.name || "Target",
          total: roll.total,
          degree: degree,
          resultText: resultText,
          effects: effectsApplied
        });
      }

      const resultLines = results
        .map(result => {
          const effectsText = result.effects.length
            ? ` - <em>Applied:</em> ${result.effects.join(", ")}`
            : "";
          return `<li><strong>${result.name}</strong>: ${result.total} vs DC ${dc} (${result.degree}) - ${result.resultText}${effectsText}</li>`;
        })
        .join("");

      const content = `
        <div class="roll-flavor">
          <b>Thunderclap</b><br>
          Might Saving Throw (DC ${dc})
          <ul>${resultLines}</ul>
          <p class="help-text">Cost: 4 energy. 15-foot cone.</p>
        </div>
      `;

      await ChatMessage.create({
        content: content,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    });
  });

  const updateStatusSummary = (token) => {
    const el = ensureStatusSummary();
    const actor = token?.actor;
    const statusMap = CONFIG.singularity?.statusEffectsMap || {};
    const sidebar = document.getElementById("sidebar");
    const isCollapsed = document.body?.classList.contains("sidebar-collapsed") || sidebar?.classList.contains("collapsed");
    if (sidebar && !isCollapsed) {
      const rect = sidebar.getBoundingClientRect();
      const rightOffset = Math.max(10, window.innerWidth - rect.left + 10);
      el.style.right = `${rightOffset}px`;
    } else {
      el.style.right = "10px";
    }
    if (!actor) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    const effects = actor.effects.filter(e => e.getFlag("core", "statusId"));
    if (!effects.length) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    const items = effects.map(effect => {
      const statusId = effect.getFlag("core", "statusId");
      const statusDef = statusMap[statusId];
      if (!statusDef) return "";
      const value = Number(effect.getFlag("singularity", "value"));
      const hasValue = statusDef.flags?.singularity?.hasValue === true;
      const label = statusDef.label;
      const title = statusDef.flags?.singularity?.description || label;
      const valueBadge = hasValue && Number.isFinite(value) ? `<span class="status-value">${value}</span>` : "";
      return `
        <div class="status-item" title="${title}" data-status-id="${statusId}" data-has-value="${hasValue}">
          <img src="${statusDef.icon}" alt="${label}">
          ${valueBadge}
        </div>
      `;
    }).join("");
    el.innerHTML = items;
    el.classList.remove("hidden");
  };

  Hooks.on("controlToken", (token, controlled) => {
    if (controlled) {
      updateStatusSummary(token);
    } else {
      const active = canvas?.tokens?.controlled?.[0];
      updateStatusSummary(active);
    }
  });

  Hooks.on("createActiveEffect", (effect) => {
    const active = canvas?.tokens?.controlled?.[0];
    if (active?.actor?.id === effect.parent?.id) {
      updateStatusSummary(active);
    }
  });

  Hooks.on("updateActiveEffect", (effect) => {
    const active = canvas?.tokens?.controlled?.[0];
    if (active?.actor?.id === effect.parent?.id) {
      updateStatusSummary(active);
    }
  });

  Hooks.on("updateActor", async (actor, change) => {
    const hpChange = change?.system?.combat?.hp;
    if (!hpChange) return;
    await syncTokenHpBars(actor);
  });

  Hooks.on("updateActor", async (actor, change) => {
    const combatChange = change?.system?.combat?.protectiveBarrier;
    const levelChange = change?.system?.basic?.primeLevel;
    const progressionChange = change?.system?.progression;
    if (!combatChange && !levelChange && !progressionChange) return;
    const tokens = actor.getActiveTokens();
    const scene = canvas?.scene;
    if (!scene || !tokens.length) return;
    await refreshProtectiveBarrierForScene(scene);
  });

  Hooks.on("updateToken", async (tokenDoc, change) => {
    const actor = tokenDoc.actor;
    if (!actor) return;
    const bar = tokenDoc.getBarAttribute?.("bar1");
    if (!bar || bar.attribute !== "combat.hp") return;
    if (!("actorData" in change) && !("bar1" in change)) return;
    const value = change?.bar1?.value ?? change?.actorData?.system?.combat?.hp?.value ?? bar.value ?? actor.system?.combat?.hp?.value ?? 0;
    const max = change?.bar1?.max ?? change?.actorData?.system?.combat?.hp?.max ?? bar.max ?? actor.system?.combat?.hp?.max ?? 0;
    const currentValue = actor.system?.combat?.hp?.value ?? 0;
    const currentMax = actor.system?.combat?.hp?.max ?? 0;
    if (tokenDoc.actorLink) {
      if (value === currentValue) return;
    } else if (value === currentValue && max === currentMax) {
      return;
    }
    try {
      if (tokenDoc.actorLink) {
        await actor.update({
          "system.combat.hp.value": value
        });
      } else {
        await actor.update({
          "system.combat.hp.value": value,
          "system.combat.hp.max": max
        });
      }
    } catch (err) {
      console.warn("Singularity | Failed to sync actor HP from token:", err);
    }
  });

  Hooks.on("updateToken", async (tokenDoc, changed) => {
    if (!("x" in changed) && !("y" in changed) && !("disposition" in changed)) return;
    const scene = tokenDoc?.scene || canvas?.scene;
    if (!scene) return;
    await refreshProtectiveBarrierForScene(scene);
  });

  Hooks.on("updateCombat", async (combat, changed) => {
    if (!("turn" in changed) && !("round" in changed)) return;
    const prevId = combat?.previous?.combatantId;
    if (!prevId) return;
    const prevCombatant = combat.combatants.get(prevId);
    const actor = prevCombatant?.actor;
    if (!actor) return;
    const scaredEffect = actor.effects.find(effect => effect.getFlag("core", "statusId") === "scared");
    if (!scaredEffect) return;
    const currentValue = Number(scaredEffect.getFlag("singularity", "value") ?? 0);
    if (!Number.isFinite(currentValue) || currentValue <= 0) return;
    const nextValue = currentValue - 1;
    if (nextValue <= 0) {
      await scaredEffect.delete();
      return;
    }
    await scaredEffect.update({ "flags.singularity.value": nextValue });
  });

  Hooks.on("updateCombat", async (combat, changed) => {
    if (!("turn" in changed) && !("round" in changed)) return;
    const prevId = combat?.previous?.combatantId;
    if (!prevId) return;
    const prevCombatant = combat.combatants.get(prevId);
    const actor = prevCombatant?.actor;
    if (!actor) return;
    const isIncorporeal = actor.effects?.some(effect => effect.getFlag("core", "statusId") === "incorporeal");
    if (!isIncorporeal) return;
    const tokenDoc = prevCombatant?.token?.document || prevCombatant?.token;
    if (!tokenDoc) return;
    const inWall = tokenDoc.getFlag("singularity", "incorporealInWall") === true;
    if (!inWall) {
      const turns = Number(tokenDoc.getFlag("singularity", "incorporealWallTurns") ?? 0);
      if (turns !== 0) {
        await tokenDoc.setFlag("singularity", "incorporealWallTurns", 0);
      }
      return;
    }
    const nextTurns = Number(tokenDoc.getFlag("singularity", "incorporealWallTurns") ?? 0) + 1;
    await tokenDoc.setFlag("singularity", "incorporealWallTurns", nextTurns);
    const roll = new Roll(`${nextTurns}d10`);
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="roll-flavor"><b>Incorporeal Collision</b><br>${nextTurns}d10 Chaos damage (ended turn in solid object) = <strong>${roll.total}</strong></div>`
    });
  });

  Hooks.on("updateToken", async (tokenDoc, changed) => {
    if (!("x" in changed) && !("y" in changed)) return;
    const actor = tokenDoc?.actor;
    if (!actor) return;
    const isIncorporeal = actor.effects?.some(effect => effect.getFlag("core", "statusId") === "incorporeal");
    const token = tokenDoc.object;
    if (!token) return;
    const dest = { x: tokenDoc.x, y: tokenDoc.y };
    let collision = false;
    try {
      collision = token.checkCollision(dest, { type: "move" });
    } catch (err) {
      collision = false;
    }
    if (!isIncorporeal) {
      if (tokenDoc.getFlag("singularity", "incorporealInWall")) {
        await tokenDoc.setFlag("singularity", "incorporealInWall", false);
        await tokenDoc.setFlag("singularity", "incorporealWallTurns", 0);
      }
      return;
    }
    const current = tokenDoc.getFlag("singularity", "incorporealInWall") === true;
    if (current !== collision) {
      await tokenDoc.setFlag("singularity", "incorporealInWall", collision);
      if (!collision) {
        await tokenDoc.setFlag("singularity", "incorporealWallTurns", 0);
      }
    }
  });

  Hooks.on("preUpdateToken", (tokenDoc, update) => {
    const actor = tokenDoc?.actor;
    if (!actor) return;
    const isParalyzed = actor.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed");
    if (!isParalyzed) return;
    if ("x" in update || "y" in update) {
      ui.notifications?.warn("Paralyzed: cannot move.");
      return false;
    }
  });

  Hooks.on("createToken", async (tokenDoc) => {
    const scene = tokenDoc?.scene || canvas?.scene;
    if (!scene) return;
    await refreshProtectiveBarrierForScene(scene);
  });

  Hooks.on("deleteToken", async (tokenDoc) => {
    const scene = tokenDoc?.scene || canvas?.scene;
    if (!scene) return;
    await refreshProtectiveBarrierForScene(scene);
  });

  Hooks.on("deleteActiveEffect", (effect) => {
    const active = canvas?.tokens?.controlled?.[0];
    if (active?.actor?.id === effect.parent?.id) {
      updateStatusSummary(active);
    }
  });

  Hooks.on("preCreateActiveEffect", (effect, data) => {
    const statusId = data?.flags?.core?.statusId;
    const statusDef = CONFIG.singularity?.statusEffectsMap?.[statusId];
    if (!statusDef) return;
    const update = {};
    update["name"] = statusDef.label;
    update["flags.singularity.description"] = statusDef.flags?.singularity?.description || "";
    update["flags.singularity.hasValue"] = statusDef.flags?.singularity?.hasValue === true;
    if (statusDef.flags?.singularity?.hasValue) {
      const value = Number(data?.flags?.singularity?.value ?? 1);
      update["flags.singularity.value"] = value;
    }
    effect.updateSource(update);
  });

  Hooks.on("renderTokenHUD", (hud, html) => {
    const token = hud?.object;
    const actor = token?.actor;
    if (!actor) return;
    const statusMap = CONFIG.singularity?.statusEffectsMap || {};
    const $html = html instanceof jQuery ? html : $(html);
    $html.find(".status-effects .effect-control").each((_, el) => {
      const statusId = el.dataset.statusId;
      const statusDef = statusMap[statusId];
      if (!statusDef) return;
      const effect = actor.effects.find(e => e.getFlag("core", "statusId") === statusId);
      const $img = $(el);
      if (statusDef.flags?.singularity?.description) {
        $img.attr("title", statusDef.flags.singularity.description);
      }
      if (!effect || statusDef.flags?.singularity?.hasValue !== true) {
        return;
      }
      if (!$img.parent().hasClass("singularity-status-wrap")) {
        $img.wrap('<div class="singularity-status-wrap"></div>');
      }
      const $wrap = $img.parent();
      const value = Number(effect.getFlag("singularity", "value") ?? 1);
      $wrap.attr("data-status-value", value);
      let $badge = $wrap.find(".singularity-status-counter");
      if (!$badge.length) {
        $badge = $('<span class="singularity-status-counter"></span>');
        $wrap.append($badge);
      }
      $badge.text(value);
    });

    $html.find(".status-effects .effect-control")
      .off("contextmenu.singularity")
      .on("contextmenu.singularity", async (event) => {
        const statusId = event.currentTarget.dataset.statusId;
        const statusDef = statusMap[statusId];
        if (!statusDef || statusDef.flags?.singularity?.hasValue !== true) return;
        event.preventDefault();
        event.stopPropagation();
        const effect = actor.effects.find(e => e.getFlag("core", "statusId") === statusId);
        if (!effect) return;
        const delta = event.shiftKey ? -1 : 1;
        const currentValue = Number(effect.getFlag("singularity", "value") ?? 1);
        const nextValue = currentValue + delta;
        if (nextValue <= 0) {
          await effect.delete();
          return;
        }
        await effect.update({ "flags.singularity.value": nextValue });
        const $img = $(event.currentTarget);
        const $wrap = $img.parent(".singularity-status-wrap");
        if ($wrap.length) {
          $wrap.attr("data-status-value", nextValue);
          $wrap.find(".singularity-status-counter").text(nextValue);
        }
      });
  });

  // Register system-specific actors and items
  CONFIG.Actor.documentClass = SingularityActor;
  CONFIG.Item.documentClass = SingularityItem;

  Hooks.on("preCreateActor", (actor, data) => {
    if (actor.type !== "hero" && actor.type !== "npc") return;
    data.prototypeToken = data.prototypeToken || {};
    data.prototypeToken.actorLink = true;
  data.prototypeToken.bar1 = data.prototypeToken.bar1 || {};
  data.prototypeToken.bar1.attribute = "combat.hp";
  data.prototypeToken.displayBars = CONST.TOKEN_DISPLAY_MODES.ALWAYS;
  data.prototypeToken.lockRotation = true;
  data.prototypeToken.disposition =
    actor.type === "hero"
      ? CONST.TOKEN_DISPOSITIONS.FRIENDLY
      : CONST.TOKEN_DISPOSITIONS.HOSTILE;
  });

  Hooks.on("preCreateToken", (tokenDoc, data) => {
    data.actorLink = true;
  data.bar1 = data.bar1 || {};
  data.bar1.attribute = "combat.hp";
  data.displayBars = CONST.TOKEN_DISPLAY_MODES.ALWAYS;
  data.lockRotation = true;
  const actorType = tokenDoc.actor?.type;
  if (actorType === "hero") {
    data.disposition = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
  } else if (actorType === "npc") {
    data.disposition = CONST.TOKEN_DISPOSITIONS.HOSTILE;
  }
  });

  Hooks.on("preUpdateToken", (tokenDoc, changes) => {
    if ("actorLink" in changes && changes.actorLink !== true) {
      changes.actorLink = true;
    }
  });

  Hooks.on("renderTokenConfig", (_app, html) => {
    const $html = html instanceof jQuery ? html : $(html);
    const input = $html.find('input[name="actorLink"]');
    if (input.length) {
      input.prop("checked", true);
      input.prop("disabled", true);
      input.closest(".form-group, .form-fields, .form-group-stacked").css("opacity", 0.6);
    }
  });
  
  // Configure initiative system
  // Initiative = Wits + Training Bonus + Other Bonuses (no dice roll, just a flat value)
  CONFIG.Combat.initiative = {
    formula: "1d20",
    decimals: 0
  };
  
  // Override the initiative formula to roll 1d20 + initiative bonus
  // Return a valid formula that Foundry can evaluate
  Combatant.prototype._getInitiativeFormula = function() {
    const actor = this.actor;
    if (!actor || (actor.type !== "hero" && actor.type !== "npc")) {
      return "1d20";
    }
    
    const calculatedInitiative = calculateInitiative(actor);
    // Return formula: 1d20 + initiative bonus
    return `1d20 + ${calculatedInitiative}`;
  };
  
  // Hook into initiative roll to show dialog instead of rolling immediately
  Hooks.on("rollInitiative", async (combatant, formula, options) => {
    const actor = combatant.actor;
    if (!actor || (actor.type !== "hero" && actor.type !== "npc")) {
      return; // Let default behavior handle other types
    }
    
    // Show dialog instead of rolling immediately
    const calculatedInitiative = calculateInitiative(actor);
    
    const dialogContent = `
      <form class="singularity-initiative-dialog">
        <div class="initiative-fields-row">
          <div class="form-group-inline">
            <label>Initiative Value:</label>
            <input type="number" id="initiative-bonus" value="${calculatedInitiative}" readonly class="readonly-input"/>
          </div>
          <div class="form-group-inline">
            <label>Additional Modifier:</label>
            <input type="number" id="initiative-modifier" value="0" placeholder="0" class="editable-input"/>
          </div>
        </div>
        <p class="help-text">Add any extra bonuses or penalties (default: +0)</p>
      </form>
    `;
    
    const dialogTitle = `Roll Initiative for ${actor.name}`;
    
    const d = new Dialog({
      title: dialogTitle,
      content: dialogContent,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: "Roll Initiative",
          callback: async (html) => {
            const baseInitiative = parseFloat(html.find("#initiative-bonus").val()) || 0;
            const modifier = parseFloat(html.find("#initiative-modifier").val()) || 0;
            
            // Roll 1d20 + base initiative + modifier
            const rollFormula = `1d20 + ${baseInitiative}${modifier !== 0 ? ` + ${modifier}` : ''}`;
            const roll = new Roll(rollFormula);
            await roll.evaluate();
            
            // Create chat message with the roll
            const flavor = `<div class="roll-flavor"><b>Initiative Roll</b><br>1d20 + ${baseInitiative} (Base)${modifier !== 0 ? ` + ${modifier} (Modifier)` : ''} = <strong>${roll.total}</strong></div>`;
            
            await roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: actor }),
              flavor: flavor
            });
            
            // Set initiative in combat tracker
            await combatant.update({ initiative: roll.total });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: async () => {
            // Don't set initiative if cancelled
          }
        }
      },
      default: "roll",
      close: async () => {
        // Don't set initiative if closed without clicking a button
      }
    });
    
    d.render(true);
    
    // Return false to prevent the default roll
    return false;
  });

  // Register sheet applications
  const coreActorSheetV1 = foundry.appv1?.sheets?.ActorSheet;
  const coreItemSheetV1 = foundry.appv1?.sheets?.ItemSheet;
  const coreActorSheetV2 = foundry.applications?.api?.ActorSheetV2 || foundry.applications?.api?.DocumentSheetV2;
  const coreItemSheetV2 = foundry.applications?.api?.ItemSheetV2 || foundry.applications?.api?.DocumentSheetV2;
  if (coreActorSheetV1) foundry.documents.collections.Actors.unregisterSheet("core", coreActorSheetV1);
  if (coreActorSheetV2) foundry.documents.collections.Actors.unregisterSheet("core", coreActorSheetV2);
  foundry.documents.collections.Actors.registerSheet("singularity", SingularityActorSheetHero, {
    types: ["hero"],
    makeDefault: true
  });
  foundry.documents.collections.Actors.registerSheet("singularity", SingularityActorSheetNPC, {
    types: ["npc"],
    makeDefault: true
  });

  if (coreItemSheetV1) foundry.documents.collections.Items.unregisterSheet("core", coreItemSheetV1);
  if (coreItemSheetV2) foundry.documents.collections.Items.unregisterSheet("core", coreItemSheetV2);
  foundry.documents.collections.Items.registerSheet("singularity", SingularityItemSheet, {
    makeDefault: true
  });

  // Preload templates
  foundry.applications.handlebars.loadTemplates([
    "systems/singularity/templates/actor-sheets/hero-sheet.html",
    "systems/singularity/templates/actor-sheets/npc-sheet.html",
    "systems/singularity/templates/item-sheets/item-sheet.html"
  ]);
});

// Global fix for dialog titles showing "TYPES.Actor.hero" instead of proper titles
Hooks.on("renderDialog", function(dialog, html, data) {
  // Get the stored title from the dialog if available
  const correctTitle = dialog._singularityDialogTitle || data.title;
  
  // Only fix if we have a valid title and it's not a TYPES format
  if (!correctTitle || correctTitle.includes('TYPES.') || correctTitle.includes('Actor.')) {
    return; // Skip fixing if we don't have a valid title
  }
  
  // Fix dialog titles that show TYPES.Actor format
  const fixDialogTitle = () => {
    // Find the dialog window associated with this dialog
    const $dialogWindow = $(html).closest('.window-app');
    if (!$dialogWindow.length) return;
    
    const titleSelectors = [
      '.window-header .window-title',
      'h4.window-title',
      '.window-title',
      '.window-header h4',
      'header h4'
    ];
    
    titleSelectors.forEach(selector => {
      const titleElement = $dialogWindow.find(selector);
      if (titleElement.length) {
        const currentTitle = titleElement.text();
        // If title contains TYPES.Actor or Actor.hero/npc format, fix it
        if (currentTitle.includes('TYPES.Actor') || currentTitle.includes('Actor.hero') || currentTitle.includes('Actor.Hero') || currentTitle.includes('Actor.npc') || currentTitle.includes('Actor.NPC')) {
          titleElement.text(correctTitle);
          titleElement.html(correctTitle);
        }
      }
    });
  };
  
  // Fix immediately and then continuously
  setTimeout(fixDialogTitle, 0);
  setTimeout(fixDialogTitle, 10);
  setTimeout(fixDialogTitle, 50);
  setTimeout(fixDialogTitle, 100);
  setTimeout(fixDialogTitle, 200);
  
  // Set up continuous fix using requestAnimationFrame for better performance
  let animationFrameId;
  const continuousFix = () => {
    fixDialogTitle();
    animationFrameId = requestAnimationFrame(continuousFix);
  };
  
  setTimeout(() => {
    animationFrameId = requestAnimationFrame(continuousFix);
  }, 10);
  
  // Clean up when dialog closes
  if (dialog.close) {
    const originalClose = dialog.close;
    dialog.close = function(...args) {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      return originalClose.apply(this, args);
    };
  }
});

Hooks.once("ready", async function() {
  console.log("Singularity | System Ready");
  
  // Force actorLink, bar1 defaults, lock rotation, and disposition on existing prototypes and active tokens
  if (game.user?.isGM) {
    for (const actor of game.actors) {
      if (actor.type !== "hero" && actor.type !== "npc") continue;
      const updates = {};
      if (actor.prototypeToken?.actorLink !== true) {
        updates["prototypeToken.actorLink"] = true;
      }
      if (actor.prototypeToken?.bar1?.attribute !== "combat.hp") {
        updates["prototypeToken.bar1.attribute"] = "combat.hp";
      }
      if (actor.prototypeToken?.displayBars !== CONST.TOKEN_DISPLAY_MODES.ALWAYS) {
        updates["prototypeToken.displayBars"] = CONST.TOKEN_DISPLAY_MODES.ALWAYS;
      }
      if (actor.prototypeToken?.lockRotation !== true) {
        updates["prototypeToken.lockRotation"] = true;
      }
      const desiredDisposition =
        actor.type === "hero"
          ? CONST.TOKEN_DISPOSITIONS.FRIENDLY
          : CONST.TOKEN_DISPOSITIONS.HOSTILE;
      if (actor.prototypeToken?.disposition !== desiredDisposition) {
        updates["prototypeToken.disposition"] = desiredDisposition;
      }
      if (Object.keys(updates).length) {
        await actor.update(updates);
      }
    }
    for (const scene of game.scenes) {
      const updates = scene.tokens
        .map(t => {
          const actor = t.actorId ? game.actors.get(t.actorId) : null;
          const actorType = actor?.type;
          const desiredDisposition =
            actorType === "hero"
              ? CONST.TOKEN_DISPOSITIONS.FRIENDLY
              : actorType === "npc"
                ? CONST.TOKEN_DISPOSITIONS.HOSTILE
                : null;

          const needsUpdate =
            t.actorLink !== true ||
            t.bar1?.attribute !== "combat.hp" ||
            t.displayBars !== CONST.TOKEN_DISPLAY_MODES.ALWAYS ||
            t.lockRotation !== true ||
            (desiredDisposition !== null && t.disposition !== desiredDisposition);

          if (!needsUpdate) return null;

          const update = {
            _id: t.id,
            actorLink: true,
            bar1: { ...t.bar1, attribute: "combat.hp" },
            displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
            lockRotation: true
          };
          if (desiredDisposition !== null) {
            update.disposition = desiredDisposition;
          }
          return update;
        })
        .filter(Boolean);
      if (updates.length) {
        await scene.updateEmbeddedDocuments("Token", updates);
      }
    }
    for (const actor of game.actors) {
      await syncTokenHpBars(actor);
    }
  }

  // Max HP is owned by the actor sheet; don't recalculate it here.

  // Auto-create pregenerated heroes in pregens compendium if they don't exist
  // Wait a bit for compendiums to fully initialize
  setTimeout(async () => {
    console.log("Singularity | Pregenerated heroes auto-creation has been disabled.");
    return;
    try {
      const pack = game.packs.find(p => p.metadata.name === "pregens" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.warn("Singularity | Pregens compendium not found");
        return;
      }
      
      // Ensure pack index is loaded
      if (!pack.index.size) {
        await pack.getIndex();
      }
      
      // Define all pregen data
      const pregens = [
        {
          name: "Vanguard",
          img: "systems/singularity/img/pregens/Vanguard.jpg",
          abilities: { might: 4, agility: 2, endurance: 4, wits: 2, charm: 0 },
          combat: { hp: { value: 18, max: 18 }, ac: 17, speeds: { land: 25 }, initiative: 0 },
          skills: {
            "Survival": { ability: "wits", rank: "Apprentice", otherBonuses: 0 },
            "Endurance Saves": { ability: "endurance", rank: "Apprentice", otherBonuses: 0 }
          },
          attacks: [{ name: "Unarmed Strike", attackBonus: 6, damage: "1d2+2", damageType: "kinetic", range: "Melee", ability: "might" }],
          items: [
            { name: "Hard to Kill", type: "talent", description: "Increase Wound Limit by 2" },
            { name: "Combat Vest", type: "equipment", description: "A protective combat vest providing armor coverage." }
          ],
          backstory: "Cassidy Miller was born in the Dust Belts, struggling agricultural states on the Terra frontiers. Her father, a structural welder, taught her that anything can be fixed with enough heat and a steady hand.\n\nWhen local syndicates began shaking down workers, a teenage Cassidy fashioned crude armor from welding equipment and hull-plating scraps. She became a nightmare for bullies and debt collectors, earning a reputation as an \"unmovable object.\"\n\nShe joined the Free States Army to protect more than just her neighborhood. During the Varysk Campaign, her true power revealed itself when her unit was pinned in a collapsing spire. While the building crumbled around them, Cassidy anchored herself and held the structural supports together with her bare hands, allowing her squad to evacuate. She walked out of the rubble carrying her commanding officer, her enhanced durability and strength fully awakened for the first time.\n\nThe government tried to market her as \"Lady Liberty\" in a flashy spandex suit, but Cassidy refused. She dropped her combat boots on the General's desk and declared, \"I'm a soldier, not a mascot.\" They compromised on \"Vanguard\", a name honoring her position at the front of every charge.",
          appearance: "Cassidy has short, dark brown hair that's often windswept from action. Her face carries a stern, focused expression, with dark, intense eyes that constantly scan for threats. She's in her late twenties, with the weathered look of someone who's seen real combat.\n\nShe wears heavy, segmented armor in dark metallic grey, showing patches of rust and wear that speak to extensive field use. The armor is layered and robust, covering her torso, arms, and legs with gauntlets, pauldrons, and greaves. Beneath the armor, a dark form-fitting undersuit provides additional protection. A utility belt with multiple pouches is strapped around her waist, carrying essential gear. Her boots are sturdy and dark brown, built for durability over style.\n\nHer posture is always ready, weight slightly shifted, conveying both confidence and constant vigilance. Even at rest, she moves with the economy of motion of a trained soldier who knows how to conserve energy for when it matters."
        },
        {
          name: "Grim Reaper",
          img: "systems/singularity/img/pregens/GrimReaper.jpg",
          abilities: { might: 0, agility: 4, endurance: 2, wits: 6, charm: 0 },
          combat: { hp: { value: 9, max: 9 }, ac: 12, speeds: { land: 25 }, initiative: 0 },
          skills: {
            "Perception": { ability: "wits", rank: "Apprentice", otherBonuses: 0 },
            "Stealth": { ability: "agility", rank: "Apprentice", otherBonuses: 0 },
            "Survival": { ability: "wits", rank: "Apprentice", otherBonuses: 0 },
            "Athletics": { ability: "might", rank: "Apprentice", otherBonuses: 0 },
            "Ranged Weapons": { ability: "agility", rank: "Apprentice", otherBonuses: 0 }
          },
          attacks: [],
          items: [
            { name: "Deadeye", type: "talent", description: "Action, 4 Energy: +5 bonus to next ranged attack (lost if you or target moves)" },
            { 
              name: "Rifle", 
              type: "weapon", 
              description: "A long-barreled firearm built for accuracy and stopping power at medium to long range. Rifles favor controlled, deliberate shots over speed, rewarding steady aim and battlefield positioning.",
              equipped: true,
              weaponData: {
                attackBonus: 0,
                damage: "1d6 + Agility modifier",
                damageType: "kinetic",
                range: "60 feet",
                type: "ranged",
                hands: 2,
                energyCost: 2,
                traits: ["Reload (Cost: 2 energy, 4 shots)"]
              }
            },
            {
              name: "Combat Vest",
              type: "armor",
              description: "A tactical vest with skull emblem. Provides basic protection while maintaining mobility.",
              equipped: true,
              armorData: {
                baseAC: 14,
                type: "medium",
                agilityCap: 4,
                mightRequirement: 1,
                traits: ["Noisy (3)"]
              }
            }
          ],
          backstory: "James Cross was a decorated Free States Army sniper, known for his precision and unwavering focus. He had everything: a loving wife, two children, and a promising career. Then came the Varysk Campaign.\n\nWhile Cross was deployed, a local crime syndicate moved into his neighborhood. When his wife refused their protection racket, they made an example of her. Cross returned home to find his family dead, his house burned, and the syndicate's mark left as a message.\n\nThe military offered counseling. The police promised an investigation. Cross took his rifle and disappeared.\n\nNow he hunts criminals with the same methodical precision he once used on enemy combatants. He doesn't care about due process, collateral damage, or the law. If you're on his list, you're dead. The skull emblem on his shoulder pad serves as a warning: cross the Grim Reaper, and there's no coming back.\n\nHe works alone, trusts no one, and leaves no witnesses. The only thing that matters is thinning the herd of those who prey on the innocent.",
          appearance: "James Cross is a rugged man in his late thirties, with a chiseled jawline and intense, dark eyes that have seen too much. A prominent scar runs across the bridge of his nose and down his left cheek, a permanent reminder of the war that shaped him. He keeps his dark brown hair short and practical, and maintains a neatly trimmed beard.\n\nHe wears tactical gear: a dark tactical vest over a dark blue or grey jacket, with multiple pouches and webbing for ammunition and equipment. His most distinctive feature is the dark grey metallic shoulder pad on his right shoulder, emblazoned with a white skull emblem. He moves with the economy of motion of a trained soldier, every action deliberate and purposeful.\n\nHis rifle is always within reach, and his fingerless tactical gloves are stained with the grime of countless stakeouts and firefights. Even at rest, his eyes constantly scan his surroundings, looking for threats, exits, and targets."
        },
        {
          name: "Omega",
          img: "systems/singularity/img/pregens/Omega.jpg",
          abilities: { might: 6, agility: 4, endurance: 2, wits: 0, charm: 2 },
          combat: { hp: { value: 15, max: 15 }, ac: 12, speeds: { land: 25, flying: 15 }, initiative: 0 },
          skills: {
            "Athletics": { ability: "might", rank: "Apprentice", otherBonuses: 0 },
            "Acrobatics": { ability: "agility", rank: "Apprentice", otherBonuses: 0 }
          },
          attacks: [
            { name: "Cosmic Blast", attackBonus: 7, damage: "1d4+3", damageType: "chaos", range: "Ranged", ability: "might" },
            { name: "Unarmed Strike", attackBonus: 3, damage: "1d4+3", damageType: "kinetic", range: "Melee", ability: "might" }
          ],
          items: [
            { name: "Enhanced Vitality", type: "talent", description: "+1 Max HP per Prime Level" },
            { name: "Impact Control", type: "talent", description: "Half damage from falling" }
          ],
          backstory: "Omega cannot remember her life before the lab. She is unsure if she was ever a child or if her life began as an adult subject. Raised by the Church of Singularity, she viewed the scientists as her only family; they experimented on her cosmic potential constantly but never with malice. Though their true goals remain a mystery to her, she has entered the world with a simple, driven purpose: she helps whoever she can, acting as the benevolent force she was raised to be.",
          appearance: "Omega has vibrant, wavy purple hair that reaches just past her shoulders, often caught in motion as if she's constantly in flight. Her most striking feature is the glowing purple energy that emanates from her eyes, forming a cosmic mask-like effect that spreads across her brow and eye sockets. This starry, ethereal energy seems to pulse with power.\n\nShe wears a sleek, form-fitting black bodysuit with a prominent vibrant purple section running down the center of her torso. A stylized gold symbol adorns her chest, resembling an open circle with a line extending from it. Her outfit is accented with substantial gold armor pieces: large rounded pauldrons on her shoulders, gauntlet-like pieces on her forearms, and an intricate gold belt around her waist. Black gloves extend up her forearms to meet the gold gauntlets.\n\nA long, dark purple cape flows dramatically behind her, adding to her otherworldly presence. The cape seems to have a subtle sparkle or glow, as if infused with the same cosmic energy that powers her abilities. Even at rest, Omega moves with a sense of weightlessness, as if she's always partially unbound from gravity."
        },
        {
          name: "Red Squirrel",
          img: "systems/singularity/img/pregens/RedSquirrel.jpg",
          abilities: { might: 0, agility: 4, endurance: 2, wits: 6, charm: 0 },
          combat: { hp: { value: 9, max: 9 }, ac: 13, speeds: { land: 25 }, initiative: 0 },
          skills: {
            "Hacking": { ability: "wits", rank: "Apprentice", otherBonuses: 0 },
            "Stealth": { ability: "agility", rank: "Apprentice", otherBonuses: 0 },
            "Gadget Tuning": { ability: "wits", rank: "Apprentice", otherBonuses: 0 },
            "Technology": { ability: "wits", rank: "Apprentice", otherBonuses: 0 }
          },
          attacks: [],
          items: [
            { name: "Improvised Gadget", type: "talent", description: "Action, 2 Energy: Create one Level 0 gadget (once per day)" },
            {
              name: "Jacket",
              type: "armor",
              description: "This jacket appears to be ordinary outerwear, but hidden layers of reinforced fabric offer basic protection while allowing complete freedom of movement. It is commonly worn by civilians, scouts, and marksmen who rely on speed and awareness rather than bulky protection.",
              equipped: true,
              armorData: {
                baseAC: 11,
                type: "light",
                agilityCap: null,
                mightRequirement: null,
                traits: []
              }
            }
          ],
          backstory: "Marcus Trent was always the kid who took things apart to see how they worked and sometimes put them back together better. Growing up in the tech districts, he learned that the best way to understand a system was to break into it. What started as curiosity became a skill, and that skill became a reputation.\n\nWhen corporate security started hunting him for \"unauthorized system access,\" Marcus went underground. He adopted the alias \"Red Squirrel\" after a particularly memorable escape through ventilation shafts, and the name stuck. Now he uses his hacking skills and custom-built gadgets to help those who can't help themselves, always staying one step ahead of the law and the corporations that think they own the future.\n\nHis signature tech screen gloves allow him to interface directly with his gadgets, controlling them with gestures and taps. Combined with his jacket's concealment properties, Red Squirrel can disappear into a crowd or slip through the tightest security as long as he has enough prep time.",
          appearance: "Marcus is lean and wiry, with quick, nervous movements that match his alias. He wears a dark jacket that helps him blend into crowds, and his most distinctive feature is the pair of tech screen gloves: sleek, fingerless gloves with integrated holographic displays on the palms that glow softly when active. His eyes are always scanning, always calculating, looking for the next angle or escape route."
        }
      ];
      
      const pregenMetadata = {
        "Vanguard": { background: "Military", powerset: "Bastion", credits: 4 },
        "Grim Reaper": { background: "Military", powerset: "Marksman", credits: 4 },
        "Omega": { background: "Athlete", powerset: "Paragon", credits: 10 },
        "Red Squirrel": { background: "Criminal", powerset: "Gadgeteer", credits: 8 }
      };
      
      // Check which pregens already exist and update their image paths if needed
      const wasLocked = pack.locked;
      if (wasLocked) {
        await pack.configure({ locked: false });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Update image paths, token images, and items for existing pregens
      for (const pregen of pregens) {
        const existing = pack.index.find(a => a.name === pregen.name);
        if (existing) {
          try {
            const existingActor = await pack.getDocument(existing._id);
            const currentImg = existingActor.img || "";
            const expectedImg = pregen.img;
            const currentTokenImg = existingActor.prototypeToken?.texture?.src || "";
            
            const updates = {};
            let needsUpdate = false;
            
            if (currentImg !== expectedImg) {
              updates["img"] = expectedImg;
              needsUpdate = true;
              console.log(`Singularity | Will update ${pregen.name} image path from "${currentImg}" to "${expectedImg}"`);
            }
            
            // Update token image to match portrait if it's different from expected
            // Only update if it's empty, default, or matches old portrait (to avoid overwriting custom tokens)
            if (currentTokenImg !== expectedImg) {
              // Check for old paths that don't include "pregens" (old structure was img/Name.jpg, new is img/pregens/Name.jpg)
              const oldPathPatterns = [
                "systems/singularity/img/Omega.jpg",
                "systems/singularity/img/RedSquirrel.jpg", 
                "systems/singularity/img/Vanguard.jpg",
                "systems/singularity/img/GrimReaper.jpg",
                "img/Omega.jpg",
                "img/RedSquirrel.jpg",
                "img/Vanguard.jpg",
                "img/GrimReaper.jpg"
              ];
              const isOldPath = oldPathPatterns.some(pattern => currentTokenImg.includes(pattern) && !currentTokenImg.includes("pregens"));
              
              // Update if empty, default, matches current portrait (auto-set), or is an old path
              if (currentTokenImg === "" || 
                  currentTokenImg === "icons/svg/mystery-man.svg" || 
                  currentTokenImg === currentImg ||
                  isOldPath) {
                updates["prototypeToken.texture.src"] = expectedImg;
                needsUpdate = true;
                console.log(`Singularity | Will update ${pregen.name} token image from "${currentTokenImg}" to "${expectedImg}"`);
              }
            }
            
            if (needsUpdate) {
              await existingActor.update(updates);
              console.log(`Singularity | ✓ Updated ${pregen.name} image and/or token path`);
              
              // Also update any existing tokens in scenes that have old image paths
              const oldPathPatterns = [
                "systems/singularity/img/Omega.jpg",
                "systems/singularity/img/RedSquirrel.jpg", 
                "systems/singularity/img/Vanguard.jpg",
                "systems/singularity/img/GrimReaper.jpg"
              ];
              
              // Check all scenes for tokens with old paths
              for (const scene of game.scenes) {
                if (!scene.tokens) continue;
                
                const tokenUpdates = [];
                for (const tokenDoc of scene.tokens) {
                  if (!tokenDoc.actorId || tokenDoc.actorId !== existing._id) continue;
                  
                  const tokenImg = tokenDoc.texture?.src || "";
                  const hasOldPath = oldPathPatterns.some(pattern => 
                    tokenImg.includes(pattern) && !tokenImg.includes("pregens")
                  );
                  
                  if (hasOldPath) {
                    tokenUpdates.push({
                      _id: tokenDoc.id,
                      "texture.src": expectedImg
                    });
                  }
                }
                
                if (tokenUpdates.length > 0) {
                  await scene.updateEmbeddedDocuments("Token", tokenUpdates);
                  console.log(`Singularity | ✓ Updated ${tokenUpdates.length} token(s) in scene "${scene.name}" for ${pregen.name}`);
                }
              }
            }
            
            // Check and add missing items
            const existingItems = existingActor.items || [];
            const existingItemNames = existingItems.map(i => i.name);
            
            const itemsToAdd = [];
            for (const item of pregen.items) {
              if (!existingItemNames.includes(item.name)) {
                const baseItem = {
                  name: item.name,
                  type: item.type,
                  system: {
                    description: item.description || "",
                    archived: false
                  }
                };
                
                if (item.type === "weapon" && item.weaponData) {
                  baseItem.system.basic = {
                    attackBonus: item.weaponData.attackBonus || 0,
                    damage: item.weaponData.damage || "1d4",
                    damageType: item.weaponData.damageType || "kinetic",
                    range: item.weaponData.range || "",
                    properties: item.weaponData.traits || [],
                    type: item.weaponData.type || "melee",
                    price: 0,
                    hands: item.weaponData.hands || 1,
                    energyCost: item.weaponData.energyCost || 1,
                    equipped: item.equipped === true
                  };
                  baseItem.img = item.weaponData.type === "ranged" ? "icons/svg/target.svg" : "icons/svg/sword.svg";
                } else if (item.type === "armor" && item.armorData) {
                  baseItem.system.basic = {
                    baseAC: item.armorData.baseAC || 10,
                    type: item.armorData.type || "light",
                    agilityCap: item.armorData.agilityCap,
                    mightRequirement: item.armorData.mightRequirement,
                    price: 0,
                    traits: item.armorData.traits || [],
                    description: "",
                    equipped: item.equipped === true
                  };
                } else if (item.type === "equipment") {
                  baseItem.system.basic = { quantity: 1 };
                } else {
                  // Talent or other
                  baseItem.system.basic = { type: "generic", prerequisites: "" };
                }
                
                itemsToAdd.push(baseItem);
                console.log(`Singularity | Will add missing item "${item.name}" to ${pregen.name}`);
              }
            }
            
            if (itemsToAdd.length > 0) {
              await existingActor.createEmbeddedDocuments("Item", itemsToAdd);
              console.log(`Singularity | ✓ Added ${itemsToAdd.length} missing item(s) to ${pregen.name}`);
            }
          } catch (updateError) {
            console.error(`Singularity | Error updating ${pregen.name}:`, updateError);
          }
        }
      }
      
      // Check if all pregens exist (after updating images)
      const existingNames = pregens.filter(p => pack.index.find(a => a.name === p.name));
      if (existingNames.length === pregens.length) {
        console.log("Singularity | All pregens already exist in compendium (images updated if needed)");
        if (wasLocked) await pack.configure({ locked: true });
        return;
      }
      
      let createdCount = 0;
      
      // Process each pregen
      for (const pregen of pregens) {
        // Skip if already exists
        const existing = pack.index.find(a => a.name === pregen.name);
        if (existing) {
          console.log(`Singularity | ${pregen.name} already exists in compendium`);
          continue;
        }
        
        const metadata = pregenMetadata[pregen.name];
        
        const actorData = {
          name: pregen.name,
          type: "hero",
          system: {
            basic: {
              primeLevel: 1,
              phenotype: "Human",
              subtype: "Terran",
              size: "Medium",
              background: metadata.background,
              powerset: metadata.powerset
            },
            abilities: pregen.abilities,
            combat: pregen.combat,
            skills: pregen.skills || {},
            savingThrows: {
              might: { rank: "Novice", otherBonuses: 0 },
              agility: { rank: "Novice", otherBonuses: 0 },
              endurance: { rank: "Novice", otherBonuses: 0 },
              wits: { rank: "Novice", otherBonuses: 0 },
              charm: { rank: "Novice", otherBonuses: 0 }
            },
            equipment: {
              credits: metadata.credits,
              weapons: [],
              armor: [],
              other: []
            },
            attacks: pregen.attacks || [],
            notes: "",
            backstory: pregen.backstory || "",
            appearance: pregen.appearance || ""
          },
          img: pregen.img,
          prototypeToken: {
            texture: {
              src: pregen.img
            }
          }
        };
        
        let actor;
        try {
          console.log(`Singularity | Creating ${pregen.name} in world...`);
          actor = await Actor.createDocuments([actorData], { render: false });
          actor = actor[0];
          
          if (!actor || !actor.id) {
            throw new Error(`Failed to create ${pregen.name} in world`);
          }
          
          // Create items
          const itemData = pregen.items.map(item => {
            const baseItem = {
              name: item.name,
              type: item.type,
              system: {
                description: item.description || "",
                archived: false
              }
            };
            
            if (item.type === "weapon" && item.weaponData) {
              baseItem.system.basic = {
                attackBonus: item.weaponData.attackBonus || 0,
                damage: item.weaponData.damage || "1d4",
                damageType: item.weaponData.damageType || "kinetic",
                range: item.weaponData.range || "",
                properties: item.weaponData.traits || [],
                type: item.weaponData.type || "melee",
                price: 0,
                hands: item.weaponData.hands || 1,
                energyCost: item.weaponData.energyCost || 1,
                equipped: item.equipped === true
              };
              baseItem.img = item.weaponData.type === "ranged" ? "icons/svg/pistol.svg" : "icons/svg/sword.svg";
            } else if (item.type === "armor" && item.armorData) {
              baseItem.system.basic = {
                baseAC: item.armorData.baseAC || 10,
                type: item.armorData.type || "light",
                agilityCap: item.armorData.agilityCap,
                mightRequirement: item.armorData.mightRequirement,
                price: 0,
                traits: item.armorData.traits || [],
                description: "",
                equipped: item.equipped === true
              };
            } else if (item.type === "equipment") {
              baseItem.system.basic = { quantity: 1 };
            } else {
              // Talent or other
              baseItem.system.basic = { type: "generic", prerequisites: "" };
            }
            
            return baseItem;
          });
          
          if (itemData.length > 0) {
            await actor.createEmbeddedDocuments("Item", itemData);
          }
          
          // Import into compendium
          await pack.importDocument(actor);
          await actor.delete();
          
          await new Promise(resolve => setTimeout(resolve, 300));
          createdCount++;
        } catch (createError) {
          console.error(`Singularity | Error creating ${pregen.name}:`, createError);
          if (actor && actor.id && !actor.pack) {
            try {
              await actor.delete();
            } catch (cleanupError) {
              console.error(`Singularity | Error cleaning up ${pregen.name}:`, cleanupError);
            }
          }
        }
      }
      
      // Fix any tokens in scenes that have old image paths (regardless of actor linking)
      const oldPathMappings = {
        "systems/singularity/img/Omega.jpg": "systems/singularity/img/pregens/Omega.jpg",
        "systems/singularity/img/RedSquirrel.jpg": "systems/singularity/img/pregens/RedSquirrel.jpg",
        "systems/singularity/img/Vanguard.jpg": "systems/singularity/img/pregens/Vanguard.jpg",
        "systems/singularity/img/GrimReaper.jpg": "systems/singularity/img/pregens/GrimReaper.jpg"
      };
      
      let fixedSceneTokens = 0;
      for (const scene of game.scenes) {
        if (!scene.tokens) continue;
        
        const tokenUpdates = [];
        for (const tokenDoc of scene.tokens) {
          const tokenImg = tokenDoc.texture?.src || "";
          
          // Check if this token has an old image path
          for (const [oldPath, newPath] of Object.entries(oldPathMappings)) {
            if (tokenImg.includes(oldPath) && !tokenImg.includes("pregens")) {
              tokenUpdates.push({
                _id: tokenDoc.id,
                "texture.src": newPath
              });
              console.log(`Singularity | Will fix token "${tokenDoc.name}" in scene "${scene.name}" - updating image from old path to "${newPath}"`);
              break; // Only fix once per token
            }
          }
        }
        
        if (tokenUpdates.length > 0) {
          try {
            await scene.updateEmbeddedDocuments("Token", tokenUpdates);
            fixedSceneTokens += tokenUpdates.length;
            console.log(`Singularity | ✓ Fixed ${tokenUpdates.length} token(s) in scene "${scene.name}"`);
          } catch (tokenFixError) {
            console.error(`Singularity | Error fixing tokens in scene "${scene.name}":`, tokenFixError);
          }
        }
      }
      
      if (fixedSceneTokens > 0) {
        console.log(`Singularity | ✓ Fixed ${fixedSceneTokens} total token(s) with old image paths across all scenes`);
      }
      
      // Refresh index after all creations
      if (createdCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await pack.getIndex({ force: true });
        
        if (wasLocked) await pack.configure({ locked: true });
        
        // Refresh any open compendium windows
        for (const app of Object.values(ui.windows)) {
          if (app.pack && app.pack === pack && app.render) {
            await app.render(false);
          }
        }
        
        if (createdCount > 0) {
          ui.notifications.info(`${createdCount} pregen character(s) created in Pregenerated Heroes compendium!`);
        }
      }
    } catch (error) {
      console.error("Singularity | Could not auto-create pregens:", error);
      ui.notifications.error(`Failed to create pregens: ${error.message}`);
    }
  }, 1000);

  // Auto-create Human phenotype in phenotypes compendium if it doesn't exist
  setTimeout(async () => {
    try {
      const pack = game.packs.find(p => p.metadata.name === "phenotypes" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.warn("Singularity | Phenotypes compendium not found");
        return;
      }
      
      // Ensure pack index is loaded
      if (!pack.index.size) {
        await pack.getIndex();
      }
      
      const wasLocked = pack.locked;
      
      const existing = pack.index.find(i => i.name === "Human");
      if (existing) {
        // Check if the existing item has the correct type
        try {
          // Unlock pack if needed
          if (wasLocked) {
            await pack.configure({ locked: false });
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          const existingItem = await pack.getDocument(existing._id);
          if (existingItem && existingItem.system?.basic?.type !== "phenotype") {
            console.log("Singularity | Fixing Human phenotype type from", existingItem.system?.basic?.type, "to phenotype");
            await existingItem.update({ "system.basic.type": "phenotype" });
            console.log("Singularity | Human phenotype type fixed!");
            ui.notifications.info("Human phenotype type corrected to 'phenotype'!");
          } else {
            console.log("Singularity | Human phenotype already exists with correct type");
          }
          
          // Re-lock pack if it was locked
          if (wasLocked) {
            await pack.configure({ locked: true });
          }
        } catch (error) {
          console.error("Singularity | Error checking/fixing existing Human item:", error);
          // Re-lock pack if it was locked, even on error
          if (wasLocked) {
            await pack.configure({ locked: true });
          }
        }
        return;
      }
      if (wasLocked) {
        console.log("Singularity | Unlocking phenotypes compendium pack");
        await pack.configure({ locked: false });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Create Human phenotype as a talent item
      const itemData = {
        name: "Human",
        type: "talent",
        system: {
          description: `<h2>Description</h2>
<p>Humans are versatile and adaptable, capable of thriving in nearly any environment or profession. Their ingenuity and resourcefulness make them quick learners and flexible adventurers.</p>

<h3>Benefits</h3>
<ul>
  <li><strong>Base speed:</strong> 25 feet</li>
  <li><strong>Size:</strong> Medium</li>
  <li><strong>Ability Boost:</strong> +1 to any ability of your choice.</li>
  <li><strong>Generic Talent:</strong> You gain a Generic Talent.</li>
</ul>

<h3>Subtypes</h3>
<ul>
  <li>Terran</li>
</ul>`,
          basic: {
            type: "phenotype",
            prerequisites: ""
          },
          archived: false
        },
        img: "icons/svg/mystery-man.svg"
      };
      
      // Create the item in the world first, then import it into the compendium
      let item;
      try {
        console.log("Singularity | Creating Human phenotype in world first...");
        item = await Item.createDocuments([itemData], { render: false });
        item = item[0];
        
        if (!item || !item.id) {
          throw new Error("Failed to create item in world");
        }
        
        console.log("Singularity | Item created in world, ID:", item.id, "Name:", item.name);
        
        // Import the item into the compendium
        console.log("Singularity | Importing item into compendium...");
        const imported = await pack.importDocument(item);
        console.log("Singularity | Item imported, result:", imported);
        
        // Delete the world item since we only want it in the compendium
        await item.delete();
        console.log("Singularity | World item deleted");
        
        // Wait for the import to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Refresh the compendium index
        await pack.getIndex({ force: true });
        const found = pack.index.find(i => i.name === "Human");
        console.log("Singularity | Human in index after import:", found ? "YES" : "NO");
        
        if (found) {
          item = await pack.getDocument(found._id);
          console.log("Singularity | Retrieved imported item, ID:", item.id);
        } else {
          throw new Error("Item was imported but not found in compendium index");
        }
      } catch (createError) {
        console.error("Singularity | Error creating/importing item:", createError);
        
        // Clean up: if we created a world item but import failed, delete it
        if (item && item.id && !item.pack) {
          try {
            await item.delete();
            console.log("Singularity | Cleaned up world item after error");
          } catch (cleanupError) {
            console.error("Singularity | Error cleaning up world item:", cleanupError);
          }
        }
        
        throw createError;
      }
      
      // Wait for database write to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh the compendium index
      await pack.getIndex({ force: true });
      console.log("Singularity | Phenotypes index refreshed, size:", pack.index.size);
      
      // Verify the item is in the index
      const humanInIndex = pack.index.find(i => i.name === "Human" || (item && i._id === item.id));
      console.log("Singularity | Human in index:", humanInIndex ? "YES" : "NO");
      
      if (wasLocked) await pack.configure({ locked: true });
      
      // Refresh any open compendium windows
      for (const app of Object.values(ui.windows)) {
        if (app.pack && app.pack === pack && app.render) {
          console.log("Singularity | Refreshing phenotypes compendium window");
          await app.render(false);
        }
      }
      
      if (humanInIndex) {
        ui.notifications.info("Human phenotype created in Phenotypes compendium!");
      } else {
        ui.notifications.warn("Human phenotype was created. Please close and reopen the compendium window to see it.");
        console.warn("Singularity | Human created but not yet in index. Item ID:", item.id);
      }
    } catch (error) {
      console.error("Singularity | Could not auto-create Human phenotype:", error);
      ui.notifications.error(`Failed to create Human phenotype: ${error.message}`);
    }
  }, 2000);

  // Auto-create Terran subtype in subtypes compendium if it doesn't exist
  setTimeout(async () => {
    try {
      const pack = game.packs.find(p => p.metadata.name === "subtypes" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.warn("Singularity | Subtypes compendium not found");
        return;
      }
      
      // Ensure pack index is loaded
      if (!pack.index.size) {
        await pack.getIndex();
      }
      
      const wasLocked = pack.locked;
      
      const existing = pack.index.find(i => i.name === "Terran");
      if (existing) {
        // Check if the existing item has the correct type
        try {
          // Unlock pack if needed
          if (wasLocked) {
            await pack.configure({ locked: false });
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          const existingItem = await pack.getDocument(existing._id);
          if (existingItem && existingItem.system?.basic?.type !== "subtype") {
            console.log("Singularity | Fixing Terran subtype type from", existingItem.system?.basic?.type, "to subtype");
            await existingItem.update({ "system.basic.type": "subtype" });
            console.log("Singularity | Terran subtype type fixed!");
            ui.notifications.info("Terran subtype type corrected to 'subtype'!");
          } else {
            console.log("Singularity | Terran subtype already exists with correct type");
          }
          
          // Re-lock pack if it was locked
          if (wasLocked) {
            await pack.configure({ locked: true });
          }
        } catch (error) {
          console.error("Singularity | Error checking/fixing existing Terran item:", error);
          // Re-lock pack if it was locked, even on error
          if (wasLocked) {
            await pack.configure({ locked: true });
          }
        }
        return;
      }
      
      // Unlock pack if needed
      if (wasLocked) {
        console.log("Singularity | Unlocking subtypes compendium pack");
        await pack.configure({ locked: false });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Create Terran subtype as a talent item
      const itemData = {
        name: "Terran",
        type: "talent",
        system: {
          description: `<h2>Description</h2>
<p>Terrans are sturdy and resilient, shaped by their homeworld's demanding conditions. They are known for endurance, practical skills, and a balanced approach to challenges.</p>

<h3>Benefits</h3>
<ul>
  <li><strong>Ability Boost:</strong> +1 to any ability of your choice.</li>
  <li><strong>Generic Talent:</strong> You gain a Generic Talent.</li>
</ul>

<h3>Requirements</h3>
<p>This subtype is only available to Human characters.</p>`,
          basic: {
            type: "subtype",
            prerequisites: "Human"
          },
          archived: false
        },
        img: "icons/svg/mystery-man.svg"
      };
      
      // Create the item in the world first, then import it into the compendium
      let item;
      try {
        console.log("Singularity | Creating Terran subtype in world first...");
        item = await Item.createDocuments([itemData], { render: false });
        item = item[0];
        
        if (!item || !item.id) {
          throw new Error("Failed to create item in world");
        }
        
        console.log("Singularity | Item created in world, ID:", item.id, "Name:", item.name);
        
        // Import the item into the compendium
        console.log("Singularity | Importing item into compendium...");
        const imported = await pack.importDocument(item);
        console.log("Singularity | Item imported, result:", imported);
        
        // Delete the world item since we only want it in the compendium
        await item.delete();
        console.log("Singularity | World item deleted");
        
        // Wait for the import to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Refresh the compendium index
        await pack.getIndex({ force: true });
        const found = pack.index.find(i => i.name === "Terran");
        console.log("Singularity | Terran in index after import:", found ? "YES" : "NO");
        
        if (found) {
          item = await pack.getDocument(found._id);
          console.log("Singularity | Retrieved imported item, ID:", item.id);
        } else {
          throw new Error("Item was imported but not found in compendium index");
        }
      } catch (createError) {
        console.error("Singularity | Error creating/importing item:", createError);
        
        // Clean up: if we created a world item but import failed, delete it
        if (item && item.id && !item.pack) {
          try {
            await item.delete();
            console.log("Singularity | Cleaned up world item after error");
          } catch (cleanupError) {
            console.error("Singularity | Error cleaning up world item:", cleanupError);
          }
        }
        
        throw createError;
      }
      
      // Wait for database write to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh the compendium index
      await pack.getIndex({ force: true });
      console.log("Singularity | Subtypes index refreshed, size:", pack.index.size);
      
      // Verify the item is in the index
      const terranInIndex = pack.index.find(i => i.name === "Terran" || (item && i._id === item.id));
      console.log("Singularity | Terran in index:", terranInIndex ? "YES" : "NO");
      
      if (wasLocked) await pack.configure({ locked: true });
      
      // Refresh any open compendium windows
      for (const app of Object.values(ui.windows)) {
        if (app.pack && app.pack === pack && app.render) {
          console.log("Singularity | Refreshing subtypes compendium window");
          await app.render(false);
        }
      }
      
      if (terranInIndex) {
        ui.notifications.info("Terran subtype created in Subtypes compendium!");
      } else {
        ui.notifications.warn("Terran subtype was created. Please close and reopen the compendium window to see it.");
        console.warn("Singularity | Terran created but not yet in index. Item ID:", item.id);
      }
    } catch (error) {
      console.error("Singularity | Could not auto-create Terran subtype:", error);
      ui.notifications.error(`Failed to create Terran subtype: ${error.message}`);
    }
  }, 3000);

  // Auto-create all backgrounds in backgrounds compendium if they don't exist
  setTimeout(async () => {
    try {
      let pack = game.packs.find(p => p.metadata.name === "backgrounds" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.warn("Singularity | Backgrounds compendium not found");
        return;
      }
      
      // Ensure pack index is loaded
      if (!pack.index.size) {
        await pack.getIndex();
      }

      const wasLocked = pack.locked;
      if (wasLocked) {
        if (!game.user?.isGM) {
          return;
        }
        try {
          const packKey = pack.collection ?? `${pack.metadata.packageName}.${pack.metadata.name}`;
          const config = game.settings.get("core", "compendiumConfiguration") ?? {};
          const updated = foundry.utils.duplicate(config);
          updated[packKey] = { ...(updated[packKey] ?? {}), locked: false };
          await game.settings.set("core", "compendiumConfiguration", updated);
        } catch (unlockSettingError) {
          // Ignore - we'll still attempt to unlock via configure below.
        }
        try {
          await pack.configure({ locked: false });
          await new Promise(resolve => setTimeout(resolve, 200));
          const packKey = pack.collection ?? `${pack.metadata.packageName}.${pack.metadata.name}`;
          pack = game.packs.get(packKey) ?? pack;
        } catch (unlockError) {
          return;
        }
      }
      
      // Define all backgrounds
      const backgrounds = [
        {
          name: "Athlete",
          description: `<h2>Description</h2>
<p>Years of sports or physical training honed your body and reflexes.</p>

<h3>Benefits</h3>
<ul>
  <li><strong>Ability Boost:</strong> Increase your <strong>Might</strong>, <strong>Agility</strong>, or <strong>Endurance</strong> ability score by +1 (choose one).</li>
  <li><strong>Athleticism:</strong> You gain <strong>Apprentice training</strong> in <strong>Acrobatics (Agility)</strong> or <strong>Athletics (Might)</strong>.</li>
</ul>`
        },
        {
          name: "Criminal",
          description: `<h2>Description</h2>
<p>You lived outside the law, relying on quick thinking, steady nerves, and knowing when to disappear. Whether as a thief, smuggler, fixer, or gang member, survival meant skill and adaptability.</p>

<h3>Benefits</h3>
<ul>
  <li><strong>Ability Boost:</strong> Increase your <strong>Agility</strong>, <strong>Endurance</strong>, or <strong>Charm</strong> ability score by +1 (choose one).</li>
  <li><strong>Street Skills:</strong> You gain <strong>Apprentice training</strong> in <strong>Stealth (Agility)</strong>, <strong>Deception (Charm)</strong>, or <strong>Survival (Wits)</strong> (choose one).</li>
</ul>`
        },
        {
          name: "Journalist",
          description: `<h2>Description</h2>
<p>You make a living uncovering the truth, asking the right questions, reading between the lines, and knowing how to get people talking. Whether reporting facts, exposing corruption, or shaping public opinion, your words carry weight.</p>

<h3>Benefits</h3>
<ul>
  <li><strong>Ability Boost:</strong> Increase your <strong>Charm</strong> ability score by +1.</li>
  <li><strong>Journalist Training:</strong> You gain <strong>Apprentice training</strong> in <strong>Persuasion (Charm)</strong>, <strong>Insight (Wits)</strong>, or <strong>Investigation (Wits)</strong> (choose one).</li>
</ul>`
        },
        {
          name: "Law Enforcement",
          description: `<h2>Description</h2>
<p>You served as a police officer, detective, federal agent, or security officer. Your training emphasized investigation, observation, and maintaining order. You understand criminal behavior, legal procedures, and how to read situations and people. Whether patrolling streets or solving complex cases, you've developed sharp instincts and the ability to defuse tense situations.</p>

<h3>Benefits</h3>
<ul>
  <li><strong>Ability Boost:</strong> Increase your <strong>Wits</strong> or <strong>Charm</strong> ability score by +1 (choose one).</li>
  <li><strong>Law Enforcement Training:</strong> You gain <strong>Apprentice training</strong> in <strong>Investigation (Wits)</strong>, <strong>Insight (Wits)</strong>, or <strong>Intimidation (Charm)</strong> (choose one).</li>
</ul>`
        },
        {
          name: "Medic",
          description: `<h2>Description</h2>
<p>You worked as a paramedic, nurse, doctor, or field medic, providing medical care in high-pressure situations. Whether in hospitals, ambulances, or combat zones, you've learned to remain calm under stress and make life-saving decisions quickly. Your medical knowledge extends beyond treating wounds to understanding anatomy, physiology, and the effects of various substances and conditions.</p>

<h3>Benefits</h3>
<ul>
  <li><strong>Ability Boost:</strong> Increase your <strong>Endurance</strong> or <strong>Wits</strong> ability score by +1 (choose one).</li>
  <li><strong>Medical Training:</strong> You gain <strong>Apprentice training</strong> in <strong>Medicine (Wits)</strong> or <strong>Insight (Wits)</strong> (choose one).</li>
</ul>`
        },
        {
          name: "Military",
          description: `<h2>Description</h2>
<p>You served in the armed forces, whether in active combat, logistics, or support roles. Military training instilled discipline, tactical awareness, and the ability to function under pressure. You understand chain of command, weapon systems, and how to work as part of a team in high-stakes situations.</p>

<h3>Benefits</h3>
<ul>
  <li><strong>Ability Boost:</strong> Increase your <strong>Might</strong>, <strong>Endurance</strong>, or <strong>Wits</strong> ability score by +1 (choose one).</li>
  <li><strong>Military Training:</strong> You gain <strong>Apprentice training</strong> in <strong>Athletics (Might)</strong>, <strong>Survival (Wits)</strong>, or <strong>Technology (Wits)</strong> (choose one).</li>
</ul>`
        },
        {
          name: "Performer",
          description: `<h2>Description</h2>
<p>You worked as an actor, musician, dancer, or entertainer before your heroics began. Whether on stage, screen, or street, you know how to command attention, read audiences, and perform under pressure. Your training in performance arts has given you excellent physical control, charisma, and the ability to adapt your presence to any situation. You understand the power of presence and how to use it to inspire, intimidate, or simply entertain.</p>

<h3>Benefits</h3>
<ul>
  <li><strong>Ability Boost:</strong> Increase your <strong>Agility</strong> or <strong>Charm</strong> ability score by +1 (choose one).</li>
  <li><strong>Performance Training:</strong> You gain <strong>Apprentice training</strong> in <strong>Acrobatics (Agility)</strong>, <strong>Performance (Charm)</strong>, or <strong>Deception (Charm)</strong> (choose one).</li>
</ul>`
        },
        {
          name: "Scientist",
          description: `<h2>Description</h2>
<p>You dedicated your life to research, experimentation, and discovery. Whether working in a laboratory, field research, or theoretical studies, you approach problems methodically and value evidence over assumptions. Your scientific background gives you unique insights into how the world works, from biology and chemistry to physics and engineering.</p>

<h3>Benefits</h3>
<ul>
  <li><strong>Ability Boost:</strong> Increase your <strong>Wits</strong> ability score by +1.</li>
  <li><strong>Scientific Training:</strong> You gain <strong>Apprentice training</strong> in <strong>Investigation (Wits)</strong>, <strong>Technology (Wits)</strong>, or <strong>Medicine (Wits)</strong> (choose one).</li>
</ul>`
        },
        {
          name: "Student",
          description: `<h2>Description</h2>
<p>You were pursuing higher education when your powers emerged or your adventures began. Whether studying at a university, technical college, or through independent research, you've developed strong learning habits, critical thinking skills, and a thirst for knowledge. Your academic background might be in any field, from humanities to sciences, and you know how to research, analyze information, and adapt to new situations quickly.</p>

<h3>Benefits</h3>
<ul>
  <li><strong>Ability Boost:</strong> Increase your <strong>Wits</strong> ability score by +1.</li>
  <li><strong>Academic Training:</strong> You gain <strong>Apprentice training</strong> in <strong>Investigation (Wits)</strong>, <strong>Technology (Wits)</strong>, or <strong>Persuasion (Charm)</strong> (choose one).</li>
</ul>`
        },
        {
          name: "Tech Enthusiast",
          description: `<h2>Description</h2>
<p>You grew up surrounded by machines, code, and circuitry, always eager to understand how technology works and how to make it better—or break it.</p>

<h3>Benefits</h3>
<ul>
  <li><strong>Ability Boost:</strong> Increase your <strong>Wits</strong> ability score by +1.</li>
  <li><strong>Tech Enthusiast Training:</strong> You gain <strong>Apprentice training</strong> in <strong>Hacking (Wits)</strong> <em>or</em> <strong>Technology (Wits)</strong> (choose one).</li>
</ul>`
        }
      ];
      
      // Track if any backgrounds were actually created
      let backgroundsCreated = 0;
      
      // Create each background if it doesn't exist
      for (const bg of backgrounds) {
        let item = null; // Declare outside try block for cleanup
        const existing = pack.index.find(i => i.name === bg.name);
        if (existing) {
          // Check if the existing item has the correct type
          try {
            const existingItem = await pack.getDocument(existing._id);
            if (existingItem && existingItem.system?.basic?.type !== "background") {
              console.log(`Singularity | Fixing ${bg.name} background type from`, existingItem.system?.basic?.type, "to background");
              await existingItem.update({ "system.basic.type": "background" });
              console.log(`Singularity | ${bg.name} background type fixed!`);
            } else {
              console.log(`Singularity | ${bg.name} background already exists with correct type`);
            }
          } catch (error) {
            console.error(`Singularity | Error checking/fixing existing ${bg.name} item:`, error);
          }
          continue;
        }
        
        // Create the background item
        const itemData = {
          name: bg.name,
          type: "talent",
          system: {
            description: bg.description,
            basic: {
              type: "background",
              prerequisites: ""
            },
            archived: false
          },
          img: "icons/svg/item-bag.svg"
        };
        
        try {
          console.log(`Singularity | Creating ${bg.name} background in world first...`);
          const createdItems = await Item.createDocuments([itemData], { render: false });
          item = createdItems[0];
          
          if (!item || !item.id) {
            throw new Error(`Failed to create ${bg.name} in world`);
          }
          
          console.log(`Singularity | ${bg.name} created in world, ID:`, item.id);
          
          // Ensure pack is unlocked before importing (should already be unlocked, but check just in case)
          if (pack.locked) {
            console.log(`Singularity | Pack became locked, attempting to unlock for ${bg.name}...`);
            try {
              await pack.configure({ locked: false });
              await new Promise(resolve => setTimeout(resolve, 200));
              if (pack.locked) {
                throw new Error("Could not unlock compendium");
              }
            } catch (unlockError) {
              console.error(`Singularity | Could not unlock pack for ${bg.name}, skipping`);
              throw unlockError;
            }
          }
          
          // Import the item into the compendium
          console.log(`Singularity | Importing ${bg.name} into compendium...`);
          await pack.importDocument(item);
          
          // Delete the world item since we only want it in the compendium
          await item.delete();
          item = null; // Clear reference after deletion
          console.log(`Singularity | ${bg.name} world item deleted`);
          
          // Track that a background was created
          backgroundsCreated++;
          
          // Small delay between creations
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (createError) {
          console.error(`Singularity | Error creating/importing ${bg.name}:`, createError);
          // Clean up: if we created a world item but import failed, delete it
          if (item && item.id && !item.pack) {
            try {
              await item.delete();
              item = null;
            } catch (cleanupError) {
              console.error(`Singularity | Error cleaning up ${bg.name} world item:`, cleanupError);
            }
          }
        }
      }
      
      // Refresh the compendium index
      await pack.getIndex({ force: true });
      console.log("Singularity | Backgrounds index refreshed, size:", pack.index.size);
      
      // Re-lock pack if it was originally locked
      if (wasLocked && !pack.locked) {
        await pack.configure({ locked: true });
      }
      
      // Refresh any open compendium windows
      for (const app of Object.values(ui.windows)) {
        if (app.pack && app.pack === pack && app.render) {
          console.log("Singularity | Refreshing backgrounds compendium window");
          await app.render(false);
        }
      }
      
      // Only show notification if backgrounds were actually created
      if (backgroundsCreated > 0) {
        ui.notifications.info(`Created ${backgroundsCreated} background${backgroundsCreated > 1 ? 's' : ''} in Backgrounds compendium!`);
      }
    } catch (error) {
      console.error("Singularity | Could not auto-create backgrounds:", error);
      ui.notifications.error(`Failed to create backgrounds: ${error.message}`);
    }
  }, 3500);

  // Auto-create selected Level 0 gadgets in gadgets compendium if they don't exist
  setTimeout(async () => {
    try {
      let pack = game.packs.find(p => p.metadata.name === "gadgets" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.warn("Singularity | Gadgets compendium not found");
        return;
      }

      if (!pack.index.size) {
        await pack.getIndex();
      }

      const wasLocked = pack.locked;
      if (wasLocked) {
        if (!game.user?.isGM) {
          return;
        }
        try {
          const packKey = pack.collection ?? `${pack.metadata.packageName}.${pack.metadata.name}`;
          const config = game.settings.get("core", "compendiumConfiguration") ?? {};
          const updated = foundry.utils.duplicate(config);
          updated[packKey] = { ...(updated[packKey] ?? {}), locked: false };
          await game.settings.set("core", "compendiumConfiguration", updated);
        } catch (unlockSettingError) {
          // Ignore and fall back to configure below.
        }
        try {
          await pack.configure({ locked: false });
          await new Promise(resolve => setTimeout(resolve, 200));
          const packKey = pack.collection ?? `${pack.metadata.packageName}.${pack.metadata.name}`;
          pack = game.packs.get(packKey) ?? pack;
        } catch (unlockError) {
          return;
        }
      }

      const gadgets = [
        {
          name: "Motion Tracker",
          img: "icons/svg/item-bag.svg",
          basic: {
            type: "gadget",
            level: 0,
            range: "Touch",
            energyCost: 1,
            hands: 1
          },
          description: `<h2>Description</h2>
<p>You deploy a small disc or handheld device that uses passive motion sensors and vibration detection to track movement within a designated area, alerting you to any creatures passing through.</p>

<h3>Motion Tracker</h3>
<ul>
  <li><strong>Type:</strong> Action</li>
  <li><strong>Range:</strong> Touch</li>
  <li><strong>Cost:</strong> 1 energy</li>
  <li><strong>Hands:</strong> 1</li>
  <li><strong>Duration:</strong> 1 hour</li>
</ul>

<h3>Effect</h3>
<p>You place the tracker on a surface. For the duration, you are aware of any creature of Small size or larger that moves within a 30-foot radius of the tracker. You learn the direction and approximate distance of each detected creature, but not their identity or exact number if multiple creatures are present.</p>
<p><em>Note:</em> The tracker cannot detect stationary creatures. You can have a number of trackers active at once equal to your Wits ability maximum.</p>`
        },
        {
          name: "Smoke Canister",
          img: "icons/svg/item-bag.svg",
          basic: {
            type: "gadget",
            level: 0,
            range: "20 feet",
            energyCost: 2,
            hands: 1
          },
          description: `<h2>Description</h2>
<p>You activate a compact chemical canister that rapidly emits a thick cloud of smoke, providing cover for movement and obscuring vision from ranged attacks.</p>

<h3>Smoke Canister</h3>
<ul>
  <li><strong>Type:</strong> Action</li>
  <li><strong>Range:</strong> 20 feet</li>
  <li><strong>Cost:</strong> 2 energy</li>
  <li><strong>Hands:</strong> 1</li>
  <li><strong>Duration:</strong> 1 minute</li>
</ul>

<h3>Effect</h3>
<p>You create a cloud of thick smoke in a 10-foot radius burst centered on a point within range. The area is heavily obscured. Creatures inside the smoke have standard cover. Additionally, any attack made through the smoke provides standard cover to the target.</p>
<p>A moderate wind (at least 10 miles per hour) disperses the smoke in 3 rounds. A strong wind (at least 20 miles per hour) disperses it immediately.</p>`
        },
        {
          name: "Utility Multi-Tool",
          img: "icons/svg/item-bag.svg",
          basic: {
            type: "gadget",
            level: 0,
            range: "Touch",
            energyCost: 1,
            hands: 1
          },
          description: `<h2>Description</h2>
<p>A compact device that can morph into various tools - lockpicks, wire cutters, screwdrivers, and more - allowing you to overcome mechanical obstacles with precision and efficiency.</p>

<h3>Utility Multi-Tool</h3>
<ul>
  <li><strong>Type:</strong> Action</li>
  <li><strong>Range:</strong> Touch</li>
  <li><strong>Cost:</strong> 1 energy</li>
  <li><strong>Hands:</strong> 1</li>
  <li><strong>Duration:</strong> 1 minute</li>
</ul>

<h3>Effect</h3>
<p>While the multi-tool is active, you gain a +2 bonus to skill checks involving mechanical devices, locks, traps, or similar technical challenges. This includes attempts to pick locks, disable traps, repair equipment, or interact with complex machinery.</p>
<p>The multi-tool can function as any standard tool for the duration, automatically adjusting its form as needed.</p>`
        }
      ];

      let createdCount = 0;

      for (const gadget of gadgets) {
        const existing = pack.index.find(i => i.name === gadget.name);
        if (existing) {
          try {
            const existingItem = await pack.getDocument(existing._id);
            if (existingItem) {
              const updates = {};
              if (existingItem.system?.basic?.level !== 0) {
                updates["system.basic.level"] = 0;
              }
              if (existingItem.system?.basic?.type !== "gadget") {
                updates["system.basic.type"] = "gadget";
              }
              if (Object.keys(updates).length > 0) {
                await existingItem.update(updates);
              }
            }
          } catch (error) {
            console.error(`Singularity | Error checking/fixing existing gadget ${gadget.name}:`, error);
          }
          continue;
        }

        const itemData = {
          name: gadget.name,
          type: "talent",
          system: {
            description: gadget.description,
            basic: {
              type: gadget.basic.type,
              level: gadget.basic.level,
              range: gadget.basic.range,
              energyCost: gadget.basic.energyCost,
              hands: gadget.basic.hands,
              prerequisites: ""
            },
            archived: false
          },
          img: gadget.img
        };

        let item = null;
        try {
          const createdItems = await Item.createDocuments([itemData], { render: false });
          item = createdItems[0];

          if (!item || !item.id) {
            throw new Error(`Failed to create ${gadget.name} in world`);
          }

          if (pack.locked) {
            await pack.configure({ locked: false });
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          await pack.importDocument(item);
          await item.delete();
          item = null;
          createdCount++;

          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (createError) {
          console.error(`Singularity | Error creating/importing gadget ${gadget.name}:`, createError);
          if (item && item.id && !item.pack) {
            try {
              await item.delete();
              item = null;
            } catch (cleanupError) {
              console.error(`Singularity | Error cleaning up ${gadget.name} world item:`, cleanupError);
            }
          }
        }
      }

      await pack.getIndex({ force: true });

      if (wasLocked && !pack.locked) {
        await pack.configure({ locked: true });
      }

      for (const app of Object.values(ui.windows)) {
        if (app.pack && app.pack === pack && app.render) {
          await app.render(false);
        }
      }

      if (createdCount > 0) {
        ui.notifications.info(`Created ${createdCount} gadget${createdCount > 1 ? "s" : ""} in Gadgets compendium!`);
      }
    } catch (error) {
      console.error("Singularity | Could not auto-create gadgets:", error);
      ui.notifications.error(`Failed to create gadgets: ${error.message}`);
    }
  }, 3600);

  // Auto-create Bastion powerset in powersets compendium if it doesn't exist
  setTimeout(async () => {
    try {
      const pack = game.packs.find(p => p.metadata.name === "powersets" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.warn("Singularity | Powersets compendium not found");
        return;
      }
      
      // Ensure pack index is loaded
      if (!pack.index.size) {
        await pack.getIndex();
      }
      
      const wasLocked = pack.locked;
      
      const existing = pack.index.find(i => i.name === "Bastion");
      if (existing) {
        // Check if the existing item has the correct type
        try {
          // Unlock pack if needed
          if (wasLocked) {
            await pack.configure({ locked: false });
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          const existingItem = await pack.getDocument(existing._id);
          if (existingItem && existingItem.system?.basic?.type !== "powerset") {
            console.log("Singularity | Fixing Bastion powerset type from", existingItem.system?.basic?.type, "to powerset");
            await existingItem.update({ "system.basic.type": "powerset" });
            console.log("Singularity | Bastion powerset type fixed!");
            ui.notifications.info("Bastion powerset type corrected to 'powerset'!");
          } else {
            console.log("Singularity | Bastion powerset already exists with correct type");
          }
          
          // Re-lock pack if it was locked
          if (wasLocked) {
            await pack.configure({ locked: true });
          }
        } catch (error) {
          console.error("Singularity | Error checking/fixing existing Bastion item:", error);
          // Re-lock pack if it was locked, even on error
          if (wasLocked) {
            await pack.configure({ locked: true });
          }
        }
        return;
      }
      if (wasLocked) {
        console.log("Singularity | Unlocking powersets compendium pack");
        await pack.configure({ locked: false });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Create Bastion powerset item
      const itemData = {
        name: "Bastion",
        type: "talent",
        system: {
          description: `<h2>Description</h2>
<p>The <strong>Bastion</strong> is a living bulwark, standing between danger and those they protect. Through sheer resilience, superior protection, or superhuman toughness, Bastions absorb punishment that would fell others and hold the line when all else fails.</p>

<p>Whether clad in advanced armor, wielding an indestructible shield, or possessing an unbreakable body, Bastions define defense through endurance and control.</p>

<h3>Example Heroes</h3>
<ul>
  <li><strong>Captain America</strong> (Marvel Comics) – A tactical defender who uses positioning, shield mastery, and resolve to protect allies.</li>
  <li><strong>The Thing</strong> (Marvel Comics) – A powerhouse of raw durability, shrugging off blows through sheer toughness.</li>
  <li><strong>Luke Cage</strong> (Marvel Comics) – Nearly impervious skin allows him to walk through gunfire and stand firm against overwhelming force.</li>
</ul>

<h3>Hit Points</h3>
<p><strong>HP:</strong> Your HP at each level is equal to <strong>(14 + your Endurance) × your Bastion level</strong>.</p>

<h3>Bastion Benefits by Level</h3>

<h4>Level 1</h4>
<ul>
  <li><strong>Endurance boost:</strong> +1 to your <strong>Endurance</strong> ability.</li>
  <li><strong>Ability Boost:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities). <strong>Endurance</strong> cannot be increased this way.</li>
  <li><strong>Armor Training:</strong> You are trained in <strong>Heavy Armor</strong>.</li>
  <li><strong>Defensive Bonus:</strong> You gain a <strong>+2 bonus to AC</strong>.</li>
  <li><strong>Saving Throw Training:</strong> You gain the Saving Throw Training (Apprentice) talent with one ability of your choice.</li>
  <li><strong>Bastion Talent:</strong> You can choose <strong>1 Bastion Talent</strong>.</li>
</ul>

<h4>Level 2</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 3</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Bastion Talent:</strong> You can choose <strong>1 Bastion Talent</strong>.</li>
</ul>

<h4>Level 4</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 5</h4>
<ul>
  <li><strong>Defensive Bonus:</strong> Your bonus to AC increases to <strong>+4</strong>.</li>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Bastion Talent:</strong> You can choose <strong>1 Bastion Talent</strong>.</li>
</ul>

<h4>Level 6</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 7</h4>
<ul>
  <li><strong>Bastion Talent:</strong> You can choose <strong>1 Bastion Talent</strong>.</li>
</ul>

<h4>Level 8</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 9</h4>
<ul>
  <li><strong>Bastion Talent:</strong> You can choose <strong>1 Bastion Talent</strong>.</li>
</ul>

<h4>Level 10</h4>
<ul>
  <li><strong>Defensive Bonus:</strong> Your bonus to AC increases to <strong>+6</strong>.</li>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Bastion Talent:</strong> You can choose <strong>1 Bastion Talent</strong>.</li>
</ul>

<h4>Level 11</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 12</h4>
<ul>
  <li><strong>Bastion Talent:</strong> You can choose <strong>1 Bastion Talent</strong>.</li>
</ul>

<h4>Level 13</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 14</h4>
<ul>
  <li><strong>Bastion Talent:</strong> You can choose <strong>1 Bastion Talent</strong>.</li>
</ul>

<h4>Level 15</h4>
<ul>
  <li><strong>Defensive Bonus:</strong> Your bonus to AC increases to <strong>+8</strong>.</li>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Bastion Talent:</strong> You can choose <strong>1 Bastion Talent</strong>.</li>
</ul>

<h4>Level 16</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 17</h4>
<ul>
  <li><strong>Bastion Talent:</strong> You can choose <strong>1 Bastion Talent</strong>.</li>
</ul>

<h4>Level 18</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 19</h4>
<ul>
  <li><strong>Bastion Talent:</strong> You can choose <strong>1 Bastion Talent</strong>.</li>
</ul>

<h4>Level 20</h4>
<ul>
  <li><strong>Defensive Bonus:</strong> Your bonus to AC increases to <strong>+10</strong>.</li>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Bastion Talent:</strong> You can choose <strong>1 Bastion Talent</strong>.</li>
</ul>`,
          basic: {
            type: "powerset",
            prerequisites: ""
          },
          archived: false
        },
        img: "icons/svg/shield.svg"
      };
      
      // Create the item in the world first, then import it into the compendium
      let item;
      try {
        console.log("Singularity | Creating Bastion powerset in world first...");
        item = await Item.createDocuments([itemData], { render: false });
        item = item[0];
        
        if (!item || !item.id) {
          throw new Error("Failed to create item in world");
        }
        
        console.log("Singularity | Item created in world, ID:", item.id, "Name:", item.name);
        
        // Import the item into the compendium
        console.log("Singularity | Importing item into compendium...");
        const imported = await pack.importDocument(item);
        console.log("Singularity | Item imported, result:", imported);
        
        // Delete the world item since we only want it in the compendium
        await item.delete();
        console.log("Singularity | World item deleted");
        
        // Wait for the import to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Refresh the compendium index
        await pack.getIndex({ force: true });
        const found = pack.index.find(i => i.name === "Bastion");
        console.log("Singularity | Bastion in index after import:", found ? "YES" : "NO");
        
        if (found) {
          item = await pack.getDocument(found._id);
          console.log("Singularity | Retrieved imported item, ID:", item.id);
        } else {
          throw new Error("Item was imported but not found in compendium index");
        }
      } catch (createError) {
        console.error("Singularity | Error creating/importing item:", createError);
        
        // Clean up: if we created a world item but import failed, delete it
        if (item && item.id && !item.pack) {
          try {
            await item.delete();
            console.log("Singularity | Cleaned up world item after error");
          } catch (cleanupError) {
            console.error("Singularity | Error cleaning up world item:", cleanupError);
          }
        }
        
        throw createError;
      }
      
      // Wait for database write to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh the compendium index
      await pack.getIndex({ force: true });
      console.log("Singularity | Powersets index refreshed, size:", pack.index.size);
      
      // Verify the item is in the index
      const bastionInIndex = pack.index.find(i => i.name === "Bastion" || (item && i._id === item.id));
      console.log("Singularity | Bastion in index:", bastionInIndex ? "YES" : "NO");
      
      if (wasLocked) await pack.configure({ locked: true });
      
      // Refresh any open compendium windows
      for (const app of Object.values(ui.windows)) {
        if (app.pack && app.pack === pack && app.render) {
          console.log("Singularity | Refreshing powersets compendium window");
          await app.render(false);
        }
      }
      
      if (bastionInIndex) {
        ui.notifications.info("Bastion powerset created in Powersets compendium!");
      } else {
        ui.notifications.warn("Bastion powerset was created. Please close and reopen the compendium window to see it.");
        console.warn("Singularity | Bastion created but not yet in index. Item ID:", item.id);
      }
    } catch (error) {
      console.error("Singularity | Could not auto-create Bastion powerset:", error);
      ui.notifications.error(`Failed to create Bastion powerset: ${error.message}`);
    }
  }, 3500);

  // Auto-create Paragon powerset in powersets compendium if it doesn't exist
  setTimeout(async () => {
    try {
      const pack = game.packs.find(p => p.metadata.name === "powersets" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.warn("Singularity | Powersets compendium not found");
        return;
      }
      
      // Ensure pack index is loaded
      if (!pack.index.size) {
        await pack.getIndex();
      }
      
      const wasLocked = pack.locked;
      
      const existing = pack.index.find(i => i.name === "Paragon");
      if (existing) {
        // Check if the existing item has the correct type
        try {
          // Unlock pack if needed
          if (wasLocked) {
            await pack.configure({ locked: false });
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          const existingItem = await pack.getDocument(existing._id);
          if (existingItem && existingItem.system?.basic?.type !== "powerset") {
            console.log("Singularity | Fixing Paragon powerset type from", existingItem.system?.basic?.type, "to powerset");
            await existingItem.update({ "system.basic.type": "powerset" });
            console.log("Singularity | Paragon powerset type fixed!");
            ui.notifications.info("Paragon powerset type corrected to 'powerset'!");
          } else {
            console.log("Singularity | Paragon powerset already exists with correct type");
          }
          
          // Re-lock pack if it was locked
          if (wasLocked) {
            await pack.configure({ locked: true });
          }
        } catch (error) {
          console.error("Singularity | Error checking/fixing existing Paragon item:", error);
          // Re-lock pack if it was locked, even on error
          if (wasLocked) {
            await pack.configure({ locked: true });
          }
        }
        return;
      }
      if (wasLocked) {
        console.log("Singularity | Unlocking powersets compendium pack");
        await pack.configure({ locked: false });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Create Paragon powerset item
      const itemData = {
        name: "Paragon",
        type: "talent",
        system: {
          description: `<h2>Description</h2>
<p>The <strong>Paragon</strong> is the embodiment of overwhelming physical supremacy. These heroes soar through the skies, endure catastrophic force, and strike with raw power that shatters steel and stone alike. Whether born superhuman, empowered by alien energy, or transformed by Singularium, Paragons dominate the battlefield through sheer presence and unstoppable momentum.</p>

<p>Paragons do not rely on armor, tactics, or preparation. Their bodies <em>are</em> the weapon, the shield, and the symbol.</p>

<h3>Example Heroes</h3>
<ul>
  <li><strong>Superman</strong> (DC Comics) - A near-invulnerable flying powerhouse, defined by strength, endurance, and moral resolve.</li>
  <li><strong>Omni-Man</strong> (<em>Invincible</em>) - A brutal paragon of flight and overwhelming force.</li>
  <li><strong>Homelander</strong> (<em>The Boys</em>) - A terrifying example of unchecked power and dominance.</li>
</ul>

<h3>Hit Points</h3>
<p><strong>HP:</strong> Your HP at each level is equal to <strong>(12 + your Endurance) × your Paragon level</strong>.</p>

<h3>Paragon Benefits by Level</h3>

<h4>Level 1</h4>
<ul>
  <li><strong>Might Boost:</strong> +1 to your <strong>Might</strong> ability.</li>
  <li><strong>Ability Boost:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities). <strong>Might</strong> cannot be increased this way.</li>
  <li><strong>Skill Training:</strong> You gain the Skill Training (Apprentice) in your choice of <strong>Athletics</strong>, <strong>Intimidation</strong>, or <strong>Persuasion</strong>.</li>
  <li><strong>Flight:</strong> You gain a <strong>flying speed of 15 feet</strong>.</li>
  <li><strong>Enhanced Unarmed Strikes:</strong> Your <strong>unarmed attack damage die increases by one step</strong>.</li>
  <li><strong>Unarmed Weapon Competence:</strong> You are <strong>Apprentice</strong> with unarmed attacks.</li>
  <li><strong>Paragon Talent:</strong> You can choose <strong>1 Paragon Talent</strong>.</li>
</ul>

<h4>Level 2</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 3</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Paragon Talent:</strong> You can choose <strong>1 Paragon Talent</strong>.</li>
</ul>

<h4>Level 4</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 5</h4>
<ul>
  <li><strong>Unarmed Weapon Competence:</strong> You are <strong>Competent</strong> with unarmed attacks.</li>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Paragon Talent:</strong> You can choose <strong>1 Paragon Talent</strong>.</li>
</ul>

<h4>Level 6</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 7</h4>
<ul>
  <li><strong>Paragon Talent:</strong> You can choose <strong>1 Paragon Talent</strong>.</li>
</ul>

<h4>Level 8</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 9</h4>
<ul>
  <li><strong>Paragon Talent:</strong> You can choose <strong>1 Paragon Talent</strong>.</li>
</ul>

<h4>Level 10</h4>
<ul>
  <li><strong>Unarmed Weapon Competence:</strong> You are <strong>Masterful</strong> with unarmed attacks.</li>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Paragon Talent:</strong> You can choose <strong>1 Paragon Talent</strong>.</li>
</ul>

<h4>Level 11</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 12</h4>
<ul>
  <li><strong>Paragon Talent:</strong> You can choose <strong>1 Paragon Talent</strong>.</li>
</ul>

<h4>Level 13</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 14</h4>
<ul>
  <li><strong>Paragon Talent:</strong> You can choose <strong>1 Paragon Talent</strong>.</li>
</ul>

<h4>Level 15</h4>
<ul>
  <li><strong>Unarmed Weapon Competence:</strong> You are <strong>Legendary</strong> with unarmed attacks.</li>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Paragon Talent:</strong> You can choose <strong>1 Paragon Talent</strong>.</li>
</ul>

<h4>Level 16</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 17</h4>
<ul>
  <li><strong>Paragon Talent:</strong> You can choose <strong>1 Paragon Talent</strong>.</li>
</ul>

<h4>Level 18</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 19</h4>
<ul>
  <li><strong>Paragon Talent:</strong> You can choose <strong>1 Paragon Talent</strong>.</li>
</ul>

<h4>Level 20</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Paragon Talent:</strong> You can choose <strong>1 Paragon Talent</strong>.</li>
</ul>`,
          basic: {
            type: "powerset",
            prerequisites: ""
          },
          archived: false
        },
        img: "icons/svg/mystery-man.svg"
      };
      
      // Create the item in the world first, then import it into the compendium
      let item;
      try {
        console.log("Singularity | Creating Paragon powerset in world first...");
        item = await Item.createDocuments([itemData], { render: false });
        item = item[0];
        
        if (!item || !item.id) {
          throw new Error("Failed to create item in world");
        }
        
        console.log("Singularity | Paragon powerset created in world, ID:", item.id, "Name:", item.name);
        
        // Import into compendium
        await pack.importDocument(item);
        console.log("Singularity | Paragon powerset imported into compendium");
        
        // Delete world item
        await item.delete();
        console.log("Singularity | Paragon powerset world item deleted");
        
        // Wait for import to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Refresh index
        await pack.getIndex({ force: true });
        
        // Check if Paragon is now in the index
        const paragonInIndex = pack.index.find(i => i.name === "Paragon");
        if (paragonInIndex) {
          console.log("Singularity | Paragon powerset confirmed in compendium index");
          ui.notifications.info("Paragon powerset created in Powersets compendium!");
        } else {
          console.warn("Singularity | Paragon powerset not yet in index after import");
          ui.notifications.warn("Paragon powerset was created. Please close and reopen the compendium window to see it.");
        }
        
        // Re-lock pack if it was locked
        if (wasLocked) {
          await pack.configure({ locked: true });
        }
        
        // Try to refresh any open compendium windows
        const app = Object.values(ui.windows).find(w => w instanceof Compendium && w.collection?.metadata?.name === "powersets");
        if (app) {
          console.log("Singularity | Refreshing powersets compendium window");
          await app.render(false);
        }
      } catch (error) {
        console.error("Singularity | Error creating Paragon powerset:", error);
        // Clean up world item if it exists
        if (item) {
          try {
            await item.delete();
          } catch (cleanupErr) {
            console.error("Singularity | Error cleaning up Paragon world item:", cleanupErr);
          }
        }
        // Re-lock pack if it was locked
        if (wasLocked) {
          await pack.configure({ locked: true });
        }
        throw error;
      }
    } catch (error) {
      console.error("Singularity | Could not auto-create Paragon powerset:", error);
      ui.notifications.error(`Failed to create Paragon powerset: ${error.message}`);
    }
  }, 4000);

  // Auto-create Gadgeteer powerset in powersets compendium if it doesn't exist
  setTimeout(async () => {
    try {
      const pack = game.packs.find(p => p.metadata.name === "powersets" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.warn("Singularity | Powersets compendium not found");
        return;
      }
      
      await pack.getIndex();
      const wasLocked = pack.locked;
      const existing = pack.index.find(i => i.name === "Gadgeteer");
      if (existing) {
        try {
          if (wasLocked) { await pack.configure({ locked: false }); await new Promise(resolve => setTimeout(resolve, 100)); }
          const existingItem = await pack.getDocument(existing._id);
          if (existingItem && existingItem.system?.basic?.type !== "powerset") {
            console.log("Singularity | Fixing Gadgeteer powerset type from", existingItem.system?.basic?.type, "to powerset");
            await existingItem.update({ "system.basic.type": "powerset" });
            ui.notifications.info("Gadgeteer powerset type corrected to 'powerset'!");
          } else {
            console.log("Singularity | Gadgeteer powerset already exists with correct type");
          }
          if (wasLocked) { await pack.configure({ locked: true }); }
        } catch (error) {
          console.error("Singularity | Error checking/fixing existing Gadgeteer item:", error);
          if (wasLocked) { await pack.configure({ locked: true }); }
        }
        return;
      }
      if (wasLocked) { await pack.configure({ locked: false }); await new Promise(resolve => setTimeout(resolve, 100)); }
      const itemData = {
        name: "Gadgeteer",
        type: "talent",
        system: {
          description: `<h2>Description</h2>
<p>The <strong>Gadgeteer</strong> is the ultimate problem-solver, relying on intellect, innovation, and a vast arsenal of high-tech devices. While they may lack innate superpowers, their ability to adapt to any situation makes them indispensable. Whether they are deploying drones, hacking security systems, or utilizing experimental weaponry, the Gadgeteer always has the right tool for the job.</p>

<h3>Example Heroes</h3>
<ul>
  <li><strong>Batman (DC Comics)</strong> – The iconic "prep-time" hero who uses a utility belt full of specialized gadgets to overcome any foe.</li>
  <li><strong>Cyborg (DC Comics)</strong> – Uses integrated technology to adapt his body to the battlefield.</li>
</ul>

<h3>Hit Points</h3>
<p><strong>HP:</strong> Your HP at each level is equal to <strong>(8 + your Endurance) × your Gadgeteer level</strong>.</p>

<h3>Gadgeteer benefits</h3>

<h4>Level 1</h4>
<ul>
  <li><strong>Wits Boost:</strong> +1 to your <strong>Wits</strong> ability.</li>
  <li><strong>Ability Boost:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities). <strong>Wits</strong> cannot be increased this way.</li>
  <li><strong>Skill Training:</strong> You gain <strong>Apprentice</strong> training in <strong>Electricity</strong> or <strong>Hacking</strong> (choose one).</li>
  <li><strong>Gadgeteer Talent:</strong> You can choose <strong>1 Gadgeteer Talent</strong>.</li>
  <li><strong>Gadget Tuning:</strong> You gain <strong>Apprentice</strong> competence in <strong>Gadget Tuning (Wits)</strong>. This special ability is used for all checks made with your gadgets.</li>
</ul>

<h4>Level 2</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 3</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Gadgeteer Talent:</strong> You can choose <strong>1 Gadgeteer Talent</strong>.</li>
</ul>

<h4>Level 4</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 5</h4>
<ul>
  <li><strong>Gadget Tuning:</strong> You are <strong>Competent</strong> with Gadget Tuning.</li>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Gadgeteer Talent:</strong> You can choose <strong>1 Gadgeteer Talent</strong>.</li>
</ul>

<h4>Level 6</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 7</h4>
<ul>
  <li><strong>Gadgeteer Talent:</strong> You can choose <strong>1 Gadgeteer Talent</strong>.</li>
</ul>

<h4>Level 8</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 9</h4>
<ul>
  <li><strong>Gadgeteer Talent:</strong> You can choose <strong>1 Gadgeteer Talent</strong>.</li>
</ul>

<h4>Level 10</h4>
<ul>
  <li><strong>Gadget Tuning:</strong> You are <strong>Masterful</strong> with Gadget Tuning.</li>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Gadgeteer Talent:</strong> You can choose <strong>1 Gadgeteer Talent</strong>.</li>
</ul>

<h4>Level 11</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 12</h4>
<ul>
  <li><strong>Gadgeteer Talent:</strong> You can choose <strong>1 Gadgeteer Talent</strong>.</li>
</ul>

<h4>Level 13</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 14</h4>
<ul>
  <li><strong>Gadgeteer Talent:</strong> You can choose <strong>1 Gadgeteer Talent</strong>.</li>
</ul>

<h4>Level 15</h4>
<ul>
  <li><strong>Gadget Tuning:</strong> You are <strong>Legendary</strong> with Gadget Tuning.</li>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Gadgeteer Talent:</strong> You can choose <strong>1 Gadgeteer Talent</strong>.</li>
</ul>

<h4>Level 16</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 17</h4>
<ul>
  <li><strong>Gadgeteer Talent:</strong> You can choose <strong>1 Gadgeteer Talent</strong>.</li>
</ul>

<h4>Level 18</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 19</h4>
<ul>
  <li><strong>Gadgeteer Talent:</strong> You can choose <strong>1 Gadgeteer Talent</strong>.</li>
</ul>

<h4>Level 20</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Gadgeteer Talent:</strong> You can choose <strong>1 Gadgeteer Talent</strong>.</li>
</ul>`,
          basic: { type: "powerset", prerequisites: "" },
          archived: false
        },
        img: "icons/svg/aura.svg"
      };
      let item;
      try {
        item = await Item.createDocuments([itemData], { render: false });
        item = item[0];
        if (!item || !item.id) { throw new Error("Failed to create item in world"); }
        await pack.importDocument(item);
        await item.delete();
        await pack.getIndex({ force: true });
        const gadgeteerInIndex = pack.index.find(i => i.name === "Gadgeteer");
        if (gadgeteerInIndex) {
          ui.notifications.info("Gadgeteer powerset created in Powersets compendium!");
        } else {
          ui.notifications.warn("Gadgeteer powerset was created. Please close and reopen the compendium window to see it.");
        }
      } catch (error) {
        console.error("Singularity | Could not auto-create Gadgeteer powerset:", error);
        ui.notifications.error(`Failed to create Gadgeteer powerset: ${error.message}`);
      } finally {
        if (wasLocked) { await pack.configure({ locked: true }); }
      }
    } catch (error) {
      console.error("Singularity | Could not auto-create Gadgeteer powerset (outer catch):", error);
      ui.notifications.error(`Failed to create Gadgeteer powerset: ${error.message}`);
    }
  }, 4500);

  // Auto-create Marksman powerset in powersets compendium if it doesn't exist
  setTimeout(async () => {
    try {
      const pack = game.packs.find(p => p.metadata.name === "powersets" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.warn("Singularity | Powersets compendium not found");
        return;
      }
      
      await pack.getIndex();
      const wasLocked = pack.locked;
      const existing = pack.index.find(i => i.name === "Marksman");
      if (existing) {
        try {
          if (wasLocked) { await pack.configure({ locked: false }); await new Promise(resolve => setTimeout(resolve, 100)); }
          const existingItem = await pack.getDocument(existing._id);
          if (existingItem && existingItem.system?.basic?.type !== "powerset") {
            console.log("Singularity | Fixing Marksman powerset type from", existingItem.system?.basic?.type, "to powerset");
            await existingItem.update({ "system.basic.type": "powerset" });
            ui.notifications.info("Marksman powerset type corrected to 'powerset'!");
          } else {
            console.log("Singularity | Marksman powerset already exists with correct type");
          }
          if (wasLocked) { await pack.configure({ locked: true }); }
        } catch (error) {
          console.error("Singularity | Error checking/fixing existing Marksman item:", error);
          if (wasLocked) { await pack.configure({ locked: true }); }
        }
        return;
      }
      if (wasLocked) { await pack.configure({ locked: false }); await new Promise(resolve => setTimeout(resolve, 100)); }
      const itemData = {
        name: "Marksman",
        type: "talent",
        system: {
          description: `<h2>Description</h2>
<p>The <strong>Marksman</strong> is a master of precision combat, relying on skill, focus, and timing rather than raw power. With a steady hand and sharp eyes, Marksmen excel at taking out targets from a distance, and exploiting weaknesses in their enemies' defenses.</p>

<h3>Example Heroes</h3>
<ul>
  <li><strong>Deadshot</strong> (DC Comics) – A literal living weapon, Deadshot can hit almost any target with deadly accuracy, often using trick shots and strategic positioning.</li>
  <li><strong>Bullseye</strong> (Marvel Comics) – Known for turning anything into a lethal projectile, his precision and creativity make him a feared Marksman.</li>
  <li><strong>Hawkeye</strong> (Marvel Comics) – A master archer who combines agility, precision, and tactical thinking to outmaneuver opponents.</li>
</ul>

<h3>Hit Points</h3>
<p><strong>HP:</strong> Your HP at each level is equal to <strong>(8 + your Endurance) × your Marksman level</strong>.</p>

<h3>Marksman Benefits by Level</h3>

<h4>Level 1</h4>
<ul>
  <li><strong>Agility boost:</strong> +1 to your <strong>Agility</strong> ability.</li>
  <li><strong>Ability Boost:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities). <strong>Agility</strong> cannot be increased this way.</li>
  <li><strong>Skill Training (Perception):</strong> You gain the Skill Training (Apprentice) for <strong>Perception</strong>.</li>
  <li><strong>Skill training (Bonus):</strong> You gain the Skill Training (Apprentice) with one additional skill of your choice.</li>
  <li><strong>Ranged Weapon Competence:</strong> You are <strong>Apprentice</strong> with all ranged weapons.</li>
  <li><strong>Marksman Talent:</strong> You can choose <strong>1 Marksman Talent</strong>.</li>
</ul>

<h4>Level 2</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 3</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Marksman Talent:</strong> You can choose <strong>1 Marksman Talent</strong>.</li>
</ul>

<h4>Level 4</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 5</h4>
<ul>
  <li><strong>Ranged Weapon Competence:</strong> You are <strong>Competent</strong> with all ranged weapons.</li>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Marksman Talent:</strong> You can choose <strong>1 Marksman Talent</strong>.</li>
</ul>

<h4>Level 6</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 7</h4>
<ul>
  <li><strong>Marksman Talent:</strong> You can choose <strong>1 Marksman Talent</strong>.</li>
</ul>

<h4>Level 8</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 9</h4>
<ul>
  <li><strong>Marksman Talent:</strong> You can choose <strong>1 Marksman Talent</strong>.</li>
</ul>

<h4>Level 10</h4>
<ul>
  <li><strong>Ranged Weapon Competence:</strong> You are <strong>Masterful</strong> with all ranged weapons.</li>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Marksman Talent:</strong> You can choose <strong>1 Marksman Talent</strong>.</li>
</ul>

<h4>Level 11</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 12</h4>
<ul>
  <li><strong>Marksman Talent:</strong> You can choose <strong>1 Marksman Talent</strong>.</li>
</ul>

<h4>Level 13</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 14</h4>
<ul>
  <li><strong>Marksman Talent:</strong> You can choose <strong>1 Marksman Talent</strong>.</li>
</ul>

<h4>Level 15</h4>
<ul>
  <li><strong>Ranged Weapon Competence:</strong> You are <strong>Legendary</strong> with all ranged weapons.</li>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Marksman Talent:</strong> You can choose <strong>1 Marksman Talent</strong>.</li>
</ul>

<h4>Level 16</h4>
<ul>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 17</h4>
<ul>
  <li><strong>Marksman Talent:</strong> You can choose <strong>1 Marksman Talent</strong>.</li>
</ul>

<h4>Level 18</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Generic Talent:</strong> You gain a <strong>Generic Talent</strong>.</li>
</ul>

<h4>Level 19</h4>
<ul>
  <li><strong>Marksman Talent:</strong> You can choose <strong>1 Marksman Talent</strong>.</li>
</ul>

<h4>Level 20</h4>
<ul>
  <li><strong>Ability Score Improvement:</strong> Distribute <strong>+2</strong> across your abilities (either +2 to one ability or +1 to two different abilities).</li>
  <li><strong>Marksman Talent:</strong> You can choose <strong>1 Marksman Talent</strong>.</li>
</ul>`,
          basic: { type: "powerset", prerequisites: "" },
          archived: false
        },
        img: "icons/svg/target.svg"
      };
      let item;
      try {
        item = await Item.createDocuments([itemData], { render: false });
        item = item[0];
        if (!item || !item.id) { throw new Error("Failed to create item in world"); }
        await pack.importDocument(item);
        await item.delete();
        await pack.getIndex({ force: true });
        const marksmanInIndex = pack.index.find(i => i.name === "Marksman");
        if (marksmanInIndex) {
          ui.notifications.info("Marksman powerset created in Powersets compendium!");
        } else {
          ui.notifications.warn("Marksman powerset was created. Please close and reopen the compendium window to see it.");
        }
      } catch (error) {
        console.error("Singularity | Could not auto-create Marksman powerset:", error);
        ui.notifications.error(`Failed to create Marksman powerset: ${error.message}`);
      } finally {
        if (wasLocked) { await pack.configure({ locked: true }); }
      }
    } catch (error) {
      console.error("Singularity | Could not auto-create Marksman powerset (outer catch):", error);
      ui.notifications.error(`Failed to create Marksman powerset: ${error.message}`);
    }
  }, 4600);

  // Auto-create Generic Talents in the talents compendium
  setTimeout(async () => {
    try {
      const pack = game.packs.find(p => p.metadata.name === "talents" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.log("Singularity | Talents compendium not found, skipping auto-creation");
        return;
      }

      // Check if talents already exist
      await pack.getIndex({ force: true });
      const existingTalents = [
        "Blast (Apprentice)",
        "Blast Damage Enhancement I",
        "Controlled Descent",
        "Enhanced Vitality",
        "Expert Climber",
        "Expert Swimmer",
        "Hard to Kill",
        "Initiative Training (Apprentice)",
        "Light Armor Training",
        "Marine Training",
        "Saving Throw Training (Apprentice)",
        "Skill Training (Apprentice)",
        "Swift Runner",
        "Weapon Training (Apprentice)"
      ];
      
      const allExist = existingTalents.every(name => pack.index.find(i => i.name === name));
      if (allExist) {
        console.log("Singularity | All Generic talents already exist in compendium; verifying metadata");
      }

      const wasLocked = pack.locked;
      if (wasLocked) {
        await pack.configure({ locked: false });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Define all Generic talents
      const genericTalents = [
        {
          name: "Blast (Apprentice)",
          level: 1,
          description: `<h2>Description</h2>
<p>You unleash a focused burst of destructive energy, shaped by your chosen talent and technique. This blast may manifest as elemental force, technological firepower, or raw supernatural power, depending on how you wield it. You project a focused blast of destructive energy at a target.</p>

<h3>Requirements</h3>
<ul>
  <li>Prime Level 1</li>
</ul>

<h3>Effect</h3>
<p>When you gain this talent, choose a <strong>damage type</strong> and an <strong>ability score</strong> (Might, Agility, Wits, or Charm). These choices define how your Blast functions and what fuels its power.</p>
<p><strong>Type:</strong> Ranged attack<br>
<strong>Range:</strong> 30 feet<br>
<strong>Cost:</strong> 2 energy<br>
<strong>Hands:</strong> 0<br>
<strong>Damage:</strong> 1d4 + chosen ability modifier (damage type chosen when you gained this talent)</p>

<h3>Rules</h3>
<ul>
  <li>Blast is treated as a ranged weapon attack for all rules, penalties, and interactions, but uses the ability modifier selected when you gained this talent for both attack and damage rolls. You can add your Blast competence level (Apprentice: +4) to the attack roll.</li>
  <li>Blast does not require a physical weapon and cannot be disarmed.</li>
</ul>`,
          type: "generic",
          prerequisites: "Prime Level 1"
        },
        {
          name: "Blast Damage Enhancement I",
          level: 4,
          description: `<h2>Description</h2>
<p>You've learned to channel greater amounts of energy into your blasts, increasing their destructive potential significantly.</p>

<h3>Requirements</h3>
<ul>
  <li>Prime Level 4</li>
  <li>Blast (Apprentice)</li>
</ul>

<h3>Effect</h3>
<p>Your Blast damage increases to <strong>3d4 + chosen ability modifier</strong> (instead of 1d4 + chosen ability modifier).</p>`,
          type: "generic",
          prerequisites: "Prime Level 4; Blast (Apprentice)"
        },
        {
          name: "Controlled Descent",
          level: 1,
          description: `<h2>Description</h2>
<p>You instinctively reduce the danger of long falls. How this manifests is up to you: arcane forces slowing your fall, micro-thrusters or a jet-assisted suit, hardened physiology, perfect parkour technique, or even raw superhuman control over gravity.</p>

<h3>Effect</h3>
<p>You take <strong>half damage from falling</strong> while you are <strong>not unconscious</strong>.</p>`,
          type: "generic",
          prerequisites: ""
        },
        {
          name: "Enhanced Vitality",
          level: 1,
          description: `<h2>Description</h2>
<p>Your hero is built tougher than most, with greater reserves of stamina and durability. This extra vitality allows them to withstand significantly more damage over the course of their adventures.</p>

<h3>Effect</h3>
<p>Your hit point maximum increases by an amount equal to twice your Prime Level.<br>
Whenever you gain a level thereafter, your hit point maximum increases by an additional 2 hit points.</p>`,
          type: "generic",
          prerequisites: ""
        },
        {
          name: "Expert Climber",
          level: 4,
          description: `<h2>Description</h2>
<p>Through dedicated practice and refinement of your climbing technique, you've elevated your vertical movement from natural talent to true expertise. Your climbing speed has increased dramatically, and you can scale surfaces with the confidence of a skilled mountaineer or urban free-runner. Your grip is sure, your movements are precise and efficient, and you can traverse vertical terrain that would challenge most others.</p>

<h3>Requirements</h3>
<ul>
  <li>Prime Level 4</li>
  <li>Wall Crawler</li>
</ul>

<h3>Effect</h3>
<p>Your climbing speed increases by <strong>+15 feet</strong>.</p>`,
          type: "generic",
          prerequisites: "Prime Level 4; Wall Crawler"
        },
        {
          name: "Expert Swimmer",
          level: 1,
          description: `<h2>Description</h2>
<p>You are naturally at home in the water, moving with grace and speed that rivals aquatic creatures.</p>

<h3>Effect</h3>
<p>You gain a <strong>swimming speed of 25 feet</strong>.</p>`,
          type: "generic",
          prerequisites: ""
        },
        {
          name: "Hard to Kill",
          level: 1,
          description: `<h2>Description</h2>
<p>Your hero is exceptionally difficult to put down for good. Whether through raw physical toughness, unbreakable will, or sheer stubborn refusal to die, they can accumulate more traumatic wounds before their body gives out.</p>

<h3>Effect</h3>
<p>Increase your Wound Limit threshold by 2.</p>`,
          type: "generic",
          prerequisites: ""
        },
        {
          name: "Initiative Training (Apprentice)",
          level: 1,
          description: `<h2>Description</h2>
<p>You have honed your tactical instincts to react faster when danger strikes. You are always one step ahead of the chaos.</p>

<h3>Effect</h3>
<p>Your proficiency in <strong>Initiative</strong> checks increases to <strong>Apprentice</strong>.</p>`,
          type: "generic",
          prerequisites: ""
        },
        {
          name: "Light Armor Training",
          level: 1,
          description: `<h2>Description</h2>
<p>Your character learns to wear light armor effectively. This allows for better protection without compromising agility or movement.</p>

<h3>Effect</h3>
<p>You are now <strong>trained</strong> in Light Armor. You can wear light armor without penalties to movement or defense. This training does not apply to Medium or Heavy Armor.</p>`,
          type: "generic",
          prerequisites: ""
        },
        {
          name: "Marine Training",
          level: 1,
          description: `<h2>Description</h2>
<p>You have trained extensively in underwater combat, learning to use the resistance of the water to your advantage rather than letting it hinder your strikes.</p>

<h3>Effect</h3>
<p>You ignore the <strong>-5 penalty to melee attack rolls</strong> while underwater.</p>`,
          type: "generic",
          prerequisites: ""
        },
        {
          name: "Saving Throw Training (Apprentice)",
          level: 1,
          description: `<h2>Description</h2>
<p>Your character's resilience improves through practice, study, or real-world experience.</p>

<h3>Effect</h3>
<p>Choose one saving throw based on an ability (Might, Agility, Endurance, Wits, or Charm) in which your character is <strong>Novice</strong>. Your proficiency in that saving throw increases to <strong>Apprentice</strong>.</p>`,
          type: "generic",
          prerequisites: ""
        },
        {
          name: "Skill Training (Apprentice)",
          level: 1,
          description: `<h2>Description</h2>
<p>Your character's skills improve through practice, study, or real-world experience.</p>

<h3>Effect</h3>
<p>Choose one skill in which your character is <strong>Novice</strong>. Your proficiency in that skill increases to <strong>Apprentice</strong>.</p>`,
          type: "generic",
          prerequisites: ""
        },
        {
          name: "Swift Runner",
          level: 1,
          description: `<h2>Description</h2>
<p>Your training and reflexes allow you to move faster than normal.</p>

<h3>Effect</h3>
<p>Your <strong>land movement speed increases by +5 feet</strong>.</p>`,
          type: "generic",
          prerequisites: ""
        },
        {
          name: "Weapon Training (Apprentice)",
          level: 1,
          description: `<h2>Description</h2>
<p>Your character improves their skill with weapons through training and practice. By focusing on a single weapon category, you can increase your training level and perform better in combat with those weapons.</p>

<h3>Effect</h3>
<p>Choose one weapon category in which your character is currently <strong>Novice</strong>. Your training level in that category increases to <strong>Apprentice</strong>.</p>`,
          type: "generic",
          prerequisites: ""
        }
      ];

      // Create all talents
      const itemsToCreate = [];
      for (const talentData of genericTalents) {
        // Check if it already exists
        const exists = pack.index.find(i => i.name === talentData.name);
        if (exists) {
          try {
            const existingDoc = await pack.getDocument(exists._id);
            const updates = {};
            if (talentData.level && existingDoc?.system?.basic?.level !== talentData.level) {
              updates["system.basic.level"] = talentData.level;
            }
            if (talentData.prerequisites && existingDoc?.system?.basic?.prerequisites !== talentData.prerequisites) {
              updates["system.basic.prerequisites"] = talentData.prerequisites;
            }
            if (Object.keys(updates).length) {
              await existingDoc.update(updates);
              console.log(`Singularity | Updated ${talentData.name} metadata`);
            }
          } catch (updateErr) {
            console.warn(`Singularity | Could not update ${talentData.name}:`, updateErr);
          }
          console.log(`Singularity | ${talentData.name} already exists, skipping create`);
          continue;
        }

        const itemData = {
          name: talentData.name,
          type: "talent",
          system: {
            description: talentData.description,
            basic: {
              type: talentData.type,
              prerequisites: talentData.prerequisites,
              level: talentData.level || 1
            },
            archived: false
          },
          img: "icons/svg/item-bag.svg"
        };
        itemsToCreate.push(itemData);
      }

      if (itemsToCreate.length === 0) {
        console.log("Singularity | All Generic talents already exist");
        if (wasLocked) await pack.configure({ locked: true });
        return;
      }

      console.log(`Singularity | Creating ${itemsToCreate.length} Generic talents...`);
      
      // Create items in world first
      const createdItems = await Item.createDocuments(itemsToCreate, { render: false });
      console.log(`Singularity | Created ${createdItems.length} items in world`);

      // Import into compendium
      for (const item of createdItems) {
        try {
          await pack.importDocument(item);
          await item.delete(); // Delete world item
          console.log(`Singularity | Imported ${item.name} into compendium`);
        } catch (err) {
          console.error(`Singularity | Error importing ${item.name}:`, err);
          // Clean up world item
          try {
            await item.delete();
          } catch (cleanupErr) {
            console.error(`Singularity | Error cleaning up ${item.name}:`, cleanupErr);
          }
        }
      }

      // Wait for imports to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh index
      await pack.getIndex({ force: true });
      
      if (wasLocked) await pack.configure({ locked: true });

      ui.notifications.info(`Created ${itemsToCreate.length} Generic talents in Talents compendium!`);
    } catch (error) {
      console.error("Singularity | Could not auto-create Generic talents:", error);
      ui.notifications.error(`Failed to create Generic talents: ${error.message}`);
    }
  }, 4000);

  // Auto-create Bastion talents in the talents compendium
  setTimeout(async () => {
    try {
      const pack = game.packs.find(p => p.metadata.name === "talents" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.log("Singularity | Talents compendium not found, skipping auto-creation of Bastion talents");
        return;
      }

      // Check if talents already exist
      await pack.getIndex({ force: true });
      
      const bastionTalentNames = [
        "Bastion's Resistance",
        "Enlarged Presence",
        "Ironbound",
        "Protect the Weak",
        "Defensive Stance",
        "Increased Resistance",
        "Intercept Attack"
      ];
      
      const allExist = bastionTalentNames.every(name => 
        pack.index.find(i => i.name === name)
      );
      
      if (allExist) {
        console.log("Singularity | All Bastion talents already exist in compendium; verifying metadata");
      }

      const wasLocked = pack.locked;
      if (wasLocked) {
        await pack.configure({ locked: false });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Define all Bastion talents
      const bastionTalents = [
        {
          name: "Bastion's Resistance",
          level: 1,
          description: `<h2>Description</h2>
<p>Your body (through training, mutation, armor, or sheer will) is built to endure punishment, allowing you to shrug off specific types of environmental or combat-related harm.</p>

<h3>Requirements</h3>
<ul>
  <li>Bastion 1</li>
</ul>

<h3>Effect</h3>
<p>Choose one damage type when you take this talent. You gain <strong>resistance</strong> to the chosen damage type equal to <strong>2 × your Bastion level</strong>.</p>
<p>You can take this talent multiple times, choosing a different damage type each time.</p>`,
          type: "bastion",
          prerequisites: "Bastion 1"
        },
        {
          name: "Enlarged Presence",
          level: 1,
          description: `<h2>Description</h2>
<p>Your body, armor, or protective field expands beyond normal limits, making you an immovable presence on the battlefield.</p>

<h3>Requirements</h3>
<ul>
  <li>Bastion 1</li>
</ul>

<h3>Effect</h3>
<ul>
  <li>Your <strong>size increases to Large</strong>.</li>
</ul>`,
          type: "bastion",
          prerequisites: "Bastion 1"
        },
        {
          name: "Ironbound",
          level: 1,
          description: `<h2>Description</h2>
<p>Your hero's physique is exceptionally resilient, allowing them to endure far more punishment than others with similar builds. This may stem from dense muscle and bone structure, accelerated cellular regeneration, or simply an iron constitution.</p>

<h3>Requirements</h3>
<ul>
  <li>Bastion 1</li>
</ul>

<h3>Effect</h3>
<p>You add your Endurance score twice when determining your maximum hit points (instead of once). This increase applies immediately and adjusts if your Endurance score changes later.</p>`,
          type: "bastion",
          prerequisites: "Bastion 1"
        },
        {
          name: "Defensive Stance",
          level: 3,
          description: `<h2>Description</h2>
<p>You adopt a defensive posture that makes you harder to hit, whether through careful positioning, shield work, or simply making yourself a smaller target.</p>

<h3>Requirements</h3>
<ul>
  <li>Bastion 3</li>
</ul>

<h3>Effect</h3>
<p>You can spend 1 energy to enter a defensive stance. While in this stance, you gain a <strong>+2 bonus to AC</strong>.</p>
<p>The stance ends if you move, or you can end it on your turn as a free action.</p>`,
          type: "bastion",
          prerequisites: "Bastion 3"
        },
        {
          name: "Increased Resistance",
          level: 5,
          description: `<h2>Description</h2>
<p>Your natural durability against your chosen element improves significantly.</p>

<h3>Requirements</h3>
<ul>
  <li>Bastion 5</li>
  <li>Bastion's Resistance</li>
</ul>

<h3>Effect</h3>
<p>For the damage type chosen for <strong>Bastion's Resistance</strong>, your resistance increases to <strong>4 × your Bastion level</strong> (instead of 2).</p>`,
          type: "bastion",
          prerequisites: "Bastion 5; Bastion's Resistance"
        },
        {
          name: "Intercept Attack",
          level: 5,
          description: `<h2>Description</h2>
<p>You can position yourself to intercept attacks meant for your allies, taking the blow yourself.</p>

<h3>Requirements</h3>
<ul>
  <li>Bastion 5</li>
</ul>

<h3>Effect</h3>
<p>As a <strong>reaction</strong> when a willing ally within 5 feet of you would be hit by an attack, you can swap places with that ally. The attack targets you instead of your ally.</p>`,
          type: "bastion",
          prerequisites: "Bastion 5"
        },
        {
          name: "Protect the Weak",
          level: 1,
          description: `<h2>Description</h2>
<p>You draw enemy attention through presence alone, whether by sheer size, intimidation, or commanding presence.</p>

<h3>Requirements</h3>
<ul>
  <li>Bastion 1</li>
</ul>

<h3>Effect</h3>
<p><strong>Type:</strong> Action<br>
<strong>Range:</strong> Melee<br>
<strong>Cost:</strong> 1 energy</p>
<p>Choose one enemy within <strong>melee range</strong>. Until the start of your next turn, that enemy takes a <strong>–2 penalty</strong> on attack rolls against <strong>any target adjacent to you</strong>.</p>

<h3>Notes</h3>
<ul>
  <li>You may have this effect active on <strong>multiple enemies at the same time</strong>.</li>
</ul>`,
          type: "bastion",
          prerequisites: "Bastion 1"
        }
      ];

      // Create all talents
      const itemsToCreate = [];
      for (const talentData of bastionTalents) {
        // Check if it already exists
        const exists = pack.index.find(i => i.name === talentData.name);
        if (exists) {
          try {
            const existingDoc = await pack.getDocument(exists._id);
            const updates = {};
            if (talentData.level && existingDoc?.system?.basic?.level !== talentData.level) {
              updates["system.basic.level"] = talentData.level;
            }
            if (talentData.prerequisites && existingDoc?.system?.basic?.prerequisites !== talentData.prerequisites) {
              updates["system.basic.prerequisites"] = talentData.prerequisites;
            }
            if (Object.keys(updates).length) {
              await existingDoc.update(updates);
              console.log(`Singularity | Updated ${talentData.name} metadata`);
            }
          } catch (updateErr) {
            console.warn(`Singularity | Could not update ${talentData.name}:`, updateErr);
          }
          console.log(`Singularity | ${talentData.name} already exists, skipping create`);
          continue;
        }

        const itemData = {
          name: talentData.name,
          type: "talent",
          system: {
            description: talentData.description,
            basic: {
              type: talentData.type,
              prerequisites: talentData.prerequisites,
              level: talentData.level || 1
            },
            archived: false
          },
          img: "icons/svg/item-bag.svg"
        };
        itemsToCreate.push(itemData);
      }

      if (itemsToCreate.length === 0) {
        console.log("Singularity | All Level 1 Bastion talents already exist");
        if (wasLocked) await pack.configure({ locked: true });
        return;
      }

      console.log(`Singularity | Creating ${itemsToCreate.length} Level 1 Bastion talents...`);
      
      // Create items in world first
      const createdItems = await Item.createDocuments(itemsToCreate, { render: false });
      console.log(`Singularity | Created ${createdItems.length} Bastion talent items in world`);

      // Import into compendium
      for (const item of createdItems) {
        try {
          await pack.importDocument(item);
          await item.delete(); // Delete world item
          console.log(`Singularity | Imported ${item.name} into compendium`);
        } catch (err) {
          console.error(`Singularity | Error importing ${item.name}:`, err);
          // Clean up world item
          try {
            await item.delete();
          } catch (cleanupErr) {
            console.error(`Singularity | Error cleaning up ${item.name}:`, cleanupErr);
          }
        }
      }

      if (wasLocked) await pack.configure({ locked: true });

      // Wait for imports to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh index
      await pack.getIndex({ force: true });
      
      if (wasLocked) await pack.configure({ locked: true });

      ui.notifications.info(`Created ${itemsToCreate.length} Level 1 Bastion talents in Talents compendium!`);
    } catch (error) {
      console.error("Singularity | Could not auto-create Level 1 Bastion talents:", error);
      ui.notifications.error(`Failed to create Level 1 Bastion talents: ${error.message}`);
    }
  }, 5000);

  // Auto-create Paragon talents in the talents compendium
  setTimeout(async () => {
    try {
      const pack = game.packs.find(p => p.metadata.name === "talents" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.log("Singularity | Talents compendium not found, skipping auto-creation of Paragon talents");
        return;
      }

      // Check if talents already exist
      await pack.getIndex({ force: true });
      
      const paragonTalentNames = [
        "Dominating Presence",
        "Impact Control",
        "Noble Presence",
        "Supersonic Moment",
        "Crushing Blow",
        "Enhanced Flight",
        "Improved Impact Control",
        "Space Breathing"
      ];
      
      const allExist = paragonTalentNames.every(name => 
        pack.index.find(i => i.name === name)
      );
      
      if (allExist) {
        console.log("Singularity | All Paragon talents already exist in compendium; verifying metadata");
      }

      const wasLocked = pack.locked;
      if (wasLocked) {
        await pack.configure({ locked: false });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Define all Paragon talents
      const paragonTalents = [
        {
          name: "Dominating Presence",
          level: 1,
          description: `<h2>Description</h2>
<p>Your overwhelming physical presence and visible superiority inspire fear and hesitation in those who face you.</p>

<h3>Requirements</h3>
<ul>
  <li>Paragon 1</li>
</ul>

<h3>Effect</h3>
<p>You gain a <strong>+4 bonus to Intimidation checks</strong> while you are flying.</p>`,
          type: "paragon",
          prerequisites: "Paragon 1"
        },
        {
          name: "Impact Control",
          level: 1,
          description: `<h2>Description</h2>
<p>Your body can instinctively absorb and redistribute extreme forces. A Paragon knows how to hit the ground without breaking it, or themselves.</p>

<h3>Requirements</h3>
<ul>
  <li>Paragon 1</li>
</ul>

<h3>Effect</h3>
<p>You take <strong>half damage from falling</strong>.</p>`,
          type: "paragon",
          prerequisites: "Paragon 1"
        },
        {
          name: "Noble Presence",
          level: 1,
          description: `<h2>Description</h2>
<p>Your overwhelming physical presence and visible superiority inspire respect and admiration in those who face you.</p>

<h3>Requirements</h3>
<ul>
  <li>Paragon 1</li>
</ul>

<h3>Effect</h3>
<p>You gain a <strong>+4 bonus to Persuasion checks</strong> while you are flying.</p>`,
          type: "paragon",
          prerequisites: "Paragon 1"
        },
        {
          name: "Supersonic Moment",
          level: 1,
          description: `<h2>Description</h2>
<p>For a Paragon, speed isn't just for travel; it's the ultimate force multiplier. By accelerating to extreme velocities, you turn your body into a living projectile.</p>

<h3>Requirements</h3>
<ul>
  <li>Paragon 1</li>
</ul>

<h3>Effect</h3>
<p>For every <strong>15 feet you fly</strong> in before making a melee attack in the same turn, you gain a <strong>+2 bonus to the damage</strong>.</p>`,
          type: "paragon",
          prerequisites: "Paragon 1"
        },
        {
          name: "Crushing Blow",
          level: 3,
          description: `<h2>Description</h2>
<p>Your unarmed strikes carry devastating force. When you land a critical hit, the impact is truly crushing.</p>

<h3>Requirements</h3>
<ul>
  <li>Paragon 3</li>
</ul>

<h3>Effect</h3>
<p>When you score a critical hit with an unarmed attack, you deal an additional <strong>1d10 damage</strong>.</p>
<p>This damage increases to <strong>2d10</strong> at Paragon level 10, <strong>3d10</strong> at Paragon level 15, and <strong>4d10</strong> at Paragon level 20.</p>`,
          type: "paragon",
          prerequisites: "Paragon 3"
        },
        {
          name: "Enhanced Flight",
          level: 3,
          description: `<h2>Description</h2>
<p>Your flight capabilities have improved significantly. You move through the air with greater speed and precision.</p>

<h3>Requirements</h3>
<ul>
  <li>Paragon 3</li>
</ul>

<h3>Effect</h3>
<p>Your flying speed increases by <strong>10 feet</strong>.</p>`,
          type: "paragon",
          prerequisites: "Paragon 3"
        },
        {
          name: "Improved Impact Control",
          level: 3,
          description: `<h2>Description</h2>
<p>Your mastery over impact forces has reached new heights. You can land from any height without harm, and even use your momentum to devastating effect.</p>

<h3>Requirements</h3>
<ul>
  <li>Paragon 3</li>
  <li>Impact Control</li>
</ul>

<h3>Effect</h3>
<p>You take <strong>no damage from falling</strong>.</p>`,
          type: "paragon",
          prerequisites: "Paragon 3; Impact Control"
        },
        {
          name: "Space Breathing",
          level: 3,
          description: `<h2>Description</h2>
<p>Your physiology has adapted to survive in the vacuum of space. You can breathe normally in environments with no atmosphere, though you still require air when underwater.</p>

<h3>Requirements</h3>
<ul>
  <li>Paragon 3</li>
</ul>

<h3>Effect</h3>
<p>You can breathe normally in environments with no atmosphere, including the vacuum of space.</p>
<p>You still cannot breathe underwater and must hold your breath or find another means of respiration when submerged.</p>`,
          type: "paragon",
          prerequisites: "Paragon 3"
        }
      ];

      // Create all talents
      const itemsToCreate = [];
      for (const talentData of paragonTalents) {
        // Check if it already exists
        const exists = pack.index.find(i => i.name === talentData.name);
        if (exists) {
          try {
            const existingDoc = await pack.getDocument(exists._id);
            const updates = {};
            if (talentData.level && existingDoc?.system?.basic?.level !== talentData.level) {
              updates["system.basic.level"] = talentData.level;
            }
            if (talentData.prerequisites && existingDoc?.system?.basic?.prerequisites !== talentData.prerequisites) {
              updates["system.basic.prerequisites"] = talentData.prerequisites;
            }
            if (Object.keys(updates).length) {
              await existingDoc.update(updates);
              console.log(`Singularity | Updated ${talentData.name} metadata`);
            }
          } catch (updateErr) {
            console.warn(`Singularity | Could not update ${talentData.name}:`, updateErr);
          }
          console.log(`Singularity | ${talentData.name} already exists, skipping create`);
          continue;
        }

        const itemData = {
          name: talentData.name,
          type: "talent",
          system: {
            description: talentData.description,
            basic: {
              type: talentData.type,
              prerequisites: talentData.prerequisites,
              level: talentData.level || 1
            },
            archived: false
          },
          img: "icons/svg/item-bag.svg"
        };
        itemsToCreate.push(itemData);
      }

      if (itemsToCreate.length === 0) {
        console.log("Singularity | All Level 1 Paragon talents already exist");
        if (wasLocked) await pack.configure({ locked: true });
        return;
      }

      console.log(`Singularity | Creating ${itemsToCreate.length} Level 1 Paragon talents...`);
      
      // Create items in world first
      const createdItems = await Item.createDocuments(itemsToCreate, { render: false });
      console.log(`Singularity | Created ${createdItems.length} Paragon talent items in world`);

      // Import into compendium
      let item;
      for (item of createdItems) {
        try {
          await pack.importDocument(item);
          await item.delete(); // Delete world item
          console.log(`Singularity | Imported ${item.name} into compendium`);
        } catch (err) {
          console.error(`Singularity | Error importing ${item.name}:`, err);
          // Clean up world item
          try {
            if (item) await item.delete();
          } catch (cleanupErr) {
            console.error(`Singularity | Error cleaning up ${item.name}:`, cleanupErr);
          }
        }
      }

      // Wait for imports to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh index
      await pack.getIndex({ force: true });
      
      if (wasLocked) await pack.configure({ locked: true });

      ui.notifications.info(`Created ${itemsToCreate.length} Level 1 Paragon talents in Talents compendium!`);
    } catch (error) {
      console.error("Singularity | Could not auto-create Level 1 Paragon talents:", error);
      ui.notifications.error(`Failed to create Level 1 Paragon talents: ${error.message}`);
    }
  }, 5500);

  // Auto-create Gadgeteer Talents in the talents compendium
  setTimeout(async () => {
    try {
      const pack = game.packs.find(p => p.metadata.name === "talents" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.log("Singularity | Talents compendium not found, skipping auto-creation of Gadgeteer talents");
        return;
      }

      await pack.getIndex({ force: true });
      
      const gadgeteerTalentNames = [
        "Enough Prep Time",
        "Expanded Loadout",
        "Improvised Gadget",
        "Rapid Deployment",
        "Improved Improvisation",
        "Gadget Mastery",
        "Rapid Preparation",
        "Reliable Gadgets",
        "Advanced Loadout",
        "Gadget Efficiency",
        "Gadget Overcharge",
        "Multiple Preparations",
        "Superior Engineering",
        "Gadget Synergy",
        "Sustained Tuning",
        "Gadget Arsenal",
        "Master Improvisation",
        "Ultimate Preparation"
      ];
      
      const allExist = gadgeteerTalentNames.every(name => 
        pack.index.find(i => i.name === name)
      );
      
      if (allExist) {
        console.log("Singularity | All Gadgeteer talents already exist in compendium; verifying metadata");
      }

      const wasLocked = pack.locked;
      if (wasLocked) {
        await pack.configure({ locked: false });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const gadgeteerTalents = [
        {
          name: "Enough Prep Time",
          level: 1,
          description: `<h2>Description</h2>
<p>Given time to plan, analyze, and counter a specific threat, you tailor your gadgets and tactics for maximum effectiveness.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 1</li>
</ul>

<h3>Effect</h3>
<p>After spending <strong>1 uninterrupted hour preparing for a known enemy</strong>, choose one of the following benefits:</p>
<ul>
  <li>Gain a <strong>+1 bonus per Gadgeteer level</strong> to your <strong>Gadget Tuning DC</strong> against the chosen enemy.</li>
  <li>Gain a <strong>+1 bonus per Gadgeteer level</strong> to <strong>attack rolls</strong> made with gadgets against the chosen enemy.</li>
</ul>
<p>This bonus lasts for a day. You can only have 1 active preparation at a time.</p>

<h3>Requirements for Preparation</h3>
<p>To use this talent, you must have <strong>reliable information</strong> about the chosen enemy. This can include one or more of the following (The Architect's discretion):</p>
<ul>
  <li>The enemy's <strong>identity or known alias</strong></li>
  <li>Observed <strong>combat abilities, powers, or equipment</strong></li>
  <li>A documented <strong>fighting style or behavior pattern</strong></li>
  <li>Prior <strong>direct encounters</strong> with the enemy</li>
  <li>Credible <strong>intel</strong> (surveillance footage, reports, blueprints, scans, etc.)</li>
</ul>
<p>Mere rumors, guesses, or encountering an unknown foe in combat <strong>do not qualify</strong>.</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 1"
        },
        {
          name: "Expanded Loadout",
          level: 1,
          description: `<h2>Description</h2>
<p>You carry extra components, backup power cells, and modular housings, allowing you to prepare more gadgets than usual.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 1</li>
</ul>

<h3>Effect</h3>
<p>You can <strong>prepare 2 additional Level 0 gadgets each day</strong>.</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 1"
        },
        {
          name: "Improvised Gadget",
          level: 1,
          description: `<h2>Description</h2>
<p>You assemble functional devices from scraps, spare parts, and sheer ingenuity.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 1</li>
</ul>

<h2>Improvised Gadget</h2>
<p><strong>Description:</strong><br>
You rapidly assemble a functional device from spare parts, half-finished components, and pure ingenuity.</p>

<p><strong>Requirement:</strong><br>
Improvised Gadget talent</p>

<p><strong>Type:</strong> Action<br>
<strong>Cost:</strong> 2 energy</p>

<h3>Effect</h3>
<p>You create one Level 0 gadget that you did not prepare. You can only use this gadget once per day.</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 1"
        },
        {
          name: "Improved Improvisation",
          level: 5,
          description: `<h2>Description</h2>
<p>Your ability to create gadgets on the fly has improved, allowing you to craft more powerful devices in the heat of battle.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 5</li>
  <li>Improvised Gadget</li>
</ul>

<h3>Effect</h3>
<p>When you use <strong>Improvised Gadget</strong>, you can create a <strong>Level 1 gadget</strong> instead of a Level 0 gadget. The energy cost remains 2.</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 5; Improvised Gadget"
        },
        {
          name: "Rapid Deployment",
          level: 3,
          description: `<h2>Description</h2>
<p>Your gadgets are optimized for quick activation, allowing you to deploy them with minimal setup time.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 3</li>
</ul>

<h3>Effect</h3>
<p>When you use a gadget, you can reduce its energy cost by <strong>1</strong> (minimum <strong>1</strong> energy).</p>
<p>You can use this ability a number of times per encounter equal to your <strong>Wits modifier</strong> (minimum <strong>1</strong>).</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 3"
        },
        {
          name: "Gadget Mastery",
          level: 7,
          description: `<h2>Description</h2>
<p>Your expertise with your devices allows you to push them beyond their normal limits, achieving more powerful and reliable results through superior tuning and calibration.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 7</li>
</ul>

<h3>Effect</h3>
<p>You gain a <strong>+2 bonus</strong> to your <strong>Gadget Tuning DC</strong>.</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 7"
        },
        {
          name: "Rapid Preparation",
          level: 7,
          description: `<h2>Description</h2>
<p>Your ability to analyze threats and prepare countermeasures has become so refined that you can complete your preparations in a fraction of the time.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 7</li>
  <li>Enough Prep Time</li>
</ul>

<h3>Effect</h3>
<p>When you use <strong>Enough Prep Time</strong>, the preparation time is reduced to <strong>10 minutes</strong> (instead of 1 hour).</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 7; Enough Prep Time"
        },
        {
          name: "Reliable Gadgets",
          level: 7,
          description: `<h2>Description</h2>
<p>Your gadgets are built so precisely that even your worst misfires are better than most.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 7</li>
</ul>

<h3>Effect</h3>
<p>When you roll a <strong>natural 1</strong> on a Gadget Tuning check, you may treat the die result as a <strong>2</strong> instead.</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 7"
        },
        {
          name: "Advanced Loadout",
          level: 9,
          description: `<h2>Description</h2>
<p>Your carrying capacity and organizational systems have been refined, allowing you to prepare even more gadgets.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 9</li>
  <li>Expanded Loadout</li>
</ul>

<h3>Effect</h3>
<p>You can prepare <strong>1 additional Level 1 gadget slot</strong> each day. Additionally, your <strong>Expanded Loadout</strong> now grants <strong>4 additional Level 0 gadget slots</strong> (instead of 2).</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 9; Expanded Loadout"
        },
        {
          name: "Gadget Efficiency",
          level: 10,
          description: `<h2>Description</h2>
<p>Your mastery of gadget design allows you to maintain your devices more efficiently, requiring less energy to keep them running.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 10</li>
</ul>

<h3>Effect</h3>
<p>A number of times per long rest equal to your <strong>Wits modifier</strong> (minimum 1), when you use the <strong>Maintain</strong> action, you can reduce the maintain cost by <strong>1</strong> (minimum 0).</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 10"
        },
        {
          name: "Gadget Overcharge",
          level: 12,
          description: `<h2>Description</h2>
<p>You can push your simpler gadgets beyond their normal operating parameters, channeling extra power through them for devastating results at the cost of burning them out.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 12</li>
</ul>

<h3>Effect</h3>
<p>When you use a <strong>Level 0 gadget</strong> that deals damage, you can choose to <strong>overcharge</strong> it. If you do, the gadget deals <strong>double damage</strong>. However, after using an overcharged gadget, you cannot use that same gadget again until after your next long rest.</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 12"
        },
        {
          name: "Multiple Preparations",
          level: 12,
          description: `<h2>Description</h2>
<p>Your tactical mind can track multiple threats simultaneously, allowing you to maintain preparations against several enemies at once.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 12</li>
  <li>Enough Prep Time</li>
</ul>

<h3>Effect</h3>
<p>When you use <strong>Enough Prep Time</strong>, you can maintain <strong>2 active preparations</strong> at once (instead of 1). Each preparation can target a different enemy, granting the full Enough Prep Time bonuses against each.</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 12; Enough Prep Time"
        },
        {
          name: "Superior Engineering",
          level: 12,
          description: `<h2>Description</h2>
<p>Your engineering skills have reached superior levels, allowing you to create and modify gadgets with enhanced precision and power.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 12</li>
  <li>Gadget Mastery</li>
</ul>

<h3>Effect</h3>
<p>Your <strong>Gadget Mastery</strong> bonus increases to <strong>+4</strong> to your Gadget Tuning DC (instead of +2).</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 12; Gadget Mastery"
        },
        {
          name: "Gadget Synergy",
          level: 14,
          description: `<h2>Description</h2>
<p>Your understanding of gadget interactions allows you to combine effects for more powerful results when actively maintaining multiple devices.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 14</li>
</ul>

<h3>Effect</h3>
<p>Once per long rest, when you use a gadget that deals damage while you are maintaining at least one other gadget that targets the same creature or area, the damage-dealing gadget deals <strong>double damage</strong>.</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 14"
        },
        {
          name: "Sustained Tuning",
          level: 15,
          description: `<h2>Description</h2>
<p>Your ability to maintain multiple active gadgets simultaneously creates a feedback loop of optimization, allowing you to tune each device more effectively as you coordinate between them.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 15</li>
</ul>

<h3>Effect</h3>
<p>Your Gadget Tuning DC increases by <strong>+1 for each gadget you are currently maintaining</strong>. Track your maintained gadgets on the Gadgets tab of your character sheet.</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 15"
        },
        {
          name: "Gadget Arsenal",
          level: 17,
          description: `<h2>Description</h2>
<p>Your preparation and organization allow you to maintain a vast array of gadgets, ready for any situation.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 17</li>
</ul>

<h3>Effect</h3>
<p>You gain additional gadget slot value equal to half your Gadgeteer level, rounded down. Each gadget in your Arsenal costs slot value equal to its level.</p>

<p><strong>Examples at level 20 (10 slot value):</strong></p>
<ul>
  <li>10 Level 1 gadgets</li>
  <li>2 Level 5 gadgets</li>
  <li>3 Level 3 gadgets and 1 Level 1 gadget</li>
</ul>

<p>Arsenal gadgets are managed on the Gadgets tab of your character sheet.</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 17"
        },
        {
          name: "Master Improvisation",
          level: 19,
          description: `<h2>Description</h2>
<p>Your ability to create gadgets from nothing has reached its peak. You can assemble complex devices from the most basic materials in moments.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 19</li>
  <li>Improved Improvisation</li>
</ul>

<h3>Effect</h3>
<p>When you use <strong>Improvised Gadget</strong>, you can create a gadget of any level up to <strong>Level 3</strong>. You can use Improvised Gadget a number of times per long rest equal to your <strong>Wits</strong> (minimum 1).</p>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 19; Improved Improvisation"
        },
        {
          name: "Ultimate Preparation",
          level: 20,
          description: `<h2>Description</h2>
<p>You have achieved the pinnacle of tactical preparation. Given enough time, you can analyze and counter any threat with perfect precision.</p>

<h3>Requirements</h3>
<ul>
  <li>Gadgeteer 20</li>
  <li>Enough Prep Time</li>
</ul>

<h3>Effect</h3>
<p>When you use <strong>Enough Prep Time</strong>, the bonuses from your preparations are doubled:</p>
<ul>
  <li>Gain a <strong>+2 bonus per Gadgeteer level</strong> to your <strong>Gadget Tuning DC</strong> against the chosen enemy (instead of +1).</li>
  <li>Gain a <strong>+2 bonus per Gadgeteer level</strong> to <strong>attack rolls</strong> made with gadgets against the chosen enemy (instead of +1).</li>
</ul>`,
          type: "gadgeteer",
          prerequisites: "Gadgeteer 20; Enough Prep Time"
        }
      ];

      const itemsToCreate = [];
      for (const talentData of gadgeteerTalents) {
        const exists = pack.index.find(i => i.name === talentData.name);
        if (exists) {
          try {
            const existingDoc = await pack.getDocument(exists._id);
            const updates = {};
            if (talentData.level && existingDoc?.system?.basic?.level !== talentData.level) {
              updates["system.basic.level"] = talentData.level;
            }
            if (talentData.prerequisites && existingDoc?.system?.basic?.prerequisites !== talentData.prerequisites) {
              updates["system.basic.prerequisites"] = talentData.prerequisites;
            }
            if (Object.keys(updates).length) {
              await existingDoc.update(updates);
              console.log(`Singularity | Updated ${talentData.name} metadata`);
            }
          } catch (updateErr) {
            console.warn(`Singularity | Could not update ${talentData.name}:`, updateErr);
          }
          console.log(`Singularity | ${talentData.name} already exists, skipping create`);
          continue;
        }
        itemsToCreate.push({
          name: talentData.name,
          type: "talent",
          system: {
            description: talentData.description,
            basic: {
              type: talentData.type,
              prerequisites: talentData.prerequisites,
              level: talentData.level || 1
            },
            archived: false
          },
          img: "icons/svg/item-bag.svg"
        });
      }

      if (itemsToCreate.length === 0) {
        console.log("Singularity | All Gadgeteer talents already exist");
        if (wasLocked) await pack.configure({ locked: true });
        return;
      }

      console.log(`Singularity | Creating ${itemsToCreate.length} Gadgeteer talents...`);
      const createdItems = await Item.createDocuments(itemsToCreate, { render: false });
      
      for (const item of createdItems) {
        try {
          await pack.importDocument(item);
          await item.delete();
        } catch (err) {
          console.error(`Singularity | Error importing ${item.name}:`, err);
          try {
            await item.delete();
          } catch (cleanupErr) {
            console.error(`Singularity | Error cleaning up ${item.name}:`, cleanupErr);
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      await pack.getIndex({ force: true });
      
      if (wasLocked) await pack.configure({ locked: true });
      
      ui.notifications.info(`Created ${itemsToCreate.length} Gadgeteer talents in Talents compendium!`);
    } catch (error) {
      console.error("Singularity | Could not auto-create Gadgeteer talents:", error);
      ui.notifications.error(`Failed to create Gadgeteer talents: ${error.message}`);
    }
  }, 6000);

  // Auto-create Marksman talents in the talents compendium
  setTimeout(async () => {
    try {
      const pack = game.packs.find(p => p.metadata.name === "talents" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.log("Singularity | Talents compendium not found, skipping auto-creation of Marksman talents");
        return;
      }

      await pack.getIndex({ force: true });
      
      const marksmanTalentNames = [
        "Deadeye",
        "Quickdraw",
        "Suppressive Fire",
        "Stabilized Movement",
        "Fast Reload",
        "Improved Deadeye",
        "Trick Shot",
        "Rapid Fire",
        "Specialized Ammunition",
        "Enhanced Precision",
        "Tripoint Trauma",
        "Lightning Reload",
        "Perfect Aim",
        "Ricochet Shot",
        "Master Marksman",
        "Pinpoint Accuracy",
        "Versatile Arsenal",
        "Deadly Focus",
        "Master Ricochet",
        "Penetrating Shot",
        "Unerring Aim",
        "Impossible Shot",
        "Perfect Shot"
      ];
      
      const allExist = marksmanTalentNames.every(name => 
        pack.index.find(i => i.name === name)
      );
      
      if (allExist) {
        console.log("Singularity | All Marksman talents already exist in compendium; verifying metadata");
      }

      const wasLocked = pack.locked;
      if (wasLocked) {
        await pack.configure({ locked: false });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const marksmanTalents = [
        {
          name: "Deadeye",
          level: 1,
          description: `<h2>Description</h2>
<p>You steady your weapon with razor focus, lining up the perfect shot.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 1</li>
  <li>You wield a ranged weapon</li>
</ul>

<h3>Action Type</h3>
<p>Action<br><strong>Cost:</strong> 4 energy</p>

<h3>Target</h3>
<p>One enemy you can see.</p>

<h3>Effect</h3>
<p>You may spend an action to carefully aim. Your next attack with the ranged weapon you are wielding gains a <strong>+5 bonus to the attack roll</strong>.</p>
<p>If you or your target moves before the attack is made, you lose this bonus.</p>`,
          type: "marksman",
          prerequisites: "Marksman 1"
        },
        {
          name: "Quickdraw",
          level: 1,
          description: `<h2>Description</h2>
<p>Your reflexes are lightning-fast, honed for the split-second between danger and response.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 1</li>
</ul>

<h3>Action Type</h3>
<p>Free Reaction (triggered by initiative)</p>

<h3>Effect</h3>
<p>Whenever you roll for initiative, you may immediately <strong>draw and reload one weapon</strong> from your inventory as part of that roll.</p>`,
          type: "marksman",
          prerequisites: "Marksman 1"
        },
        {
          name: "Suppressive Fire",
          level: 1,
          description: `<h2>Description</h2>
<p>You are trained to keep enemies pinned down with precise, suppressive shots.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 1</li>
  <li>You wield a loaded ranged weapon</li>
</ul>

<h3>Effect</h3>
<p>You can use the <strong>Suppressive Fire</strong> action.</p>`,
          type: "marksman",
          prerequisites: "Marksman 1"
        },
        {
          name: "Stabilized Movement",
          level: 3,
          description: `<h2>Description</h2>
<p>Your posture and balance keep your weapon steady, even on the move.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 3</li>
  <li>Deadeye</li>
</ul>

<h3>Effect</h3>
<p>When you use Deadeye, you do not lose its attack bonus if you move before making the attack.</p>
<p>You still lose the bonus if the target moves.</p>`,
          type: "marksman",
          prerequisites: "Marksman 3; Deadeye"
        },
        {
          name: "Fast Reload",
          level: 3,
          description: `<h2>Description</h2>
<p>Your hands move with practiced speed, reloading your weapon almost instinctively.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 3</li>
  <li>You wield a ranged weapon that requires reloading.</li>
</ul>

<h3>Effect</h3>
<p>Once per round, when you reload a ranged weapon, you reduce the energy cost by <strong>1</strong> (minimum <strong>1</strong> energy).</p>`,
          type: "marksman",
          prerequisites: "Marksman 3; Reloading ranged weapon"
        },
        {
          name: "Improved Deadeye",
          level: 7,
          description: `<h2>Description</h2>
<p>Your aim has become so refined that you can maintain perfect focus even when your target moves.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 7</li>
  <li>Deadeye</li>
</ul>

<h3>Effect</h3>
<p>When you use Deadeye, you do not lose the attack bonus if the target moves before you make the attack.</p>
<p>You still lose the bonus if you move (unless you have Stabilized Movement).</p>`,
          type: "marksman",
          prerequisites: "Marksman 7; Deadeye"
        },
        {
          name: "Trick Shot",
          level: 7,
          description: `<h2>Description</h2>
<p>You can perform incredible feats with your ranged weapon, using special ammunition or unconventional techniques to achieve remarkable effects.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 7</li>
</ul>

<h3>Effect</h3>
<p>When you make a ranged weapon attack, you can choose to perform a trick shot instead of dealing normal damage. Choose one of the following effects:</p>
<ul>
  <li><strong>Disarming Shot:</strong> The target must make a <strong>Might</strong> saving throw against your attack roll. On a failure, they drop one held item of your choice.</li>
  <li><strong>Blinding Shot:</strong> The target must make an <strong>Agility</strong> saving throw against your attack roll. On a failure, they are <strong>Blinded</strong> for 1 round.</li>
  <li><strong>Tripping Shot:</strong> The target must make an <strong>Agility</strong> saving throw against your attack roll. On a failure, they are knocked <strong>Prone</strong>.</li>
  <li><strong>Dazing Shot:</strong> The target must make an <strong>Endurance</strong> saving throw against your attack roll. On a failure, they are <strong>Dazed</strong> for 1 round.</li>
</ul>
<p>You can use this ability a number of times per long rest equal to your <strong>Agility</strong> (minimum 1).</p>`,
          type: "marksman",
          prerequisites: "Marksman 7"
        },
        {
          name: "Rapid Fire",
          level: 9,
          description: `<h2>Description</h2>
<p>You unleash a flurry of shots in rapid succession, overwhelming your target with sheer volume of fire.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 9</li>
  <li>You wield a ranged weapon</li>
</ul>

<h3>Effect</h3>
<p>When you make a ranged weapon attack, you can choose to use <strong>Rapid Fire</strong>. If you do, you make <strong>two separate ranged weapon attacks</strong> against the same target. Roll damage for both attacks normally. Combine the damage from both attacks, then apply resistance once to the combined total.</p>
<p>You can use this ability a number of times per long rest equal to your <strong>Agility</strong> (minimum 1).</p>`,
          type: "marksman",
          prerequisites: "Marksman 9"
        },
        {
          name: "Specialized Ammunition",
          level: 9,
          description: `<h2>Description</h2>
<p>You have access to or can craft specialized ammunition that changes the damage type of your attacks, allowing you to adapt to different threats.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 9</li>
</ul>

<h3>Effect</h3>
<p>When you make a ranged weapon attack, you can choose to change the damage type to one of the following: <strong>Fire</strong>, <strong>Cold</strong>, <strong>Electricity</strong>, <strong>Poison</strong>, or <strong>Photonic</strong>. The damage amount remains the same.</p>
<p>You can use this ability a number of times per long rest equal to your <strong>Wits</strong> (minimum 1).</p>`,
          type: "marksman",
          prerequisites: "Marksman 9"
        },
        {
          name: "Enhanced Precision",
          level: 10,
          description: `<h2>Description</h2>
<p>Your focus and precision have reached new heights, allowing you to achieve even greater accuracy when taking careful aim.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 10</li>
  <li>Deadeye</li>
</ul>

<h3>Effect</h3>
<p>When you use <strong>Deadeye</strong>, the bonus to your attack roll increases to <strong>+10</strong> (instead of +5).</p>`,
          type: "marksman",
          prerequisites: "Marksman 10, Deadeye"
        },
        {
          name: "Tripoint Trauma",
          level: 10,
          description: `<h2>Description</h2>
<p>Your shots are so devastatingly precise that they shatter multiple systems at once.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 10</li>
  <li>Surgical Precision</li>
</ul>

<h3>Effect</h3>
<p>When you score a <strong>Critical Hit</strong> and reduce a creature to 0 Health with a ranged weapon attack, you may choose to inflict <strong>three different Wounds</strong> instead of a single Extreme Wound.</p>`,
          type: "marksman",
          prerequisites: "Marksman 10, Surgical Precision"
        },
        {
          name: "Lightning Reload",
          level: 12,
          description: `<h2>Description</h2>
<p>Your reloading speed has reached superhuman levels, allowing you to reload your weapon instantly without expending energy.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 12</li>
  <li>Fast Reload</li>
</ul>

<h3>Effect</h3>
<p>A number of times per long rest equal to your <strong>Agility</strong> (minimum 1), you can reload a ranged weapon without spending energy.</p>`,
          type: "marksman",
          prerequisites: "Marksman 12, Fast Reload"
        },
        {
          name: "Perfect Aim",
          level: 12,
          description: `<h2>Description</h2>
<p>Your aim is so precise that you can ignore most obstacles and defensive measures.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 12</li>
  <li>Deadeye</li>
</ul>

<h3>Effect</h3>
<p>When you make a ranged weapon attack, you ignore <strong>Minor Cover</strong>. Additionally, <strong>Standard Cover</strong> is treated as Minor Cover for your attacks.</p>`,
          type: "marksman",
          prerequisites: "Marksman 12, Deadeye"
        },
        {
          name: "Ricochet Shot",
          level: 12,
          description: `<h2>Description</h2>
<p>You can angle your shots to bounce off surfaces, hitting targets around corners or behind cover.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 12</li>
</ul>

<h3>Effect</h3>
<p>When you make a ranged weapon attack, you can choose to have the projectile ricochet off a solid surface within range before reaching the target. The ricochet allows you to attack a target that you cannot see directly, as long as you know the exact square they are in (either because a teammate pointed it out to you, or it is evident from the creature's previous movement). The attack roll takes a <strong>-5 penalty</strong> due to the ricochet.</p>`,
          type: "marksman",
          prerequisites: "Marksman 12"
        },
        {
          name: "Master Marksman",
          level: 14,
          description: `<h2>Description</h2>
<p>Your expertise with ranged weapons has reached a level where you can accurately engage targets at extreme distances.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 14</li>
</ul>

<h3>Effect</h3>
<p>The range of all ranged weapons you wield is <strong>doubled</strong>.</p>`,
          type: "marksman",
          prerequisites: "Marksman 14"
        },
        {
          name: "Pinpoint Accuracy",
          level: 14,
          description: `<h2>Description</h2>
<p>Your precision is so refined that you can consistently strike critical areas.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 14</li>
</ul>

<h3>Effect</h3>
<p>When you roll a natural 20 on a ranged weapon attack roll, you can roll <strong>one additional damage die</strong>.</p>`,
          type: "marksman",
          prerequisites: "Marksman 14"
        },
        {
          name: "Versatile Arsenal",
          level: 15,
          description: `<h2>Description</h2>
<p>You are equally skilled with all types of ranged weapons, seamlessly switching between them as the situation demands.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 15</li>
  <li>Quickdraw</li>
</ul>

<h3>Effect</h3>
<p>You can draw or stow a ranged weapon as a <strong>free action</strong>.</p>`,
          type: "marksman",
          prerequisites: "Marksman 15, Quickdraw"
        },
        {
          name: "Deadly Focus",
          level: 17,
          description: `<h2>Description</h2>
<p>When you take the time to aim, your shots become devastatingly powerful.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 17</li>
  <li>Deadeye</li>
</ul>

<h3>Effect</h3>
<p>When you use <strong>Deadeye</strong>, your next ranged weapon attack deals <strong>double damage</strong> on a hit.</p>
<p>You can use this ability a number of times per long rest equal to your <strong>Agility</strong> (minimum 1).</p>`,
          type: "marksman",
          prerequisites: "Marksman 17, Deadeye"
        },
        {
          name: "Master Ricochet",
          level: 17,
          description: `<h2>Description</h2>
<p>Your mastery of ricochet shots has reached such perfection that you can execute them with the same accuracy as direct shots.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 17</li>
  <li>Ricochet Shot</li>
</ul>

<h3>Effect</h3>
<p>When you use <strong>Ricochet Shot</strong>, you ignore the -5 penalty to the attack roll. Your ricochet shots are as accurate as direct shots.</p>`,
          type: "marksman",
          prerequisites: "Marksman 17, Ricochet Shot"
        },
        {
          name: "Penetrating Shot",
          level: 17,
          description: `<h2>Description</h2>
<p>Your precision has reached such a level that you can thread your shots through even the smallest gaps, completely bypassing most cover.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 17</li>
  <li>Perfect Aim</li>
</ul>

<h3>Effect</h3>
<p>When you make a ranged weapon attack, you completely ignore <strong>Minor Cover</strong> and <strong>Standard Cover</strong>. Your attacks are unaffected by these types of cover.</p>`,
          type: "marksman",
          prerequisites: "Marksman 17, Perfect Aim"
        },
        {
          name: "Unerring Aim",
          level: 19,
          description: `<h2>Description</h2>
<p>Your aim is so refined that even your worst shots are still remarkably accurate.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 19</li>
  <li>Enhanced Precision</li>
</ul>

<h3>Effect</h3>
<p>When you make a ranged weapon attack, you can treat a roll of <strong>1–5</strong> on the d20 as a <strong>6</strong>.</p>`,
          type: "marksman",
          prerequisites: "Marksman 19, Enhanced Precision"
        },
        {
          name: "Impossible Shot",
          level: 20,
          description: `<h2>Description</h2>
<p>You can make shots that seem physically impossible, threading through narrow gaps, curving around obstacles, or hitting targets at extreme ranges.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 20</li>
</ul>

<h3>Action</h3>
<p><strong>Cost:</strong> 4 Energy</p>

<h3>Effect</h3>
<p>Make a ranged weapon attack against a target you can see, regardless of cover, range, or line of sight obstacles. The attack ignores all cover and has no maximum range. The attack roll takes a <strong>-5 penalty</strong> due to the impossible nature of the shot.</p>
<p>You can use this ability <strong>once per long rest</strong>.</p>`,
          type: "marksman",
          prerequisites: "Marksman 20"
        },
        {
          name: "Perfect Shot",
          level: 20,
          description: `<h2>Description</h2>
<p>You have achieved the pinnacle of marksmanship. When you take the time to line up the perfect shot, nothing can stop it.</p>

<h3>Requirements</h3>
<ul>
  <li>Marksman 20</li>
  <li>Unerring Aim</li>
</ul>

<h3>Action</h3>
<p><strong>Cost:</strong> 4 Energy</p>

<h3>Effect</h3>
<p>Make a ranged weapon attack against a target you can see. This attack <strong>automatically hits</strong> and scores a <strong>critical hit</strong>, regardless of cover, range, or other obstacles. The attack deals <strong>triple damage</strong> instead of double damage.</p>
<p>You can use this ability <strong>once per long rest</strong>.</p>`,
          type: "marksman",
          prerequisites: "Marksman 20, Unerring Aim"
        }
      ];

      // Create all talent items
      const itemsToCreate = [];
      for (const talentData of marksmanTalents) {
        // Check if it already exists
        const exists = pack.index.find(i => i.name === talentData.name);
        if (exists) {
          try {
            const existingDoc = await pack.getDocument(exists._id);
            const updates = {};
            if (talentData.level && existingDoc?.system?.basic?.level !== talentData.level) {
              updates["system.basic.level"] = talentData.level;
            }
            if (talentData.prerequisites && existingDoc?.system?.basic?.prerequisites !== talentData.prerequisites) {
              updates["system.basic.prerequisites"] = talentData.prerequisites;
            }
            if (Object.keys(updates).length) {
              await existingDoc.update(updates);
              console.log(`Singularity | Updated ${talentData.name} metadata`);
            }
          } catch (updateErr) {
            console.warn(`Singularity | Could not update ${talentData.name}:`, updateErr);
          }
          console.log(`Singularity | ${talentData.name} already exists, skipping create`);
          continue;
        }

        const itemData = {
          name: talentData.name,
          type: "talent",
          system: {
            description: talentData.description,
            basic: {
              type: talentData.type,
              prerequisites: talentData.prerequisites,
              level: talentData.level || 1
            },
            archived: false
          },
          img: "icons/svg/target.svg"
        };
        itemsToCreate.push(itemData);
      }

      if (itemsToCreate.length === 0) {
        console.log("Singularity | All Marksman talents already exist");
        if (wasLocked) await pack.configure({ locked: true });
        return;
      }

      console.log(`Singularity | Creating ${itemsToCreate.length} Marksman talents...`);
      const createdItems = await Item.createDocuments(itemsToCreate, { render: false });
      
      for (const item of createdItems) {
        try {
          await pack.importDocument(item);
          await item.delete();
        } catch (err) {
          console.error(`Singularity | Error importing ${item.name}:`, err);
          try {
            await item.delete();
          } catch (cleanupErr) {
            console.error(`Singularity | Error cleaning up ${item.name}:`, cleanupErr);
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      await pack.getIndex({ force: true });
      
      if (wasLocked) await pack.configure({ locked: true });
      
      ui.notifications.info(`Created ${itemsToCreate.length} Marksman talents in Talents compendium!`);
    } catch (error) {
      console.error("Singularity | Could not auto-create Marksman talents:", error);
      ui.notifications.error(`Failed to create Marksman talents: ${error.message}`);
    }
  }, 6100);

  // Auto-create Gadgets in the gadgets compendium (Level 0 through Level 3)
  setTimeout(async () => {
    try {
      // First, check if gadgets compendium exists, if not, we'll need to create items in world
      let pack = game.packs.find(p => p.metadata.name === "gadgets" && p.metadata.packageName === "singularity");
      
      // If compendium doesn't exist, we'll create items in world (user can manually create compendium later)
      if (!pack) {
        console.log("Singularity | Gadgets compendium not found. Items will be created in world.");
        // For now, skip - user can create compendium manually
        return;
      }

      await pack.getIndex({ force: true });
      console.log("Singularity | Gadgets compendium index loaded, size:", pack.index.size);

      const wasLocked = pack.locked;
      if (wasLocked) {
        if (!game.user?.isGM) {
          return;
        }
        try {
          const packKey = pack.collection ?? `${pack.metadata.packageName}.${pack.metadata.name}`;
          const config = game.settings.get("core", "compendiumConfiguration") ?? {};
          const updated = foundry.utils.duplicate(config);
          updated[packKey] = { ...(updated[packKey] ?? {}), locked: false };
          await game.settings.set("core", "compendiumConfiguration", updated);
        } catch (unlockSettingError) {
          // Ignore - we'll still attempt to unlock via configure below.
        }
        try {
          await pack.configure({ locked: false });
          await new Promise(resolve => setTimeout(resolve, 200));
          const packKey = pack.collection ?? `${pack.metadata.packageName}.${pack.metadata.name}`;
          pack = game.packs.get(packKey) ?? pack;
        } catch (unlockError) {
          return;
        }
      }
      
      // Level 0 through Level 3 gadgets from handbook
      const gadgetNames = {
        level0: [
          "Liquid Foam Spray",
          "Magnetic Grapnel",
          "Micro-Missile Launcher",
          "Photon Projector",
          "Support Drone"
        ],
        level1: [
          "Remote Med-Siphon",
          "Sonic Grenade",
          "Trauma Stabilizer"
        ],
        level2: [
          "Electrostatic Web",
          "Holo-Decoy",
          "Shield Projector"
        ],
        level3: [
          "Adrenaline Injector",
          "Force Cannon",
          "Plasma Wall"
        ]
      };
      
      const allGadgetNames = [...gadgetNames.level0, ...gadgetNames.level1, ...gadgetNames.level2, ...gadgetNames.level3];
      
      // Check which gadgets exist
      const existingGadgets = [];
      const missingGadgets = [];
      for (const name of allGadgetNames) {
        const exists = pack.index.find(i => i.name === name);
        if (exists) {
          existingGadgets.push(name);
        } else {
          missingGadgets.push(name);
        }
      }
      
      console.log("Singularity | Existing gadgets:", existingGadgets.length, existingGadgets);
      console.log("Singularity | Missing gadgets:", missingGadgets.length, missingGadgets);
      
      if (missingGadgets.length === 0) {
        console.log("Singularity | All Level 0 through Level 3 gadgets already exist in compendium");
        // Still check and update icons even if all gadgets exist
        // Update existing gadgets that have the old cog.svg icon
        for (const gadgetIndex of pack.index) {
          if (allGadgetNames.includes(gadgetIndex.name)) {
            try {
              const gadgetDoc = await pack.getDocument(gadgetIndex._id);
              if (gadgetDoc && gadgetDoc.img === "icons/svg/cog.svg") {
                await gadgetDoc.update({ img: "icons/svg/item-bag.svg" });
                console.log(`Singularity | Updated ${gadgetIndex.name} icon from cog.svg to item-bag.svg`);
              }
            } catch (err) {
              console.error(`Singularity | Error updating ${gadgetIndex.name} icon:`, err);
            }
          }
        }
        if (wasLocked && !pack.locked) {
          await pack.configure({ locked: true });
        }
        return;
      }
      
      // Update existing gadgets that have the old cog.svg icon before creating new ones
      for (const gadgetIndex of pack.index) {
        if (allGadgetNames.includes(gadgetIndex.name)) {
          try {
            const gadgetDoc = await pack.getDocument(gadgetIndex._id);
            if (gadgetDoc && gadgetDoc.img === "icons/svg/cog.svg") {
              await gadgetDoc.update({ img: "icons/svg/item-bag.svg" });
              console.log(`Singularity | Updated ${gadgetIndex.name} icon from cog.svg to item-bag.svg`);
            }
          } catch (err) {
            console.error(`Singularity | Error updating ${gadgetIndex.name} icon:`, err);
          }
        }
      }

      // Level 0 through Level 3 gadgets from handbook (matching gadgets.html exactly)
      const gadgets = [
        // Level 0 gadgets (from handbook)
        {
          name: "Liquid Foam Spray",
          level: 0,
          description: `<h2>Description</h2>
<p>You unleash a pressurized canister of quick-hardening chemical foam that coats the ground or an enemy's limbs, making movement extremely difficult.</p>

<h2>Liquid Foam Spray</h2>
<p><strong>Type:</strong> Action<br>
<strong>Range:</strong> 15 feet<br>
<strong>Cost:</strong> 2 energy<br>
<strong>Hands:</strong> 1<br>
<strong>Duration:</strong> 10 minutes</p>

<h3>Effect</h3>
<p>You target a single 5-foot square. That square becomes difficult terrain for 10 minutes.</p>
<div class="alert alert-info mt-3">
  <strong>Note:</strong> You can have a number of targeted squares active at once equal to your <strong>Wits</strong> ability maximum.
</div>`
        },
        {
          name: "Magnetic Grapnel",
          level: 0,
          description: `<h2>Description</h2>
<p>You fire a high-tension, motorized cable with a multi-purpose magnetic tip that anchors to surfaces, allowing for rapid vertical or horizontal repositioning.</p>

<h2>Magnetic Grapnel</h2>
<p><strong>Type:</strong> Action<br>
<strong>Range:</strong> 30 feet<br>
<strong>Cost:</strong> 2 energy<br>
<strong>Hands:</strong> 1<br>
<strong>Duration:</strong> Instantaneous</p>

<h3>Effect</h3>
<p>Target a fixed point or a surface within range. You are immediately pulled to that location.</p>

<h3>Notes</h3>
<ul>
  <li>Because this movement is mechanical and sudden, it does not trigger the <strong>Tactical Withdrawal</strong> penalty, allowing you to move away from melee enemies at your full distance.</li>
</ul>`
        },
        {
          name: "Micro-Missile Launcher",
          level: 0,
          description: `<h2>Description</h2>
<p>A wrist-mounted or shoulder-slung tube that fires small, self-propelled projectiles. While small, the explosive force is enough to deter any foe.</p>

<h2>Micro-Missile Launcher</h2>
<p><strong>Type:</strong> Ranged Attack<br>
<strong>Range:</strong> 30 feet<br>
<strong>Cost:</strong> 2 energy<br>
<strong>Hands:</strong> 1<br>
<strong>Damage:</strong> 1d4 + Wits modifier Fire damage</p>

<h3>Effect</h3>
<p>You use your <strong>Gadget Tuning</strong> skill for the attack roll.</p>`
        },
        {
          name: "Photon Projector",
          level: 0,
          description: `<h2>Description</h2>
<p>You activate a compact, high-intensity LED device or launch a sticky "flare" bead that illuminates the surrounding area with steady, flicker-free light.</p>

<h2>Photon Projector</h2>
<p><strong>Type:</strong> Action<br>
<strong>Range:</strong> 30 feet<br>
<strong>Cost:</strong> 1 energy<br>
<strong>Hands:</strong> 1<br>
<strong>Duration:</strong> 1 hour</p>

<h3>Effect</h3>
<p>The projector emits bright light in a <strong>20-foot radius</strong> and dim light for an additional <strong>20 feet</strong>.</p>`
        },
        {
          name: "Support Drone",
          level: 0,
          description: `<h2>Description</h2>
<p>You deploy a micro-drone that hovers near an ally, providing real-time tactical overlays and sensor data to optimize their next move.</p>

<h2>Support Drone</h2>
<p><strong>Type:</strong> Action<br>
<strong>Range:</strong> 30 feet<br>
<strong>Cost:</strong> 1 energy<br>
<strong>Hands:</strong> 1<br>
<strong>Duration:</strong> Until the start of your next turn</p>

<h3>Effect</h3>
<p>The target gains a <strong>+1 bonus</strong> to one attack roll, saving throw, or skill check they attempt before the duration ends. The target chooses which roll to use the bonus on before rolling. If the target uses the bonus, the effect ends.</p>
<p>Once a creature has benefited from the Support Drone, they become <strong>temporarily immune</strong> to this gadget for 10 minutes.</p>`
        },
        // Level 1 gadgets (from handbook)
        {
          name: "Remote Med-Siphon",
          level: 1,
          description: `<h2>Description</h2>
<p>You fire a pressurized needle-dart or a concentrated stream of bio-regenerative chemicals from a distance, allowing you to treat wounded allies in the heat of gunfire without leaving cover.</p>

<h2>Remote Med-Siphon</h2>
<p><strong>Type:</strong> Action<br>
<strong>Range:</strong> 60 feet<br>
<strong>Cost:</strong> 2 energy<br>
<strong>Hands:</strong> 1<br>
<strong>Duration:</strong> Instantaneous</p>

<h3>Effect</h3>
<p>The target creature immediately regains <strong>2d6 + Gadget Tuning rank</strong> HP.</p>`
        },
        {
          name: "Sonic Grenade",
          level: 1,
          description: `<h2>Description</h2>
<p>You trigger a high-intensity discharge from a specialized canister or chest-plate, releasing a blinding magnesium flash and a disorienting 160-decibel sonic boom.</p>

<h2>Sonic Grenade</h2>
<p><strong>Type:</strong> Action<br>
<strong>Range:</strong> 10-foot burst (centered on you)<br>
<strong>Cost:</strong> 4 energy<br>
<strong>Hands:</strong> 0<br>
<strong>Duration:</strong> 1 round</p>

<h3>Effect</h3>
<p>All creatures other than you within the radius must make an <strong>Agility saving throw</strong> against your <strong>Gadget Tuning DC</strong>. The effect depends on their result:</p>
<ul>
  <li><strong>Extreme Success:</strong> The creature is unaffected.</li>
  <li><strong>Success:</strong> The creature is <strong>Dazed</strong> until the start of your next turn.</li>
  <li><strong>Failure:</strong> The creature is <strong>Staggered 1 and Dazed</strong> until the start of your next turn.</li>
  <li><strong>Extreme Failure:</strong> The creature is <strong>Staggered 2, Dazed, and Deafened</strong> until the start of your next turn.</li>
</ul>`
        },
        {
          name: "Trauma Stabilizer",
          level: 1,
          description: `<h2>Description</h2>
<p>A sophisticated medical gauntlet or handheld device that uses high-frequency sonic waves and concentrated stem-cell gel to instantly seal major wounds and restart vital systems.</p>

<h2>Trauma Stabilizer</h2>
<p><strong>Type:</strong> Action<br>
<strong>Range:</strong> Touch<br>
<strong>Cost:</strong> 2 energy<br>
<strong>Hands:</strong> 1<br>
<strong>Duration:</strong> Instantaneous</p>

<h3>Effect</h3>
<p>The target creature immediately regains <strong>2d8 + Gadget Tuning</strong> HP.</p>`
        },
        // Level 2 gadgets
        {
          name: "Electrostatic Web",
          level: 2,
          description: `<h2>Description</h2>
<p>You launch a canister that detonates mid-air, releasing conductive nanofilaments that form an electrified web, entangling and shocking enemies in a targeted area.</p>

<h2>Electrostatic Web</h2>
<p><strong>Type:</strong> Action<br>
<strong>Range:</strong> 30 feet<br>
<strong>Cost:</strong> 4 energy<br>
<strong>Hands:</strong> 1<br>
<strong>Duration:</strong> 1 minute (1 energy to maintain)</p>

<h3>Effect</h3>
<p>You target a <strong>15-foot burst</strong> within range. All creatures in the area must make an <strong>Agility saving throw</strong> against your <strong>Gadget Tuning DC</strong>. The effect depends on their result:</p>
<ul>
  <li><strong>Extreme Success:</strong> The creature is unaffected.</li>
  <li><strong>Success:</strong> The creature takes <strong>1d4 + Gadget Tuning rank Electricity damage</strong> and is <strong>Staggered 1</strong> for 1 round.</li>
  <li><strong>Failure:</strong> The creature takes <strong>2d4 + Gadget Tuning rank Electricity damage</strong> and is <strong>Immobilized</strong> for 1 round, then is <strong>Staggered 1</strong> for 1 minute. The creature can attempt an <strong>Agility check</strong> (DC = your Gadget Tuning DC) as an action on their turn to escape, ending the Immobilized effect on a success.</li>
  <li><strong>Extreme Failure:</strong> The creature takes <strong>3d4 + Gadget Tuning rank Electricity damage</strong> and is <strong>Immobilized</strong> for 1 minute. The creature can attempt an <strong>Agility check</strong> (DC = your Gadget Tuning DC) as an action on their turn to escape, ending the effect on a success.</li>
</ul>
<p>The affected area becomes <strong>difficult terrain</strong> while the web persists.</p>`
        },
        {
          name: "Holo-Decoy",
          level: 2,
          description: `<h2>Description</h2>
<p>You project a realistic holographic duplicate of yourself or an ally that moves autonomously, drawing enemy fire and creating tactical opportunities.</p>

<h2>Holo-Decoy</h2>
<p><strong>Type:</strong> Action<br>
<strong>Range:</strong> 30 feet<br>
<strong>Cost:</strong> 4 energy<br>
<strong>Hands:</strong> 1<br>
<strong>Duration:</strong> 1 minute</p>

<h3>Effect</h3>
<p>You create a holographic duplicate of yourself or a willing creature within range. The duplicate appears in an unoccupied space within range. The duplicate has the same appearance and size as the original, but creatures can attempt a <strong>Perception check</strong> (DC = your Gadget Tuning DC) to identify it as a hologram.</p>
<p>The duplicate can move up to your speed each round as a free action on your turn. Enemies must make a <strong>Wits saving throw</strong> against your <strong>Gadget Tuning DC</strong> before attacking the duplicate; on a failure, they must attack the duplicate instead of the real target. The duplicate disappears if it takes any damage or at the end of the duration.</p>`
        },
        {
          name: "Shield Projector",
          level: 2,
          description: `<h2>Description</h2>
<p>You deploy a hardlight generator or electromagnetic field emitter that creates a semi-transparent barrier, providing cover and deflecting incoming attacks for you or an ally.</p>

<h2>Shield Projector</h2>
<p><strong>Type:</strong> Action<br>
<strong>Range:</strong> 30 feet<br>
<strong>Cost:</strong> 4 energy<br>
<strong>Hands:</strong> 1<br>
<strong>Duration:</strong> 1 minute</p>

<h3>Effect</h3>
<p>You create a barrier in a 5-foot square within range. This barrier provides <strong>standard cover</strong> to any creature behind it. The barrier has <strong>15 + Gadget Tuning rank HP</strong> and blocks line of effect. It is destroyed when reduced to 0 HP.</p>
<p>As a reaction when an ally within 5 feet of the barrier would be hit by an attack, you can cause the barrier to intercept the attack, granting the ally a <strong>+2 bonus to AC</strong> against that attack. If the attack still hits, the barrier takes the damage instead.</p>`
        },
        // Level 3 gadgets
        {
          name: "Adrenaline Injector",
          level: 3,
          description: `<h2>Description</h2>
<p>You administer a precise cocktail of performance-enhancing nanites and synthetic adrenaline through a rapid-injection device, dramatically boosting an ally's combat effectiveness.</p>

<h2>Adrenaline Injector</h2>
<p><strong>Type:</strong> Action<br>
<strong>Range:</strong> Touch<br>
<strong>Cost:</strong> 4 energy<br>
<strong>Hands:</strong> 1<br>
<strong>Duration:</strong> 1 minute</p>

<h3>Effect</h3>
<p>You or a willing creature within range gains the following benefits:</p>
<ul>
  <li><strong>+1 bonus to attack rolls</strong></li>
  <li><strong>+10 feet to speed</strong></li>
  <li><strong>+1 bonus to saving throws</strong></li>
</ul>
<p>When the effect ends, the target's <strong>Fatigued</strong> value increases by 1.</p>`
        },
        {
          name: "Force Cannon",
          level: 3,
          description: `<h2>Description</h2>
<p>You fire a concentrated blast of repulsor energy from a shoulder-mounted or handheld cannon, dealing significant damage and potentially knocking targets off their feet.</p>

<h2>Force Cannon</h2>
<p><strong>Type:</strong> Ranged Attack<br>
<strong>Range:</strong> 60 feet<br>
<strong>Cost:</strong> 4 energy<br>
<strong>Hands:</strong> 1<br>
<strong>Damage:</strong> 3d6 + Wits modifier Force damage</p>

<h3>Effect</h3>
<p>You use your <strong>Gadget Tuning</strong> skill for the attack roll. On a hit, the target takes damage and must make an <strong>Endurance saving throw</strong> against your <strong>Gadget Tuning DC</strong>. The effect depends on their result:</p>
<ul>
  <li><strong>Extreme Success:</strong> The target is unaffected by the knockback effect.</li>
  <li><strong>Success:</strong> The target is pushed back 5 feet.</li>
  <li><strong>Failure:</strong> The target is knocked <strong>Prone</strong> and pushed back 10 feet.</li>
  <li><strong>Extreme Failure:</strong> The target is knocked <strong>Prone</strong>, pushed back 20 feet, and is <strong>Staggered 1</strong> for 1 round.</li>
</ul>`
        },
        {
          name: "Plasma Wall",
          level: 3,
          description: `<h2>Description</h2>
<p>You project a wall of superheated plasma between two points, creating both a defensive barrier and an offensive hazard that burns anything passing through.</p>

<h2>Plasma Wall</h2>
<p><strong>Type:</strong> Action<br>
<strong>Range:</strong> 60 feet<br>
<strong>Cost:</strong> 4 energy<br>
<strong>Hands:</strong> 1<br>
<strong>Duration:</strong> 1 minute (1 energy to maintain)</p>

<h3>Effect</h3>
<p>You create a straight wall of plasma up to 30 feet long and 10 feet high within range. The wall must be continuous and cannot pass through occupied spaces. The wall provides <strong>standard cover</strong> and blocks line of effect.</p>
<p>Any creature that enters the wall's space or starts their turn there takes <strong>2d6 + Gadget Tuning rank Fire damage</strong>. The wall has <strong>3 × Gadget Tuning DC</strong> HP. When reduced to 0 HP, the wall disappears.</p>`
        }
      ];

      const itemsToCreate = [];
      for (const gadgetData of gadgets) {
        const exists = pack.index.find(i => i.name === gadgetData.name);
        if (exists) {
          console.log(`Singularity | ${gadgetData.name} already exists, skipping`);
          continue;
        }
        itemsToCreate.push({
          name: gadgetData.name,
          type: "talent",
          system: {
            description: gadgetData.description,
            basic: {
              type: "gadget",
              level: gadgetData.level,
              prerequisites: ""
            },
            archived: false
          },
          img: "icons/svg/item-bag.svg"
        });
      }

      if (itemsToCreate.length === 0) {
        console.log("Singularity | All Level 0 through Level 3 gadgets already exist");
        return;
      }

      console.log(`Singularity | Creating ${itemsToCreate.length} gadgets...`);
      
      // Create items in world first, then import into compendium (compendium is unlocked)
      const createdItems = await Item.createDocuments(itemsToCreate, { render: false });
      console.log(`Singularity | Created ${createdItems.length} gadgets in world`);
      
      // Import into compendium
      let successCount = 0;
      for (const item of createdItems) {
        try {
          await pack.importDocument(item);
          await item.delete();
          successCount++;
          console.log(`Singularity | Imported ${item.name} into compendium`);
        } catch (importErr) {
          console.error(`Singularity | Error importing ${item.name}:`, importErr);
          try {
            await item.delete();
          } catch (cleanupErr) {
            console.error(`Singularity | Error cleaning up ${item.name}:`, cleanupErr);
          }
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      await pack.getIndex({ force: true });
      if (wasLocked && !pack.locked) {
        await pack.configure({ locked: true });
      }

      if (successCount > 0) {
        ui.notifications.info(`Created ${successCount} gadgets in Gadgets compendium!`);
      }
    } catch (error) {
      console.error("Singularity | Could not auto-create gadgets:", error);
      ui.notifications.error(`Failed to create gadgets: ${error.message}`);
    }
  }, 6500);

  // Auto-create Armor items in the armor compendium
  setTimeout(async () => {
    try {
      const pack = game.packs.find(p => p.metadata.name === "armor" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.log("Singularity | Armor compendium not found, skipping auto-creation");
        return;
      }

      // Check if armors already exist
      await pack.getIndex({ force: true });
      const existingArmors = [
        "Jacket",
        "Synthetic Leather",
        "Nanoweave Suit",
        "Combat Vest",
        "Riot Gear",
        "Enforcer Armor",
        "Plated Assault Armor"
      ];
      
      const allExist = existingArmors.every(name => pack.index.find(i => i.name === name));
      if (allExist) {
        console.log("Singularity | All armor items already exist in compendium");
        return;
      }

      const wasLocked = pack.locked;
      if (wasLocked) {
        try {
          await pack.configure({ locked: false });
          await new Promise(resolve => setTimeout(resolve, 200));
          // Verify the unlock actually worked
          if (pack.locked) {
            // Compendium is still locked, skip auto-creation silently
            console.log("Singularity | Armor compendium is locked, skipping auto-creation.");
            return;
          }
        } catch (unlockError) {
          // Could not unlock, skip auto-creation silently
          console.log("Singularity | Could not unlock armor compendium, skipping auto-creation.");
          return;
        }
      }

      // Define all armor items
      const armorItems = [
        {
          name: "Jacket",
          description: "This jacket appears to be ordinary outerwear, but hidden layers of reinforced fabric offer basic protection while allowing complete freedom of movement. It is commonly worn by civilians, scouts, and marksmen who rely on speed and awareness rather than bulky protection.",
          type: "light",
          baseAC: 11,
          agilityCap: null,
          mightRequirement: null,
          price: 2,
          traits: []
        },
        {
          name: "Synthetic Leather",
          description: "Tough, synthetic hide treated for ballistic resistance. Popular among bikers, wasteland wanderers, and mercenaries for its durability and rugged style, offering better protection than standard clothing without significant bulk.",
          type: "light",
          baseAC: 12,
          agilityCap: null,
          mightRequirement: null,
          price: 20,
          traits: []
        },
        {
          name: "Nanoweave Suit",
          description: "A form-fitting bodysuit woven from advanced nanofibers. The material is soft and flexible under normal conditions but hardens instantly upon impact, providing superior protection for elite operatives who cannot afford to be weighed down.",
          type: "light",
          baseAC: 13,
          agilityCap: null,
          mightRequirement: null,
          price: 100,
          traits: []
        },
        {
          name: "Combat Vest",
          description: "This combat vest combines reinforced plates with flexible materials to provide reliable protection while preserving mobility. It is standard issue for trained fighters and security forces who need a balance between defense and freedom of movement in combat.",
          type: "medium",
          baseAC: 14,
          agilityCap: 4,
          mightRequirement: 1,
          price: 6,
          traits: ["Noisy (3)"]
        },
        {
          name: "Riot Gear",
          description: "A set of rigid impact pads and a ballistic vest designed for crowd control and urban pacification. It offers excellent protection against blunt force and shrapnel, though the interlocking plates can be somewhat restrictive and loud during movement.",
          type: "medium",
          baseAC: 15,
          agilityCap: 3,
          mightRequirement: 2,
          price: 10,
          traits: ["Noisy (4)"]
        },
        {
          name: "Enforcer Armor",
          description: "Standard-issue protection for private security and riot control units. This armor consists of a heavy ballistic vest reinforced with ceramic plates and limb guards. It offers substantial protection for a reasonable cost, though it lacks the total coverage of military assault suits.",
          type: "heavy",
          baseAC: 16,
          agilityCap: 1,
          mightRequirement: 2,
          price: 20,
          traits: ["Noisy (4)"]
        },
        {
          name: "Plated Assault Armor",
          description: "This suit is built from thick composite plates and reinforced joints, designed to absorb extreme punishment in direct combat. It is worn by frontline troops who are trained to fight under its weight and structure, trading speed and finesse for overwhelming protection.",
          type: "heavy",
          baseAC: 18,
          agilityCap: 0,
          mightRequirement: 3,
          price: 40,
          traits: ["Noisy (6)"]
        }
      ];

      // Create all armor items
      const itemsToCreate = [];
      for (const armorData of armorItems) {
        // Check if it already exists
        const exists = pack.index.find(i => i.name === armorData.name);
        if (exists) {
          console.log(`Singularity | ${armorData.name} already exists, skipping`);
          continue;
        }

        const itemData = {
          name: armorData.name,
          type: "armor",
          system: {
            description: `<p>${armorData.description}</p>`,
            basic: {
              baseAC: armorData.baseAC,
              agilityCap: armorData.agilityCap,
              mightRequirement: armorData.mightRequirement,
              type: armorData.type,
              price: armorData.price,
              traits: armorData.traits
            }
          },
          img: "icons/svg/shield.svg"
        };
        itemsToCreate.push(itemData);
      }

      if (itemsToCreate.length === 0) {
        console.log("Singularity | All armor items already exist");
        if (wasLocked) {
          try {
            await pack.configure({ locked: true });
          } catch (lockError) {
            console.warn("Singularity | Could not re-lock armor compendium:", lockError);
          }
        }
        return;
      }

      console.log(`Singularity | Creating ${itemsToCreate.length} armor items...`);
      
      // Create items in world first
      const createdItems = await Item.createDocuments(itemsToCreate, { render: false });
      console.log(`Singularity | Created ${createdItems.length} armor items in world`);

      // Import into compendium
      for (const item of createdItems) {
        try {
          await pack.importDocument(item);
          await item.delete(); // Delete world item
          console.log(`Singularity | Imported ${item.name} into compendium`);
        } catch (err) {
          console.error(`Singularity | Error importing ${item.name}:`, err);
          // Clean up world item
          try {
            await item.delete();
          } catch (cleanupErr) {
            console.error(`Singularity | Error cleaning up ${item.name}:`, cleanupErr);
          }
        }
      }

      // Wait for imports to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh index
      await pack.getIndex({ force: true });
      
      if (wasLocked) {
        try {
          await pack.configure({ locked: true });
        } catch (lockError) {
          console.warn("Singularity | Could not re-lock armor compendium:", lockError);
          // Non-critical error, just log it
        }
      }
      
      ui.notifications.info(`Created ${itemsToCreate.length} armor items in Armor compendium!`);
    } catch (error) {
      console.error("Singularity | Could not auto-create armor items:", error);
      ui.notifications.error(`Failed to create armor items: ${error.message}`);
    }
  }, 6000);

  // Auto-create Weapon items in the weapons compendium
  setTimeout(async () => {
    try {
      const pack = game.packs.find(p => p.metadata.name === "weapons" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.log("Singularity | Weapons compendium not found, skipping auto-creation");
        return;
      }

      // Check if weapons already exist
      await pack.getIndex({ force: true });
      const existingWeapons = [
        "Battleaxe",
        "Combat Knife",
        "Greatsword",
        "Pistol",
        "Rifle",
        "Short Bow",
        "Shortsword",
        "Shotgun",
        "Sniper Rifle",
        "Unarmed Strike"
      ];
      
      const allExist = existingWeapons.every(name => pack.index.find(i => i.name === name));
      
      const wasLocked = pack.locked;
      if (wasLocked) {
        await pack.configure({ locked: false });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Update existing weapon item images if needed
      const weaponImageMap = {
        "Pistol": "systems/singularity/img/weapons/pistol.jpg",
        "Rifle": "systems/singularity/img/weapons/rifle.jpg",
        "Shotgun": "systems/singularity/img/weapons/shotgun.jpg",
        "Sniper Rifle": "systems/singularity/img/weapons/sniper_rifle.jpg",
        "Battleaxe": "systems/singularity/img/weapons/battleaxe.jpg",
        "Combat Knife": "systems/singularity/img/weapons/combat_knife.jpg",
        "Greatsword": "systems/singularity/img/weapons/greatsword.jpg",
        "Short Bow": "systems/singularity/img/weapons/shortbow.jpg",
        "Shortsword": "systems/singularity/img/weapons/shortsword.jpg",
        "Unarmed Strike": "systems/singularity/img/weapons/punch.jpg"
      };
      
      for (const [weaponName, imagePath] of Object.entries(weaponImageMap)) {
        const weaponIndex = pack.index.find(i => i.name === weaponName);
        if (weaponIndex) {
          try {
            const weaponDoc = await pack.getDocument(weaponIndex._id);
            if (weaponDoc && weaponDoc.img !== imagePath) {
              await weaponDoc.update({ img: imagePath });
              console.log(`Singularity | Updated ${weaponName} image to ${imagePath}`);
            }
          } catch (err) {
            console.error(`Singularity | Error updating ${weaponName} image:`, err);
          }
        }
      }
      
      // Update existing weapons to add categories if missing (run even if all weapons exist)
      console.log("Singularity | Checking existing weapons for category updates...");
      const weaponCategoryMap = {
        "Battleaxe": ["Heavy Melee Weapons", "Thrown Weapons"],
        "Combat Knife": ["Light Melee Weapons", "Thrown Weapons"],
        "Greatsword": ["Heavy Melee Weapons"],
        "Pistol": ["Ranged Weapons", "Firearms"],
        "Rifle": ["Ranged Weapons", "Firearms"],
        "Short Bow": ["Ranged Weapons", "Bows"],
        "Shortsword": ["Light Melee Weapons"],
        "Shotgun": ["Ranged Weapons", "Firearms"],
        "Sniper Rifle": ["Ranged Weapons", "Firearms"]
      };
      
      for (const weaponIndex of pack.index) {
        const expectedCategories = weaponCategoryMap[weaponIndex.name];
        if (expectedCategories) {
          try {
            const weaponDoc = await pack.getDocument(weaponIndex._id);
            if (weaponDoc) {
              const currentCategories = weaponDoc.system?.basic?.categories || [];
              // Check if categories are missing or different
              if (!currentCategories || currentCategories.length === 0 || 
                  JSON.stringify([...currentCategories].sort()) !== JSON.stringify([...expectedCategories].sort())) {
                await weaponDoc.update({
                  "system.basic.categories": expectedCategories
                });
                console.log(`Singularity | Updated ${weaponIndex.name} with categories: ${expectedCategories.join(", ")}`);
              }
            }
          } catch (err) {
            console.error(`Singularity | Error updating ${weaponIndex.name}:`, err);
          }
        }
      }
      
      if (allExist) {
        console.log("Singularity | All weapon items already exist in compendium");
        if (wasLocked) await pack.configure({ locked: true });
        return;
      }

      // Define all weapon items (excluding Unarmed Strike since it's auto-added)
      const weaponItems = [
        {
          name: "Battleaxe",
          description: "A heavy two-handed axe with a reinforced head, designed for hacking through armor and shields. It strikes a balance between speed and impact, allowing a warrior to deliver powerful chopping blows with reasonable energy efficiency.",
          type: "melee",
          price: 8,
          hands: 2,
          energyCost: 2,
          damage: "1d8 + Might modifier",
          damageType: "kinetic",
          range: null,
          traits: ["Heavy (2)", "Momentum (1)", "Thrown (Range 15 ft.)"],
          categories: ["Heavy Melee Weapons", "Thrown Weapons"] // Can be thrown
        },
        {
          name: "Combat Knife",
          description: "A short, razor-sharp blade designed mainly for close-quarters fighting and utility use. Lightweight and easy to maneuver, it allows quick, precise strikes while remaining suitable for general survival tasks.",
          type: "melee",
          price: 2,
          hands: 1,
          energyCost: 1,
          damage: "1d4 + Might modifier",
          damageType: "kinetic",
          range: null,
          traits: ["Concealable", "Finesse", "Thrown (Range 15 ft.)"],
          categories: ["Light Melee Weapons", "Thrown Weapons"] // Can be thrown
        },
        {
          name: "Greatsword",
          description: "A massive two‑handed blade built for devastating, sweeping strikes. The greatsword trades speed and efficiency for overwhelming force, capable of cleaving through armor and multiple foes when wielded with strength and discipline.",
          type: "melee",
          price: 10,
          hands: 2,
          energyCost: 3,
          damage: "1d12 + Might modifier",
          damageType: "kinetic",
          range: null,
          traits: ["Heavy (3)"],
          categories: ["Heavy Melee Weapons"]
        },
        {
          name: "Pistol",
          description: "A compact, semi-automatic firearm designed for quick, accurate shots at short to medium range. Its light weight and ease of use make it ideal for self-defense, stealth operations, and backup combat situations.",
          type: "ranged",
          price: 3,
          hands: 1,
          energyCost: 1,
          damage: "1d4 + Agility modifier",
          damageType: "kinetic",
          range: "20 feet",
          traits: ["Concealable", "Reload (Cost: 1 energy, 4 shot)"],
          categories: ["Ranged Weapons", "Firearms"] // Both for Marksman and Weapon Training
        },
        {
          name: "Rifle",
          description: "A long-barreled firearm built for accuracy and stopping power at medium to long range. Rifles favor controlled, deliberate shots over speed, rewarding steady aim and battlefield positioning.",
          type: "ranged",
          price: 6,
          hands: 2,
          energyCost: 2,
          damage: "1d6 + Agility modifier",
          damageType: "kinetic",
          range: "60 feet",
          traits: ["Reload (Cost: 2 energy, 4 shots)"],
          categories: ["Ranged Weapons", "Firearms"] // Both for Marksman and Weapon Training
        },
        {
          name: "Short Bow",
          description: "A lightweight bow designed for mobility and rapid firing at short to medium ranges. It allows for quick, precise shots while keeping the user agile, but requires practice to use effectively in sustained combat.",
          type: "ranged",
          price: 5,
          hands: 2,
          energyCost: 2,
          damage: "1d6 + Agility modifier",
          damageType: "kinetic",
          range: "30 feet",
          traits: [],
          categories: ["Ranged Weapons", "Bows"] // Both for Marksman and Weapon Training
        },
        {
          name: "Shortsword",
          description: "A well-balanced steel blade designed for open combat rather than concealment. Longer reach and greater cutting power make it effective in duels and battlefield engagements, favoring strength and control over speed or subtlety.",
          type: "melee",
          price: 6,
          hands: 1,
          energyCost: 2,
          damage: "1d6 + Might modifier",
          damageType: "kinetic",
          range: null,
          traits: ["Finesse"],
          categories: ["Light Melee Weapons"]
        },
        {
          name: "Shotgun",
          description: "A powerful close-range firearm that fires a spread of pellets or a heavy slug. It is devastating in tight corridors and urban environments but loses effectiveness rapidly over distance.",
          type: "ranged",
          price: 12,
          hands: 2,
          energyCost: 2,
          damage: "1d10 + Agility modifier",
          damageType: "kinetic",
          range: "15 feet",
          traits: ["Reload (Cost: 1 energy, 2 shots)"],
          categories: ["Ranged Weapons", "Firearms"] // Both for Marksman and Weapon Training
        },
        {
          name: "Sniper Rifle",
          description: "A high-caliber precision rifle equipped with advanced optics. Designed for extreme range engagements, it is heavy and unwieldy, requiring significant energy to aim and fire effectively.",
          type: "ranged",
          price: 100,
          hands: 2,
          energyCost: 3,
          damage: "1d10 + Agility modifier",
          damageType: "kinetic",
          range: "150 feet",
          traits: ["Heavy (2)", "Reload (Cost: 1 energy, 1 shot)", "Setup (4)"],
          categories: ["Ranged Weapons", "Firearms"] // Both for Marksman and Weapon Training
        }
      ];

      // Create all weapon items
      const itemsToCreate = [];
      for (const weaponData of weaponItems) {
        // Check if it already exists
        const exists = pack.index.find(i => i.name === weaponData.name);
        if (exists) {
          console.log(`Singularity | ${weaponData.name} already exists, skipping`);
          continue;
        }

        // Determine image path - use custom images for weapons if available
        const weaponImageMap = {
          "Pistol": "systems/singularity/img/weapons/pistol.jpg",
          "Rifle": "systems/singularity/img/weapons/rifle.jpg",
          "Shotgun": "systems/singularity/img/weapons/shotgun.jpg",
          "Sniper Rifle": "systems/singularity/img/weapons/sniper_rifle.jpg",
          "Battleaxe": "systems/singularity/img/weapons/battleaxe.jpg",
          "Combat Knife": "systems/singularity/img/weapons/combat_knife.jpg",
          "Greatsword": "systems/singularity/img/weapons/greatsword.jpg",
          "Short Bow": "systems/singularity/img/weapons/shortbow.jpg",
          "Shortsword": "systems/singularity/img/weapons/shortsword.jpg",
          "Unarmed Strike": "systems/singularity/img/weapons/punch.jpg"
        };
        
        let imgPath = weaponImageMap[weaponData.name];
        if (!imgPath) {
          // Default to icon if no custom image
          imgPath = weaponData.type === "melee" ? "icons/svg/sword.svg" : "icons/svg/target.svg";
        }
        
        const itemData = {
          name: weaponData.name,
          type: "weapon",
          system: {
            description: `<p>${weaponData.description}</p>`,
            basic: {
              attackBonus: 0,
              damage: weaponData.damage,
              damageType: weaponData.damageType,
              range: weaponData.range || "",
              properties: weaponData.traits,
              type: weaponData.type, // "melee" or "ranged" for Marksman compatibility
              price: weaponData.price,
              hands: weaponData.hands,
              energyCost: weaponData.energyCost,
              equipped: false,
              categories: weaponData.categories || [] // Weapon categories for competence matching
            }
          },
          img: imgPath
        };
        itemsToCreate.push(itemData);
      }

      if (itemsToCreate.length === 0) {
        console.log("Singularity | All weapon items already exist");
        if (wasLocked) await pack.configure({ locked: true });
        return;
      }

      console.log(`Singularity | Creating ${itemsToCreate.length} weapon items...`);
      
      // Create items in world first
      const createdItems = await Item.createDocuments(itemsToCreate, { render: false });
      console.log(`Singularity | Created ${createdItems.length} weapon items in world`);

      // Import into compendium
      for (const item of createdItems) {
        try {
          await pack.importDocument(item);
          await item.delete(); // Delete world item
          console.log(`Singularity | Imported ${item.name} into compendium`);
        } catch (err) {
          console.error(`Singularity | Error importing ${item.name}:`, err);
          // Clean up world item
          try {
            await item.delete();
          } catch (cleanupErr) {
            console.error(`Singularity | Error cleaning up ${item.name}:`, cleanupErr);
          }
        }
      }

      // Wait for imports to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh index
      await pack.getIndex({ force: true });
      
      if (wasLocked) await pack.configure({ locked: true });

      ui.notifications.info(`Created ${itemsToCreate.length} weapon items in Weapons compendium!`);
    } catch (error) {
      console.error("Singularity | Could not auto-create weapon items:", error);
      ui.notifications.error(`Failed to create weapon items: ${error.message}`);
    }
  }, 6500);

  // Auto-create NPC actors in the enemies compendium
  setTimeout(async () => {
    try {
      const pack = game.packs.find(p => p.metadata.name === "enemies" && p.metadata.packageName === "singularity");
      if (!pack) {
        console.log("Singularity | Enemies compendium not found, skipping auto-creation");
        return;
      }

      // Check if NPCs already exist
      await pack.getIndex({ force: true });
      const existingNPCs = [
        "Small Gun Drone",
        "Small Blade Drone",
        "Thug",
        "Soldier",
        "Cyber-Enhanced Enforcer"
      ];
      
      console.log("Singularity | Checking NPC compendium for updates...");
      
      const wasLocked = pack.locked;
      if (wasLocked) {
        console.log("Singularity | Unlocking NPC compendium for updates...");
        await pack.configure({ locked: false });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // NPC data from HTML files
      const npcData = [
        {
          name: "Small Gun Drone",
          img: "systems/singularity/img/npcs/small_gun_drone.jpg",
          challengeRating: "1/2",
          size: "Small",
          description: "Small gun drones are lightweight aerial combat units armed with integrated ranged weapons. These automated machines hover above the battlefield, providing suppressive fire and engaging targets from a distance. While individually fragile, they excel at maintaining distance from melee combatants and can coordinate with other drones to create overlapping fields of fire. Their non-living nature makes them immune to many forms of mental and life-draining attacks that would affect organic creatures.",
          abilities: { might: 0, agility: 2, endurance: 0, wits: 0, charm: 0 },
          combat: { hp: { value: 6, max: 6 }, ac: 13, speed: 20 },
          specialAbilities: [],
          traits: ["Electrical", "Non-living"],
          resistances: [],
          weaknesses: [{ type: "Lightning", value: 3 }],
          immunities: [{ type: "Necrotic" }, { type: "Psychic" }, { type: "Radiant" }],
          skills: {},
          weapons: [{ name: "Integrated Light Gun", attackBonus: 0, damage: "1d4 + 2", damageType: "kinetic", range: "20 ft." }],
          armor: [{ name: "Natural Armor", acBonus: 11, type: "natural" }],
          equipment: []
        },
        {
          name: "Small Blade Drone",
          img: "systems/singularity/img/npcs/small_blade_drone.jpg",
          challengeRating: "1/2",
          size: "Small",
          description: "Small blade drones are compact, autonomous robotic units equipped with retractable melee weapons designed for close-quarters combat. These nimble machines use flight capabilities to maneuver quickly around the battlefield, harrying enemies with swift strikes. Despite their small size and limited durability, they excel at swarming tactics and can be deployed in large numbers to overwhelm opponents through coordinated attacks from multiple angles.",
          abilities: { might: 1, agility: 2, endurance: 0, wits: 0, charm: 0 },
          combat: { hp: { value: 6, max: 6 }, ac: 13, speed: 30 },
          specialAbilities: [],
          traits: ["Electrical", "Non-living"],
          resistances: [],
          weaknesses: [{ type: "Lightning", value: 3 }],
          immunities: [{ type: "Necrotic" }, { type: "Psychic" }, { type: "Radiant" }],
          skills: {},
          weapons: [{ name: "Retractable Blade", attackBonus: 0, damage: "1d4 + 1", damageType: "kinetic", range: "Melee" }],
          armor: [{ name: "Natural Armor", acBonus: 11, type: "natural" }],
          equipment: []
        },
        {
          name: "Thug",
          img: "systems/singularity/img/npcs/thug.jpg",
          challengeRating: "1/2",
          size: "Medium",
          description: "Thugs are opportunistic street criminals and low-level enforcers who rely on intimidation and crude weapons. Typically unskilled and poorly equipped, they serve as common threats in urban environments, working alone or in small groups for crime bosses or petty gangs. While not particularly dangerous individually, they can overwhelm heroes through numbers and sheer aggression.",
          abilities: { might: 1, agility: 1, endurance: 0, wits: 0, charm: 0 },
          combat: { hp: { value: 8, max: 8 }, ac: 12, speed: 25 },
          specialAbilities: [{ name: "Trained with Light Armor", description: "The thug suffers no penalties while wearing light armor." }],
          traits: ["Living"],
          resistances: [],
          weaknesses: [],
          immunities: [],
          skills: { "Intimidation": { rank: "Apprentice", ability: "charm" } },
          weapons: [{ name: "Combat Knife", attackBonus: 0, damage: "1d4 + 1", damageType: "kinetic", range: "Melee" }],
          armor: [{ name: "Jacket", acBonus: 11, type: "light" }],
          equipment: []
        },
        {
          name: "Soldier",
          img: "systems/singularity/img/npcs/soldier.jpg",
          challengeRating: "1",
          size: "Medium",
          description: "Soldiers are trained military personnel or professional mercenaries with proper combat training and equipment. They represent a significant threat, capable of coordinated tactics and effective use of firearms and armor. Often serving as guards, military units, or elite security forces, these combatants have experience in real combat situations and know how to work together to achieve tactical objectives.",
          abilities: { might: 2, agility: 3, endurance: 2, wits: 0, charm: 0 },
          combat: { hp: { value: 15, max: 15 }, ac: 17, speed: 25 },
          specialAbilities: [{ name: "Trained with Medium Armor", description: "The soldier suffers no penalties while wearing medium armor." }],
          traits: ["Living"],
          resistances: [],
          weaknesses: [],
          immunities: [],
          skills: { 
            "Rifle": { rank: "Apprentice", ability: "agility" },
            "Unarmed Attacks": { rank: "Apprentice", ability: "might" },
            "Might Saves": { rank: "Apprentice", ability: "might" }
          },
          weapons: [{ name: "Rifle", attackBonus: 4, damage: "1d6 + 3", damageType: "kinetic", range: "60 ft." }],
          armor: [{ name: "Combat Vest", acBonus: 14, type: "medium" }],
          equipment: []
        },
        {
          name: "Cyber-Enhanced Enforcer",
          img: "systems/singularity/img/npcs/cyber_enhanced_enforcer.jpg",
          challengeRating: "5",
          size: "Medium",
          description: "Cyber-enhanced enforcers are elite combat units augmented with extensive cybernetic implants and enhancements. These warriors represent the pinnacle of military augmentation technology, combining peak physical conditioning with advanced technological modifications. Wielding heavy weapons and clad in full assault armor, they serve as the backbone of elite security forces, corporate armies, or specialized military units. Their cybernetic enhancements grant them superior resilience and combat effectiveness, making them formidable opponents on the battlefield.",
          abilities: { might: 3, agility: 2, endurance: 3, wits: 1, charm: 0 },
          combat: { hp: { value: 45, max: 45 }, ac: 18, speed: 25 },
          specialAbilities: [
            { name: "Trained with Heavy Armor", description: "The enforcer suffers no penalties while wearing heavy armor." },
            { name: "Cyber-Enhanced Endurance", description: "The enforcer's cybernetic implants grant additional resilience. They gain advantage on Endurance saves against exhaustion and fatigue effects." }
          ],
          traits: ["Electrical", "Living"],
          resistances: [],
          weaknesses: [{ type: "Lightning", value: 3 }],
          immunities: [],
          skills: { 
            "Heavy Melee Weapons": { rank: "Competent", ability: "might" },
            "Unarmed Attacks": { rank: "Competent", ability: "might" },
            "Endurance Saves": { rank: "Competent", ability: "endurance" }
          },
          weapons: [{ name: "Greatsword", attackBonus: 8, damage: "1d12 + 3", damageType: "photonic", range: "Melee" }],
          armor: [{ name: "Plated Assault Armor", acBonus: 18, type: "heavy" }],
          equipment: []
        }
      ];

      // Update existing NPCs that have incorrect size or image paths
      await pack.getIndex({ force: true }); // Refresh index
      console.log("Singularity | Starting NPC size and image update check...");
      console.log(`Singularity | Pack index has ${pack.index.size} entries`);
      
      for (const npc of npcData) {
        console.log(`Singularity | Looking for: "${npc.name}"`);
        const exists = pack.index.find(i => i.name === npc.name);
        console.log(`Singularity | Found in index: ${exists ? "YES" : "NO"}`, exists ? `(ID: ${exists._id})` : "");
        
        if (exists) {
          console.log(`Singularity | Checking ${npc.name}...`);
          try {
            const existingActor = await pack.getDocument(exists._id);
            console.log(`Singularity | Retrieved actor: ${existingActor.name}`);
            const correctSize = npc.size || "Medium";
            const correctImg = npc.img || "icons/svg/skull.svg";
            
            // Ensure basic exists
            if (!existingActor.system.basic) {
              console.log(`Singularity | Creating basic object for ${npc.name}`);
              existingActor.system.basic = {};
            }
            
            const currentSize = existingActor.system.basic.size || "Medium";
            const currentImg = existingActor.img || "";
            const currentTokenImg = existingActor.prototypeToken?.texture?.src || "";
            console.log(`Singularity | ${npc.name} - Current size: "${currentSize}", Should be: "${correctSize}"`);
            console.log(`Singularity | ${npc.name} - Current img: "${currentImg}", Should be: "${correctImg}"`);
            console.log(`Singularity | ${npc.name} - Current token img: "${currentTokenImg}", Should be: "${correctImg}"`);
            
            const updates = {};
            let needsUpdate = false;
            
            if (currentSize !== correctSize) {
              updates["system.basic.size"] = correctSize;
              needsUpdate = true;
              console.log(`Singularity | Will update ${npc.name} size from "${currentSize}" to "${correctSize}"`);
            }
            
            if (currentImg !== correctImg) {
              updates["img"] = correctImg;
              needsUpdate = true;
              console.log(`Singularity | Will update ${npc.name} image from "${currentImg}" to "${correctImg}"`);
            }
            
            // Update token image to match portrait if it's different (or if it's the default skull)
            if (currentTokenImg !== correctImg && (currentTokenImg === "" || currentTokenImg === "icons/svg/skull.svg" || currentTokenImg === currentImg)) {
              updates["prototypeToken.texture.src"] = correctImg;
              needsUpdate = true;
              console.log(`Singularity | Will update ${npc.name} token image from "${currentTokenImg}" to "${correctImg}"`);
            }
            
            // Update token size based on NPC size
            const sizeToGrid = {
              "Infinitesimal": 0.5,
              "Microscopic": 0.5,
              "Minuscule": 0.5,
              "Tiny": 0.5,
              "Small": 0.5,
              "Medium": 1,
              "Large": 2,
              "Huge": 3,
              "Enormous": 4,
              "Titanic": 5,
              "Behemoth": 6
            };
            
            const correctGridSize = sizeToGrid[correctSize] || 1;
            const currentTokenWidth = existingActor.prototypeToken?.width || 1;
            const currentTokenHeight = existingActor.prototypeToken?.height || 1;
            
            if (currentTokenWidth !== correctGridSize || currentTokenHeight !== correctGridSize) {
              updates["prototypeToken.width"] = correctGridSize;
              updates["prototypeToken.height"] = correctGridSize;
              needsUpdate = true;
              console.log(`Singularity | Will update ${npc.name} token size from ${currentTokenWidth}x${currentTokenHeight} to ${correctGridSize}x${correctGridSize}`);
            }
            
            if (needsUpdate) {
              await existingActor.update(updates);
              console.log(`Singularity | Update call completed for ${npc.name}`);
              
              // Wait a moment for the update to persist
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Verify the update worked
              await pack.getIndex({ force: true }); // Refresh index
              const updatedActor = await pack.getDocument(exists._id);
              const verifiedSize = updatedActor.system.basic?.size || "Medium";
              const verifiedImg = updatedActor.img || "";
              console.log(`Singularity | ✓ Updated ${npc.name} size to "${verifiedSize}" and image to "${verifiedImg}"`);
              
              if (verifiedSize !== correctSize || verifiedImg !== correctImg) {
                console.warn(`Singularity | ⚠ Warning: Update may not have persisted!`);
              }
            } else {
              console.log(`Singularity | ${npc.name} already has correct size and image`);
            }
          } catch (err) {
            console.error(`Singularity | ✗ Error updating ${npc.name}:`, err);
            console.error(`Singularity | Error stack:`, err.stack);
          }
        } else {
          console.log(`Singularity | ${npc.name} not found in compendium, will be created`);
        }
      }
      
      console.log("Singularity | Finished NPC size and image update check");

      // Check if all NPCs exist (after potential updates)
      const allExist = existingNPCs.every(name => pack.index.find(i => i.name === name));
      if (allExist) {
        console.log("Singularity | All NPC actors already exist in compendium (and updated if needed)");
        if (wasLocked) await pack.configure({ locked: true });
        return;
      }

      // Create NPC actors
      const actorsToCreate = [];
      for (const npc of npcData) {
        // Check if it already exists
        const exists = pack.index.find(i => i.name === npc.name);
        if (exists) {
          console.log(`Singularity | ${npc.name} already exists, skipping creation`);
          continue;
        }

        const actorImg = npc.img || "icons/svg/skull.svg";
        const npcSize = npc.size || "Medium";
        
        // Size to grid space mapping
        const sizeToGrid = {
          "Infinitesimal": 0.5,
          "Microscopic": 0.5,
          "Minuscule": 0.5,
          "Tiny": 0.5,
          "Small": 0.5,
          "Medium": 1,
          "Large": 2,
          "Huge": 3,
          "Enormous": 4,
          "Titanic": 5,
          "Behemoth": 6
        };
        
        const gridSize = sizeToGrid[npcSize] || 1;
        
        const actorData = {
          name: npc.name,
          type: "npc",
          system: {
            basic: {
              challengeRating: npc.challengeRating,
              name: npc.name,
              size: npcSize
            },
            abilities: npc.abilities,
            combat: npc.combat,
            specialAbilities: npc.specialAbilities,
            traits: npc.traits,
            resistances: npc.resistances,
            weaknesses: npc.weaknesses,
            immunities: npc.immunities,
            skills: npc.skills,
            notes: `<p>${npc.description}</p>`
          },
          img: actorImg,
          prototypeToken: {
            texture: {
              src: actorImg
            },
            width: gridSize,
            height: gridSize
          }
        };

        actorsToCreate.push({ actorData, items: npc.weapons.concat(npc.armor).concat(npc.equipment) });
      }

      if (actorsToCreate.length === 0) {
        console.log("Singularity | All NPC actors already exist");
        if (wasLocked) await pack.configure({ locked: true });
        return;
      }

      console.log(`Singularity | Creating ${actorsToCreate.length} NPC actors...`);

      // Create actors and items
      for (const { actorData, items } of actorsToCreate) {
        try {
          // Create actor in world first
          const actor = await Actor.create(actorData, { render: false });
          console.log(`Singularity | Created ${actor.name} in world`);

          // Create items for this actor
          for (const itemData of items) {
            let itemType = "weapon";
            let itemSystem = {
              description: "",
              basic: {
                attackBonus: itemData.attackBonus || 0,
                damage: itemData.damage || "",
                damageType: itemData.damageType || "kinetic",
                range: itemData.range || "",
                properties: []
              }
            };

            if (itemData.acBonus !== undefined) {
              itemType = "armor";
              itemSystem.basic = {
                baseAC: itemData.acBonus,
                agilityCap: null,
                mightRequirement: null,
                type: itemData.type || "light",
                price: 0,
                traits: [],
                description: "",
                equipped: false
              };
            }

            const item = await Item.create({
              name: itemData.name,
              type: itemType,
              system: itemSystem
            }, { parent: actor, render: false });

            console.log(`Singularity | Created ${item.name} for ${actor.name}`);
          }

          // Import actor into compendium (items will be imported with it)
          await pack.importDocument(actor);
          await actor.delete(); // Delete world actor
          console.log(`Singularity | Imported ${actorData.name} into compendium`);
        } catch (err) {
          console.error(`Singularity | Error creating ${actorData.name}:`, err);
        }
      }

      // Wait for imports to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh index
      await pack.getIndex({ force: true });
      
      if (wasLocked) await pack.configure({ locked: true });

      ui.notifications.info(`Created ${actorsToCreate.length} NPC actors in Enemies compendium!`);
    } catch (error) {
      console.error("Singularity | Could not auto-create NPC actors:", error);
      ui.notifications.error(`Failed to create NPC actors: ${error.message}`);
    }
  }, 7000);
});

// NPC Browser Button for Actors Directory
Hooks.on("renderSidebarTab", (app, html, data) => {
  // Only add to Actors directory
  if (app.tabName !== "actors" && app.tabName !== "Actor" && app.id !== "actors") {
    return;
  }
  
  // Use setTimeout to ensure DOM is fully rendered
  setTimeout(() => {
    const $html = $(html);
    
    // Check if button already exists
    if ($html.find(".singularity-npc-browser-btn").length > 0) {
      return;
    }

    // Create button in the header actions area
    const buttonHtml = `<button type="button" class="singularity-npc-browser-btn" title="Open NPC Browser">
      <i class="fas fa-book"></i> NPC Browser
    </button>`;
    
    // Try to find header actions area
    const headerActions = $html.find(".header-actions, .action-buttons");
    if (headerActions.length) {
      headerActions.append(buttonHtml);
    } else {
      // Fallback: add to top of directory
      $html.prepend(`<div class="action-buttons">${buttonHtml}</div>`);
    }
    
    // Attach click handler
    $html.find(".singularity-npc-browser-btn").on("click", function(event) {
      event.preventDefault();
      openNpcBrowserDialog();
    });
  }, 100);
});

// Also try adding button directly to sidebar as a fallback
Hooks.on("ready", () => {
  // Wait a bit for sidebar to be ready
  setTimeout(() => {
    addNpcBrowserButton();
    
    // Watch for when actors tab becomes active
    const observer = new MutationObserver(() => {
      const actorsTab = document.querySelector("#actors");
      if (actorsTab && !actorsTab.querySelector(".singularity-npc-browser-btn")) {
        addNpcBrowserButton();
      }
    });
    
    observer.observe(document.querySelector("#sidebar") || document.body, {
      childList: true,
      subtree: true
    });
  }, 2000);
});

// Function to add NPC browser button to sidebar
function addNpcBrowserButton() {
  const actorsTab = document.querySelector("#actors");
  if (!actorsTab) {
    return;
  }
  
  // Check if button already exists
  if (actorsTab.querySelector(".singularity-npc-browser-btn")) {
    return;
  }
  
  // Create button HTML
  const buttonHtml = `<button type="button" class="singularity-npc-browser-btn" title="Open NPC Browser">
    <i class="fas fa-book"></i> NPC Browser
  </button>`;
  
  // Try to find header actions area
  const headerActions = actorsTab.querySelector(".header-actions, .action-buttons");
  if (headerActions) {
    headerActions.insertAdjacentHTML("beforeend", buttonHtml);
    const button = actorsTab.querySelector(".singularity-npc-browser-btn");
    if (button) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        openNpcBrowserDialog();
      });
    }
  }
}

// Open NPC Browser Dialog
async function openNpcBrowserDialog() {
  const content = await foundry.applications.handlebars.renderTemplate("systems/singularity/templates/dialogs/npc-browser.html", {});
  
  const dialog = new Dialog({
    title: "NPC Browser",
    content: content,
    buttons: {
      close: {
        icon: '<i class="fas fa-times"></i>',
        label: "Close",
        callback: () => {}
      }
    },
    default: "close",
    width: 800,
    height: 600
  });
  
  dialog.render(true);
  
  // Wait for dialog to render, then load NPCs
  setTimeout(() => {
    const dialogHtml = dialog.element;
    attachNpcBrowserHandlers($(dialogHtml));
    loadNpcBrowser($(dialogHtml));
  }, 100);
}

// Attach event handlers for NPC browser
function attachNpcBrowserHandlers(html) {
  // Remove existing handlers to avoid duplicates
  html.find(".npc-refresh").off("click");
  html.find(".npc-cr-filter").off("change");
  html.find(".npc-search").off("input");
  html.find(".npc-browser-item").off("click");

  // Refresh button
  html.find(".npc-refresh").on("click", async function(event) {
    event.preventDefault();
    const button = $(this);
    button.addClass("fa-spin");
    await loadNpcBrowser(html);
    button.removeClass("fa-spin");
  });

  // CR filter
  html.find(".npc-cr-filter").on("change", function(event) {
    const filterCr = $(this).val() || "";
    const searchText = html.find(".npc-search").val() || "";
    
    const pack = game.packs.find(p => p.metadata.name === "enemies" && p.metadata.packageName === "singularity");
    if (!pack) return;

    const npcs = Array.from(pack.index.values());
    renderNpcBrowser(html, npcs, filterCr, searchText);
  });

  // Search
  html.find(".npc-search").on("input", function(event) {
    const searchText = $(this).val() || "";
    const filterCr = html.find(".npc-cr-filter").val() || "";
    
    const pack = game.packs.find(p => p.metadata.name === "enemies" && p.metadata.packageName === "singularity");
    if (!pack) return;

    const npcs = Array.from(pack.index.values());
    renderNpcBrowser(html, npcs, filterCr, searchText);
  });

  // Click to import - use delegated event handler
  html.off("click", ".npc-browser-item");
  html.on("click", ".npc-browser-item", async function(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const item = $(this);
    const uuid = item.data("uuid");
    const npcId = item.data("npc-id");
    
    if (!uuid && !npcId) {
      ui.notifications.error("Could not find NPC ID.");
      return;
    }

    try {
      let actor;
      
      // Try to get actor from UUID first
      if (uuid) {
        actor = await fromUuid(uuid);
      }
      
      // If that didn't work, try getting from compendium directly
      if (!actor && npcId) {
        const pack = game.packs.find(p => p.metadata.name === "enemies" && p.metadata.packageName === "singularity");
        if (pack) {
          actor = await pack.getDocument(npcId);
        }
      }
      
      if (!actor) {
        ui.notifications.error("Could not find NPC in compendium.");
        return;
      }

      // Check if this is a compendium actor
      if (actor.pack || actor.compendium) {
        // This is a compendium actor - import it into the world
        // Get the full actor data
        const actorData = actor.toObject();
        // Remove the _id and other compendium-specific properties so Foundry creates a new one
        delete actorData._id;
        delete actorData.folder;
        
        // Create the actor in the world
        const importedActors = await Actor.createDocuments([actorData]);
        if (importedActors && importedActors.length > 0) {
          const importedActor = importedActors[0];
          ui.notifications.info(`Imported ${importedActor.name} from compendium.`);
          
          // Open the imported actor's sheet (it's now in the world and editable)
          importedActor.sheet.render(true);
        } else {
          ui.notifications.error("Failed to import NPC into the world.");
        }
      } else {
        // Actor is already in the world, just open its sheet
        actor.sheet.render(true);
      }
    } catch (error) {
      console.error("Singularity | Error importing NPC:", error);
      ui.notifications.error(`Failed to import NPC: ${error.message}`);
    }
  });
}

// NPC Browser functionality
async function loadNpcBrowser(html) {
  const browserList = html.find(".npc-browser-list");
  browserList.html('<p class="npc-browser-loading">Loading NPCs from compendium...</p>');

  try {
    const pack = game.packs.find(p => p.metadata.name === "enemies" && p.metadata.packageName === "singularity");
    if (!pack) {
      browserList.html('<p class="npc-browser-error">Enemies compendium not found.</p>');
      return;
    }

    await pack.getIndex({ force: true });
    const npcs = Array.from(pack.index.values());
    const filterCr = html.find(".npc-cr-filter").val() || "";
    const searchText = html.find(".npc-search").val() || "";
    renderNpcBrowser(html, npcs, filterCr, searchText);
  } catch (error) {
    console.error("Singularity | Error loading NPC browser:", error);
    browserList.html('<p class="npc-browser-error">Error loading NPCs from compendium.</p>');
  }
}

function renderNpcBrowser(html, npcs, filterCr = "", searchText = "") {
  const browserList = html.find(".npc-browser-list");
  
  // Filter NPCs by search text
  let filtered = npcs;
  
  if (searchText) {
    const search = searchText.toLowerCase();
    filtered = filtered.filter(npc => 
      npc.name.toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    browserList.html('<p class="npc-browser-empty">No NPCs found matching your filters.</p>');
    return;
  }

  // Sort by name
  filtered.sort((a, b) => a.name.localeCompare(b.name));

  // Create list HTML - we'll load CR asynchronously
  const listHtml = filtered.map(npc => {
    return `
      <div class="npc-browser-item" data-uuid="${npc.uuid}" data-npc-id="${npc._id}" title="Click to import ${npc.name}">
        <div class="npc-browser-item-name">${npc.name}</div>
        <div class="npc-browser-item-cr">CR: Loading...</div>
      </div>
    `;
  }).join("");

  browserList.html(listHtml);

  // Load CRs asynchronously and apply filter
  loadNpcCrs(html, filtered, filterCr);
}

async function loadNpcCrs(html, npcs, filterCr = "") {
  const pack = game.packs.find(p => p.metadata.name === "enemies" && p.metadata.packageName === "singularity");
  if (!pack) return;

  const browserList = html.find(".npc-browser-list");
  
  for (const npc of npcs) {
    try {
      const actorData = await pack.getDocument(npc._id);
      const cr = actorData.system.basic.challengeRating || "?";
      const item = browserList.find(`[data-npc-id="${npc._id}"]`);
      if (item.length) {
        item.find(".npc-browser-item-cr").text(`CR: ${cr}`);
        
        // Apply CR filter
        if (filterCr) {
          let show = false;
          if (filterCr === "10+") {
            const crNum = parseFloat(cr);
            show = !isNaN(crNum) && crNum >= 10;
          } else {
            show = cr === filterCr;
          }
          
          if (!show) {
            item.hide();
          } else {
            item.show();
          }
        }
      }
    } catch (err) {
      console.error(`Error loading CR for ${npc.name}:`, err);
    }
  }
}


// Handle Critical Hit button clicks in chat messages
const normalizeDamageType = (value) => String(value || "").trim().toLowerCase();
const isAllDamageType = (value) => {
  const normalized = normalizeDamageType(value);
  return normalized === "all" || normalized === "all damage" || normalized === "all damages";
};
const getCalculatedResistances = (actor) => {
  const resistances = actor?.system?.resistances || [];
  const primeLevel = actor?.system?.basic?.primeLevel || 1;
  const calculated = resistances.map((resistance) => {
    const copy = { ...resistance };
    if (copy.value === null && copy.source === "Bastion's Resistance") {
      copy.calculatedValue = 2 * primeLevel;
    } else if (copy.value !== null && copy.value !== undefined) {
      copy.calculatedValue = copy.value;
    }
    return copy;
  });
  const equippedArmor = actor?.items?.find(item => item.type === "armor" && item.system?.basic?.equipped);
  const mods = equippedArmor?.system?.basic?.modifications || [];
  const armorResistances = Array.isArray(mods)
    ? mods.filter(mod => mod?.type === "resistance" && mod.damageType)
        .map(mod => ({
          type: mod.damageType,
          calculatedValue: Number(mod.value) || 3,
          source: `Armor Mod: ${equippedArmor?.name || "Armor"}`
        }))
    : [];
  const guardianAuraValue = actor?.effects?.find(effect => effect.getFlag("singularity", "guardianAuraResistance"))
    ? 5
    : 0;
  const guardianAuraResistances = guardianAuraValue > 0
    ? [{ type: "All", calculatedValue: guardianAuraValue, source: "Guardian Aura" }]
    : [];
  return calculated.concat(armorResistances, guardianAuraResistances);
};
const getDamageAdjustment = (actor, damageType) => {
  const normalizedType = normalizeDamageType(damageType);
  const isIncorporeal = actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "incorporeal");
  if (isIncorporeal && normalizedType !== "chaos") {
    return { immune: true, resist: 0, weak: 0, reason: "Incorporeal immunity" };
  }

  const immunities = actor?.system?.immunities || [];
  const isImmune = immunities.some(i => {
    const type = normalizeDamageType(i?.type);
    return type === normalizedType || isAllDamageType(type);
  });
  if (isImmune) {
    return { immune: true, resist: 0, weak: 0, reason: "Immunity" };
  }

  const resistances = getCalculatedResistances(actor);
  const resist = resistances
    .filter(r => {
      const type = normalizeDamageType(r?.type);
      return type === normalizedType || isAllDamageType(type);
    })
    .reduce((sum, r) => sum + (Number(r.calculatedValue) || 0), 0);

  const weaknesses = actor?.system?.weaknesses || [];
  const weak = weaknesses
    .filter(w => {
      const type = normalizeDamageType(w?.type);
      return type === normalizedType || isAllDamageType(type);
    })
    .reduce((sum, w) => sum + (Number(w.value) || 0), 0);

  return { immune: false, resist, weak, reason: null };
};

Hooks.on("renderChatMessageHTML", function(message, html, data) {
  // Convert HTMLElement to jQuery for compatibility (or use vanilla JS)
  const $html = $(html);
  const savingThrowRankBonuses = {
    "Novice": 0,
    "Apprentice": 2,
    "Competent": 5,
    "Masterful": 9,
    "Legendary": 14
  };

  const getComputedAbility = (actor, ability) => {
    const value = actor?.system?.abilities?.[ability];
    return Number(value) || 0;
  };

  const hasTalentByName = (actor, talentName) => {
    if (!actor || !talentName) return false;
    const needle = String(talentName).toLowerCase();
    const embedded = (actor.items || []).some(item =>
      item.type === "talent" && String(item.name || "").toLowerCase().includes(needle)
    );
    if (embedded) return true;
    const progression = actor.system?.progression || {};
    for (let lvl = 1; lvl <= 20; lvl++) {
      const levelData = progression[`level${lvl}`] || {};
      const names = [
        levelData.paragonTalentName,
        levelData.powersetTalentName,
        levelData.bastionTalentName,
        levelData.gadgeteerTalentName,
        levelData.marksmanTalentName,
        levelData.genericTalentName
      ].filter(Boolean);
      if (names.some(name => String(name).toLowerCase().includes(needle))) {
        return true;
      }
    }
    return false;
  };

  const applyStatusForRounds = async (actor, statusId, rounds = 1) => {
    if (!actor || !statusId) return false;
    const statusDef = CONFIG.singularity?.statusEffectsMap?.[statusId];
    if (!statusDef) return false;

    const existing = actor.effects.find(effect => effect.getFlag("core", "statusId") === statusId);
    if (existing) {
      return true;
    }

    const duration = {};
    if (game.combat) {
      duration.rounds = rounds;
      duration.startRound = game.combat.round;
      duration.startTurn = game.combat.turn;
    }

    const effectData = {
      name: statusDef.label || statusId,
      icon: statusDef.icon || "icons/svg/aura.svg",
      flags: foundry.utils.deepClone(statusDef.flags || {}),
      disabled: false,
      duration
    };

    await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    return true;
  };
  
  // Add click handler for critical hit buttons
  const applyDamageToTarget = async (button, baseDamage, damageType, attackName, options = {}) => {
    const targets = Array.from(game.user?.targets || []);
    if (!targets.length) {
      ui.notifications.warn("No target selected.");
      return;
    }

    const targetToken = targets[0];
    const targetActor = targetToken.actor;
    if (!targetActor) {
      ui.notifications.error("Target has no actor.");
      return;
    }

    const { immune, resist, weak, reason } = getDamageAdjustment(targetActor, damageType);
    let appliedDamage = 0;
    let detailText = "";

    if (immune) {
      appliedDamage = 0;
      detailText = reason ? `${reason} (0 applied)` : "Immune (0 applied)";
    } else {
      appliedDamage = Math.max(0, baseDamage - resist + weak);
      const parts = [];
      if (resist) parts.push(`-${resist} resist`);
      if (weak) parts.push(`+${weak} weak`);
      detailText = parts.length ? parts.join(", ") : "No adjustments";
    }

    const currentHp = targetActor.system?.combat?.hp?.value ?? 0;
    const maxHp = targetActor.system?.combat?.hp?.max ?? 0;
    let finalHp = Math.max(0, currentHp - appliedDamage);
    let unbreakableTriggered = false;
    let unbreakableUsesLeft = null;
    const updateData = { "system.combat.hp.value": finalHp };

    if (finalHp <= 0 && currentHp > 0 && hasUnbreakableTalent(targetActor)) {
      const unbreakableData = foundry.utils.deepClone(targetActor.system?.combat?.unbreakable || { used: 0 });
      const used = Number(unbreakableData.used) || 0;
      const maxUses = getUnbreakableMaxUses(targetActor);
      if (used < maxUses) {
        unbreakableTriggered = true;
        unbreakableData.used = used + 1;
        unbreakableUsesLeft = Math.max(0, maxUses - unbreakableData.used);
        finalHp = 1;
        updateData["system.combat.hp.value"] = finalHp;
        updateData["system.combat.unbreakable"] = unbreakableData;
      }
    }

    await targetActor.update(updateData);

    let legendaryImpactText = "";
    if (options.legendaryImpact === true && options.sourceActor) {
      const sourceActor = options.sourceActor;
      const sourceSavingThrow = sourceActor.system?.savingThrows?.might || {};
      const sourceRank = sourceSavingThrow.rank || "Novice";
      const sourceTrainingBonus = savingThrowRankBonuses[sourceRank] || 0;
      const sourceOtherBonuses = Number(sourceSavingThrow.otherBonuses) || 0;
      const sourceMight = getComputedAbility(sourceActor, "might");
      const mightDc = 10 + sourceMight + sourceTrainingBonus + sourceOtherBonuses;

      const targetSavingThrow = targetActor.system?.savingThrows?.might || {};
      const targetRank = targetSavingThrow.rank || "Novice";
      const targetTrainingBonus = savingThrowRankBonuses[targetRank] || 0;
      const targetOtherBonuses = Number(targetSavingThrow.otherBonuses) || 0;
      const targetMight = getComputedAbility(targetActor, "might");

      const saveRoll = new Roll(`1d20 + ${targetMight} + ${targetTrainingBonus} + ${targetOtherBonuses}`);
      await saveRoll.evaluate();

      const saveFailed = saveRoll.total < mightDc;
      let statusApplied = false;
      if (saveFailed && (targetActor.isOwner || game.user.isGM)) {
        statusApplied = await applyStatusForRounds(targetActor, "stunned", 1);
      }

      legendaryImpactText = saveFailed
        ? `<br>Legendary Impact: Might Save ${saveRoll.total} vs DC ${mightDc} (Failure) — Stunned until end of next turn${statusApplied ? " (applied)" : ""}.`
        : `<br>Legendary Impact: Might Save ${saveRoll.total} vs DC ${mightDc} (Success).`;
    }

    const targetName = targetToken.name || targetActor.name || "Target";
    const kindLabel = options.isCritical ? "Critical Applied" : "Damage Applied";
    if (unbreakableTriggered) {
      const usesNote = unbreakableUsesLeft !== null ? ` (uses left ${unbreakableUsesLeft})` : "";
      detailText = `${detailText}<br>Unbreakable: 1 HP instead, no wound gained${usesNote}`;
    }
    const flavor = `<div class="roll-flavor"><b>${attackName} - ${kindLabel}</b><br>Target: ${targetName}<br>Base: ${baseDamage} (${damageType})<br>${detailText}${legendaryImpactText}<br><strong>Applied: ${appliedDamage} (${damageType})</strong> (HP: ${currentHp} → ${finalHp}${maxHp ? ` / ${maxHp}` : ""})</div>`;

    await ChatMessage.create({
      speaker: message.speaker,
      flavor: flavor
    });

    if (button) {
      button.disabled = true;
      button.style.opacity = "0.5";
      button.style.cursor = "not-allowed";
    }
  };

  $html.find(".critical-hit-button").click(async function(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const rollTotal = parseFloat(button.dataset.rollTotal);
    const damageType = button.dataset.damageType;
    const attackName = button.dataset.attackName;
    
    if (isNaN(rollTotal)) {
      ui.notifications.error("Invalid damage roll total");
      return;
    }
    
    const sourceActorId = message.speaker?.actor;
    const sourceActor = sourceActorId ? game.actors?.get(sourceActorId) : null;
    const isUnarmedStrike = String(attackName || "").trim().toLowerCase() === "unarmed strike";
    const hasLegendaryImpact = isUnarmedStrike && hasTalentByName(sourceActor, "legendary impact");

    let criticalDamage = rollTotal * 2;
    if (hasLegendaryImpact) {
      const damageRollFlag = message.getFlag("singularity", "damageRoll") || {};
      const formula = String(damageRollFlag.formula || "").trim();
      if (formula) {
        try {
          const maximizedRoll = new Roll(formula);
          await maximizedRoll.evaluate({ maximize: true });
          criticalDamage = maximizedRoll.total * 2;
        } catch (err) {
          console.warn("Singularity | Failed to maximize Legendary Impact critical damage:", err);
        }
      }
    }

    await applyDamageToTarget(button, criticalDamage, damageType, attackName, {
      isCritical: true,
      sourceActor,
      legendaryImpact: hasLegendaryImpact
    });
  });

  $html.find(".apply-damage-button").click(async function(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const rollTotal = parseFloat(button.dataset.rollTotal);
    const damageType = button.dataset.damageType;
    const attackName = button.dataset.attackName;

    if (isNaN(rollTotal)) {
      ui.notifications.error("Invalid damage roll total");
      return;
    }

    await applyDamageToTarget(button, rollTotal, damageType, attackName, { isCritical: false });
  });
});

/**
 * Hook into combatant creation to automatically set initiative
 * and allow adding modifiers via dialog
 */
Hooks.on("createCombatant", async function(combatant, options, userId) {
  // Only process if this is the user who created the combatant
  if (userId !== game.user.id) return;
  
  const actor = combatant.actor;
  if (!actor) return;

  // Calculate initiative using the helper function
  const calculatedInitiative = calculateInitiative(actor);

  // Create dialog to allow adding modifiers
  const dialogContent = `
    <form class="singularity-initiative-dialog">
      <div class="initiative-fields-row">
        <div class="form-group-inline">
          <label>Initiative Value:</label>
          <input type="number" id="initiative-bonus" value="${calculatedInitiative}" readonly class="readonly-input"/>
        </div>
        <div class="form-group-inline">
          <label>Additional Modifier:</label>
          <input type="number" id="initiative-modifier" value="0" placeholder="0" class="editable-input"/>
        </div>
      </div>
      <p class="help-text">Add any extra bonuses or penalties (default: +0)</p>
    </form>
  `;

  const dialogTitle = `Set Initiative for ${actor.name}`;
  
  const d = new Dialog({
    title: dialogTitle,
    content: dialogContent,
    buttons: {
      roll: {
        icon: '<i class="fas fa-dice-d20"></i>',
        label: "Roll Initiative",
        callback: async (html) => {
          const baseInitiative = parseFloat(html.find("#initiative-bonus").val()) || 0;
          const modifier = parseFloat(html.find("#initiative-modifier").val()) || 0;
          
          // Roll 1d20 + base initiative + modifier
          const rollFormula = `1d20 + ${baseInitiative}${modifier !== 0 ? ` + ${modifier}` : ''}`;
          const roll = new Roll(rollFormula);
          await roll.evaluate();
          
          // Create chat message with the roll
          const flavor = `<div class="roll-flavor"><b>Initiative Roll</b><br>1d20 + ${baseInitiative} (Base)${modifier !== 0 ? ` + ${modifier} (Modifier)` : ''} = <strong>${roll.total}</strong></div>`;
          
          await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            flavor: flavor
          });
          
          // Set initiative in combat tracker
          await combatant.update({ initiative: roll.total });
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel",
        callback: async () => {
          // Don't set initiative if cancelled
        }
      }
    },
    default: "roll",
    close: async () => {
      // Don't set initiative if closed without clicking a button
    }
  });
  
  
  d.render(true);
});
