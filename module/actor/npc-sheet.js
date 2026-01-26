/**
 * NPC Character Sheet
 * @extends {foundry.appv1.sheets.ActorSheet}
 */
export class SingularityActorSheetNPC extends foundry.appv1.sheets.ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["singularity", "sheet", "actor", "npc"],
      template: "systems/singularity/templates/actor-sheets/npc-sheet.html",
      width: 700,
      height: 800,
      resizable: true,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }],
      scrollY: [".sheet-body"]
    });
  }

  /** @override */
  getData() {
    const context = super.getData();
    const actorData = context.actor;

    // Ensure name is never empty to prevent validation errors
    if (!actorData.name || actorData.name.trim() === "") {
      actorData.name = "Unnamed NPC";
    }

    // Ensure system data exists
    if (!actorData.system) {
      actorData.system = {};
    }
    
    // Ensure basic data exists
    if (!actorData.system.basic) {
      actorData.system.basic = {};
    }
    
    // Ensure size exists (default to Medium)
    if (!actorData.system.basic.size) {
      actorData.system.basic.size = "Medium";
    }
    
    // Make sure system is available in context for templates
    context.system = actorData.system;
    
    // Ensure abilities exist
    if (!actorData.system.abilities) {
      actorData.system.abilities = {
        might: 0,
        agility: 0,
        endurance: 0,
        wits: 0,
        charm: 0
      };
    }

    // Calculate ability scores (base values for NPCs)
    const calculatedAbilityScores = {
      might: actorData.system.abilities?.might || 0,
      agility: actorData.system.abilities?.agility || 0,
      endurance: actorData.system.abilities?.endurance || 0,
      wits: actorData.system.abilities?.wits || 0,
      charm: actorData.system.abilities?.charm || 0
    };
    context.calculatedAbilityScores = calculatedAbilityScores;

    // Initialize saving throws (simplified for NPCs - just use stored values)
    const savingThrowsData = actorData.system.savingThrows || {};
    const savingThrows = {};
    const savingThrowAbilityNames = ["might", "agility", "endurance", "wits", "charm"];
    
    for (const ability of savingThrowAbilityNames) {
      const savingThrow = savingThrowsData[ability] || {};
      savingThrows[ability] = {
        rank: savingThrow.rank || "Novice",
        otherBonuses: savingThrow.otherBonuses ?? 0
      };
    }
    context.savingThrows = savingThrows;

    // Calculate Initiative: Wits + Training Bonus + Other Bonuses (same as heroes)
    const wits = calculatedAbilityScores.wits || 0;
    const combatData = actorData.system.combat || {};
    const initiativeData = combatData.initiative || { rank: "Novice", otherBonuses: 0 };
    const initiativeRank = initiativeData.rank || "Novice";
    
    // Training bonuses: Novice +0, Apprentice +4, Competent +8, Masterful +12, Legendary +16
    const initiativeTrainingBonuses = {
      "Novice": 0,
      "Apprentice": 4,
      "Competent": 8,
      "Masterful": 12,
      "Legendary": 16
    };
    const initiativeTrainingBonus = initiativeTrainingBonuses[initiativeRank] || 0;
    const initiativeOtherBonuses = Number(initiativeData.otherBonuses) || 0;
    
    const calculatedInitiative = wits + initiativeTrainingBonus + initiativeOtherBonuses;
    context.calculatedInitiative = calculatedInitiative;
    context.initiativeBreakdown = {
      wits: wits,
      trainingBonus: initiativeTrainingBonus,
      trainingRank: initiativeRank,
      otherBonuses: initiativeOtherBonuses,
      total: calculatedInitiative
    };

    // Organize items by type (ensure items array exists)
    const items = actorData.items || [];
    context.weapons = items.filter(i => i && i.type === "weapon");
    context.armor = items.filter(i => i && i.type === "armor");
    context.equipment = items.filter(i => i && i.type === "equipment");

    // Build attacks array from equipped weapons (similar to heroes)
    // Make a copy of attacks array to avoid modifying the original
    const attacks = foundry.utils.deepClone(actorData.system.attacks || []);
    const equippedWeapons = context.weapons.filter(w => w && w.system?.basic?.equipped === true);
    
    // Add equipped weapons as attacks if they don't already exist
    // Note: _ensureEquippedWeaponAttacks in actor.js already handles dual-mode weapons,
    // but we need to ensure weapon images are set correctly for NPCs
    for (const weapon of equippedWeapons) {
      if (!weapon || !weapon.name) continue;
      
      const weaponName = weapon.name;
      const weaponCategories = weapon.system?.basic?.categories || [];
      const hasThrownCategory = weaponCategories.includes("Thrown Weapons");
      const hasMeleeCategory = weaponCategories.some(cat => 
        cat === "Light Melee Weapons" || cat === "Heavy Melee Weapons" || cat === "Unarmed Strikes"
      );
      
      // If weapon has both melee and thrown categories, check for both attack modes
      if (hasMeleeCategory && hasThrownCategory) {
        const meleeAttackName = `${weaponName} (Melee)`;
        const thrownAttackName = `${weaponName} (Thrown)`;
        
        // Update melee attack image if it exists
        const meleeAttack = attacks.find(a => a && a.name === meleeAttackName);
        if (meleeAttack && weapon.img) {
          meleeAttack.weaponImg = weapon.img;
        }
        
        // Update thrown attack image if it exists
        const thrownAttack = attacks.find(a => a && a.name === thrownAttackName);
        if (thrownAttack && weapon.img) {
          thrownAttack.weaponImg = weapon.img;
        }
      } else {
        // Standard single-mode weapon
        const existingAttack = attacks.find(a => 
          a && a.name && a.name.toLowerCase() === weaponName.toLowerCase() &&
          !a.name.includes("(Melee)") && !a.name.includes("(Thrown)")
        );
        
        if (existingAttack && weapon.img) {
          existingAttack.weaponImg = weapon.img;
        }
      }
    }
    
    // Calculate attack bonuses and damage for each attack
    const calculatedAttacks = attacks.map(attack => {
      if (!attack || !attack.ability) {
        // Skip invalid attacks
        return null;
      }
      
      // Match weapon image for dual-mode weapons (strip mode suffix like heroes do)
      if (!attack.weaponImg) {
        const baseAttackName = attack.name?.replace(/\s*\(Melee\)$/i, "").replace(/\s*\(Thrown\)$/i, "");
        const matchingWeapon = equippedWeapons.find(w => 
          w.name && baseAttackName && w.name.toLowerCase() === baseAttackName.toLowerCase()
        );
        if (matchingWeapon && matchingWeapon.img) {
          attack.weaponImg = matchingWeapon.img;
        }
      }
      const baseAttackName = attack.name?.replace(/\s*\(Melee\)$/i, "").replace(/\s*\(Thrown\)$/i, "");
      const matchingWeapon = equippedWeapons.find(w => 
        w.name && baseAttackName && w.name.toLowerCase() === baseAttackName.toLowerCase()
      );
      const isWeaponAttack = Boolean(attack.weaponId) || Boolean(matchingWeapon);
      const isUnarmed = attack.name && attack.name.toLowerCase() === "unarmed strike";
      
      const abilityScore = calculatedAbilityScores[attack.ability] || 0;
      const attackBonus = (attack.baseAttackBonus || 0) + abilityScore;
      const damageBonus = abilityScore;
      
      let damageFormula = "";
      if (attack.baseDamage) {
        if (damageBonus > 0) {
          damageFormula = `${attack.baseDamage}+${damageBonus}`;
        } else if (damageBonus < 0) {
          damageFormula = `${attack.baseDamage}${damageBonus}`;
        } else {
          damageFormula = attack.baseDamage;
        }
      } else {
        damageFormula = "1d4";
      }
      
      return {
        ...attack,
        calculatedAttackBonus: attackBonus,
        calculatedDamage: damageFormula,
        attackBonusBreakdown: `${attack.baseAttackBonus || 0} (base) + ${abilityScore} (${attack.ability})`,
        canDelete: !isWeaponAttack && !isUnarmed
      };
    }).filter(a => a !== null); // Filter out null entries
    
    context.attacks = calculatedAttacks;

    // Speeds - handle both old single speed format and new multiple speeds format
    const speeds = {};
    if (actorData.system.combat?.speeds) {
      // New format: multiple speeds
      Object.assign(speeds, actorData.system.combat.speeds);
    } else if (actorData.system.combat?.speed !== undefined) {
      // Old format: single speed
      speeds.land = actorData.system.combat.speed;
    } else {
      // Default: no speeds
      speeds.land = 0;
    }
    context.speeds = speeds;

    // Special abilities and traits
    context.specialAbilities = actorData.system.specialAbilities || [];
    context.traits = actorData.system.traits || [];
    context.skills = actorData.system.skills || {};
    
    // Resistances, Weaknesses & Immunities
    context.resistances = actorData.system.resistances || [];
    context.weaknesses = actorData.system.weaknesses || [];
    context.immunities = actorData.system.immunities || [];

    // Ensure combat AC is set (fallback to 10 if not calculated)
    if (!context.system) {
      context.system = {};
    }
    if (!context.system.combat) {
      context.system.combat = {};
    }
    if (context.system.combat.ac === undefined || context.system.combat.ac === null) {
      context.system.combat.ac = 10;
    }

    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add/Delete special ability
    html.find(".add-special-ability").click(this._onAddSpecialAbility.bind(this));
    html.find(".delete-special-ability").click(this._onDeleteSpecialAbility.bind(this));

    // Add/Delete trait
    html.find(".add-trait").click(this._onAddTrait.bind(this));
    html.find(".delete-trait").click(this._onDeleteTrait.bind(this));

    // Add/Delete RWI (Resistances, Weaknesses, Immunities)
    html.find(".add-rwi").click(this._onAddRWI.bind(this));
    html.on("click", ".rwi-delete", this._onDeleteRWI.bind(this));

    // Add item
    html.find(".item-create").click(this._onItemCreate.bind(this));
    
    // Edit item
    html.find(".item-edit").click(this._onItemEdit.bind(this));
    
    // Delete item
    html.find(".item-delete").click(this._onItemDelete.bind(this));

    // Weapon equip/unequip
    html.find(".weapon-equip").click(this._onWeaponEquip.bind(this));
    html.find(".weapon-unequip").click(this._onWeaponUnequip.bind(this));

    // Armor equip/unequip
    html.find(".armor-equip").click(this._onArmorEquip.bind(this));
    html.find(".armor-unequip").click(this._onArmorUnequip.bind(this));

    // Attack and damage rolls
    html.find(".attack-roll").click(this._onRollAttack.bind(this));
    html.find(".damage-roll").click(this._onRollDamage.bind(this));

    // Saving throw rolls and ranks
    html.find(".saving-throw-roll").click(this._onSavingThrowRoll.bind(this));
    html.find(".saving-throw-rank").on("change", this._onSavingThrowRankChange.bind(this));

    // Saving throw other bonuses
    html.find(".saving-throw-other-bonus").on("change", this._onSavingThrowOtherBonusChange.bind(this));

    // Speed management
    html.find(".add-speed-type").on("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._onAddSpeedType(event);
    });
    html.on("click", ".speed-delete", this._onDeleteSpeed.bind(this));

    // Image change dialog
    html.on("click", "[data-action='change-image']", this._onChangeImage.bind(this));

    // Ability rolls and breakdowns
    html.on("click", "[data-action='roll-ability']", this._onAbilityNameRoll.bind(this));
    html.on("click", "[data-action='show-ability-breakdown']", this._onShowAbilityBreakdown.bind(this));

    // Double-click ability value to edit (toggle input field)
    html.find(".ability-value").on("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const ability = event.currentTarget.dataset.ability;
      const abilityDiv = $(event.currentTarget);
      const abilityInput = abilityDiv.siblings(`input[name="system.abilities.${ability}"]`);
      
      if (abilityInput.length) {
        abilityDiv.hide();
        abilityInput.show().focus().select();
        
        abilityInput.on("blur", function() {
          abilityInput.hide();
          abilityDiv.show();
        });
        
        abilityInput.on("keydown", function(e) {
          if (e.key === "Enter") {
            abilityInput.blur();
          }
        });
      }
    });

    // Buy weapons/armor from compendium
    html.find(".buy-weapon").click(this._onBuyWeapon.bind(this));
    html.find(".buy-armor").click(this._onBuyArmor.bind(this));

    // Handle name changes to prevent empty names
    html.find('input[name="name"]').on("blur", (event) => {
      const name = event.target.value?.trim();
      if (!name || name === "") {
        this.actor.update({ name: "Unnamed NPC" });
      }
    });
  }

  /** @override */
  async _updateObject(event, formData) {
    // Ensure name is never empty
    if (formData.name === "" || !formData.name) {
      formData.name = "Unnamed NPC";
    }
    
    // Process numeric fields - ensure they're numbers, not strings, and default to 0 if empty
    const numericFields = [
      "system.abilities.might",
      "system.abilities.agility", 
      "system.abilities.endurance",
      "system.abilities.wits",
      "system.abilities.charm",
      "system.combat.hp.value",
      "system.combat.hp.max",
      "system.combat.speed"
    ];
    
    for (const field of numericFields) {
      if (field in formData) {
        const value = formData[field];
        if (value === null || value === undefined || value === "") {
          formData[field] = 0;
        } else {
          const parsed = Number(value);
          formData[field] = isNaN(parsed) ? 0 : parsed;
        }
      }
    }

    // Use the default Foundry form submission which handles merging automatically
    return super._updateObject(event, formData);
  }

  _onAddSpecialAbility(event) {
    event.preventDefault();
    const name = prompt("Enter special ability name:");
    if (!name) return;
    const description = prompt("Enter description:");

    const abilities = foundry.utils.deepClone(this.actor.system.specialAbilities || []);
    abilities.push({ name: name, description: description || "" });

    this.actor.update({ "system.specialAbilities": abilities });
  }

  _onDeleteSpecialAbility(event) {
    event.preventDefault();
    const index = parseInt(event.currentTarget.dataset.index);
    const abilities = foundry.utils.deepClone(this.actor.system.specialAbilities || []);
    abilities.splice(index, 1);

    this.actor.update({ "system.specialAbilities": abilities });
  }

  _onAddTrait(event) {
    event.preventDefault();
    const name = prompt("Enter trait name:");
    if (!name) return;

    const traits = foundry.utils.deepClone(this.actor.system.traits || []);
    traits.push(name);

    this.actor.update({ "system.traits": traits });
  }

  _onDeleteTrait(event) {
    event.preventDefault();
    const index = parseInt(event.currentTarget.dataset.index);
    const traits = foundry.utils.deepClone(this.actor.system.traits || []);
    traits.splice(index, 1);

    this.actor.update({ "system.traits": traits });
  }

  _onItemCreate(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type;
    const itemData = {
      name: `New ${type.capitalize()}`,
      type: type,
      system: {}
    };
    return this.actor.createEmbeddedDocuments("Item", [itemData]);
  }

  _onItemEdit(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (item) {
      item.sheet.render(true);
    }
  }

  _onItemDelete(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (item) {
      item.delete();
    }
  }

  async _onRollAttack(event) {
    event.preventDefault();
    const attackId = parseInt(event.currentTarget.dataset.attackId);
    const attacks = this.actor.system.attacks || [];
    const attack = attacks[attackId];

    if (!attack) return;

    // Calculate ability score
    const abilityScore = this.actor.system.abilities?.[attack.ability] || 0;
    const attackBonus = (attack.baseAttackBonus || 0) + abilityScore;

    const roll = new Roll("1d20 + @bonus", { bonus: attackBonus });
    await roll.evaluate();
    
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<b>${attack.name} - Attack</b><br>${attack.baseAttackBonus || 0} (base) + ${abilityScore} (${attack.ability}) = <strong>${roll.total}</strong>`
    });
  }

  async _onRollDamage(event) {
    event.preventDefault();
    const attackId = parseInt(event.currentTarget.dataset.attackId);
    const attacks = this.actor.system.attacks || [];
    const attack = attacks[attackId];

    if (!attack) return;

    // Calculate ability score
    const abilityScore = this.actor.system.abilities?.[attack.ability] || 0;
    
    let damageFormula = "";
    if (attack.baseDamage) {
      if (abilityScore > 0) {
        damageFormula = `${attack.baseDamage}+${abilityScore}`;
      } else if (abilityScore < 0) {
        damageFormula = `${attack.baseDamage}${abilityScore}`;
      } else {
        damageFormula = attack.baseDamage;
      }
    } else {
      damageFormula = "1d4";
    }

    const roll = new Roll(damageFormula);
    await roll.evaluate();
    
    const criticalButton = `<div class="chat-card-buttons" style="margin-top: 5px;"><button type="button" class="critical-hit-button" data-roll-total="${roll.total}" data-damage-type="${attack.damageType}" data-attack-name="${attack.name}" style="padding: 4px 8px; background: rgba(220, 53, 69, 0.5); color: #ffffff; border: 1px solid rgba(220, 53, 69, 0.8); border-radius: 3px; cursor: pointer; font-size: 11px;"><i class="fas fa-bolt"></i> Critical Hit (Double Damage)</button></div>`;
    const flavor = `<div class="roll-flavor"><b>${attack.name} - Damage</b><br>${damageFormula} (${attack.damageType}) = <strong>${roll.total}</strong>${criticalButton}</div>`;
    
    const message = await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: flavor
    });

    await message.setFlag("singularity", "damageRoll", {
      total: roll.total,
      formula: damageFormula,
      damageType: attack.damageType,
      attackName: attack.name
    });
  }

  async _onSavingThrowRoll(event) {
    event.preventDefault();
    const ability = event.currentTarget.dataset.savingThrow;
    if (!ability) return;

    const savingThrow = this.actor.system.savingThrows?.[ability] || {};
    const rank = savingThrow.rank || "Novice";
    const otherBonuses = savingThrow.otherBonuses || 0;
    
    // Calculate rank bonus
    const rankBonuses = { "Novice": 0, "Apprentice": 4, "Competent": 8, "Masterful": 12, "Legendary": 16 };
    const rankBonus = rankBonuses[rank] || 0;
    
    // Get ability score
    const abilityScore = this.actor.system.abilities?.[ability] || 0;
    
    const totalBonus = rankBonus + abilityScore + otherBonuses;

    const roll = new Roll("1d20 + @bonus", { bonus: totalBonus });
    await roll.evaluate();
    
    const breakdown = `${rankBonus} (${rank}) + ${abilityScore} (${ability})${otherBonuses > 0 ? ` + ${otherBonuses} (other)` : ''}`;
    
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<b>Saving Throw - ${ability.capitalize()}</b><br>${breakdown} = <strong>${roll.total}</strong>`
    });
  }

  async _onSavingThrowRankChange(event) {
    const ability = event.currentTarget.dataset.savingThrow;
    const rank = event.currentTarget.value || "Novice";
    
    const savingThrows = foundry.utils.deepClone(this.actor.system.savingThrows || {});
    if (!savingThrows[ability]) {
      savingThrows[ability] = { rank: "Novice", otherBonuses: 0 };
    }
    savingThrows[ability].rank = rank;
    
    await this.actor.update({ "system.savingThrows": savingThrows });
  }

  async _onSavingThrowOtherBonusChange(event) {
    const ability = event.currentTarget.dataset.savingThrow;
    const value = parseInt(event.currentTarget.value) || 0;
    
    const savingThrows = foundry.utils.deepClone(this.actor.system.savingThrows || {});
    if (!savingThrows[ability]) {
      savingThrows[ability] = { rank: "Novice", otherBonuses: 0 };
    }
    savingThrows[ability].otherBonuses = value;
    
    await this.actor.update({ "system.savingThrows": savingThrows });
  }

  async _onWeaponEquip(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item || item.type !== "weapon") return;

    // Check hands requirement
    const weaponHands = item.system?.basic?.hands || 1;
    
    // Get all currently equipped weapons
    const equippedWeapons = this.actor.items.filter(i => 
      i.type === "weapon" && i.system?.basic?.equipped === true && i.id !== item.id
    );
    
    // Calculate total hands used by equipped weapons
    let totalHandsUsed = 0;
    for (const equippedWeapon of equippedWeapons) {
      totalHandsUsed += equippedWeapon.system?.basic?.hands || 1;
    }
    
    // Check if equipping this weapon would exceed 2 hands
    if (totalHandsUsed + weaponHands > 2) {
      ui.notifications.warn(`Cannot equip ${item.name}! You need ${weaponHands} hand(s) for this weapon, but you only have ${2 - totalHandsUsed} hand(s) available.`);
      return;
    }

    await item.update({ "system.basic.equipped": true });
    await this.actor.update({ "system.attacks": null }); // Clear attacks to force regeneration
  }

  async _onWeaponUnequip(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item || item.type !== "weapon") return;

    await item.update({ "system.basic.equipped": false });
    
    // Remove from attacks array (handle both single-mode and dual-mode weapons)
    const attacks = foundry.utils.deepClone(this.actor.system.attacks || []);
    const weaponName = item.name;
    // Filter out attacks that match the weapon name (including mode suffixes)
    const filteredAttacks = attacks.filter(a => {
      if (!a.name) return true;
      const baseAttackName = a.name.replace(/\s*\(Melee\)$/i, "").replace(/\s*\(Thrown\)$/i, "");
      return baseAttackName.toLowerCase() !== weaponName.toLowerCase();
    });
    await this.actor.update({ "system.attacks": filteredAttacks });
  }

  async _onArmorEquip(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item || item.type !== "armor") return;

    // Unequip all other armor first
    const allArmor = this.actor.items.filter(i => i.type === "armor" && i.id !== itemId);
    for (const armor of allArmor) {
      await armor.update({ "system.basic.equipped": false });
    }

    await item.update({ "system.basic.equipped": true });
  }

  async _onArmorUnequip(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item || item.type !== "armor") return;

    await item.update({ "system.basic.equipped": false });
  }

  async _onBuyWeapon(event) {
    event.preventDefault();
    
    // Get weapons from the compendium
    const pack = game.packs.get("singularity.weapons");
    if (!pack) {
      ui.notifications.error("Weapons compendium not found!");
      return;
    }
    
    const index = await pack.getIndex();
    const allWeapons = Array.from(index.values());
    
    if (allWeapons.length === 0) {
      ui.notifications.warn("No weapons available in compendium.");
      return;
    }
    
    const sortedWeapons = allWeapons.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    
    const content = await renderTemplate("systems/singularity/templates/dialogs/item-selection.html", {
      level: 1,
      slotType: "weapon",
      items: sortedWeapons,
      itemTypeLabel: "Weapon"
    });
    
    const dialogTitle = "Buy Weapon from Compendium";
    const dialogId = `weapon-dialog-${Date.now()}`;
    
    const d = new Dialog({
      title: dialogTitle,
      content: content,
      buttons: {
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => {}
        }
      },
      default: "cancel",
      width: 600,
      height: 500,
      render: (html) => {
        html.find(".item-selection-item").click(async function(event) {
          event.preventDefault();
          const itemId = $(this).data("item-id");
          if (!itemId) return;
          
          try {
            const weaponDoc = await pack.getDocument(itemId);
            if (!weaponDoc) {
              ui.notifications.error("Could not find weapon in compendium.");
              return;
            }
            
            const weaponData = weaponDoc.toObject();
            weaponData.flags = weaponData.flags || {};
            weaponData.system.basic.equipped = false;
            
            await this.actor.createEmbeddedDocuments("Item", [weaponData]);
            ui.notifications.info(`Added ${weaponDoc.name} to inventory.`);
            
            d.close();
          } catch (error) {
            console.error("Error buying weapon:", error);
            ui.notifications.error(`Failed to buy weapon: ${error.message}`);
          }
        }.bind(this));
      }
    });
    
    d.render(true);
  }

  async _onBuyArmor(event) {
    event.preventDefault();
    
    // Get armor from the compendium
    const pack = game.packs.get("singularity.armor");
    if (!pack) {
      ui.notifications.error("Armor compendium not found!");
      return;
    }
    
    const index = await pack.getIndex();
    const allArmor = Array.from(index.values());
    
    if (allArmor.length === 0) {
      ui.notifications.warn("No armor available in compendium.");
      return;
    }
    
    const sortedArmor = allArmor.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    
    const content = await renderTemplate("systems/singularity/templates/dialogs/armor-selection.html", {
      armors: sortedArmor
    });
    
    const dialogTitle = "Buy Armor from Compendium";
    
    const d = new Dialog({
      title: dialogTitle,
      content: content,
      buttons: {
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => {}
        }
      },
      default: "cancel",
      width: 600,
      height: 500,
      render: (html) => {
        html.find(".armor-selection-item").click(async function(event) {
          event.preventDefault();
          const itemId = $(this).data("item-id");
          if (!itemId) return;
          
          try {
            const armorDoc = await pack.getDocument(itemId);
            if (!armorDoc) {
              ui.notifications.error("Could not find armor in compendium.");
              return;
            }
            
            const armorData = armorDoc.toObject();
            armorData.flags = armorData.flags || {};
            armorData.system.basic.equipped = false;
            
            await this.actor.createEmbeddedDocuments("Item", [armorData]);
            ui.notifications.info(`Added ${armorDoc.name} to inventory.`);
            
            d.close();
          } catch (error) {
            console.error("Error buying armor:", error);
            ui.notifications.error(`Failed to buy armor: ${error.message}`);
          }
        }.bind(this));
      }
    });
    
    d.render(true);
  }

  async _onAddRWI(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type; // "resistance", "weakness", or "immunity"
    
    const damageTypes = [
      "Acid", "Chaos", "Cold", "Fire", "Kinetic", "Lightning", 
      "Necrotic", "Photonic", "Poison", "Psychic", "Radiant", "Sonic", "Energy"
    ];
    
    const typeOptions = damageTypes.map(dt => `<option value="${dt}">${dt}</option>`).join("");
    
    const content = `
      <form>
        <div class="form-group">
          <label>Damage Type</label>
          <select name="damageType" required>
            <option value="">Choose...</option>
            ${typeOptions}
          </select>
        </div>
        ${type !== "immunity" ? `
        <div class="form-group">
          <label>Value</label>
          <input type="number" name="value" min="1" ${type === "resistance" ? "placeholder=\"Optional\"" : "required"}>
        </div>
        ` : ""}
      </form>
    `;
    
    const d = new Dialog({
      title: `Add ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      content: content,
      buttons: {
        add: {
          icon: '<i class="fas fa-check"></i>',
          label: "Add",
          callback: (html) => {
            const form = html[0].querySelector("form");
            const formData = new FormData(form);
            const damageType = formData.get("damageType");
            const value = formData.get("value");
            
            if (!damageType) {
              ui.notifications.error(`Please select a damage type.`);
              return false;
            }
            
            if (type !== "immunity" && !value && type === "weakness") {
              ui.notifications.error(`Please enter a value for weakness.`);
              return false;
            }
            
            const rwiArray = foundry.utils.deepClone(this.actor.system[type + "s"] || []);
            const newEntry = { type: damageType };
            if (value && parseInt(value) > 0) {
              newEntry.value = parseInt(value);
            }
            rwiArray.push(newEntry);
            
            this.actor.update({ [`system.${type}s`]: rwiArray });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "add"
    });
    
    d.render(true);
  }

  async _onDeleteRWI(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type; // "resistance", "weakness", or "immunity"
    const id = parseInt(event.currentTarget.dataset.id);
    
    const rwiArray = foundry.utils.deepClone(this.actor.system[type + "s"] || []);
    rwiArray.splice(id, 1);
    
    this.actor.update({ [`system.${type}s`]: rwiArray });
  }

  async _onAddSpeedType(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Get current speeds to determine which ones are already added
    let currentSpeeds = {};
    if (this.actor.system.combat?.speeds) {
      currentSpeeds = this.actor.system.combat.speeds;
    } else if (this.actor.system.combat?.speed !== undefined) {
      currentSpeeds.land = this.actor.system.combat.speed;
    }
    
    // Define available speed types (matching hero system exactly)
    const availableSpeedTypes = [
      { value: "swimming", label: "Swimming" },
      { value: "flying", label: "Flying" },
      { value: "crawling", label: "Crawling" },
      { value: "climbing", label: "Climbing" }
    ];
    
    // Filter out speed types that already exist (check for undefined/null, not falsy values)
    const availableOptions = availableSpeedTypes
      .filter(st => currentSpeeds[st.value] === undefined || currentSpeeds[st.value] === null)
      .map(st => `<option value="${st.value}">${st.label}</option>`)
      .join("");
    
    if (availableOptions === "") {
      ui.notifications.warn("All available speed types have already been added.");
      return;
    }
    
    const content = `
      <form>
        <div class="form-group">
          <label>Speed Type:</label>
          <select name="speedType" required>
            <option value="">Choose a speed type...</option>
            ${availableOptions}
          </select>
          <p class="notes" style="font-size: 11px; color: #999; margin-top: 5px;">Select a speed type to add. Land speed is always present.</p>
        </div>
      </form>
    `;
    
    new Dialog({
      title: "Add Speed Type",
      content: content,
      buttons: {
        add: {
          icon: '<i class="fas fa-check"></i>',
          label: "Add",
          callback: async (html) => {
            const form = html[0].querySelector("form");
            const formData = new FormData(form);
            const speedType = formData.get("speedType");
            
            if (!speedType || speedType.trim() === "") {
              ui.notifications.error("Please select a speed type.");
              return false;
            }
            
            const normalizedType = speedType.toLowerCase().trim();
            
            // Get current speeds - handle both old and new format
            let speeds = {};
            if (this.actor.system.combat?.speeds) {
              speeds = foundry.utils.deepClone(this.actor.system.combat.speeds);
            } else if (this.actor.system.combat?.speed !== undefined) {
              // Migrate from old format
              speeds.land = this.actor.system.combat.speed;
            }
            
            // Check if speed type already exists (shouldn't happen with dropdown, but safety check)
            if (speeds[normalizedType] !== undefined && speeds[normalizedType] !== null) {
              ui.notifications.warn(`Speed type "${normalizedType}" already exists.`);
              return false;
            }
            
            // Add new speed type with default value of 0
            speeds[normalizedType] = 0;
            
            // Update the actor
            const updateData = {
              "system.combat.speeds": speeds
            };
            
            // If we migrated from old format, also remove the old speed field
            if (this.actor.system.combat?.speed !== undefined && !this.actor.system.combat?.speeds) {
              updateData["system.combat.speed"] = null;
            }
            
            try {
              await this.actor.update(updateData);
              this.render();
              ui.notifications.info(`Added ${normalizedType} speed type.`);
            } catch (error) {
              console.error("Singularity | Error adding speed type:", error);
              ui.notifications.error(`Failed to add speed type: ${error.message}`);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "add",
      close: () => {}
    }).render(true);
  }

  async _onDeleteSpeed(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Get speed type from the clicked element - handle clicks on the icon inside the anchor
    const speedType = $(event.currentTarget).closest(".speed-delete").data("speed-type");
    
    if (!speedType) {
      ui.notifications.warn("Could not determine speed type to delete.");
      return;
    }
    
    // Don't allow deleting "land" speed
    if (speedType === "land") {
      ui.notifications.warn("Cannot delete land speed.");
      return;
    }
    
    // Get current speeds
    let speeds = {};
    if (this.actor.system.combat?.speeds) {
      speeds = foundry.utils.deepClone(this.actor.system.combat.speeds);
    } else if (this.actor.system.combat?.speed !== undefined) {
      // Migrate from old format
      speeds.land = this.actor.system.combat.speed;
    }
    
    // Check if speed type exists (even if value is 0)
    if (speeds[speedType] === undefined || speeds[speedType] === null) {
      ui.notifications.warn(`Speed type "${speedType}" does not exist.`);
      return;
    }
    
    delete speeds[speedType];
    
    // Ensure we maintain land speed if it existed
    if (!speeds.land && this.actor.system.combat?.speed !== undefined) {
      speeds.land = this.actor.system.combat.speed;
    } else if (!speeds.land) {
      speeds.land = 0;
    }
    
    try {
      // Use Foundry's unset syntax to remove the key
      await this.actor.update({ [`system.combat.speeds.-=${speedType}`]: null });
      
      // Fallback if unset doesn't work - force a full update
      if (this.actor.system.combat.speeds && this.actor.system.combat.speeds[speedType]) {
        await this.actor.update({ "system.combat.speeds": speeds }, { diff: false });
      }
      
      // Refresh actor data
      await this.actor.prepareData();
      
      // Force full re-render
      this.render(true);
      ui.notifications.info(`Removed ${speedType} speed type.`);
    } catch (error) {
      console.error("Singularity | Error deleting speed type:", error);
      ui.notifications.error(`Failed to delete speed type: ${error.message}`);
    }
  }

  async _onAbilityNameRoll(event) {
    event.preventDefault();
    event.stopPropagation();
    const ability = event.currentTarget.dataset.ability;
    if (!ability) return;
    
    // Get the current ability score (NPCs use base values directly)
    const abilityScore = this.actor.system.abilities?.[ability] || 0;
    const abilityDisplay = ability.charAt(0).toUpperCase() + ability.slice(1);

    const dialogContent = `
      <form class="singularity-roll-dialog">
        <div class="roll-fields-row">
          <div class="form-group-inline">
            <label>Ability Roll:</label>
            <input type="text" id="ability-roll" value="1d20" readonly class="readonly-input"/>
          </div>
          <div class="form-group-inline">
            <label>${abilityDisplay} Score:</label>
            <input type="number" id="ability-score" value="${abilityScore}" readonly class="readonly-input"/>
          </div>
          <div class="form-group-inline">
            <label>Extra Modifier:</label>
            <input type="text" id="extra-modifier" value="0" placeholder="0 or +1d6" class="editable-input"/>
          </div>
        </div>
        <p class="help-text">Add any extra bonuses (e.g., +2, +1d6, -1). Click "Roll Ability" to roll 1d20 + ${abilityDisplay} + Extra Modifier.</p>
      </form>
    `;

    const dialogTitle = `Roll ${abilityDisplay} Check`;
    
    const d = new Dialog({
      title: dialogTitle,
      content: dialogContent,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: "Roll Ability",
          callback: async (html) => {
            const abilityScore = parseFloat(html.find("#ability-score").val()) || 0;
            const extra = html.find("#extra-modifier").val().trim() || "0";
            
            // Build roll formula: 1d20 + ability + extra
            let rollFormula = `1d20 + ${abilityScore}`;
            if (extra && extra !== "0") {
              rollFormula += ` + ${extra}`;
            }
            
            const roll = new Roll(rollFormula);
            await roll.evaluate();
            
            const extraText = extra !== "0" ? ` + ${extra} (Extra)` : "";
            const flavor = `<div class="roll-flavor"><b>${abilityDisplay} Check</b><br>1d20 + ${abilityScore} (${abilityDisplay})${extraText} = <strong>${roll.total}</strong></div>`;
            
            await roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              flavor: flavor
            });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => {}
        }
      },
      default: "roll"
    });
    
    d.render(true);
  }

  async _onShowAbilityBreakdown(event) {
    event.preventDefault();
    event.stopPropagation();

    const ability = event.currentTarget.dataset.ability;
    if (!ability) return;

    // Get current ability score (NPCs use base values directly)
    const abilityScore = this.actor.system.abilities?.[ability] || 0;
    const abilityDisplay = ability.charAt(0).toUpperCase() + ability.slice(1);
    
    const dialogContent = `
      <div class="ability-breakdown">
        <h3>${abilityDisplay} Score Breakdown</h3>
        <div class="breakdown-item">
          <label>Base Score:</label>
          <span class="breakdown-value">${abilityScore}</span>
        </div>
        <hr>
        <div class="breakdown-item total">
          <label><strong>Total ${abilityDisplay} Score:</strong></label>
          <span class="breakdown-value"><strong>${abilityScore}</strong></span>
        </div>
        <p class="help-text" style="margin-top: 10px; font-size: 0.85rem; color: #a0aec0;">
          For NPCs, ability scores are the base values. You can edit them by double-clicking the ability value.
        </p>
      </div>
    `;
    
    new Dialog({
      title: `${abilityDisplay} Score Breakdown`,
      content: dialogContent,
      buttons: {
        close: {
          icon: '<i class="fas fa-times"></i>',
          label: "Close",
          callback: () => {}
        }
      },
      default: "close"
    }).render(true);
  }

  async _onChangeImage(event) {
    event.preventDefault();
    event.stopPropagation();

    const dialogContent = `
      <form class="singularity-image-dialog">
        <div class="form-group">
          <p style="color: #d1d1d1; margin-bottom: 20px;">
            Choose what you want to change:
          </p>
          <div class="image-option-grid">
            <button type="button" class="image-option-btn" data-image-type="portrait">
              <i class="fas fa-portrait fa-2x"></i>
              <span>Change Portrait</span>
              <small>Visible in character sheet and actors menu</small>
            </button>
            <button type="button" class="image-option-btn" data-image-type="token">
              <i class="fas fa-chess fa-2x"></i>
              <span>Change Token</span>
              <small>Visible when placed on the map</small>
            </button>
          </div>
        </div>
      </form>
      <style>
        .image-option-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-top: 15px;
        }
        .image-option-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          background: rgba(30, 33, 45, 0.95);
          border: 2px solid rgba(189, 95, 255, 0.4);
          border-radius: 5px;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .image-option-btn:hover {
          background: rgba(50, 53, 65, 0.95);
          border-color: rgba(189, 95, 255, 0.8);
          transform: translateY(-2px);
        }
        .image-option-btn i {
          margin-bottom: 10px;
          color: rgba(189, 95, 255, 0.8);
        }
        .image-option-btn span {
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 5px;
        }
        .image-option-btn small {
          font-size: 11px;
          color: #a0aec0;
          text-align: center;
        }
      </style>
    `;

    const dialog = new Dialog({
      title: "Change Character Image",
      content: dialogContent,
      buttons: {},
      default: "",
      close: () => {},
      render: (html) => {
        // Attach event listeners after dialog is rendered
        html.find(".image-option-btn").on("click", async (btnEvent) => {
          btnEvent.preventDefault();
          btnEvent.stopPropagation();
          const imageType = $(btnEvent.currentTarget).data("image-type");
          dialog.close();

          const filePicker = new FilePicker({
            type: "image",
            current: imageType === "portrait" ? this.actor.img : this.actor.prototypeToken.texture.src,
            callback: async (path) => {
              if (imageType === "portrait") {
                await this.actor.update({ img: path });
                ui.notifications.info(`Portrait updated for ${this.actor.name}`);
              } else if (imageType === "token") {
                await this.actor.update({ "prototypeToken.texture.src": path });
                ui.notifications.info(`Token image updated for ${this.actor.name}`);
              }
              this.render(false);
            },
            button: {
              icon: '<i class="fas fa-file-upload"></i>',
              label: "Select Image"
            }
          });

          filePicker.render(true);
        });
      }
    });

    dialog.render(true);
  }
}
