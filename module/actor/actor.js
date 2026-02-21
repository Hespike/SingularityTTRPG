/**
 * Extend the base Actor entity
 * @extends {Actor}
 */
export class SingularityActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded documents
  }

  /** @override */
  prepareDerivedData() {
    const systemData = this.system;

    if (this.type === "hero") {
      this._prepareHeroData(systemData);
    } else if (this.type === "npc") {
      this._prepareNpcData(systemData);
    }
  }

  /**
   * Prepare Hero type specific data
   */
  _prepareHeroData(systemData) {
    // AC is now manually editable on the character sheet
    // Auto-calculation has been disabled to allow manual control
    // If you want to re-enable auto-calculation, uncomment the code below:
    /*
    let acBase = 10;
    let acBonus = 0;
    
    // Add agility to AC (in Singularity, ability scores are used directly)
    // AC = 10 + Agility + Armor bonus
    const isParalyzed = this.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed");
    const agility = isParalyzed ? 0 : (parseInt(systemData.abilities.agility) || 0);
    acBase += agility;

    // Calculate armor bonus from equipped armor
    for (const item of this.items) {
      if (item.type === "armor" && !item.system.archived) {
        acBonus += item.system.basic.acBonus || 0;
      }
    }

    systemData.combat.ac = acBase + acBonus;
    */

    // Check if Enhanced Vitality talent is selected
    const primeLevel = systemData.basic?.primeLevel || 1;
    let hasEnhancedVitality = false;
    
    // Check all progression slots for Enhanced Vitality
    for (let lvl = 1; lvl <= 20; lvl++) {
      const levelKey = `level${lvl}`;
      const levelData = systemData.progression?.[levelKey] || {};
      
      const talentNames = [
        levelData.genericTalentName,
        levelData.humanGenericTalentName,
        levelData.terranGenericTalentName,
        levelData.powersetTalentName,
        levelData.bastionTalentName
      ].filter(Boolean);
      
      for (const talentName of talentNames) {
        if (talentName && talentName.toLowerCase().includes("enhanced vitality")) {
          hasEnhancedVitality = true;
          break;
        }
      }
      
      if (hasEnhancedVitality) break;
    }
    
    // Calculate ability bonuses from progression (matches hero-sheet getData)
    const abilityBonuses = { might: 0, agility: 0, endurance: 0, wits: 0, charm: 0 };
    const addBoost = (ability) => {
      if (abilityBonuses.hasOwnProperty(ability)) {
        abilityBonuses[ability] += 1;
      }
    };
    addBoost(systemData.progression?.level1?.humanAbilityBoost);
    addBoost(systemData.progression?.level1?.terranAbilityBoost);
    addBoost(systemData.progression?.level1?.backgroundAbilityBoost);

    const powersetName = systemData.progression?.level1?.powersetName || systemData.basic?.powerset;
    if (powersetName === "Bastion") {
      abilityBonuses.endurance += 1;
      const ability1 = systemData.progression?.level1?.bastionAbilityBoost1;
      if (ability1 && ability1 !== "endurance") addBoost(ability1);
      const ability2 = systemData.progression?.level1?.bastionAbilityBoost2;
      if (ability2 && ability2 !== "endurance") addBoost(ability2);
    } else if (powersetName === "Paragon") {
      abilityBonuses.might += 1;
      const ability1 = systemData.progression?.level1?.paragonAbilityBoost1;
      if (ability1 && ability1 !== "might") addBoost(ability1);
      const ability2 = systemData.progression?.level1?.paragonAbilityBoost2;
      if (ability2 && ability2 !== "might") addBoost(ability2);
    } else if (powersetName === "Marksman") {
      abilityBonuses.agility += 1;
      const ability1 = systemData.progression?.level1?.marksmanAbilityBoost1;
      if (ability1 && ability1 !== "agility") addBoost(ability1);
      const ability2 = systemData.progression?.level1?.marksmanAbilityBoost2;
      if (ability2 && ability2 !== "agility") addBoost(ability2);
    }

    const enduranceScore = abilityBonuses.endurance || 0;

    // Calculate max HP for Bastion characters
    // Formula: (14 + Endurance) × Bastion level
    // If Ironbound is selected: (14 + Endurance × 2) × Bastion level
    // Enhanced Vitality adds: +1 × Prime Level
    if (powersetName === "Bastion") {
      const bastionLevel = primeLevel;
      
      // Check if Ironbound talent is selected
      const bastionTalentName = systemData.progression?.level1?.bastionTalentName || "";
      const hasIronbound = bastionTalentName && bastionTalentName.toLowerCase().includes("ironbound");
      
      let enduranceContribution = enduranceScore;
      if (hasIronbound) {
        enduranceContribution = enduranceScore * 2;
      }
      
      let calculatedMaxHp = (14 + enduranceContribution) * bastionLevel;
      
      // Add Enhanced Vitality bonus
      if (hasEnhancedVitality) {
        calculatedMaxHp += primeLevel;
      }
      
      // Update stored max HP and ensure current HP doesn't exceed it
      systemData.combat.hp.max = calculatedMaxHp;
      if (systemData.combat.hp.value > calculatedMaxHp) {
        systemData.combat.hp.value = calculatedMaxHp;
      }
    } else if (powersetName === "Paragon") {
      const paragonLevel = primeLevel;
      
      // Paragon HP: (12 + Endurance) × Paragon level
      let calculatedMaxHp = (12 + enduranceScore) * paragonLevel;
      
      // Add Enhanced Vitality bonus
      if (hasEnhancedVitality) {
        calculatedMaxHp += primeLevel;
      }
      
      // Update stored max HP and ensure current HP doesn't exceed it
      systemData.combat.hp.max = calculatedMaxHp;
      if (systemData.combat.hp.value > calculatedMaxHp) {
        systemData.combat.hp.value = calculatedMaxHp;
      }
    } else if (powersetName === "Gadgeteer") {
      const gadgeteerLevel = primeLevel;
      // Gadgeteer HP: (8 + Endurance) × Gadgeteer level
      let calculatedMaxHp = (8 + enduranceScore) * gadgeteerLevel;
      
      // Add Enhanced Vitality bonus if applicable
      if (hasEnhancedVitality) {
        calculatedMaxHp += primeLevel;
      }
      
      systemData.combat.hp.max = calculatedMaxHp;
      if (systemData.combat.hp.value > calculatedMaxHp) {
        systemData.combat.hp.value = calculatedMaxHp;
      }
    } else if (powersetName === "Marksman") {
      const marksmanLevel = primeLevel;
      // Marksman HP: (8 + Endurance) × Marksman level
      let calculatedMaxHp = (8 + enduranceScore) * marksmanLevel;
      
      // Add Enhanced Vitality bonus if applicable
      if (hasEnhancedVitality) {
        calculatedMaxHp += primeLevel;
      }
      
      systemData.combat.hp.max = calculatedMaxHp;
      if (systemData.combat.hp.value > calculatedMaxHp) {
        systemData.combat.hp.value = calculatedMaxHp;
      }
    } else {
      // For non-Bastion characters, add Enhanced Vitality bonus if selected
      if (hasEnhancedVitality) {
        const enhancedVitalityBonus = primeLevel;
        const baseMaxHp = systemData.combat.hp.max || 0;
        const calculatedMaxHp = baseMaxHp + enhancedVitalityBonus;

        systemData.combat.hp.max = calculatedMaxHp;
        if (systemData.combat.hp.value > calculatedMaxHp) {
          systemData.combat.hp.value = calculatedMaxHp;
        }
      } else {
        // No powerset and no Enhanced Vitality: reset max HP to 0
        systemData.combat.hp.max = 0;
        if (systemData.combat.hp.value !== 0) {
          systemData.combat.hp.value = 0;
        }
      }
    }

    // Update token size based on actor size
    this._updateTokenSize(systemData);
    
    // Ensure Unarmed Strike attack exists for all heroes
    this._ensureUnarmedStrike(systemData);
    
    // Ensure equipped weapons are added as attacks
    this._ensureEquippedWeaponAttacks(systemData);
    
    // Ensure Paragon talent skills exist (Intimidation for Dominating Presence, Persuasion for Noble Presence)
    this._ensureParagonTalentSkills(systemData);
    
    // Ensure Gadget Tuning skill exists for Gadgeteer
    this._ensureGadgetTuning(systemData);
    
    // Ensure Perception skill exists for Marksman
    this._ensureMarksmanPerception(systemData);

    // Remove powerset skills if powerset is no longer selected
    this._cleanupPowersetSkills(systemData);
  }
  
  /**
   * Ensure Gadget Tuning skill exists for Gadgeteer characters
   */
  _ensureGadgetTuning(systemData) {
    const powersetName = systemData.progression?.level1?.powersetName || systemData.basic?.powerset;
    
    if (powersetName === "Gadgeteer") {
      const primeLevel = Number(systemData.basic?.primeLevel) || 1;
      const rankOrder = {
        "Novice": 0,
        "Apprentice": 1,
        "Competent": 2,
        "Masterful": 3,
        "Legendary": 4
      };
      const targetRank = primeLevel >= 15 ? "Legendary" : primeLevel >= 10 ? "Masterful" : primeLevel >= 5 ? "Competent" : "Apprentice";

      // Initialize skills if it doesn't exist
      if (!systemData.skills) {
        systemData.skills = {};
      }
      
      // Add Gadget Tuning skill if it doesn't exist
      if (!systemData.skills["Gadget Tuning"]) {
        systemData.skills["Gadget Tuning"] = {
          rank: targetRank,
          ability: "wits",
          otherBonuses: 0,
          lockedSource: "Gadgeteer Skill Training",
          lockedByPowerset: true
        };
      } else {
        const currentRank = systemData.skills["Gadget Tuning"].rank || "Novice";
        if ((rankOrder[currentRank] ?? 0) < (rankOrder[targetRank] ?? 0)) {
          systemData.skills["Gadget Tuning"].rank = targetRank;
        }
        systemData.skills["Gadget Tuning"].lockedSource = "Gadgeteer Skill Training";
        systemData.skills["Gadget Tuning"].lockedByPowerset = true;
      }
    }
  }
  
  /**
   * Ensure Perception skill exists for Marksman characters with Apprentice training
   */
  _ensureMarksmanPerception(systemData) {
    const powersetName = systemData.progression?.level1?.powersetName || systemData.basic?.powerset;
    
    if (powersetName === "Marksman") {
      // Initialize skills if it doesn't exist
      if (!systemData.skills) {
        systemData.skills = {};
      }
      
      // Check if Perception already exists
      if (!systemData.skills["Perception"]) {
        systemData.skills["Perception"] = {
          rank: "Apprentice",
          ability: "wits",
          otherBonuses: 0,
          lockedSource: "Marksman Skill Training",
          lockedByPowerset: true
        };
      } else {
        // Ensure it has Apprentice rank if it exists
        if (!systemData.skills["Perception"].rank || systemData.skills["Perception"].rank === "Novice") {
          systemData.skills["Perception"].rank = "Apprentice";
        }
        systemData.skills["Perception"].lockedSource = "Marksman Skill Training";
        systemData.skills["Perception"].lockedByPowerset = true;
      }
    }
  }

  /**
   * Remove powerset-granted skills when powerset is removed.
   */
  _cleanupPowersetSkills(systemData) {
    if (!systemData.skills) {
      return;
    }

    const powersetName = systemData.progression?.level1?.powersetName || systemData.basic?.powerset;
    const skills = systemData.skills;

    if (powersetName !== "Marksman") {
      for (const [skillName, skill] of Object.entries(skills)) {
        if (skill?.lockedSource === "Marksman Skill Training" || skillName === "Perception") {
          delete skills[skillName];
        }
      }
    }

    if (powersetName !== "Gadgeteer") {
      for (const [skillName, skill] of Object.entries(skills)) {
        if (skill?.lockedSource === "Gadgeteer Skill Training" || skillName === "Gadget Tuning") {
          delete skills[skillName];
        }
      }
    }

    if (powersetName !== "Paragon") {
      for (const [skillName, skill] of Object.entries(skills)) {
        if (skill?.lockedSource === "Paragon Skill Training") {
          delete skills[skillName];
        }
      }
    }
  }
  
  /**
   * Ensure Paragon talent skills exist (Intimidation for Dominating Presence, Persuasion for Noble Presence)
   */
  _ensureParagonTalentSkills(systemData) {
    // Initialize skills if it doesn't exist
    if (!systemData.skills) {
      systemData.skills = {};
    }
    
    // Check for Paragon talents across all levels
    const progression = systemData.progression || {};
    let hasDominatingPresence = false;
    let hasNoblePresence = false;
    let hasLegendaryPresence = false;
    for (let lvl = 1; lvl <= 20; lvl++) {
      const levelKey = `level${lvl}`;
      const levelData = progression[levelKey] || {};
      const names = [];
      if (lvl === 1 && levelData.paragonTalentName) {
        names.push(levelData.paragonTalentName);
      }
      if (levelData.powersetTalentName) {
        names.push(levelData.powersetTalentName);
      }
      for (const name of names) {
        const lower = String(name || "").toLowerCase();
        if (lower.includes("dominating presence")) hasDominatingPresence = true;
        if (lower.includes("noble presence")) hasNoblePresence = true;
        if (lower.includes("legendary presence")) hasLegendaryPresence = true;
      }
      if (hasDominatingPresence && hasNoblePresence) break;
    }
    
    // Add Intimidation skill if Dominating Presence is selected
    if (hasDominatingPresence) {
      const presenceBonus = hasLegendaryPresence ? 6 : 4;
      if (!systemData.skills["Intimidation"]) {
        systemData.skills["Intimidation"] = {
          rank: "Novice",
          ability: "charm",
          otherBonuses: presenceBonus, // +4 or +6 bonus while flying
          lockedOtherBonuses: true, // Mark as locked (from talent)
          lockedSource: "Dominating Presence" // Track the source
        };
      } else {
        // Ensure the skill has the locked bonus
        if (!systemData.skills["Intimidation"].lockedOtherBonuses) {
          // Add the bonus if it doesn't already have it
          const existingBonus = Number(systemData.skills["Intimidation"].otherBonuses) || 0;
          if (existingBonus < presenceBonus) {
            systemData.skills["Intimidation"].otherBonuses = presenceBonus;
            systemData.skills["Intimidation"].lockedOtherBonuses = true;
            systemData.skills["Intimidation"].lockedSource = "Dominating Presence";
          }
        } else if (hasLegendaryPresence && systemData.skills["Intimidation"].otherBonuses !== presenceBonus) {
          systemData.skills["Intimidation"].otherBonuses = presenceBonus;
        }
      }
    }
    
    // Add Persuasion skill if Noble Presence is selected
    if (hasNoblePresence) {
      const presenceBonus = hasLegendaryPresence ? 6 : 4;
      if (!systemData.skills["Persuasion"]) {
        systemData.skills["Persuasion"] = {
          rank: "Novice",
          ability: "charm",
          otherBonuses: presenceBonus, // +4 or +6 bonus while flying
          lockedOtherBonuses: true, // Mark as locked (from talent)
          lockedSource: "Noble Presence" // Track the source
        };
      } else {
        // Ensure the skill has the locked bonus
        if (!systemData.skills["Persuasion"].lockedOtherBonuses) {
          // Add the bonus if it doesn't already have it
          const existingBonus = Number(systemData.skills["Persuasion"].otherBonuses) || 0;
          if (existingBonus < presenceBonus) {
            systemData.skills["Persuasion"].otherBonuses = presenceBonus;
            systemData.skills["Persuasion"].lockedOtherBonuses = true;
            systemData.skills["Persuasion"].lockedSource = "Noble Presence";
          }
        } else if (hasLegendaryPresence && systemData.skills["Persuasion"].otherBonuses !== presenceBonus) {
          systemData.skills["Persuasion"].otherBonuses = presenceBonus;
        }
      }
    }

    if (!hasDominatingPresence && systemData.skills["Intimidation"]?.lockedSource === "Dominating Presence") {
      delete systemData.skills["Intimidation"];
    }
    if (!hasNoblePresence && systemData.skills["Persuasion"]?.lockedSource === "Noble Presence") {
      delete systemData.skills["Persuasion"];
    }
  }
  
  /**
   * Ensure Unarmed Strike attack exists for the hero
   */
  _ensureUnarmedStrike(systemData) {
    // Initialize attacks array if it doesn't exist
    if (!systemData.attacks) {
      systemData.attacks = [];
    }
    
    // Check if Unarmed Strike already exists
    const hasUnarmedStrike = systemData.attacks.some(attack => 
      attack.name && attack.name.toLowerCase() === "unarmed strike"
    );
    
    // If it doesn't exist, add it
    if (!hasUnarmedStrike) {
      // Check if Paragon is selected (for Enhanced Unarmed Strikes - damage die increases by one step)
      const powersetName = systemData.progression?.level1?.powersetName || systemData.basic?.powerset;
      const primeLevel = Number(systemData.basic?.primeLevel) || 1;
      const getParagonUnarmedRank = (level) => {
        if (level >= 15) return "Legendary";
        if (level >= 10) return "Masterful";
        if (level >= 5) return "Competent";
        return "Apprentice";
      };
      let baseDamage = "1d2"; // Default unarmed strike damage
      let baseAttackBonus = 0; // Default: Novice (no bonus)
      
      if (powersetName === "Paragon") {
        // Paragon's Enhanced Unarmed Strikes: damage die increases by one step
        // 1d2 -> 1d4 -> 1d6 -> 1d8 -> 1d10 -> 1d12
        baseDamage = "1d4"; // One step up from 1d2
        
        // Paragon's Unarmed Weapon Competence scales by level
        baseAttackBonus = 0; // Competence bonus is handled elsewhere
      }
      
      // Use the newer format with baseDamage and ability (like Blast)
      // This allows dynamic calculation based on current ability score
      systemData.attacks.push({
        name: "Unarmed Strike",
        baseAttackBonus: baseAttackBonus, // Competence bonus (0 for Novice/Apprentice)
        baseDamage: baseDamage, // Base damage die
        ability: "might", // Uses Might modifier
        damageType: "kinetic",
        range: "Melee",
        cost: 1, // Energy cost to attack
        traits: ["Natural"],
        hands: 0, // Does not require a weapon
        weaponImg: "systems/singularity/img/weapons/punch.jpg", // Image for unarmed strike
        isCustom: false,
        weaponCompetenceRank: powersetName === "Paragon" ? getParagonUnarmedRank(primeLevel) : "Novice"
      });
    } else {
      // If Unarmed Strike exists, check if we need to update it for Paragon
      const powersetName = systemData.progression?.level1?.powersetName || systemData.basic?.powerset;
      const primeLevel = Number(systemData.basic?.primeLevel) || 1;
      const getParagonUnarmedRank = (level) => {
        if (level >= 15) return "Legendary";
        if (level >= 10) return "Masterful";
        if (level >= 5) return "Competent";
        return "Apprentice";
      };
      const unarmedStrike = systemData.attacks.find(attack => 
        attack.name && attack.name.toLowerCase() === "unarmed strike"
      );
      
      if (unarmedStrike) {
        if (powersetName === "Paragon") {
          // Update damage die if it's still at base (1d2)
          if (!unarmedStrike.baseDamage || unarmedStrike.baseDamage === "1d2") {
            unarmedStrike.baseDamage = "1d4"; // Enhanced Unarmed Strikes
          }
          
          // Update to use new format if it's still using legacy format
          if (!unarmedStrike.baseDamage && unarmedStrike.damage) {
            // Legacy format detected - convert to new format
            unarmedStrike.baseDamage = "1d4";
            unarmedStrike.ability = "might";
            // Keep old damage as fallback, but prefer baseDamage + ability
          }
          
          // Paragon unarmed competence scales by level
          unarmedStrike.weaponCompetenceRank = getParagonUnarmedRank(primeLevel);
          // Ensure baseAttackBonus exists (Paragon starts at Apprentice = +0, but bonus is calculated in getData)
          if (unarmedStrike.baseAttackBonus === undefined) {
            unarmedStrike.baseAttackBonus = 0;
          }
        } else {
          // Non-Paragon: Unarmed Strike is Novice (untrained)
          unarmedStrike.weaponCompetenceRank = "Novice";
          if (unarmedStrike.baseAttackBonus === undefined) {
            unarmedStrike.baseAttackBonus = 0;
          }
        }
        unarmedStrike.isCustom = false;
      }
    }
    
    // Ensure Unarmed Strike has weaponImg (for image display)
    const unarmedStrike = systemData.attacks.find(attack => 
      attack.name && attack.name.toLowerCase() === "unarmed strike"
    );
    if (unarmedStrike && !unarmedStrike.weaponImg) {
      unarmedStrike.weaponImg = "systems/singularity/img/weapons/punch.jpg";
      // Remove old icon if it exists (we're using image now)
      if (unarmedStrike.icon) {
        delete unarmedStrike.icon;
      }
    }
  }

  /**
   * Ensure equipped weapons are added as attacks
   */
  _ensureEquippedWeaponAttacks(systemData) {
    // Initialize attacks array if it doesn't exist
    if (!systemData.attacks) {
      systemData.attacks = [];
    }
    
    // Get all equipped weapons
    const equippedWeapons = this.items.filter(item => 
      item.type === "weapon" && item.system?.basic?.equipped === true
    );
    
    for (const weapon of equippedWeapons) {
      const weaponName = weapon.name;
      const weaponCategories = weapon.system?.basic?.categories || [];
      const hasThrownCategory = weaponCategories.includes("Thrown Weapons");
      const hasMeleeCategory = weaponCategories.some(cat => 
        cat === "Light Melee Weapons" || cat === "Heavy Melee Weapons" || cat === "Unarmed Strikes"
      );
      
      // Parse damage from weapon
      let baseDamage = weapon.system?.basic?.damage || "1d4";
      const damageMatch = baseDamage.match(/^(\d+d\d+)/);
      if (damageMatch) {
        baseDamage = damageMatch[1];
      }
      const weaponMods = weapon.system?.basic?.modifications || [];
      const enhancementMod = this._getWeaponEnhancementMod(weaponMods);
      baseDamage = this._applyWeaponDamageEnhancement(baseDamage, enhancementMod);
      const damageType = this._getWeaponDamageType(weapon, weaponMods);
      
      // Extract thrown range from properties if available
      let thrownRange = "15 ft.";
      const thrownProperty = weapon.system?.basic?.properties?.find(prop => 
        typeof prop === "string" && prop.toLowerCase().includes("thrown")
      );
      if (thrownProperty) {
        const rangeMatch = thrownProperty.match(/range\s+(\d+\s*ft\.)/i);
        if (rangeMatch) {
          thrownRange = rangeMatch[1];
        }
      }
      
      // If weapon has both melee and thrown categories, create separate attacks for each mode
      if (hasMeleeCategory && hasThrownCategory) {
        // Create melee attack
        const meleeAttackName = `${weaponName} (Melee)`;
        let existingMeleeIndex = systemData.attacks.findIndex(attack => 
          attack.name === meleeAttackName
        );
        
        const meleeAttack = {
          name: meleeAttackName,
          baseAttackBonus: weapon.system?.basic?.attackBonus || 0,
          baseDamage: baseDamage,
          ability: "might",
          damageType: damageType,
          range: "Melee",
          cost: weapon.system?.basic?.energyCost || 1,
          type: "melee",
          traits: weapon.system?.basic?.properties || [],
          weaponMode: "melee",
          weaponId: weapon.id || weapon._id,
          isCustom: false
        };
        
        if (existingMeleeIndex === -1) {
          systemData.attacks.push(meleeAttack);
        } else {
          systemData.attacks[existingMeleeIndex] = { ...systemData.attacks[existingMeleeIndex], ...meleeAttack };
        }
        
        // Create thrown attack
        const thrownAttackName = `${weaponName} (Thrown)`;
        let existingThrownIndex = systemData.attacks.findIndex(attack => 
          attack.name === thrownAttackName
        );
        
        const thrownAttack = {
          name: thrownAttackName,
          baseAttackBonus: weapon.system?.basic?.attackBonus || 0,
          baseDamage: baseDamage,
          ability: "agility",
          damageType: damageType,
          range: thrownRange,
          cost: weapon.system?.basic?.energyCost || 1,
          type: "ranged",
          traits: weapon.system?.basic?.properties || [],
          weaponMode: "thrown",
          weaponId: weapon.id || weapon._id,
          isCustom: false
        };
        
        if (existingThrownIndex === -1) {
          systemData.attacks.push(thrownAttack);
        } else {
          systemData.attacks[existingThrownIndex] = { ...systemData.attacks[existingThrownIndex], ...thrownAttack };
        }
      } else {
        // Standard single-mode weapon (melee or ranged, but not both)
        const weaponType = weapon.system?.basic?.type || (hasThrownCategory ? "ranged" : "melee");
        const ability = weaponType === "ranged" || hasThrownCategory ? "agility" : "might";
        
        let existingAttackIndex = systemData.attacks.findIndex(attack => 
          attack.name && attack.name.toLowerCase() === weaponName.toLowerCase() &&
          !attack.name.includes("(Melee)") && !attack.name.includes("(Thrown)")
        );
        
        const standardAttack = {
          name: weaponName,
          baseAttackBonus: weapon.system?.basic?.attackBonus || 0,
          baseDamage: baseDamage,
          ability: ability,
          damageType: damageType,
          range: weapon.system?.basic?.range || (weaponType === "ranged" || hasThrownCategory ? thrownRange : "Melee"),
          cost: weapon.system?.basic?.energyCost || 1,
          type: weaponType,
          traits: weapon.system?.basic?.properties || [],
          weaponId: weapon.id || weapon._id,
          isCustom: false
        };
        
        if (existingAttackIndex === -1) {
          systemData.attacks.push(standardAttack);
        } else {
          systemData.attacks[existingAttackIndex] = { ...systemData.attacks[existingAttackIndex], ...standardAttack };
        }
      }
    }
    
    // Remove attacks for weapons that are no longer equipped or don't exist
    systemData.attacks = systemData.attacks.filter(attack => {
      if (attack?.isCustom || attack?.isTalentAttack) {
        return true;
      }
      if (attack?.name && attack.name.toLowerCase() === "blast") {
        return true;
      }
      // Keep Unarmed Strike
      if (attack.name && attack.name.toLowerCase() === "unarmed strike") {
        return true;
      }
      
      // Extract base weapon name (remove mode suffix)
      const weaponName = attack.name?.replace(/\s*\(Melee\)$/i, "").replace(/\s*\(Thrown\)$/i, "");
      const matchingWeapon = equippedWeapons.find(w => 
        w.name && weaponName && w.name.toLowerCase() === weaponName.toLowerCase()
      );
      
      return matchingWeapon !== undefined;
    });
  }

  _getWeaponEnhancementMod(mods) {
    const enhancements = Array.isArray(mods) ? mods.filter(mod => mod?.type === "damage-enhancement") : [];
    if (!enhancements.length) return null;
    return enhancements.sort((a, b) => (Number(b.tier) || 0) - (Number(a.tier) || 0))[0];
  }

  _applyWeaponDamageEnhancement(damage, enhancementMod) {
    if (!enhancementMod || !damage) return damage;
    const match = String(damage).match(/(\d+)\s*d\s*(\d+)/i);
    if (!match) return damage;
    const dice = Number(match[1]);
    const die = Number(match[2]);
    if (!dice || !die) return damage;
    const addDice = die <= 6
      ? Number(enhancementMod.addDiceSmall ?? 2)
      : Number(enhancementMod.addDiceLarge ?? 1);
    const safeAdd = Number.isNaN(addDice) ? 0 : addDice;
    const newDice = dice + safeAdd;
    return String(damage).replace(match[0], `${newDice}d${die}`);
  }

  _getWeaponDamageType(weapon, mods) {
    const modList = Array.isArray(mods) ? mods : (weapon?.system?.basic?.modifications || []);
    const conversion = modList.find(mod => mod?.type === "damage-type-conversion" && mod?.damageType);
    return conversion?.damageType || weapon?.system?.basic?.damageType || "kinetic";
  }

  /**
   * Update token size based on actor size category
   */
  _updateTokenSize(systemData) {
    const size = systemData.basic?.size || "Medium";
    
    // Size to grid space mapping (from size.html)
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
    
    // Update prototype token dimensions
    if (this.prototypeToken) {
      this.prototypeToken.updateSource({
        width: gridSize,
        height: gridSize
      });
    }
  }

  /**
   * Prepare NPC type specific data
   */
  _prepareNpcData(systemData) {
    // Calculate AC from armor
    let acBase = 10;
    let acBonus = 0;
    
    // Add agility to AC (in Singularity, ability scores are used directly)
    // AC = 10 + Agility + Armor bonus
    const isParalyzed = this.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed");
    const agility = isParalyzed ? 0 : (parseInt(systemData.abilities.agility) || 0);
    acBase += agility;
    if (this.effects?.some(effect => effect.getFlag("core", "statusId") === "offbalance")) {
      acBase -= 2;
    }

    // Calculate armor bonus from equipped armor
    for (const item of this.items) {
      if (item.type === "armor" && !item.system.archived) {
        acBonus += item.system.basic.acBonus || 0;
      }
    }

    systemData.combat.ac = acBase + acBonus;

    // Ensure Unarmed Strike attack exists for NPCs (matches heroes)
    this._ensureUnarmedStrike(systemData);

    // Ensure equipped weapons are added as attacks (similar to heroes)
    this._ensureEquippedWeaponAttacks(systemData);

    // Ensure HP doesn't exceed max
    if (systemData.combat.hp.value > systemData.combat.hp.max) {
      systemData.combat.hp.value = systemData.combat.hp.max;
    }
  }

  /**
   * Get ability modifier
   * In Singularity, "A score of 0 represents an average level of ability"
   * So 0 = average = 0 modifier
   * The modifier appears to be calculated as: score / 2 (rounded down)
   * This means: 0 = 0, +2 = +1, +4 = +2, -2 = -1, etc.
   */
  getAbilityModifier(ability) {
    const value = this.system.abilities[ability.toLowerCase()];
    if (value === null || value === undefined || value === "") return 0;
    const numValue = parseInt(value) || 0; // Default to 0 (average) if invalid
    // In Singularity, 0 is average, so modifier = score / 2
    return Math.floor(numValue / 2);
  }

  /**
   * Get skill modifier
   */
  getSkillModifier(skillName) {
    const skills = this.system.skills || {};
    const skill = skills[skillName];
    const noisyPenalty = skillName === "Stealth" ? this._getNoisyPenalty() : 0;
    const stealthyBonus = skillName === "Stealth" ? this._getStealthyBonus() : 0;
    if (!skill) {
      // If not trained, return only ability score
      const ability = this._getSkillAbility(skillName);
      return this.getAbilityScore(ability) + stealthyBonus - noisyPenalty;
    }

    const ability = skill.ability || this._getSkillAbility(skillName);
    const abilityScore = this.getAbilityScore(ability);
    const trainingBonus = this._getTrainingBonus(skill.rank || "Novice");
    const otherBonuses = Number(skill.otherBonuses) || 0;
    
    return abilityScore + trainingBonus + otherBonuses + stealthyBonus - noisyPenalty;
  }

  /**
   * Get noisy armor penalty to Stealth (Noisy (X))
   */
  _getNoisyPenalty() {
    const armors = this.items.filter(item => item.type === "armor" && item.system?.basic?.equipped);
    let highest = 0;
    for (const armor of armors) {
      const traits = armor.system?.basic?.traits || armor.system?.basic?.properties || [];
      const mods = armor.system?.basic?.modifications || [];
      const silenceReduction = Array.isArray(mods)
        ? mods.filter(mod => mod?.type === "silence").reduce((total, mod) => total + (Number(mod.value) || 0), 0)
        : 0;
      const traitList = Array.isArray(traits) ? traits : String(traits).split(",").map(t => t.trim());
      let armorNoisy = 0;
      for (const trait of traitList) {
        const match = String(trait).match(/Noisy\s*\((\d+)\)/i);
        if (match) {
          armorNoisy = Math.max(armorNoisy, Number(match[1]));
        } else if (/^Noisy$/i.test(String(trait))) {
          armorNoisy = Math.max(armorNoisy, 1);
        }
      }
      armorNoisy = Math.max(0, armorNoisy - silenceReduction);
      highest = Math.max(highest, armorNoisy);
    }
    return highest;
  }

  /**
   * Get stealthy armor bonus to Stealth (Stealthy (X))
   */
  _getStealthyBonus() {
    const armors = this.items.filter(item => item.type === "armor" && item.system?.basic?.equipped);
    let highest = 0;
    for (const armor of armors) {
      const traits = armor.system?.basic?.traits || armor.system?.basic?.properties || [];
      const traitList = Array.isArray(traits) ? traits : String(traits).split(",").map(t => t.trim());
      for (const trait of traitList) {
        const match = String(trait).match(/Stealthy\s*\((\d+)\)/i);
        if (match) {
          highest = Math.max(highest, Number(match[1]));
        } else if (/^Stealthy$/i.test(String(trait))) {
          highest = Math.max(highest, 1);
        }
      }
    }
    return highest;
  }

  /**
   * Get training bonus for a rank
   */
  _getTrainingBonus(rank) {
    const bonuses = {
      "Novice": 0,
      "Apprentice": 4,
      "Competent": 8,
      "Masterful": 12,
      "Legendary": 16
    };
    return bonuses[rank] || 0;
  }

  /**
   * Get ability associated with a skill
   */
  _getSkillAbility(skillName) {
    const skillMap = {
      "Athletics": "might",
      "Acrobatics": "agility",
      "Dexterity": "agility",
      "Piloting (Flying Vehicles)": "agility",
      "Piloting (Land Vehicles)": "agility",
      "Piloting (Aquatic Vehicles)": "agility",
      "Stealth": "agility",
      "Animal Handling": "wits",
      "Electricity": "wits",
      "Insight": "wits",
      "Investigation": "wits",
      "Lore (History)": "wits",
      "Lore (Medicine)": "wits",
      "Lore (Nature)": "wits",
      "Lore (Religion)": "wits",
      "Lore (Technology)": "wits",
      "Perception": "wits",
      "Survival": "wits",
      "Deception": "charm",
      "Intimidation": "charm",
      "Performance": "charm",
      "Persuasion": "charm"
    };
    return skillMap[skillName] || "wits";
  }
}
