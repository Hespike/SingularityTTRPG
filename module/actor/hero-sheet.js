/**
 * Hero Character Sheet
 * @extends {foundry.appv1.sheets.ActorSheet}
 */
export class SingularityActorSheetHero extends foundry.appv1.sheets.ActorSheet {
  constructor(...args) {
    super(...args);
    
    // Register Handlebars helpers
    if (typeof Handlebars !== 'undefined') {
      if (!Handlebars.helpers.capitalize) {
        Handlebars.registerHelper('capitalize', function(str) {
          if (!str) return '';
          return str.charAt(0).toUpperCase() + str.slice(1);
        });
      }
      if (!Handlebars.helpers.gt) {
        Handlebars.registerHelper('gt', function(a, b) {
          return a > b;
        });
      }
      if (!Handlebars.helpers.lte) {
        Handlebars.registerHelper('lte', function(a, b) {
          return a <= b;
        });
      }
      if (!Handlebars.helpers.times) {
        Handlebars.registerHelper('times', function(n, block) {
          var accum = '';
          for(var i = 0; i < n; ++i) {
            accum += block.fn(i);
          }
          return accum;
        });
      }
      if (!Handlebars.helpers.add) {
        Handlebars.registerHelper('add', function(a, b) {
          return a + b;
        });
      }
      if (!Handlebars.helpers.lookup) {
        Handlebars.registerHelper('lookup', function(obj, field) {
          return obj && obj[field];
        });
      }
      if (!Handlebars.helpers.contains) {
        Handlebars.registerHelper('contains', function(array, value) {
          if (!Array.isArray(array)) return false;
          return array.includes(value);
        });
      }
    }
  }
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["singularity", "sheet", "actor", "hero"],
      template: "systems/singularity/templates/actor-sheets/hero-sheet.html",
      width: 800,
      height: 900,
      resizable: true,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }],
      scrollY: [".sheet-body"]
    });
  }

  /** @override */
  getTitle() {
    // Return just the actor's name, not the TYPES.Actor.hero format
    return this.actor?.name || "Unnamed Hero";
  }

  /** @override */
  async getData(options = {}) {
    try {
      const context = await super.getData(options);
      // Ensure cssClass is set correctly for template
      if (!context.cssClass || !context.cssClass.includes('singularity')) {
        context.cssClass = "singularity sheet actor hero";
      }
      const actorData = context.actor;

      // Initialize progression early to avoid errors (use safe defaults, don't modify actor data)
      const progression = actorData.system.progression || {};
      const level1 = progression.level1 || {};

      // Ensure numeric fields have proper defaults for display (use safe defaults)
      const abilities = actorData.system.abilities || {};
      const combat = actorData.system.combat || {};
      const basic = actorData.system.basic || {};
      
      // Get powersetName early since it's used in multiple places
      const powersetName = actorData.system.progression?.level1?.powersetName || actorData.system.basic?.powerset;
      
      // Use safe defaults without modifying actor data
      const safeAbilities = {
        might: abilities.might ?? 0,
        agility: abilities.agility ?? 0,
        endurance: abilities.endurance ?? 0,
        wits: abilities.wits ?? 0,
        charm: abilities.charm ?? 0
      };
      
      const safeCombat = {
        hp: {
          value: combat.hp?.value ?? 0,
          max: combat.hp?.max ?? 0
        },
        ac: combat.ac ?? 10,
        speed: combat.speed ?? 25,
        speeds: combat.speeds || {},
        initiative: combat.initiative || { rank: "Novice", otherBonuses: 0 }
      };
      
      const safeBasic = {
        primeLevel: basic.primeLevel ?? 1,
        phenotype: basic.phenotype || "",
        subtype: basic.subtype || "",
        size: basic.size || "Medium",
        background: basic.background || "",
        powerset: basic.powerset || ""
      };
      const primeLevel = safeBasic.primeLevel || 1;
      
      // Store safe defaults in context (don't modify actor data)
      context.speeds = safeCombat.speeds;

      // Helper function to get all talent names (embedded + progression) - reusable throughout getData
      const getAllTalentNames = () => {
        const embeddedTalents = actorData.items.filter(i => i.type === "talent");
        const progressionTalentNames = [];
        
        // Check all progression levels
        for (let level = 1; level <= 20; level++) {
          const levelKey = `level${level}`;
          const levelData = actorData.system.progression?.[levelKey] || {};
          
          // Check level 1 specific slots
          if (level === 1) {
            if (levelData.humanGenericTalentName) {
              progressionTalentNames.push(levelData.humanGenericTalentName);
            }
            if (levelData.terranGenericTalentName) {
              progressionTalentNames.push(levelData.terranGenericTalentName);
            }
            if (levelData.bastionTalentName) {
              progressionTalentNames.push(levelData.bastionTalentName);
            }
            if (levelData.paragonTalentName) {
              progressionTalentNames.push(levelData.paragonTalentName);
            }
            if (levelData.gadgeteerTalentName) {
              progressionTalentNames.push(levelData.gadgeteerTalentName);
            }
            if (levelData.marksmanTalentName) {
              progressionTalentNames.push(levelData.marksmanTalentName);
            }
          }
          
          // Check generic talent slots for all levels
          if (levelData.genericTalentName) {
            progressionTalentNames.push(levelData.genericTalentName);
          }
          if (levelData.powersetTalentName) {
            progressionTalentNames.push(levelData.powersetTalentName);
          }
        }
        
        return [
          ...embeddedTalents.map(t => t.name),
          ...progressionTalentNames
        ];
      };

      // Organize items by type (ensure items array exists)
      const items = actorData.items || [];
      
      // Process weapons to add competence information
      const weaponsWithCompetence = items.filter(i => i && i.type === "weapon").map(weapon => {
        const weaponCopy = foundry.utils.deepClone(weapon);
        const weaponCategories = weaponCopy.system?.basic?.categories || [];
        let weaponCompetenceRank = "Novice";
        let weaponCompetenceBonus = 0;
        
        // Helper to extract rank from talent name
        const extractRank = (talentName) => {
          if (!talentName) return "Novice";
          const nameLower = talentName.toLowerCase();
          if (nameLower.includes("legendary")) return "Legendary";
          if (nameLower.includes("masterful")) return "Masterful";
          if (nameLower.includes("competent")) return "Competent";
          if (nameLower.includes("apprentice")) return "Apprentice";
          return "Novice";
        };
        
        // Check weapon categories for Weapon Training talents
        if (weaponCategories.length > 0) {
          let foundTraining = false;
          let highestRank = "Novice";
          let highestBonus = 0;
          
          for (let lvl = 1; lvl <= 20; lvl++) {
            const levelKey = `level${lvl}`;
            const levelData = progression[levelKey] || {};
            
            // Check humanGenericTalent
            if (levelData.humanGenericTalentName && 
                levelData.humanGenericTalentName.toLowerCase().includes("weapon training") &&
                levelData.humanGenericTalentWeaponCategory) {
              if (weaponCategories.includes(levelData.humanGenericTalentWeaponCategory)) {
                const rank = extractRank(levelData.humanGenericTalentName);
                const bonus = rank === "Apprentice" ? 4 : rank === "Competent" ? 8 : rank === "Masterful" ? 12 : rank === "Legendary" ? 16 : 0;
                if (bonus > highestBonus) {
                  highestRank = rank;
                  highestBonus = bonus;
                  foundTraining = true;
                }
              }
            }
            
            // Check terranGenericTalent
            if (levelData.terranGenericTalentName && 
                levelData.terranGenericTalentName.toLowerCase().includes("weapon training") &&
                levelData.terranGenericTalentWeaponCategory) {
              if (weaponCategories.includes(levelData.terranGenericTalentWeaponCategory)) {
                const rank = extractRank(levelData.terranGenericTalentName);
                const bonus = rank === "Apprentice" ? 4 : rank === "Competent" ? 8 : rank === "Masterful" ? 12 : rank === "Legendary" ? 16 : 0;
                if (bonus > highestBonus) {
                  highestRank = rank;
                  highestBonus = bonus;
                  foundTraining = true;
                }
              }
            }
            
            // Check genericTalent
            if (levelData.genericTalentName && 
                levelData.genericTalentName.toLowerCase().includes("weapon training") &&
                levelData.genericTalentWeaponCategory) {
              if (weaponCategories.includes(levelData.genericTalentWeaponCategory)) {
                const rank = extractRank(levelData.genericTalentName);
                const bonus = rank === "Apprentice" ? 4 : rank === "Competent" ? 8 : rank === "Masterful" ? 12 : rank === "Legendary" ? 16 : 0;
                if (bonus > highestBonus) {
                  highestRank = rank;
                  highestBonus = bonus;
                  foundTraining = true;
                }
              }
            }
          }
          
          // Check Paragon Unarmed Strike
          if (weaponCategories.includes("Unarmed Strikes") && powersetName === "Paragon") {
            if (4 > highestBonus) {
              highestRank = "Apprentice";
              highestBonus = 4;
              foundTraining = true;
            }
          }
          
          // Check Marksman Ranged Weapon Training
          if (weaponCategories.includes("Ranged Weapons") && powersetName === "Marksman") {
            let marksmanRank = "Apprentice";
            let marksmanBonus = 4;
            if (primeLevel >= 15) {
              marksmanRank = "Legendary";
              marksmanBonus = 16;
            } else if (primeLevel >= 10) {
              marksmanRank = "Masterful";
              marksmanBonus = 12;
            } else if (primeLevel >= 5) {
              marksmanRank = "Competent";
              marksmanBonus = 8;
            }
            if (marksmanBonus > highestBonus) {
              highestRank = marksmanRank;
              highestBonus = marksmanBonus;
              foundTraining = true;
            }
          }
          
          if (foundTraining) {
            weaponCompetenceRank = highestRank;
            weaponCompetenceBonus = highestBonus;
          }
        }
        // Fallback: Check Unarmed Strike by name
        else if (weaponCopy.name && weaponCopy.name.toLowerCase() === "unarmed strike") {
          if (powersetName === "Paragon") {
            weaponCompetenceRank = "Apprentice";
            weaponCompetenceBonus = 4;
          }
        }
        // Fallback: Check ranged weapons (Marksman) by type
        else if (weaponCopy.system?.basic?.type === "ranged" && powersetName === "Marksman") {
          if (primeLevel >= 15) {
            weaponCompetenceRank = "Legendary";
            weaponCompetenceBonus = 16;
          } else if (primeLevel >= 10) {
            weaponCompetenceRank = "Masterful";
            weaponCompetenceBonus = 12;
          } else if (primeLevel >= 5) {
            weaponCompetenceRank = "Competent";
            weaponCompetenceBonus = 8;
          } else if (primeLevel >= 1) {
            weaponCompetenceRank = "Apprentice";
            weaponCompetenceBonus = 4;
          }
        }
        
        weaponCopy.weaponCompetenceRank = weaponCompetenceRank;
        weaponCopy.weaponCompetenceBonus = weaponCompetenceBonus;
        
        // Format properties array as comma-separated string for display
        if (weaponCopy.system?.basic?.properties && Array.isArray(weaponCopy.system.basic.properties)) {
          weaponCopy.system.basic.propertiesDisplay = weaponCopy.system.basic.properties.join(", ");
        } else {
          weaponCopy.system.basic.propertiesDisplay = "";
        }
        
        return weaponCopy;
      });
      
      context.weapons = weaponsWithCompetence;
      
      // Process armor items - format traits array as a string for display
      const armorItems = items.filter(i => i && i.type === "armor");
      context.armor = armorItems.map(armor => {
        const armorCopy = foundry.utils.deepClone(armor);
        // Format traits array as comma-separated string
        if (armorCopy.system?.basic?.traits && Array.isArray(armorCopy.system.basic.traits)) {
          armorCopy.system.basic.traitsDisplay = armorCopy.system.basic.traits.join(", ");
        } else {
          armorCopy.system.basic.traitsDisplay = "";
        }
        return armorCopy;
      });
      
      context.talents = items.filter(i => i && i.type === "talent");
      context.equipment = items.filter(i => i && i.type === "equipment");

      // Calculate ability bonuses from progression (Human, Terran, etc.) FIRST
    // Ability scores start at 0 and are increased by bonuses
    const abilityBonuses = {
      might: 0,
      agility: 0,
      endurance: 0,
      wits: 0,
      charm: 0
    };
    
    // Check Human ability boost
    if (actorData.system.progression?.level1?.humanAbilityBoost) {
      const ability = actorData.system.progression.level1.humanAbilityBoost;
      if (abilityBonuses.hasOwnProperty(ability)) {
        abilityBonuses[ability] += 1;
      }
    }
    
    // Check Terran ability boost
    if (actorData.system.progression?.level1?.terranAbilityBoost) {
      const ability = actorData.system.progression.level1.terranAbilityBoost;
      if (abilityBonuses.hasOwnProperty(ability)) {
        abilityBonuses[ability] += 1;
      }
    }
    
    // Check Background ability boost
    if (actorData.system.progression?.level1?.backgroundAbilityBoost) {
      const ability = actorData.system.progression.level1.backgroundAbilityBoost;
      if (abilityBonuses.hasOwnProperty(ability)) {
        abilityBonuses[ability] += 1;
      }
    }
    
    // Check Bastion powerset benefits
    if (powersetName === "Bastion") {
      // +1 Endurance boost at level 1
      abilityBonuses.endurance += 1;
      
      // +2 ability boost distribution (stored in bastionAbilityBoost1 and bastionAbilityBoost2)
      // Can be +2 to one ability or +1 to two different abilities (not Endurance)
      if (actorData.system.progression?.level1?.bastionAbilityBoost1) {
        const ability1 = actorData.system.progression.level1.bastionAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "endurance") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (actorData.system.progression?.level1?.bastionAbilityBoost2) {
        const ability2 = actorData.system.progression.level1.bastionAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "endurance") {
          abilityBonuses[ability2] += 1;
        }
      }
    } else if (powersetName === "Paragon") {
      // +1 Might boost at level 1
      abilityBonuses.might += 1;
      
      // +2 ability boost distribution (stored in paragonAbilityBoost1 and paragonAbilityBoost2)
      // Can be +2 to one ability or +1 to two different abilities (not Might)
      if (actorData.system.progression?.level1?.paragonAbilityBoost1) {
        const ability1 = actorData.system.progression.level1.paragonAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "might") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (actorData.system.progression?.level1?.paragonAbilityBoost2) {
        const ability2 = actorData.system.progression.level1.paragonAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "might") {
          abilityBonuses[ability2] += 1;
        }
      }
    } else if (powersetName === "Marksman") {
      // +1 Agility boost at level 1
      abilityBonuses.agility += 1;
      
      // +2 ability boost distribution (stored in marksmanAbilityBoost1 and marksmanAbilityBoost2)
      // Can be +2 to one ability or +1 to two different abilities (not Agility)
      if (actorData.system.progression?.level1?.marksmanAbilityBoost1) {
        const ability1 = actorData.system.progression.level1.marksmanAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "agility") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (actorData.system.progression?.level1?.marksmanAbilityBoost2) {
        const ability2 = actorData.system.progression.level1.marksmanAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "agility") {
          abilityBonuses[ability2] += 1;
        }
      }
    }
    
    // Calculate final ability scores (base 0 + bonuses) for display
    const abilityNames = ["might", "agility", "endurance", "wits", "charm"];
    const calculatedAbilityScores = {};
    for (const ability of abilityNames) {
      const bonus = abilityBonuses[ability] || 0;
      // Ability scores are calculated from bonuses only (base is 0)
      calculatedAbilityScores[ability] = bonus;
    }
    
    // Store calculated scores in context (don't modify actor data)
    context.calculatedAbilityScores = calculatedAbilityScores;
    context.abilityBonuses = abilityBonuses;
    
    // Calculate ability breakdowns for display
    const abilityBreakdowns = {};
    for (const ability of abilityNames) {
      const breakdown = {
        base: 0,
        sources: []
      };
      
      // Check Human ability boost
      if (actorData.system.progression?.level1?.humanAbilityBoost === ability) {
        breakdown.sources.push({ name: "Human Ability Boost", value: 1 });
      }
      
      // Check Terran ability boost
      if (actorData.system.progression?.level1?.terranAbilityBoost === ability) {
        breakdown.sources.push({ name: "Terran Ability Boost", value: 1 });
      }
      
      // Check Background ability boost
      if (actorData.system.progression?.level1?.backgroundAbilityBoost === ability) {
        const backgroundName = actorData.system.basic?.background || "Background";
        breakdown.sources.push({ name: `${backgroundName} Ability Boost`, value: 1 });
      }
      
      // Check powerset benefits
      if (powersetName === "Bastion") {
        if (ability === "endurance") {
          breakdown.sources.push({ name: "Bastion Level 1 Bonus", value: 1 });
        }
        if (actorData.system.progression?.level1?.bastionAbilityBoost1 === ability) {
          breakdown.sources.push({ name: "Bastion Ability Boost", value: 1 });
        }
        if (actorData.system.progression?.level1?.bastionAbilityBoost2 === ability) {
          breakdown.sources.push({ name: "Bastion Ability Boost", value: 1 });
        }
      } else if (powersetName === "Paragon") {
        if (ability === "might") {
          breakdown.sources.push({ name: "Paragon Level 1 Bonus", value: 1 });
        }
        if (actorData.system.progression?.level1?.paragonAbilityBoost1 === ability) {
          breakdown.sources.push({ name: "Paragon Ability Boost", value: 1 });
        }
        if (actorData.system.progression?.level1?.paragonAbilityBoost2 === ability) {
          breakdown.sources.push({ name: "Paragon Ability Boost", value: 1 });
        }
      } else if (powersetName === "Marksman") {
        if (ability === "agility") {
          breakdown.sources.push({ name: "Marksman Level 1 Bonus", value: 1 });
        }
        if (actorData.system.progression?.level1?.marksmanAbilityBoost1 === ability) {
          breakdown.sources.push({ name: "Marksman Ability Boost", value: 1 });
        }
        if (actorData.system.progression?.level1?.marksmanAbilityBoost2 === ability) {
          breakdown.sources.push({ name: "Marksman Ability Boost", value: 1 });
        }
      }
      
      // Calculate total
      breakdown.total = breakdown.sources.reduce((sum, source) => sum + source.value, 0);
      
      abilityBreakdowns[ability] = breakdown;
    }
    context.abilityBreakdowns = abilityBreakdowns;
    
      // Calculate AC: Base AC (from armor or 10 if unarmored) + Agility (up to cap) + Powerset bonus + Other bonuses
      let calculatedAc = 10; // Base unarmored AC
      let armorBaseAc = 0;
      let agilityCap = null;
      let mightRequirement = null;
      let equippedArmor = null;
      
      // Check if character is wearing armor (reuse armorItems from above)
      // Find equipped armor (only one can be equipped at a time)
      equippedArmor = armorItems.find(armor => armor.system?.basic?.equipped === true);
      
      if (equippedArmor) {
        armorBaseAc = equippedArmor.system?.basic?.baseAC || 0;
        agilityCap = equippedArmor.system?.basic?.agilityCap;
        mightRequirement = equippedArmor.system?.basic?.mightRequirement;
        calculatedAc = armorBaseAc;
      }
      
      // Check armor training to calculate untrained penalties
      const allTalentNames = getAllTalentNames();
      
      // Check for armor training (hierarchy: Heavy > Medium > Light)
      // Heavy Armor Training can come from:
      // 1. "Heavy Armor Training" talent
      // 2. "Heavy Armor" skill (from Bastion) - only if Bastion is present
      const hasHeavyArmorTrainingTalent = allTalentNames.some(name => 
        name && name.toLowerCase().includes("heavy armor training")
      );
      
      // Check if Bastion is present (which grants Heavy Armor skill)
      const hasBastion = powersetName === "Bastion";
      const heavyArmorSkill = actorData.system.skills?.["Heavy Armor"];
      const hasHeavyArmorSkill = heavyArmorSkill && 
                                  heavyArmorSkill.rank && 
                                  heavyArmorSkill.rank !== "Novice";
      
      // Heavy Armor Training is valid if:
      // - Has "Heavy Armor Training" talent, OR
      // - Has "Heavy Armor" skill AND Bastion is present (Bastion grants this skill)
      const hasHeavyArmorTraining = hasHeavyArmorTrainingTalent || (hasHeavyArmorSkill && hasBastion);
      
      const hasMediumArmorTraining = allTalentNames.some(name => 
        name && name.toLowerCase().includes("medium armor training")
      );
      
      const hasLightArmorTraining = allTalentNames.some(name => 
        name && name.toLowerCase().includes("light armor training")
      );
      
      // Determine effective training level (hierarchy applies)
      let effectiveTraining = "none";
      if (hasHeavyArmorTraining) {
        effectiveTraining = "heavy"; // Heavy includes Medium and Light
      } else if (hasMediumArmorTraining) {
        effectiveTraining = "medium"; // Medium includes Light
      } else if (hasLightArmorTraining) {
        effectiveTraining = "light";
      }
      
      // Calculate untrained armor penalty
      let untrainedPenalty = 0;
      if (equippedArmor) {
        const armorType = equippedArmor.system?.basic?.type?.toLowerCase() || "";
        
        // Apply penalty based on armor type and training level
        if (armorType === "light") {
          if (effectiveTraining === "none") {
            untrainedPenalty = -3;
          }
          // If has any training (light, medium, or heavy), penalty is 0
        } else if (armorType === "medium") {
          if (effectiveTraining === "none") {
            untrainedPenalty = -6;
          } else if (effectiveTraining === "light") {
            untrainedPenalty = -3;
          }
          // If has medium or heavy training, penalty is 0
        } else if (armorType === "heavy") {
          if (effectiveTraining === "none") {
            untrainedPenalty = -9;
          } else if (effectiveTraining === "light") {
            untrainedPenalty = -6;
          } else if (effectiveTraining === "medium") {
            untrainedPenalty = -3;
          }
          // If has heavy training, penalty is 0
        }
      }
      
      // Apply untrained penalty to AC
      calculatedAc += untrainedPenalty;
      
      // Add Agility modifier (up to agility cap if wearing armor)
      const agility = calculatedAbilityScores.agility || 0;
      const might = calculatedAbilityScores.might || 0;
      let agilityContribution = 0;
      const isStunned = this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "stunned");
      const isParalyzed = this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed");
      const isProneStatus = this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "prone");
      const isOffBalance = this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "offbalance");
      
      // Check if character meets Might requirement for armor
      let meetsMightRequirement = true;
      if (equippedArmor && mightRequirement !== null) {
        meetsMightRequirement = might >= mightRequirement;
      }
      
      if (meetsMightRequirement) {
        // Can add Agility modifier
        if (equippedArmor && agilityCap !== null) {
          // If wearing armor with an agility cap, limit the agility contribution
          agilityContribution = Math.min(agility, agilityCap);
        } else {
          // If unarmored or armor has no cap, use full agility
          agilityContribution = agility;
        }
      }
      // If doesn't meet Might requirement, agilityContribution stays 0
      if (isStunned || isParalyzed) {
        agilityContribution = 0;
      }
      
      calculatedAc += agilityContribution;

      if (isOffBalance) {
        calculatedAc -= 2;
      }
      
      // Add powerset bonus (Bastion)
      let powersetAcBonus = 0;
      if (powersetName === "Bastion") {
        const currentLevel = safeBasic.primeLevel;
        // AC bonus scaling: +2 at 1, +4 at 5, +6 at 10, +8 at 15, +10 at 20
        if (currentLevel >= 20) powersetAcBonus = 10;
        else if (currentLevel >= 15) powersetAcBonus = 8;
        else if (currentLevel >= 10) powersetAcBonus = 6;
        else if (currentLevel >= 5) powersetAcBonus = 4;
        else if (currentLevel >= 1) powersetAcBonus = 2;
      }
      context.powersetAcBonus = powersetAcBonus;
      calculatedAc += powersetAcBonus;
      
      // Calculate Might deficit for speed penalty (if armor is equipped)
      let mightDeficit = 0;
      if (equippedArmor && mightRequirement !== null) {
        mightDeficit = mightRequirement - might;
      }
      
      // Store calculated AC and breakdown for display
      context.calculatedAc = calculatedAc;
      context.acBreakdown = {
        base: equippedArmor ? armorBaseAc : 10,
        agility: agilityContribution,
        agilityCap: agilityCap,
        mightRequirement: mightRequirement,
        might: might,
        mightDeficit: mightDeficit,
        meetsMightRequirement: meetsMightRequirement,
        stunned: isStunned,
        paralyzed: isParalyzed,
        prone: isProneStatus,
        proneMeleeAc: isProneStatus ? -2 : 0,
        proneRangedAc: isProneStatus ? 2 : 0,
        offBalance: isOffBalance,
        offBalanceAc: isOffBalance ? -2 : 0,
        powersetBonus: powersetAcBonus,
        untrainedPenalty: untrainedPenalty,
        effectiveTraining: effectiveTraining,
        armorType: equippedArmor ? (equippedArmor.system?.basic?.type?.toLowerCase() || null) : null,
        total: calculatedAc,
        isArmored: !!equippedArmor,
        armorName: equippedArmor ? equippedArmor.name : null
      };
      
      // Store might deficit for speed calculation (will be used later)
      context.armorMightDeficit = mightDeficit;

    // Calculate Initiative: Wits + Training Bonus + Other Bonuses
    const wits = calculatedAbilityScores.wits || 0;
    const initiativeData = safeCombat.initiative;
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

    // Skills - calculate total bonus for each skill
    // According to handbook: Novice +0, Apprentice +4, Competent +8, Masterful +12, Legendary +16
    // Note: Paragon talent skills (Intimidation, Persuasion) are added in actor.js prepareData
    const skills = foundry.utils.deepClone(actorData.system.skills || {});
    const trainingBonuses = {
      "Novice": 0,
      "Apprentice": 4,
      "Competent": 8,
      "Masterful": 12,
      "Legendary": 16
    };
    
    // Add total bonus to each skill for display (use calculated ability scores)
    // Separate editable skills from locked training skills (Heavy Armor, Weapon Training)
    const skillsWithBonus = {};
    const lockedTrainingSkills = {};
    
    const equippedArmorForNoisy = actorData.items?.find(i => i.type === "armor" && i.system?.basic?.equipped === true);
    const traits = equippedArmorForNoisy?.system?.basic?.traits || equippedArmorForNoisy?.system?.basic?.properties || [];
    const traitList = Array.isArray(traits) ? traits : String(traits || "").split(",").map(t => t.trim());
    let noisyPenalty = 0;
    for (const trait of traitList) {
      const match = String(trait).match(/Noisy\s*\((\d+)\)/i);
      if (match) {
        noisyPenalty = Math.max(noisyPenalty, Number(match[1]));
      } else if (/^Noisy$/i.test(String(trait))) {
        noisyPenalty = Math.max(noisyPenalty, 1);
      }
    }
    if (noisyPenalty > 0 && !skills["Stealth"]) {
      skills["Stealth"] = {
        rank: "Novice",
        ability: "agility",
        otherBonuses: 0
      };
    }

    for (const [skillName, skill] of Object.entries(skills)) {
      const abilityName = skill.ability;
      const abilityScore = calculatedAbilityScores[abilityName] || 0;
      const trainingBonus = trainingBonuses[skill.rank] || 0;
    // Ensure otherBonuses exists, default to 0, and parse as number
    const otherBonuses = (skill.otherBonuses !== undefined && skill.otherBonuses !== null) ? Number(skill.otherBonuses) || 0 : 0;
    const noisy = skillName === "Stealth" ? noisyPenalty : 0;
    const totalBonus = Number(abilityScore) + Number(trainingBonus) + Number(otherBonuses) - noisy;
      
      // Format bonus for display (add + sign for positive numbers)
      const bonusDisplay = totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}`;
      
      const skillData = {
        ...skill,
        otherBonuses: otherBonuses,
        totalBonus: totalBonus,
        bonusDisplay: bonusDisplay,
        lockedOtherBonuses: skill.lockedOtherBonuses || false, // Preserve locked status
        lockedSource: skill.lockedSource || null, // Preserve source
        noisyPenalty: noisy
      };
      
      // Separate Heavy Armor from editable skills
      if (skillName === "Heavy Armor") {
        lockedTrainingSkills[skillName] = skillData;
      } else {
        skillsWithBonus[skillName] = skillData;
      }
    }
    
    // Build armor training list (Heavy includes Medium and Light)
    // Reuse the armor training variables that were already calculated earlier in getData()
    const armorTrainingList = [];
    // Note: hasHeavyArmorTraining, hasMediumArmorTraining, hasLightArmorTraining are already calculated above
    if (hasHeavyArmorTraining) {
      armorTrainingList.push({ name: "Heavy Armor", includes: "Medium and Light Armor" });
    } else {
      if (hasMediumArmorTraining) {
        armorTrainingList.push({ name: "Medium Armor", includes: "Light Armor" });
      } else if (hasLightArmorTraining) {
        armorTrainingList.push({ name: "Light Armor", includes: null });
      }
    }
    
    // Get Weapon Training from talents (with weapon categories)
    const weaponTrainingTalents = [];
    
    // Helper function to extract rank from talent name
    const extractRankFromTalentName = (talentName) => {
      if (!talentName) return "Novice";
      const nameLower = talentName.toLowerCase();
      if (nameLower.includes("legendary")) return "Legendary";
      if (nameLower.includes("masterful")) return "Masterful";
      if (nameLower.includes("competent")) return "Competent";
      if (nameLower.includes("apprentice")) return "Apprentice";
      return "Novice"; // Default if not specified
    };
    
    // Check progression slots first (to get weapon categories)
    for (let lvl = 1; lvl <= 20; lvl++) {
      const levelKey = `level${lvl}`;
      const levelData = progression[levelKey] || {};
      
      // Check humanGenericTalent
      if (levelData.humanGenericTalentName && levelData.humanGenericTalentName.toLowerCase().includes("weapon training")) {
        const weaponCategory = levelData.humanGenericTalentWeaponCategory || "";
        const rank = extractRankFromTalentName(levelData.humanGenericTalentName);
        // Only add if category is selected AND it's not "Unarmed Strikes" when Paragon is selected
        if (weaponCategory && !(weaponCategory === "Unarmed Strikes" && powersetName === "Paragon")) {
          weaponTrainingTalents.push({
            name: levelData.humanGenericTalentName,
            category: weaponCategory,
            rank: rank
          });
        }
        // Don't add if category is not selected (don't show "Category not selected")
      }
      
      // Check terranGenericTalent
      if (levelData.terranGenericTalentName && levelData.terranGenericTalentName.toLowerCase().includes("weapon training")) {
        const weaponCategory = levelData.terranGenericTalentWeaponCategory || "";
        const rank = extractRankFromTalentName(levelData.terranGenericTalentName);
        // Only add if category is selected AND it's not "Unarmed Strikes" when Paragon is selected
        if (weaponCategory && !(weaponCategory === "Unarmed Strikes" && powersetName === "Paragon")) {
          weaponTrainingTalents.push({
            name: levelData.terranGenericTalentName,
            category: weaponCategory,
            rank: rank
          });
        }
        // Don't add if category is not selected (don't show "Category not selected")
      }
      
      // Check genericTalent
      if (levelData.genericTalentName && levelData.genericTalentName.toLowerCase().includes("weapon training")) {
        const weaponCategory = levelData.genericTalentWeaponCategory || "";
        const rank = extractRankFromTalentName(levelData.genericTalentName);
        // Only add if category is selected AND it's not "Unarmed Strikes" when Paragon is selected
        if (weaponCategory && !(weaponCategory === "Unarmed Strikes" && powersetName === "Paragon")) {
          weaponTrainingTalents.push({
            name: levelData.genericTalentName,
            category: weaponCategory,
            rank: rank
          });
        }
        // Don't add if category is not selected (don't show "Category not selected")
      }
    }
    
    // Also check embedded items (for talents added directly, not through progression)
    for (const item of actorData.items || []) {
      if (item.type === "talent") {
        const talentName = item.name || "";
        if (talentName.toLowerCase().includes("weapon training")) {
          // Check if we already have this talent from progression
          const alreadyAdded = weaponTrainingTalents.some(wt => wt.name === talentName);
          if (!alreadyAdded) {
            const rank = extractRankFromTalentName(talentName);
            weaponTrainingTalents.push({
              name: talentName,
              category: null, // Can't determine category from embedded items
              rank: rank
            });
          }
        }
      }
    }
    
    // Add Paragon powerset's Unarmed Strike training
    if (powersetName === "Paragon") {
      weaponTrainingTalents.push({
        name: "Paragon Unarmed Strike Training",
        category: "Unarmed Strikes",
        rank: "Apprentice" // Paragon gets Apprentice at level 1
      });
    }
    
    // Add Marksman powerset's Ranged Weapon training (for display purposes)
    if (powersetName === "Marksman") {
      // Calculate rank based on prime level: Apprentice at 1, Competent at 5, Masterful at 10, Legendary at 15
      let marksmanRank = "Apprentice";
      if (primeLevel >= 15) {
        marksmanRank = "Legendary";
      } else if (primeLevel >= 10) {
        marksmanRank = "Masterful";
      } else if (primeLevel >= 5) {
        marksmanRank = "Competent";
      }
      
      weaponTrainingTalents.push({
        name: "Marksman Ranged Weapon Training",
        category: "Ranged Weapons", // This is a catch-all for ranged weapons
        rank: marksmanRank
      });
    }
    
    // Collect all selected weapon categories from all progression slots (for disabling duplicates)
    // Also create separate arrays excluding each slot's own selection
    const selectedWeaponCategories = [];
    const selectedWeaponCategoriesExcludingHuman = [];
    const selectedWeaponCategoriesExcludingTerran = [];
    const selectedWeaponCategoriesExcludingGeneric = [];
    
    for (let lvl = 1; lvl <= 20; lvl++) {
      const levelKey = `level${lvl}`;
      const levelData = progression[levelKey] || {};
      
      if (levelData.humanGenericTalentWeaponCategory) {
        selectedWeaponCategories.push(levelData.humanGenericTalentWeaponCategory);
        // Add to all except human's own list
        selectedWeaponCategoriesExcludingHuman.push(levelData.humanGenericTalentWeaponCategory);
      }
      if (levelData.terranGenericTalentWeaponCategory) {
        selectedWeaponCategories.push(levelData.terranGenericTalentWeaponCategory);
        // Add to all except terran's own list
        selectedWeaponCategoriesExcludingTerran.push(levelData.terranGenericTalentWeaponCategory);
      }
      if (levelData.genericTalentWeaponCategory) {
        selectedWeaponCategories.push(levelData.genericTalentWeaponCategory);
        // Add to all except generic's own list
        selectedWeaponCategoriesExcludingGeneric.push(levelData.genericTalentWeaponCategory);
      }
    }
    
    // Remove duplicates and exclude current slot's selection
    const humanCategory = progression.level1?.humanGenericTalentWeaponCategory || "";
    const terranCategory = progression.level1?.terranGenericTalentWeaponCategory || "";
    
    context.selectedWeaponCategories = selectedWeaponCategories;
    context.selectedWeaponCategoriesExcludingHuman = selectedWeaponCategories.filter(cat => cat !== humanCategory);
    context.selectedWeaponCategoriesExcludingTerran = selectedWeaponCategories.filter(cat => cat !== terranCategory);
    context.selectedWeaponCategoriesExcludingGeneric = selectedWeaponCategories.filter(cat => cat !== (progression.level1?.genericTalentWeaponCategory || ""));
    
    context.skills = skillsWithBonus;
    context.lockedTrainingSkills = lockedTrainingSkills;
    context.armorTrainingList = armorTrainingList;
    context.weaponTrainingTalents = weaponTrainingTalents;

    // Check for Supersonic Moment talent (check all levels, but only if Paragon powerset is selected)
    // Use the progression variable that's already defined earlier in getData()
    let hasSupersonicMoment = false;
    if (powersetName === "Paragon") {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        const paragonTalentName = levelData.paragonTalentName || "";
        if (paragonTalentName && paragonTalentName.toLowerCase().includes("supersonic moment")) {
          hasSupersonicMoment = true;
          break;
        }
      }
    }
    context.hasSupersonicMoment = hasSupersonicMoment;
    
    // Check for Deadeye talent (check all levels, but only if Marksman powerset is selected)
    let hasDeadeye = false;
    if (powersetName === "Marksman") {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        const marksmanTalentName = levelData.marksmanTalentName || "";
        if (marksmanTalentName && marksmanTalentName.toLowerCase().includes("deadeye")) {
          hasDeadeye = true;
          break;
        }
      }
    }
    context.hasDeadeye = hasDeadeye;
    
    // Check for Gadgeteer powerset (set flag early, but calculate slots after primeLevel is defined)
    const hasGadgeteer = powersetName === "Gadgeteer";
    context.hasGadgeteer = hasGadgeteer;
    
    // Check for "Enough Prep Time" talent
    let hasEnoughPrepTime = false;
    for (let lvl = 1; lvl <= 20; lvl++) {
      const levelKey = `level${lvl}`;
      const levelData = progression[levelKey] || {};
      const gadgeteerTalentName = levelData.gadgeteerTalentName || "";
      if (gadgeteerTalentName && gadgeteerTalentName.toLowerCase().includes("enough prep time")) {
        hasEnoughPrepTime = true;
        break;
      }
    }
    context.hasEnoughPrepTime = hasEnoughPrepTime;
    
    // Check for "Expanded Loadout" talent
    let hasExpandedLoadout = false;
    for (let lvl = 1; lvl <= 20; lvl++) {
      const levelKey = `level${lvl}`;
      const levelData = progression[levelKey] || {};
      const gadgeteerTalentName = levelData.gadgeteerTalentName || "";
      if (gadgeteerTalentName && gadgeteerTalentName.toLowerCase().includes("expanded loadout")) {
        hasExpandedLoadout = true;
        break;
      }
    }
    context.hasExpandedLoadout = hasExpandedLoadout;
    
    // Calculate Supersonic Moment damage bonus if active
    if (hasSupersonicMoment) {
      const supersonicData = actorData.system.combat?.supersonicMoment || { active: false, distance: 0 };
      if (supersonicData.active && supersonicData.distance) {
        // +2 damage bonus for every 15 feet flown
        const distance = Number(supersonicData.distance) || 0;
        const bonus = Math.floor(distance / 15) * 2;
        context.supersonicDamageBonus = bonus;
      } else {
        context.supersonicDamageBonus = 0;
      }
    }

    // Initialize saving throws if they don't exist (read-only, create safe copy)
    const savingThrowsData = actorData.system.savingThrows || {};
    const savingThrows = {};
    const savingThrowAbilityNames = ["might", "agility", "endurance", "wits", "charm"];
    
    // Calculate saving throw breakdowns (all ranks are locked, only changeable via talents/powersets)
    const savingThrowBreakdowns = {};
    const allTalentNamesForSavingThrows = getAllTalentNames();
    
    for (const ability of savingThrowAbilityNames) {
      const savingThrow = savingThrowsData[ability] || {};
      const breakdown = {
        rank: savingThrow.rank || "Novice",
        otherBonuses: savingThrow.otherBonuses ?? 0,
        sources: []
      };
      
      // Check for Bastion Saving Throw Training
      const bastionSavingThrow = actorData.system.progression?.level1?.bastionSavingThrow;
      if (bastionSavingThrow === ability && powersetName === "Bastion") {
        breakdown.sources.push({ 
          name: "Bastion Saving Throw Training", 
          rank: "Apprentice" 
        });
        // Ensure rank is at least Apprentice
        if (!breakdown.rank || breakdown.rank === "Novice") {
          breakdown.rank = "Apprentice";
        }
      }
      
      // Check for Saving Throw Training talents
      for (const talentName of allTalentNamesForSavingThrows) {
        if (talentName && talentName.toLowerCase().includes("saving throw training")) {
          // Check if this talent applies to this saving throw
          // For now, we'll check if the saving throw is at Apprentice or higher
          // (This is a simplified check - in reality, the talent might specify which saving throw)
          const currentRank = savingThrow.rank || "Novice";
          if (currentRank !== "Novice") {
            // Extract rank from talent name (e.g., "Saving Throw Training (Apprentice)")
            let talentRank = "Apprentice"; // Default
            if (talentName.toLowerCase().includes("competent")) {
              talentRank = "Competent";
            } else if (talentName.toLowerCase().includes("masterful")) {
              talentRank = "Masterful";
            } else if (talentName.toLowerCase().includes("legendary")) {
              talentRank = "Legendary";
            }
            
            // Only add if this talent would set the rank to this level or higher
            const rankOrder = { "Novice": 0, "Apprentice": 1, "Competent": 2, "Masterful": 3, "Legendary": 4 };
            if (rankOrder[talentRank] >= rankOrder[currentRank]) {
              breakdown.sources.push({ 
                name: talentName, 
                rank: talentRank 
              });
            }
          }
        }
      }
      
      // If no sources, it's just the base Novice rank
      if (breakdown.sources.length === 0) {
        breakdown.sources.push({ 
          name: "Base Rank", 
          rank: "Novice" 
        });
      }
      
      savingThrows[ability] = {
        rank: breakdown.rank,
        otherBonuses: breakdown.otherBonuses
      };
      
      savingThrowBreakdowns[ability] = breakdown;
    }
    
    context.savingThrows = savingThrows;
    context.savingThrowBreakdowns = savingThrowBreakdowns;

    // Initialize resistances, weaknesses, and immunities
    // Calculate dynamic resistance values (e.g., 2 × Bastion level)
    const resistancesData = actorData.system.resistances || [];
    const calculatedResistances = resistancesData.map(resistance => {
      const resistanceCopy = { ...resistance };
      // If value is null, calculate it dynamically (e.g., for Bastion's Resistance)
      if (resistance.value === null && resistance.source === "Bastion's Resistance") {
        const bastionLevel = safeBasic.primeLevel || 1;
        resistanceCopy.calculatedValue = 2 * bastionLevel;
      } else if (resistance.value !== null && resistance.value !== undefined) {
        resistanceCopy.calculatedValue = resistance.value;
      }
      return resistanceCopy;
    });
    context.resistances = calculatedResistances;
    context.weaknesses = actorData.system.weaknesses || [];
    context.immunities = actorData.system.immunities || [];

    // Calculate size dynamically
    // Check if character has Enlarged Presence talent
    // Note: Use actorData directly here since progressionCopy hasn't been initialized yet
    let calculatedSize = safeBasic.size || "Medium";
    const bastionTalentName = actorData.system.progression?.level1?.bastionTalentName || "";
    const hasEnlargedPresence = bastionTalentName && (
      bastionTalentName.toLowerCase().includes("enlarged") && 
      bastionTalentName.toLowerCase().includes("presence")
    );
    
    if (hasEnlargedPresence) {
      calculatedSize = "Large";
    }
    
    context.calculatedSize = calculatedSize;
    
    // Check if Ironbound talent is selected (for HP calculation)
    const hasIronbound = bastionTalentName && (
      bastionTalentName.toLowerCase().includes("ironbound")
    );

    // Check if Enhanced Vitality talent is selected
    let hasEnhancedVitality = false;
    
    // Check all progression slots for Enhanced Vitality
    for (let lvl = 1; lvl <= 20; lvl++) {
      const levelKey = `level${lvl}`;
      const levelData = actorData.system.progression?.[levelKey] || {};
      
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
    
    // Calculate max HP dynamically for all characters
    // Max HP is always calculated and never manually editable
    let calculatedMaxHp = null;
    const enduranceScore = calculatedAbilityScores.endurance || 0;
    
    if (powersetName === "Bastion") {
      // Bastion HP: (14 + Endurance) × Bastion level
      // If Ironbound is selected: (14 + Endurance × 2) × Bastion level
      const bastionLevel = primeLevel;
      
      let enduranceContribution = enduranceScore;
      if (hasIronbound) {
        enduranceContribution = enduranceScore * 2;
      }
      
      calculatedMaxHp = (14 + enduranceContribution) * bastionLevel;
      
      // Add Enhanced Vitality bonus
      if (hasEnhancedVitality) {
        calculatedMaxHp += 2 * primeLevel;
      }
    } else if (powersetName === "Paragon") {
      // Paragon HP: (12 + Endurance) × Paragon level
      const paragonLevel = primeLevel;
      calculatedMaxHp = (12 + enduranceScore) * paragonLevel;
      
      // Add Enhanced Vitality bonus
      if (hasEnhancedVitality) {
        calculatedMaxHp += 2 * primeLevel;
      }
    } else if (powersetName === "Gadgeteer") {
      // Gadgeteer HP: (8 + Endurance) × Gadgeteer level
      const gadgeteerLevel = primeLevel;
      calculatedMaxHp = (8 + enduranceScore) * gadgeteerLevel;
      
      // Add Enhanced Vitality bonus
      if (hasEnhancedVitality) {
        calculatedMaxHp += 2 * primeLevel;
      }
    } else if (powersetName === "Marksman") {
      // Marksman HP: (8 + Endurance) × Marksman level
      const marksmanLevel = primeLevel;
      calculatedMaxHp = (8 + enduranceScore) * marksmanLevel;
      
      // Add Enhanced Vitality bonus
      if (hasEnhancedVitality) {
        calculatedMaxHp += 2 * primeLevel;
      }
    } else if (hasEnhancedVitality) {
      // For characters without powerset but with Enhanced Vitality, calculate HP
      // Use stored base max HP and add Enhanced Vitality bonus
      const baseMaxHp = safeCombat.hp.max || 0;
      const enhancedVitalityBonus = 2 * primeLevel;
      calculatedMaxHp = baseMaxHp + enhancedVitalityBonus;
    } else {
      // For characters without powerset and without Enhanced Vitality, use stored value
      calculatedMaxHp = safeCombat.hp.max || 0;
    }
    
    // Always set calculatedMaxHp (never null - it's always calculated or from stored value)
    context.calculatedMaxHp = calculatedMaxHp;
    
    // Calculate HP breakdown for display
    const hpBreakdown = {
      powersetBase: 0,
      enduranceContribution: 0,
      enduranceMultiplier: 1,
      levelMultiplier: 1,
      enhancedVitalityBonus: 0,
      baseHp: 0,
      total: calculatedMaxHp,
      formula: "",
      sources: []
    };
    
    if (powersetName === "Bastion") {
      const bastionLevel = primeLevel;
      hpBreakdown.levelMultiplier = bastionLevel;
      hpBreakdown.powersetBase = 14;
      hpBreakdown.enduranceContribution = enduranceScore;
      hpBreakdown.enduranceMultiplier = hasIronbound ? 2 : 1;
      
      hpBreakdown.sources.push({ 
        name: `Base HP per Level (Bastion)`, 
        value: hpBreakdown.powersetBase,
        perLevel: true
      });
      
      if (hasIronbound) {
        hpBreakdown.sources.push({ 
          name: `Endurance (×2 from Ironbound)`, 
          value: enduranceScore,
          multiplier: 2,
          perLevel: true
        });
        hpBreakdown.formula = `(14 + Endurance × 2) × ${bastionLevel}`;
      } else {
        hpBreakdown.sources.push({ 
          name: `Endurance`, 
          value: enduranceScore,
          perLevel: true
        });
        hpBreakdown.formula = `(14 + Endurance) × ${bastionLevel}`;
      }
    } else if (powersetName === "Paragon") {
      const paragonLevel = primeLevel;
      hpBreakdown.levelMultiplier = paragonLevel;
      hpBreakdown.powersetBase = 12;
      hpBreakdown.enduranceContribution = enduranceScore;
      
      hpBreakdown.sources.push({ 
        name: `Base HP per Level (Paragon)`, 
        value: hpBreakdown.powersetBase,
        perLevel: true
      });
      hpBreakdown.sources.push({ 
        name: `Endurance`, 
        value: enduranceScore,
        perLevel: true
      });
      hpBreakdown.formula = `(12 + Endurance) × ${paragonLevel}`;
    } else if (powersetName === "Gadgeteer") {
      const gadgeteerLevel = primeLevel;
      hpBreakdown.levelMultiplier = gadgeteerLevel;
      hpBreakdown.powersetBase = 8;
      hpBreakdown.enduranceContribution = enduranceScore;
      
      hpBreakdown.sources.push({ 
        name: `Base HP per Level (Gadgeteer)`, 
        value: hpBreakdown.powersetBase,
        perLevel: true
      });
      hpBreakdown.sources.push({ 
        name: `Endurance`, 
        value: enduranceScore,
        perLevel: true
      });
      hpBreakdown.formula = `(8 + Endurance) × ${gadgeteerLevel}`;
    } else if (powersetName === "Marksman") {
      const marksmanLevel = primeLevel;
      hpBreakdown.levelMultiplier = marksmanLevel;
      hpBreakdown.powersetBase = 8;
      hpBreakdown.enduranceContribution = enduranceScore;
      
      hpBreakdown.sources.push({ 
        name: `Base HP per Level (Marksman)`, 
        value: hpBreakdown.powersetBase,
        perLevel: true
      });
      hpBreakdown.sources.push({ 
        name: `Endurance`, 
        value: enduranceScore,
        perLevel: true
      });
      hpBreakdown.formula = `(8 + Endurance) × ${marksmanLevel}`;
    } else {
      hpBreakdown.baseHp = safeCombat.hp.max || 0;
      hpBreakdown.sources.push({ 
        name: `Base HP`, 
        value: hpBreakdown.baseHp,
        perLevel: false
      });
      hpBreakdown.formula = `Base HP`;
    }
    
    // Add Enhanced Vitality bonus if applicable
    if (hasEnhancedVitality) {
      hpBreakdown.enhancedVitalityBonus = 2 * primeLevel;
      hpBreakdown.sources.push({ 
        name: `Enhanced Vitality (+2 per Prime Level)`, 
        value: hpBreakdown.enhancedVitalityBonus,
        perLevel: false
      });
      if (hpBreakdown.formula) {
        hpBreakdown.formula += ` + ${hpBreakdown.enhancedVitalityBonus} (Enhanced Vitality)`;
      } else {
        hpBreakdown.formula = `${hpBreakdown.baseHp} + ${hpBreakdown.enhancedVitalityBonus} (Enhanced Vitality)`;
      }
    }
    
    context.hpBreakdown = hpBreakdown;

    // Calculate gadget slots and prepared gadgets if Gadgeteer (after primeLevel is defined)
    if (hasGadgeteer) {
      const gadgeteerLevel = primeLevel;
      
      // Gadget slot table based on Gadgeteer level
      const gadgetSlotTable = {
        1: { level0: 4, level1: 2 },
        2: { level0: 4, level1: 3 },
        3: { level0: 4, level1: 3, level2: 1 },
        4: { level0: 4, level1: 3, level2: 2 },
        5: { level0: 5, level1: 3, level2: 2, level3: 1 },
        6: { level0: 5, level1: 3, level2: 2, level3: 2 },
        7: { level0: 5, level1: 3, level2: 2, level3: 2, level4: 1 },
        8: { level0: 5, level1: 3, level2: 2, level3: 2, level4: 2 },
        9: { level0: 6, level1: 3, level2: 2, level3: 2, level4: 2, level5: 1 },
        10: { level0: 6, level1: 3, level2: 2, level3: 2, level4: 2, level5: 2 },
        11: { level0: 6, level1: 3, level2: 2, level3: 2, level4: 2, level5: 2, level6: 1 },
        12: { level0: 6, level1: 3, level2: 2, level3: 2, level4: 2, level5: 2, level6: 2 },
        13: { level0: 7, level1: 3, level2: 2, level3: 2, level4: 2, level5: 2, level6: 2, level7: 1 },
        14: { level0: 7, level1: 3, level2: 2, level3: 2, level4: 2, level5: 2, level6: 2, level7: 2 },
        15: { level0: 7, level1: 3, level2: 2, level3: 2, level4: 2, level5: 2, level6: 2, level7: 2, level8: 1 },
        16: { level0: 7, level1: 3, level2: 2, level3: 2, level4: 2, level5: 2, level6: 2, level7: 2, level8: 2 },
        17: { level0: 8, level1: 3, level2: 2, level3: 2, level4: 2, level5: 2, level6: 2, level7: 2, level8: 2, level9: 1 },
        18: { level0: 8, level1: 3, level2: 2, level3: 2, level4: 2, level5: 2, level6: 2, level7: 2, level8: 2, level9: 2 },
        19: { level0: 8, level1: 3, level2: 2, level3: 2, level4: 2, level5: 2, level6: 2, level7: 2, level8: 2, level9: 2, level10: 1 },
        20: { level0: 8, level1: 3, level2: 2, level3: 2, level4: 2, level5: 2, level6: 2, level7: 2, level8: 2, level9: 2, level10: 2 }
      };
      
      const slots = gadgetSlotTable[gadgeteerLevel] || { level0: 4, level1: 2 };
      
      // Apply "Expanded Loadout" bonus (+2 Level 0 gadget slots)
      let level0Slots = slots.level0 || 0;
      if (hasExpandedLoadout) {
        level0Slots += 2;
      }
      
      // Get prepared gadgets from actor data
      const preparedGadgetsData = actorData.system.gadgets?.prepared || { level0: [], level1: [] };
      
      // Calculate available slots
      const gadgetSlots = {
        level0: {
          total: level0Slots,
          used: (preparedGadgetsData.level0 || []).length,
          available: Math.max(0, level0Slots - (preparedGadgetsData.level0 || []).length)
        },
        level1: {
          total: slots.level1 || 0,
          used: (preparedGadgetsData.level1 || []).length,
          available: Math.max(0, (slots.level1 || 0) - (preparedGadgetsData.level1 || []).length)
        }
      };
      
      context.gadgetSlots = gadgetSlots;
      
      // Pad prepared gadgets arrays to match total slots (fill with null for empty slots)
      // Ensure gadgets have images (default to mystery-man if missing, fix old cog.svg references)
      const paddedLevel0 = Array(level0Slots || 0).fill(null).map((_, index) => {
        const gadget = (preparedGadgetsData.level0 || [])[index] || null;
        if (gadget) {
          if (!gadget.img || gadget.img === "icons/svg/cog.svg") {
            // Fix old cog.svg icon or set default image if missing
            gadget.img = "icons/svg/item-bag.svg";
          }
        }
        return gadget;
      });
      const paddedLevel1 = Array(slots.level1 || 0).fill(null).map((_, index) => {
        const gadget = (preparedGadgetsData.level1 || [])[index] || null;
        if (gadget) {
          if (!gadget.img || gadget.img === "icons/svg/cog.svg") {
            // Fix old cog.svg icon or set default image if missing
            gadget.img = "icons/svg/item-bag.svg";
          }
        }
        return gadget;
      });
      
      // Create slot arrays for template iteration (with index info)
      const level0SlotArray = paddedLevel0.map((gadget, index) => ({
        gadget: gadget,
        slotNumber: index + 1,
        isEmpty: !gadget
      }));
      const level1SlotArray = paddedLevel1.map((gadget, index) => ({
        gadget: gadget,
        slotNumber: index + 1,
        isEmpty: !gadget
      }));
      
      context.preparedGadgets = {
        level0: paddedLevel0,
        level1: paddedLevel1
      };
      context.gadgetSlotsArray = {
        level0: level0SlotArray,
        level1: level1SlotArray
      };
      
      // Get Gadget Tuning rank
      const gadgetTuningSkill = actorData.system.skills?.["Gadget Tuning"] || {};
      const gadgetTuningRank = gadgetTuningSkill.rank || "Novice";
      context.gadgetTuningRank = gadgetTuningRank;
      
      // Calculate Gadget Tuning DC (10 + Wits + skill modifier)
      const wits = safeAbilities.wits || 0;
      const rankModifiers = {
        "Novice": 0,
        "Apprentice": 2,
        "Competent": 5,
        "Masterful": 9,
        "Legendary": 14
      };
      const skillModifier = rankModifiers[gadgetTuningRank] || 0;
      let gadgetTuningDC = 10 + wits + skillModifier;
      
      // Add "Enough Prep Time" bonus if active
      if (hasEnoughPrepTime) {
        const enoughPrepTimeData = actorData.system.combat?.enoughPrepTime || { active: false, enemyName: "" };
        if (enoughPrepTimeData.active && enoughPrepTimeData.enemyName) {
          const enoughPrepTimeBonus = gadgeteerLevel; // +1 per Gadgeteer level
          gadgetTuningDC += enoughPrepTimeBonus;
          context.enoughPrepTimeDCBonus = enoughPrepTimeBonus;
        } else {
          context.enoughPrepTimeDCBonus = 0;
        }
      } else {
        context.enoughPrepTimeDCBonus = 0;
      }
      
      context.gadgetTuningDC = gadgetTuningDC;
      context.gadgeteerLevel = gadgeteerLevel;
      
      // Calculate "Enough Prep Time" attack bonus if active
      if (hasEnoughPrepTime) {
        const enoughPrepTimeData = actorData.system.combat?.enoughPrepTime || { active: false, enemyName: "" };
        context.enoughPrepTimeActive = enoughPrepTimeData.active;
        context.enoughPrepTimeEnemyName = enoughPrepTimeData.enemyName || "";
        if (enoughPrepTimeData.active && enoughPrepTimeData.enemyName) {
          context.enoughPrepTimeAttackBonus = gadgeteerLevel; // +1 per Gadgeteer level
        } else {
          context.enoughPrepTimeAttackBonus = 0;
        }
      } else {
        context.enoughPrepTimeActive = false;
        context.enoughPrepTimeEnemyName = "";
        context.enoughPrepTimeAttackBonus = 0;
      }
    } else {
      // If not Gadgeteer, set defaults
      context.gadgetTuningRank = "Novice";
      context.gadgetTuningDC = null;
      context.enoughPrepTimeActive = false;
      context.enoughPrepTimeEnemyName = "";
      context.enoughPrepTimeAttackBonus = 0;
      context.enoughPrepTimeDCBonus = 0;
    }

    // Attacks - calculate dynamic bonuses based on current ability scores
      // Get equipped weapons to match with attacks
      const equippedWeapons = items.filter(i => i && i.type === "weapon" && i.system?.basic?.equipped === true);
      
      const scaredEffect = this.actor?.effects?.find(effect => effect.getFlag("core", "statusId") === "scared");
      const scaredPenalty = Math.max(0, Number(scaredEffect?.getFlag("singularity", "value") ?? 0));
      const pronePenalty = this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "prone") ? 2 : 0;
      const fatiguedEffect = this.actor?.effects?.find(effect => effect.getFlag("core", "statusId") === "fatigued");
      const fatiguedPenalty = Math.max(0, Number(fatiguedEffect?.getFlag("singularity", "value") ?? 0));
      const blindedPenalty = this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "blinded") ? 10 : 0;

      // Process attacks to calculate dynamic attack bonuses and damage
      const attacksWithCalculations = (actorData.system.attacks || []).map(attack => {
        const attackCopy = { ...attack };
        
        // Try to match attack name with equipped weapon name (case-insensitive)
        // For dual-mode weapons, strip the mode suffix (e.g., "Combat Knife (Melee)" -> "Combat Knife")
        const baseAttackName = attack.name?.replace(/\s*\(Melee\)$/i, "").replace(/\s*\(Thrown\)$/i, "");
        const matchingWeapon = equippedWeapons.find(w => w.name && baseAttackName && w.name.toLowerCase() === baseAttackName.toLowerCase());
        if (matchingWeapon && matchingWeapon.img) {
          attackCopy.weaponImg = matchingWeapon.img;
        }
        const isWeaponAttack = Boolean(attack.weaponId) || Boolean(matchingWeapon);
        const isUnarmed = attack.name && attack.name.toLowerCase() === "unarmed strike";
        const isTalentAttack = attack.isTalentAttack === true || (attack.name && attack.name.toLowerCase() === "blast");
        if (isTalentAttack) {
          attackCopy.isTalentAttack = true;
          if (!attackCopy.weaponImg) {
            attackCopy.weaponImg = "icons/svg/explosion.svg";
          }
        }
        const isCustom = attack.isCustom;
        attackCopy.canDelete = isCustom === true
          ? true
          : isCustom === false
            ? false
            : (!isWeaponAttack && !isUnarmed && !isTalentAttack);
        
        // Determine weapon competence rank and bonus
        let weaponCompetenceRank = "Novice"; // Default
        let weaponCompetenceBonus = 0; // Novice = +0
        
        // Get weapon categories from matching weapon item
        const weaponCategories = matchingWeapon?.system?.basic?.categories || [];
        const weaponType = matchingWeapon?.system?.basic?.type || attack.type || "melee";
        const weaponMode = attack.weaponMode; // "melee", "thrown", or undefined
        
        // Check for Unarmed Strike
        if (attack.name && attack.name.toLowerCase() === "unarmed strike") {
          // Unarmed Strike: Novice by default, Apprentice if Paragon
          if (powersetName === "Paragon") {
            // Paragon gets Apprentice with unarmed at level 1
            weaponCompetenceRank = "Apprentice";
            weaponCompetenceBonus = 4; // Apprentice = +4
          } else {
            weaponCompetenceRank = "Novice";
            weaponCompetenceBonus = 0; // Novice = +0
          }
        }
        // Check weapon categories for Weapon Training talents
        // For dual-mode weapons, only check categories relevant to the current mode
        else if (weaponCategories.length > 0) {
          // Filter categories based on weapon mode
          let relevantCategories = weaponCategories;
          if (weaponMode === "melee") {
            // Only check melee categories for melee mode
            relevantCategories = weaponCategories.filter(cat => 
              cat === "Light Melee Weapons" || cat === "Heavy Melee Weapons" || cat === "Unarmed Strikes"
            );
          } else if (weaponMode === "thrown") {
            // Only check Thrown Weapons category for thrown mode
            relevantCategories = weaponCategories.filter(cat => cat === "Thrown Weapons");
          }
          // Check all progression slots for Weapon Training that matches any category
          let foundTraining = false;
          let highestRank = "Novice";
          let highestBonus = 0;
          
          for (let lvl = 1; lvl <= 20; lvl++) {
            const levelKey = `level${lvl}`;
            const levelData = progression[levelKey] || {};
            
            // Helper to extract rank from talent name
            const extractRank = (talentName) => {
              if (!talentName) return "Novice";
              const nameLower = talentName.toLowerCase();
              if (nameLower.includes("legendary")) return "Legendary";
              if (nameLower.includes("masterful")) return "Masterful";
              if (nameLower.includes("competent")) return "Competent";
              if (nameLower.includes("apprentice")) return "Apprentice";
              return "Novice";
            };
            
            // Check humanGenericTalent
            if (levelData.humanGenericTalentName && 
                levelData.humanGenericTalentName.toLowerCase().includes("weapon training") &&
                levelData.humanGenericTalentWeaponCategory) {
              if (relevantCategories.includes(levelData.humanGenericTalentWeaponCategory)) {
                const rank = extractRank(levelData.humanGenericTalentName);
                const bonus = rank === "Apprentice" ? 4 : rank === "Competent" ? 8 : rank === "Masterful" ? 12 : rank === "Legendary" ? 16 : 0;
                if (bonus > highestBonus) {
                  highestRank = rank;
                  highestBonus = bonus;
                  foundTraining = true;
                }
              }
            }
            
            // Check terranGenericTalent
            if (levelData.terranGenericTalentName && 
                levelData.terranGenericTalentName.toLowerCase().includes("weapon training") &&
                levelData.terranGenericTalentWeaponCategory) {
              if (relevantCategories.includes(levelData.terranGenericTalentWeaponCategory)) {
                const rank = extractRank(levelData.terranGenericTalentName);
                const bonus = rank === "Apprentice" ? 4 : rank === "Competent" ? 8 : rank === "Masterful" ? 12 : rank === "Legendary" ? 16 : 0;
                if (bonus > highestBonus) {
                  highestRank = rank;
                  highestBonus = bonus;
                  foundTraining = true;
                }
              }
            }
            
            // Check genericTalent
            if (levelData.genericTalentName && 
                levelData.genericTalentName.toLowerCase().includes("weapon training") &&
                levelData.genericTalentWeaponCategory) {
              if (relevantCategories.includes(levelData.genericTalentWeaponCategory)) {
                const rank = extractRank(levelData.genericTalentName);
                const bonus = rank === "Apprentice" ? 4 : rank === "Competent" ? 8 : rank === "Masterful" ? 12 : rank === "Legendary" ? 16 : 0;
                if (bonus > highestBonus) {
                  highestRank = rank;
                  highestBonus = bonus;
                  foundTraining = true;
                }
              }
            }
          }
          
          // Check Paragon Unarmed Strike (if weapon has "Unarmed Strikes" category and is in melee mode)
          if (relevantCategories.includes("Unarmed Strikes") && powersetName === "Paragon") {
            if (4 > highestBonus) {
              highestRank = "Apprentice";
              highestBonus = 4;
              foundTraining = true;
            }
          }
          
          // Check Marksman Ranged Weapon Training (if weapon has "Ranged Weapons" category)
          // Only applies to ranged/thrown mode
          if ((relevantCategories.includes("Ranged Weapons") || weaponMode === "thrown") && powersetName === "Marksman") {
            let marksmanRank = "Apprentice";
            let marksmanBonus = 4;
            if (primeLevel >= 15) {
              marksmanRank = "Legendary";
              marksmanBonus = 16;
            } else if (primeLevel >= 10) {
              marksmanRank = "Masterful";
              marksmanBonus = 12;
            } else if (primeLevel >= 5) {
              marksmanRank = "Competent";
              marksmanBonus = 8;
            }
            if (marksmanBonus > highestBonus) {
              highestRank = marksmanRank;
              highestBonus = marksmanBonus;
              foundTraining = true;
            }
          }
          
          if (foundTraining) {
            weaponCompetenceRank = highestRank;
            weaponCompetenceBonus = highestBonus;
          }
        }
        // Fallback: Check for ranged weapons (Marksman competence) using type
        else if (weaponType === "ranged" || attack.type === "ranged") {
          if (powersetName === "Marksman") {
            // Marksman gets Ranged Weapon Competence: Apprentice at level 1, Competent at 5, Masterful at 10, Legendary at 15
            if (primeLevel >= 15) {
              weaponCompetenceRank = "Legendary";
              weaponCompetenceBonus = 16; // Legendary = +16
            } else if (primeLevel >= 10) {
              weaponCompetenceRank = "Masterful";
              weaponCompetenceBonus = 12; // Masterful = +12
            } else if (primeLevel >= 5) {
              weaponCompetenceRank = "Competent";
              weaponCompetenceBonus = 8; // Competent = +8
            } else if (primeLevel >= 1) {
              weaponCompetenceRank = "Apprentice";
              weaponCompetenceBonus = 4; // Apprentice = +4
            }
          }
        }
        // Check if attack already has a stored competence rank (from previous calculations)
        else if (attack.weaponCompetenceRank) {
          weaponCompetenceRank = attack.weaponCompetenceRank;
          // Map rank to bonus
          const rankBonuses = {
            "Novice": 0,
            "Apprentice": 4,
            "Competent": 8,
            "Masterful": 12,
            "Legendary": 16
          };
          weaponCompetenceBonus = rankBonuses[weaponCompetenceRank] || 0;
        }
        
        // Store competence rank for future reference
        attackCopy.weaponCompetenceRank = weaponCompetenceRank;
        
        // Check for Deadeye bonus (only applies to ranged weapons)
        let deadeyeBonus = 0;
        const deadeyeData = actorData.system.combat?.deadeye || { active: false };
        if (deadeyeData.active && (attack.type === "ranged" || (matchingWeapon && matchingWeapon.system?.basic?.type === "ranged"))) {
          deadeyeBonus = 5; // +5 attack bonus from Deadeye
        }
        
        // If attack has baseAttackBonus and ability, calculate dynamic bonus
        if (attack.baseAttackBonus !== undefined && attack.ability) {
          const currentAbilityScore = calculatedAbilityScores[attack.ability] || 0;
          // Add weapon competence bonus, Deadeye bonus, and ability score to baseAttackBonus
          attackCopy.calculatedAttackBonus = attack.baseAttackBonus + weaponCompetenceBonus + deadeyeBonus + currentAbilityScore;
          // Build breakdown string
          const parts = [];
          if (weaponCompetenceBonus > 0) {
            parts.push(`+${weaponCompetenceBonus} (${weaponCompetenceRank})`);
          } else if (weaponCompetenceRank === "Novice") {
            parts.push(`+0 (Novice)`);
          }
          if (deadeyeBonus > 0) {
            parts.push(`+${deadeyeBonus} (Deadeye)`);
          }
          if (attack.baseAttackBonus > 0) {
            parts.push(`+${attack.baseAttackBonus}`);
          }
          if (currentAbilityScore !== 0) {
            parts.push(`${currentAbilityScore >= 0 ? '+' : ''}${currentAbilityScore} (${attack.ability.charAt(0).toUpperCase() + attack.ability.slice(1)})`);
          }
          if (scaredPenalty > 0) {
            attackCopy.calculatedAttackBonus -= scaredPenalty;
            parts.push(`-${scaredPenalty} (Scared)`);
          }
          if (pronePenalty > 0) {
            attackCopy.calculatedAttackBonus -= pronePenalty;
            parts.push(`-${pronePenalty} (Prone)`);
          }
          if (fatiguedPenalty > 0) {
            attackCopy.calculatedAttackBonus -= fatiguedPenalty;
            parts.push(`-${fatiguedPenalty} (Fatigued)`);
          }
          if (blindedPenalty > 0) {
            attackCopy.calculatedAttackBonus -= blindedPenalty;
            parts.push(`-${blindedPenalty} (Blinded)`);
          }
          attackCopy.attackBonusBreakdown = parts.length > 0 ? parts.join(" ") : "+0";
        } else if (attack.attackBonus !== undefined) {
          // Legacy support: if attackBonus exists but no baseAttackBonus, use it as-is
          attackCopy.calculatedAttackBonus = attack.attackBonus + weaponCompetenceBonus + deadeyeBonus;
          const parts = [`+${attack.attackBonus}`];
          if (weaponCompetenceBonus > 0) {
            parts.push(`+${weaponCompetenceBonus} (${weaponCompetenceRank})`);
          }
          if (deadeyeBonus > 0) {
            parts.push(`+${deadeyeBonus} (Deadeye)`);
          }
          if (scaredPenalty > 0) {
            attackCopy.calculatedAttackBonus -= scaredPenalty;
            parts.push(`-${scaredPenalty} (Scared)`);
          }
          if (pronePenalty > 0) {
            attackCopy.calculatedAttackBonus -= pronePenalty;
            parts.push(`-${pronePenalty} (Prone)`);
          }
          if (fatiguedPenalty > 0) {
            attackCopy.calculatedAttackBonus -= fatiguedPenalty;
            parts.push(`-${fatiguedPenalty} (Fatigued)`);
          }
          if (blindedPenalty > 0) {
            attackCopy.calculatedAttackBonus -= blindedPenalty;
            parts.push(`-${blindedPenalty} (Blinded)`);
          }
          attackCopy.attackBonusBreakdown = parts.join(" ");
        } else {
          // No baseAttackBonus, use only competence bonus, Deadeye bonus, and ability
          const currentAbilityScore = calculatedAbilityScores[attack.ability || "might"] || 0;
          attackCopy.calculatedAttackBonus = weaponCompetenceBonus + deadeyeBonus + currentAbilityScore;
          const parts = [];
          if (weaponCompetenceBonus > 0) {
            parts.push(`+${weaponCompetenceBonus} (${weaponCompetenceRank})`);
          } else if (weaponCompetenceRank === "Novice") {
            parts.push(`+0 (Novice)`);
          }
          if (deadeyeBonus > 0) {
            parts.push(`+${deadeyeBonus} (Deadeye)`);
          }
          if (currentAbilityScore !== 0) {
            parts.push(`${currentAbilityScore >= 0 ? '+' : ''}${currentAbilityScore} (${(attack.ability || "might").charAt(0).toUpperCase() + (attack.ability || "might").slice(1)})`);
          }
          if (scaredPenalty > 0) {
            attackCopy.calculatedAttackBonus -= scaredPenalty;
            parts.push(`-${scaredPenalty} (Scared)`);
          }
          if (pronePenalty > 0) {
            attackCopy.calculatedAttackBonus -= pronePenalty;
            parts.push(`-${pronePenalty} (Prone)`);
          }
          if (fatiguedPenalty > 0) {
            attackCopy.calculatedAttackBonus -= fatiguedPenalty;
            parts.push(`-${fatiguedPenalty} (Fatigued)`);
          }
          if (blindedPenalty > 0) {
            attackCopy.calculatedAttackBonus -= blindedPenalty;
            parts.push(`-${blindedPenalty} (Blinded)`);
          }
          attackCopy.attackBonusBreakdown = parts.length > 0 ? parts.join(" ") : "+0";
        }
        
        // If attack has baseDamage and ability, calculate dynamic damage
        if (attack.baseDamage && attack.ability) {
          const currentAbilityScore = calculatedAbilityScores[attack.ability] || 0;
          if (currentAbilityScore > 0) {
            attackCopy.calculatedDamage = `${attack.baseDamage}+${currentAbilityScore}`;
          } else if (currentAbilityScore < 0) {
            attackCopy.calculatedDamage = `${attack.baseDamage}${currentAbilityScore}`;
          } else {
            attackCopy.calculatedDamage = attack.baseDamage;
          }
        } else if (attack.damage) {
          // Legacy support: if damage exists but no baseDamage, use it as-is
          attackCopy.calculatedDamage = attack.damage;
        } else {
          attackCopy.calculatedDamage = "";
        }
        
        return attackCopy;
      });
      
      context.attacks = attacksWithCalculations;

      // Get notes fields (read-only)
      const notes = actorData.system.notes || "";
      const backstory = actorData.system.backstory || "";
      const appearance = actorData.system.appearance || "";

      // Enrich notes content for display
      try {
        context.enrichedNotes = await TextEditor.enrichHTML(notes, { async: true, secrets: this.actor.isOwner, relativeTo: this.actor });
        context.enrichedBackstory = await TextEditor.enrichHTML(backstory, { async: true, secrets: this.actor.isOwner, relativeTo: this.actor });
        context.enrichedAppearance = await TextEditor.enrichHTML(appearance, { async: true, secrets: this.actor.isOwner, relativeTo: this.actor });
      } catch (error) {
        console.error("Singularity | Error enriching notes:", error);
        // Fallback to empty strings if enrichment fails
        context.enrichedNotes = notes;
        context.enrichedBackstory = backstory;
        context.enrichedAppearance = appearance;
      }

      // Prepare progression data with item information
      // Create a copy of progression data to avoid modifying actor data
      const progressionCopy = foundry.utils.deepClone(progression);
      
      // For each level, if there's an item ID stored, get the item details
      for (let level = 1; level <= 20; level++) {
        const levelKey = `level${level}`;
        if (!progressionCopy[levelKey]) {
          progressionCopy[levelKey] = {};
        }
        const levelData = progressionCopy[levelKey];
        
        // Helper function to get item details (modifies levelData copy, not original)
        const getItemDetails = (itemId, prefix) => {
          if (!itemId) return;
          let item = this.actor.items.get(itemId);
          if (!item) {
            item = game.items.get(itemId);
          }
          if (!item) {
            if (itemId.includes(".")) {
              levelData[`${prefix}Uuid`] = itemId;
              for (const pack of game.packs.values()) {
                if (pack.index.has(itemId.split(".")[2])) {
                  const packItem = pack.index.get(itemId.split(".")[2]);
                  if (packItem) {
                    levelData[`${prefix}Name`] = packItem.name;
                    levelData[`${prefix}Img`] = packItem.img || "icons/svg/mystery-man.svg";
                    return;
                  }
                }
              }
            } else {
              levelData[`${prefix}`] = itemId;
              levelData[`${prefix}Name`] = itemId;
              levelData[`${prefix}Img`] = "icons/svg/mystery-man.svg";
              levelData[`${prefix}Uuid`] = "";
              return;
            }
          }
          if (item) {
            levelData[`${prefix}Name`] = item.name;
            levelData[`${prefix}Img`] = item.img;
            levelData[`${prefix}Uuid`] = item.uuid;
          } else {
            if (!levelData[`${prefix}Name`]) {
              levelData[`${prefix}Name`] = "Unknown Item";
              levelData[`${prefix}Img`] = "icons/svg/mystery-man.svg";
            }
          }
        };
        
        // Get details for each slot type
        if (level === 1) {
          getItemDetails(levelData.phenotype, "phenotype");
          getItemDetails(levelData.subtype, "subtype");
          getItemDetails(levelData.background, "background");
          getItemDetails(levelData.powerset, "powerset");
          // Note: humanAbilityBoost and terranAbilityBoost are now strings (ability names), not item IDs
          getItemDetails(levelData.humanGenericTalent, "humanGenericTalent");
          getItemDetails(levelData.terranGenericTalent, "terranGenericTalent");
        } else {
          getItemDetails(levelData.genericTalent, "genericTalent");
          getItemDetails(levelData.powersetTalent, "powersetTalent");
        }
      }
      
      // Store the progression copy in context (don't modify original actor data)
      // Assign to context.actor.system.progression for template access
      // Note: context.actor is already a copy from super.getData(), so this is safe for display
      // Ensure system exists before assigning
      if (!context.actor.system) {
        context.actor.system = {};
      }
      context.actor.system.progression = progressionCopy;
      const level1Copy = context.actor.system.progression.level1;
      const basicPowers = actorData.system.basic || {};
      const fillField = (fieldName, fallbackValue) => {
        if (!level1Copy[fieldName] && fallbackValue) {
          level1Copy[fieldName] = fallbackValue;
        }
        const nameField = `${fieldName}Name`;
        if (!level1Copy[nameField] && level1Copy[fieldName]) {
          level1Copy[nameField] = level1Copy[fieldName];
        }
      };
      fillField("phenotype", basicPowers.phenotype);
      fillField("subtype", basicPowers.subtype);
      fillField("background", basicPowers.background);
      fillField("powerset", basicPowers.powerset);
      
      // Parse background bonuses if background is selected
      const backgroundName = progressionCopy.level1?.backgroundName;
      const backgroundId = progressionCopy.level1?.background;
      let backgroundBonuses = null;
      
      if (backgroundName || backgroundId) {
        console.log("Singularity | Parsing background bonuses for:", backgroundName, "ID:", backgroundId);
        // Try to get background item to parse its description
        let backgroundItem = null;
        if (backgroundId) {
          backgroundItem = this.actor.items.get(backgroundId);
          if (!backgroundItem && backgroundId.includes(".")) {
            // Try to get from compendium - handle UUID format: Compendium.singularity.backgrounds.Athlete
            const parts = backgroundId.split(".");
            if (parts.length >= 4 && parts[0] === "Compendium" && parts[1] === "singularity") {
              // Format: Compendium.singularity.backgrounds.Athlete
              const packName = parts[2];
              const itemName = parts[3];
              const pack = game.packs.get(`singularity.${packName}`);
              if (pack) {
                try {
                  const index = await pack.getIndex();
                  const indexEntry = index.get(itemName);
                  if (indexEntry) {
                    backgroundItem = await pack.getDocument(indexEntry._id);
                    console.log("Singularity | Loaded background item from compendium:", backgroundItem?.name);
                  } else {
                    console.warn("Singularity | Background item not found in compendium index:", itemName);
                  }
                } catch (e) {
                  console.warn("Singularity | Could not load background item:", e);
                }
              } else {
                console.warn("Singularity | Compendium pack not found:", `singularity.${packName}`);
              }
            } else if (parts.length >= 3) {
              // Fallback: try old format (singularity.backgrounds.Athlete)
              const packName = parts[1];
              const itemName = parts[2];
              const pack = game.packs.get(`singularity.${packName}`);
              if (pack) {
                try {
                  const index = await pack.getIndex();
                  const indexEntry = index.get(itemName);
                  if (indexEntry) {
                    backgroundItem = await pack.getDocument(indexEntry._id);
                    console.log("Singularity | Loaded background item from compendium (old format):", backgroundItem?.name);
                  }
                } catch (e) {
                  console.warn("Singularity | Could not load background item:", e);
                }
              }
            }
          } else if (backgroundItem) {
            console.log("Singularity | Found background item in actor items:", backgroundItem.name);
          }
        }
        
        if (backgroundItem && backgroundItem.system?.description) {
          const description = backgroundItem.system.description;
          console.log("Singularity | Background description length:", description.length);
          backgroundBonuses = { abilityBoostOptions: [], skillTrainingOptions: [] };
          
          // Parse ability boost options - look for patterns like:
          // "Increase your Might, Agility, or Endurance ability score by +1 (choose one)"
          // "Increase your Wits ability score by +1"
          const abilityBoostSection = description.match(/<strong>Ability Boost:<\/strong>[\s\S]*?<\/li>/i);
          if (abilityBoostSection) {
            const boostText = abilityBoostSection[0];
            console.log("Singularity | Ability boost section found:", boostText.substring(0, 100));
            // Find all <strong> tags with ability names
            const abilityPattern = /<strong>([A-Z][a-z]+)<\/strong>/g;
            let abilityMatch;
            const foundAbilities = [];
            while ((abilityMatch = abilityPattern.exec(boostText)) !== null) {
              const ability = abilityMatch[1].trim();
              // Only include valid abilities
              if (["Might", "Agility", "Endurance", "Wits", "Charm"].includes(ability)) {
                foundAbilities.push(ability.toLowerCase()); // Store lowercase for consistency with system
              }
            }
            if (foundAbilities.length > 0) {
              backgroundBonuses.abilityBoostOptions = [...new Set(foundAbilities)]; // Remove duplicates
              console.log("Singularity | Found ability boost options:", backgroundBonuses.abilityBoostOptions);
            } else {
              console.warn("Singularity | No ability boost options found in text");
            }
          } else {
            console.warn("Singularity | Ability boost section not found in description");
          }
          
          // Parse skill training options - look for patterns like:
          // "You gain Apprentice training in Acrobatics (Agility) or Athletics (Might)"
          // The section name can vary: "Athleticism:", "Street Skills:", "Training:", etc.
          // Look for any list item that contains "Apprentice training"
          const skillTrainingSection = description.match(/<li>[\s\S]*?Apprentice training[\s\S]*?<\/li>/i);
          if (skillTrainingSection) {
            const trainingText = skillTrainingSection[0];
            console.log("Singularity | Skill training section found:", trainingText.substring(0, 200));
            // Find all skills in format "Skill (Ability)" or "Skill(Ability)"
            // Look for patterns like: <strong>Acrobatics (Agility)</strong> or <strong>Stealth(Agility)</strong>
            const skillPattern = /<strong>([^<]+?)\s*\(([^)]+)\)<\/strong>/g;
            let skillMatch;
            const foundSkills = [];
            while ((skillMatch = skillPattern.exec(trainingText)) !== null) {
              const skillName = skillMatch[1].trim();
              const ability = skillMatch[2].trim();
              // Skip "Apprentice training" itself if it matches
              if (skillName.toLowerCase() !== "apprentice training") {
                foundSkills.push(`${skillName} (${ability})`);
              }
            }
            if (foundSkills.length > 0) {
              backgroundBonuses.skillTrainingOptions = foundSkills;
              console.log("Singularity | Found skill training options:", backgroundBonuses.skillTrainingOptions);
            } else {
              console.warn("Singularity | No skill training options found in text");
            }
          } else {
            console.warn("Singularity | Skill training section not found in description");
          }
        } else {
          console.warn("Singularity | Background item not found or has no description. Item:", backgroundItem);
        }
      }
      
      context.backgroundBonuses = backgroundBonuses;
      console.log("Singularity | Final backgroundBonuses:", backgroundBonuses);

      // Calculate land speed AFTER progression data is populated (base 25 + bonuses from talents)
      // Also check for armor Might requirement penalties
      let landSpeed = 25; // Base land speed
      const isBlinded = this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "blinded");
      
      // Check if equipped armor has Might requirement penalty (use stored deficit from AC calculation)
      let speedPenalty = null; // "halved" or "immobile"
      const armorMightDeficit = context.armorMightDeficit || 0;
      if (armorMightDeficit > 0) {
        if (armorMightDeficit >= 4) {
          speedPenalty = "immobile";
          // Will set to 0 after calculating base speed + bonuses
        } else if (armorMightDeficit >= 1) {
          speedPenalty = "halved";
          // Will halve after calculating base speed + bonuses
        }
      }
      
      // Helper function to get item name from ID/UUID (synchronous, uses already loaded data)
      const getItemNameFromId = (itemId) => {
        if (!itemId) return null;
        // Try to get from actor's items first
        let item = this.actor.items.get(itemId);
        // If not found, try to find in world items
        if (!item) {
          item = game.items.get(itemId);
        }
        // If still not found and it looks like a UUID, try to get from compendium index
        if (!item && itemId.includes(".")) {
          const parts = itemId.split(".");
          if (parts.length >= 3) {
            const packName = parts[1];
            const itemName = parts[2];
            const pack = game.packs.get(`singularity.${packName}`);
            if (pack && pack.index) {
              const packItem = pack.index.get(itemName);
              if (packItem) {
                return packItem.name;
              }
            }
          }
        }
        return item ? item.name : null;
      };
      
      // Check for Swift Runner talent (+5 to land speed)
      // Reuse allTalentNames that was already calculated earlier in the function for armor training checks
      
      console.log("Singularity | Checking talents for Swift Runner.");
      console.log("Singularity | All talent names:", allTalentNames);
      
      const hasSwiftRunner = allTalentNames.includes("Swift Runner");
      console.log("Singularity | Has Swift Runner:", hasSwiftRunner);
      
      if (hasSwiftRunner) {
        landSpeed += 5;
        console.log("Singularity | Swift Runner detected, land speed increased to", landSpeed);
      } else {
        console.log("Singularity | No Swift Runner found, land speed remains", landSpeed);
      }
      
      // Apply Might requirement penalty (halve speed if 1-3 deficit, set to 0 if 4+)
      if (speedPenalty === "halved") {
        landSpeed = Math.floor(landSpeed / 2);
        // Round up to the nearest 5 after halving
        landSpeed = Math.ceil(landSpeed / 5) * 5;
        console.log("Singularity | Armor Might requirement not met (1-3 deficit), speed halved and rounded up to", landSpeed);
      } else if (speedPenalty === "immobile") {
        landSpeed = 0;
        console.log("Singularity | Armor Might requirement not met (4+ deficit), character is immobile");
      }

      if (isBlinded && landSpeed > 0) {
        landSpeed = Math.ceil(landSpeed / 2 / 5) * 5;
      }
      
      // Store calculated land speed in context (don't modify actor data)
      context.speeds.land = landSpeed;
      context.armorSpeedPenalty = speedPenalty;

      // Calculate swimming speed - check if Expert Swimmer talent is selected
      let swimmingSpeed = null; // null means use stored value or show as editable
      
      // Check if Expert Swimmer is selected (reuse allTalentNames from Swift Runner check above)
      const hasExpertSwimmer = allTalentNames.some(name => 
        name && name.toLowerCase().includes("expert swimmer")
      );
      
      if (hasExpertSwimmer) {
        swimmingSpeed = 25; // Expert Swimmer grants 25 ft swimming speed
        // Update context speeds for display (don't modify actor data)
        context.speeds.swimming = 25;
      }
      
      context.calculatedSwimmingSpeed = swimmingSpeed;

      // Calculate flying speed - check if Paragon is selected
      // Reuse powersetName that was already declared earlier in the function
      let calculatedFlyingSpeed = null;
      if (powersetName === "Paragon") {
        // Paragon grants 15 ft flying speed at level 1
        calculatedFlyingSpeed = 15;
        context.speeds.flying = 15;
        console.log("Singularity | Paragon detected, flying speed set to 15 ft");
      }
      context.calculatedFlyingSpeed = calculatedFlyingSpeed;

      if (isBlinded) {
        for (const [speedType, value] of Object.entries(context.speeds || {})) {
          if (typeof value === "number" && value > 0) {
            context.speeds[speedType] = Math.ceil(value / 2 / 5) * 5;
          }
        }
        if (context.calculatedSwimmingSpeed) {
          context.calculatedSwimmingSpeed = Math.ceil(context.calculatedSwimmingSpeed / 2 / 5) * 5;
        }
        if (context.calculatedFlyingSpeed) {
          context.calculatedFlyingSpeed = Math.ceil(context.calculatedFlyingSpeed / 2 / 5) * 5;
        }
        context.blindedSpeedPenalty = true;
      }

      // Calculate Wound Limit: 3 + Endurance (+ 2 if Hard to Kill)
      const wounds = actorData.system.wounds || [];
      const endurance = calculatedAbilityScores.endurance || 0;
      
      // Check if Hard to Kill talent is selected
      const hasHardToKill = allTalentNames.some(name => 
        name && name.toLowerCase().includes("hard to kill")
      );
      
      let woundLimit = 3 + endurance;
      if (hasHardToKill) {
        woundLimit += 2;
      }
      
      // Calculate current wound value (Standard = 1, Extreme = 3)
      const woundValue = wounds.reduce((total, wound) => {
        return total + (wound.isExtreme ? 3 : 1);
      }, 0);
      
      context.calculatedWoundLimit = woundLimit;
      context.woundValue = woundValue;
      context.hasHardToKill = hasHardToKill;
      context.wounds = wounds;

      return context;
    } catch (error) {
      console.error("Singularity | Error in getData():", error);
      console.error("Singularity | Error stack:", error.stack);
      ui.notifications.error(`Error loading character sheet: ${error.message}`);
      // Return a minimal context to prevent complete failure
      try {
        const fallbackContext = await super.getData();
        // Ensure fallback context has required fields
        fallbackContext.cssClass = "singularity sheet actor hero";
        return fallbackContext;
      } catch (fallbackError) {
        console.error("Singularity | Fallback getData() also failed:", fallbackError);
        // Return absolute minimal context
        return {
          actor: this.actor.toObject(),
          owner: this.actor.isOwner,
          cssClass: "singularity sheet actor hero",
          editable: this.actor.isOwner
        };
      }
    }
  }

  /** @override */
  async _render(force, options) {
    try {
      // Preserve the current active tab before re-rendering
      let activeTab = null;
      if (this.element && !force) {
        const currentActiveTab = this.element.find('.sheet-tabs .item.active, .tab.active');
        if (currentActiveTab.length) {
          activeTab = currentActiveTab.first().data('tab');
        }
      }
      
      await super._render(force, options);
      // Debug: Check if our template was used
      if (this.element) {
        const hasOurClasses = this.element.hasClass('singularity');
        console.log("Singularity | Sheet rendered. Has our classes:", hasOurClasses, "Element classes:", this.element.attr('class'));
        
        if (!hasOurClasses) {
          console.error("Singularity | WARNING: Template not loaded correctly! Using base sheet instead.");
          ui.notifications.error("Character sheet template failed to load. Please check console for errors.");
        } else {
          // Ensure the sheet body is visible and tabs are activated
          const sheetBody = this.element.find('.sheet-body');
          if (sheetBody.length) {
            sheetBody.css('display', 'block');
            
            // Restore the previously active tab, or default to "main" if no tab was active
            const tabToActivate = activeTab || "main";
            const tabElement = this.element.find(`.tab[data-tab="${tabToActivate}"]`);
            const tabNav = this.element.find(`.sheet-tabs .item[data-tab="${tabToActivate}"]`);
            
            // Remove active class from all tabs
            this.element.find('.tab.active').removeClass('active');
            this.element.find('.sheet-tabs .item.active').removeClass('active');
            
            // Activate the desired tab
            if (tabElement.length) {
              tabElement.addClass('active');
            }
            if (tabNav.length) {
              tabNav.addClass('active');
            }
            
            // If no tab was active and we couldn't find the tab, default to main
            if (!activeTab && (!tabElement.length || !tabNav.length)) {
              const initialTab = this.element.find('.tab[data-tab="main"]');
              const initialTabNav = this.element.find('.sheet-tabs .item[data-tab="main"]');
              if (initialTab.length) {
                initialTab.addClass('active');
              }
              if (initialTabNav.length) {
                initialTabNav.addClass('active');
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Singularity | Error in _render:", error);
      ui.notifications.error(`Error rendering character sheet: ${error.message}`);
      throw error;
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add skill
    html.find(".add-skill").click(this._onAddSkill.bind(this));
    
    // Delete skill - handle clicks on the anchor or icon inside it
    html.on("click", ".delete-skill", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      // Get the anchor element - use jQuery to find it reliably
      const $anchor = $(event.currentTarget).closest(".delete-skill");
      if ($anchor.length === 0) {
        console.warn("Could not find delete-skill anchor element");
        return;
      }
      
      const skillName = $anchor.data("skill");
      if (!skillName) {
        console.warn("No skill name found in data-skill attribute");
        return;
      }

      await this._onDeleteSkill(skillName);
    });
    
    // Edit skill
    html.find(".edit-skill").click(this._onEditSkill.bind(this));
    
    // Roll skill
    html.find(".skill-roll").click(this._onRollSkill.bind(this));
    
    // Update other bonuses on skill
    html.find(".skill-other-bonus").on("change blur", this._onUpdateSkillOtherBonuses.bind(this));
    
    // Prevent editing of locked skill bonuses
    html.find(".skill-other-bonus-locked").on("click", (event) => {
      const skillName = $(event.currentTarget).closest(".skill").find(".skill-name-text strong").text();
      const source = $(event.currentTarget).attr("title") || "a talent";
      ui.notifications.warn(`${skillName} other bonus is locked (comes from ${source}).`);
    });

    // Add item
    html.find(".item-create").click(this._onItemCreate.bind(this));
    
    // Buy armor from compendium
    html.find(".buy-armor").click(this._onBuyArmor.bind(this));
    
    // Equip/Unequip armor
    html.find(".armor-equip").click(this._onEquipArmor.bind(this));
    html.find(".armor-unequip").click(this._onUnequipArmor.bind(this));

    // Buy weapon from compendium
    html.find(".buy-weapon").click(this._onBuyWeapon.bind(this));

    // Equip/Unequip weapons
    html.find(".weapon-equip").click(this._onEquipWeapon.bind(this));
    html.find(".weapon-unequip").click(this._onUnequipWeapon.bind(this));
    
    // Edit item
    html.find(".item-edit").click(this._onItemEdit.bind(this));
    
    // Click on item icon to open item sheet
    html.find(".clickable-item-icon").click(this._onItemIconClick.bind(this));
    
    // Delete item
    html.find(".item-delete").click(this._onItemDelete.bind(this));

    // Roll ability check
    html.find(".ability-roll").click(this._onAbilityRoll.bind(this));

    // Roll saving throw
    html.find(".saving-throw-roll").click(this._onRollSavingThrow.bind(this));

    // Update other bonuses on saving throw
    html.find(".saving-throw-other-bonus").on("change blur", this._onUpdateSavingThrowOtherBonuses.bind(this));

    // Attack management
    html.find(".add-attack").click(this._onAddAttack.bind(this));
    html.find(".attack-edit").click(this._onEditAttack.bind(this));
    html.find(".attack-delete").click(this._onDeleteAttack.bind(this));
    html.find(".attack-roll").click(this._onRollAttack.bind(this));
    html.find(".damage-roll").click(this._onRollDamage.bind(this));

    // Speed management
    // Removed Add Speed Type button - speeds are now automatically calculated from talents
    html.on("click", ".speed-delete", this._onDeleteSpeed.bind(this));

    // Image change dialog
    html.on("click", "[data-action='change-image']", this._onChangeImage.bind(this));

    // Resistances, Weaknesses, and Immunities management
    html.find(".add-rwi").click(this._onAddRWI.bind(this));
    html.on("click", ".rwi-delete", this._onDeleteRWI.bind(this));

    // Wounds management
    html.find(".roll-wound").click(this._onRollWound.bind(this));
    html.find(".roll-extreme-wound").click(this._onRollExtremeWound.bind(this));
    html.on("click", ".wound-delete", this._onDeleteWound.bind(this));

    // Supersonic Moment controls
    html.find(".supersonic-toggle").on("change", this._onSupersonicToggle.bind(this));
    html.find(".supersonic-distance-input").on("change blur", this._onSupersonicDistanceChange.bind(this));

    // Deadeye controls
    html.find(".deadeye-toggle").on("change", this._onDeadeyeToggle.bind(this));

    // Enough Prep Time controls
    html.find(".enough-prep-time-toggle").on("change", this._onEnoughPrepTimeToggle.bind(this));
    html.find(".enough-prep-time-enemy-input").on("change blur", this._onEnoughPrepTimeEnemyChange.bind(this));

    // Gadgets management
    html.find(".add-gadget").click(this._onAddGadget.bind(this));
    html.find(".gadget-use").click(this._onUseGadget.bind(this));
    html.on("click", ".gadget-remove", this._onRemoveGadget.bind(this));
    html.on("click", ".gadget-item-clickable", this._onGadgetItemClick.bind(this));

    // Long Rest button
    html.find(".long-rest-button").click(this._onLongRest.bind(this));

    // Progression slot management
    html.on("click", ".slot-delete", this._onDeleteProgressionSlot.bind(this));
    
    // Handle clicks on progression slot items to show details (but not on delete button)
    html.on("click", ".progression-slot .slot-item", this._onProgressionItemClick.bind(this));
    
    // Handle clicks on talent progression slots to open talent selection dialog
    html.on("click", ".progression-slot[data-slot-type='genericTalent'], .progression-slot[data-slot-type='humanGenericTalent'], .progression-slot[data-slot-type='terranGenericTalent'], .progression-slot[data-slot-type='bastionTalent'], .progression-slot[data-slot-type='paragonTalent'], .progression-slot[data-slot-type='gadgeteerTalent'], .progression-slot[data-slot-type='marksmanTalent']", this._onTalentSlotClick.bind(this));
    
    // Handle clicks on phenotype, subtype, and powerset progression slots
    html.on("click", ".progression-slot[data-slot-type='phenotype']", this._onPhenotypeSlotClick.bind(this));
    html.on("click", ".progression-slot[data-slot-type='subtype']", this._onSubtypeSlotClick.bind(this));
    html.on("click", ".progression-slot[data-slot-type='background']", this._onBackgroundSlotClick.bind(this));
    html.on("click", ".progression-slot[data-slot-type='powerset']", this._onPowersetSlotClick.bind(this));
    
    // Handle ability boost selection changes
    html.find(".ability-boost-select").on("change", this._onAbilityBoostChange.bind(this));
    html.find(".talent-detail-select").on("change", this._onAbilityBoostChange.bind(this));
    
    // Prevent talent slot click when clicking on talent detail select
    html.find(".talent-detail-select").on("click", (event) => {
      event.stopPropagation();
    });

    // Handle Initiative breakdown click
    html.on("click", "[data-action='show-initiative-breakdown']", this._onShowInitiativeBreakdown.bind(this));
    
    // Handle AC breakdown click
    html.on("click", "[data-action='show-ac-breakdown']", this._onShowAcBreakdown.bind(this));
    
    // Handle ability breakdown click
    html.on("click", "[data-action='show-ability-breakdown']", this._onShowAbilityBreakdown.bind(this));
    
    // Handle ability name click (roll)
    html.on("click", "[data-action='roll-ability']", this._onAbilityNameRoll.bind(this));
    
    // Handle HP breakdown click
    html.on("click", "[data-action='show-hp-breakdown']", this._onShowHpBreakdown.bind(this));
    
    // Handle saving throw breakdown click
    html.on("click", "[data-action='show-saving-throw-breakdown']", this._onShowSavingThrowBreakdown.bind(this));
    
    // Handle saving throw name click (roll)
    html.on("click", "[data-action='roll-saving-throw']", this._onRollSavingThrow.bind(this));
    
    // Handle Prime Level increase/decrease buttons
    html.on("click", "[data-action='increase-level']", this._onIncreaseLevel.bind(this));
    html.on("click", "[data-action='decrease-level']", this._onDecreaseLevel.bind(this));

    // Handle name changes to prevent empty names
    html.find('input[name="name"]').on("blur", (event) => {
      const name = event.target.value?.trim();
      if (!name || name === "") {
        this.actor.update({ name: "Unnamed Hero" });
      }
    });

    // Handle inline AC bonus edits using Foundry's data-item-property system
    html.find(".inline-edit")
      .on("mousedown", (event) => {
        event.stopPropagation();
        event.stopImmediatePropagation();
      })
      .on("click", (event) => {
        event.stopPropagation();
        event.stopImmediatePropagation();
        event.currentTarget.focus();
        event.currentTarget.select();
      })
      .on("change", this._onInlineEdit.bind(this))
      .on("blur", this._onInlineEdit.bind(this));
  }

  /** @override */
  async _updateObject(event, formData) {
    // Exclude inline-edit fields from form submission - they handle their own updates
    if (event && event.target && event.target.classList.contains("inline-edit")) {
      return;
    }
    // Ensure name is never empty
    if (formData.name === "" || !formData.name) {
      formData.name = "Unnamed Hero";
    }
    
    // Process numeric fields - ensure they're numbers, not strings, and default to 0 if empty
    const numericFields = [
      "system.combat.hp.value",
      "system.combat.hp.max",
      "system.combat.speed",
      "system.combat.initiative",
      "system.combat.ac",
      "system.basic.primeLevel",
      "system.equipment.credits"
    ];
    
    for (const field of numericFields) {
      if (field in formData) {
        const value = formData[field];
        if (value === null || value === undefined || value === "") {
          formData[field] = field === "system.basic.primeLevel" ? 1 : 0;
        } else {
          const parsed = Number(value);
          formData[field] = isNaN(parsed) ? (field === "system.basic.primeLevel" ? 1 : 0) : parsed;
        }
      }
    }
    
    // Handle speed fields (they can be in system.combat.speeds.*)
    // Skip land speed as it's calculated, not editable
    for (const key in formData) {
      if (key.startsWith("system.combat.speeds.") && !key.endsWith(".land")) {
        const value = formData[key];
        if (value === null || value === undefined || value === "") {
          formData[key] = 0;
        } else {
          const parsed = Number(value);
          formData[key] = isNaN(parsed) ? 0 : parsed;
        }
      }
    }
    
    // Remove land speed from formData if it was submitted (it's calculated, not editable)
    if ("system.combat.speeds.land" in formData) {
      delete formData["system.combat.speeds.land"];
    }
    
    // Remove flying speed from formData if it comes from Paragon (it's calculated, not editable)
    const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
    if (powersetName === "Paragon" && "system.combat.speeds.flying" in formData) {
      delete formData["system.combat.speeds.flying"];
    }
    
    // Prevent all saving throw rank changes (they are always locked, only changeable via talents/powersets)
    const savingThrowAbilityNames = ["might", "agility", "endurance", "wits", "charm"];
    for (const ability of savingThrowAbilityNames) {
      const savingThrowPath = `system.savingThrows.${ability}.rank`;
      if (savingThrowPath in formData) {
        ui.notifications.warn(`Cannot change ${ability.charAt(0).toUpperCase() + ability.slice(1)} saving throw rank. Saving Throw Competence is set by talents and powersets.`);
        delete formData[savingThrowPath];
      }
    }

    // Use the default Foundry form submission which handles merging automatically
    return super._updateObject(event, formData);
  }

  async _onAddSkill(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const template = `
      <form>
        <div class="form-group">
          <label>Skill Name:</label>
          <input type="text" name="skillName" placeholder="e.g., Stealth" required/>
        </div>
        <div class="form-group">
          <label>Associated Ability:</label>
          <select name="ability" required>
            <option value="might">Might</option>
            <option value="agility" selected>Agility</option>
            <option value="endurance">Endurance</option>
            <option value="wits">Wits</option>
            <option value="charm">Charm</option>
          </select>
        </div>
        <div class="form-group">
          <label>Training Rank:</label>
          <select name="rank" required>
            <option value="Novice" selected>Novice</option>
            <option value="Apprentice">Apprentice</option>
            <option value="Competent">Competent</option>
            <option value="Masterful">Masterful</option>
            <option value="Legendary">Legendary</option>
          </select>
        </div>
      </form>
    `;

    new Dialog({
      title: "Add Skill",
      content: template,
      buttons: {
        add: {
          icon: '<i class="fas fa-check"></i>',
          label: "Add",
          callback: async (html) => {
            const skillName = html.find('input[name="skillName"]').val()?.trim();
            const ability = html.find('select[name="ability"]').val();
            const rank = html.find('select[name="rank"]').val();

            if (!skillName) {
              ui.notifications.warn("Please enter a skill name.");
              return;
            }

            const skills = foundry.utils.deepClone(this.actor.system.skills || {});
            
            // Check if skill already exists
            if (skills[skillName]) {
              ui.notifications.warn(`Skill "${skillName}" already exists.`);
              return;
            }

            skills[skillName] = {
              ability: ability.toLowerCase(),
              rank: rank,
              otherBonuses: 0
            };

            await this.actor.update({ "system.skills": skills });
            // Force a full re-render
            this.render(true);
            ui.notifications.info(`Added skill: ${skillName}`);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => {}
        }
      },
      default: "add",
      close: () => {}
    }).render(true);
  }

  async _onDeleteSkill(skillName) {
    if (!skillName) {
      console.warn("No skill name provided for deletion");
      return;
    }

    // Check if this skill comes from a talent (locked)
    const skills = this.actor.system.skills || {};
    const skill = skills[skillName];
    if (skill && skill.lockedOtherBonuses) {
      const source = skill.lockedSource || "a talent";
      ui.notifications.warn(`Cannot delete ${skillName}. This skill comes from ${source}. Remove the talent from the Progression tab to remove this skill.`);
      return;
    }

    // Store reference to this for use in callback
    const self = this;
    const actor = this.actor;

    // Confirm deletion using standard Dialog
    new Dialog({
      title: "Delete Skill",
      content: `<p>Are you sure you want to delete the skill "<strong>${skillName}</strong>"?</p>`,
      buttons: {
        yes: {
          icon: '<i class="fas fa-check"></i>',
          label: "Delete",
          callback: async () => {
            try {
              console.log("Delete callback called for skill:", skillName);
              const currentSkills = actor.system.skills || {};
              console.log("Current skills:", currentSkills);
              
              if (!currentSkills[skillName]) {
                console.warn("Skill not found in skills object:", skillName);
                ui.notifications.warn(`Skill "${skillName}" not found.`);
                return;
              }
              
              // Use Foundry's unset operator to remove the skill
              const updateData = {};
              updateData[`system.skills.-=${skillName}`] = null;
              
              console.log("Update data (using unset):", updateData);
              
              try {
                await actor.update(updateData, { render: false });
                console.log("Actor updated with unset operator");
                
                // Refresh actor data
                await actor.prepareData();
                console.log("Actor skills after update:", actor.system.skills);
                
                // If unset didn't work, try replacing the entire object
                if (actor.system.skills && actor.system.skills[skillName]) {
                  console.log("Unset didn't work, trying full object replacement");
                  const updatedSkills = { ...currentSkills };
                  delete updatedSkills[skillName];
                  
                  await actor.update({ "system.skills": updatedSkills }, { diff: false, render: false });
                  await actor.prepareData();
                  console.log("Actor skills after full replacement:", actor.system.skills);
                }
              } catch (error) {
                console.error("Error updating actor:", error);
                // Fallback: try full object replacement
                const updatedSkills = { ...currentSkills };
                delete updatedSkills[skillName];
                await actor.update({ "system.skills": updatedSkills }, { diff: false, render: false });
                await actor.prepareData();
              }
              
              // Force a full re-render of the sheet
              await self.render(true);
              console.log("Sheet re-rendered");
              
              // Double-check after render
              console.log("Final actor skills check:", actor.system.skills);
              
              ui.notifications.info(`Deleted skill: ${skillName}`);
            } catch (error) {
              console.error("Error deleting skill:", error);
              ui.notifications.error(`Failed to delete skill: ${error.message}`);
            }
          }
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => {}
        }
      },
      default: "no",
      close: () => {}
    }).render(true);
  }

  async _onAddSpeed(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const speedTypes = [
      { value: "swimming", label: "Swimming" },
      { value: "flying", label: "Flying" },
      { value: "crawling", label: "Crawling" },
      { value: "climbing", label: "Climbing" }
    ];
    
    // Get existing speed types
    const existingSpeeds = this.actor.system.combat.speeds || { land: this.actor.system.combat.speed || 25 };
    const existingTypes = Object.keys(existingSpeeds);
    
    // Filter out already added speed types
    const availableTypes = speedTypes.filter(type => !existingTypes.includes(type.value));
    
    if (availableTypes.length === 0) {
      ui.notifications.warn("All speed types have already been added.");
      return;
    }
    
    const template = `
      <form>
        <div class="form-group">
          <label>Speed Type:</label>
          <select name="speedType" required>
            ${availableTypes.map(type => `<option value="${type.value}">${type.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Speed Value:</label>
          <input type="number" name="speedValue" value="0" min="0" required/>
        </div>
      </form>
    `;

    new Dialog({
      title: "Add Speed Type",
      content: template,
      buttons: {
        add: {
          icon: '<i class="fas fa-check"></i>',
          label: "Add",
          callback: async (html) => {
            const speedType = html.find('select[name="speedType"]').val();
            const speedValue = parseInt(html.find('input[name="speedValue"]').val()) || 0;

            const speeds = foundry.utils.deepClone(this.actor.system.combat.speeds || { land: this.actor.system.combat.speed || 25 });
            speeds[speedType] = speedValue;

            await this.actor.update({ "system.combat.speeds": speeds });
            this.render(true);
            ui.notifications.info(`Added ${speedType} speed: ${speedValue} ft.`);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => {}
        }
      },
      default: "add",
      close: () => {}
    }).render(true);
  }

  async _onDeleteSpeed(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const speedType = $(event.currentTarget).closest(".speed-delete").data("speed-type");
    if (!speedType || speedType === "land") {
      ui.notifications.warn("Cannot delete land speed.");
      return;
    }
    
    // Check if swimming speed comes from Expert Swimmer talent
    if (speedType === "swimming") {
      // Check all progression slots for Expert Swimmer
      const progression = this.actor.system.progression || {};
      let hasExpertSwimmer = false;
      
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        
        const talentNames = [
          levelData.genericTalentName,
          levelData.humanGenericTalentName,
          levelData.terranGenericTalentName,
          levelData.powersetTalentName,
          levelData.bastionTalentName
        ].filter(Boolean);
        
        for (const talentName of talentNames) {
          if (talentName && talentName.toLowerCase().includes("expert swimmer")) {
            hasExpertSwimmer = true;
            break;
          }
        }
        
        if (hasExpertSwimmer) break;
      }
      
      if (hasExpertSwimmer) {
        ui.notifications.warn("Swimming speed comes from the Expert Swimmer talent. Remove the talent from the Progression tab to remove this speed.");
        return;
      }
    }
    
    // Check if flying speed comes from Paragon powerset
    if (speedType === "flying") {
      const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
      if (powersetName === "Paragon") {
        ui.notifications.warn("Flying speed comes from the Paragon powerset. Remove Paragon from the Progression tab to remove this speed.");
        return;
      }
    }

    const speeds = foundry.utils.deepClone(this.actor.system.combat.speeds || {});
    delete speeds[speedType];

    await this.actor.update({ [`system.combat.speeds.-=${speedType}`]: null });
    // Fallback if unset doesn't work
    if (this.actor.system.combat.speeds && this.actor.system.combat.speeds[speedType]) {
      await this.actor.update({ "system.combat.speeds": speeds }, { diff: false });
    }
    await this.actor.prepareData();
    this.render(true);
    ui.notifications.info(`Removed ${speedType} speed.`);
  }

  async _onAddRWI(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const rwiType = $(event.currentTarget).data("type"); // "resistance", "weakness", or "immunity"
    if (!rwiType) return;
    
    const damageTypes = [
      "Energy",
      "Kinetic",
      "Fire",
      "Cold",
      "Lightning",
      "Acid",
      "Poison",
      "Psychic",
      "Radiant",
      "Necrotic",
      "Force",
      "Thunder"
    ];
    
    const template = `
      <form>
        <div class="form-group">
          <label>Damage Type:</label>
          <select name="damageType" required>
            ${damageTypes.map(type => `<option value="${type}">${type}</option>`).join('')}
          </select>
        </div>
        ${rwiType === "resistance" || rwiType === "weakness" ? `
        <div class="form-group">
          <label>Value (optional):</label>
          <input type="number" name="value" min="0" placeholder="e.g., 5"/>
          <p style="font-size: 11px; color: #a0aec0; margin-top: 5px;">Leave empty if the value is determined by other factors (e.g., 2 × Bastion level)</p>
        </div>
        ` : ''}
      </form>
      <style>
        .form-group {
          margin-bottom: 15px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          color: #d1d1d1;
          font-weight: bold;
        }
        .form-group select,
        .form-group input {
          width: 100%;
          padding: 8px;
          background: rgba(30, 33, 45, 0.95);
          border: 1px solid rgba(189, 95, 255, 0.4);
          border-radius: 3px;
          color: #ffffff;
          font-size: 14px;
        }
      </style>
    `;
    
    new Dialog({
      title: `Add ${rwiType.charAt(0).toUpperCase() + rwiType.slice(1)}`,
      content: template,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: "Add",
          callback: async (html) => {
            const damageType = html.find('select[name="damageType"]').val();
            const value = html.find('input[name="value"]').val();
            
            if (!damageType) {
              ui.notifications.warn("Please select a damage type.");
              return;
            }
            
            const rwiArray = foundry.utils.deepClone(this.actor.system[rwiType + "s"] || []);
            const newItem = {
              type: damageType,
              value: value ? parseInt(value) : null
            };
            
            rwiArray.push(newItem);
            
            await this.actor.update({ [`system.${rwiType}s`]: rwiArray });
            this.render();
            ui.notifications.info(`Added ${damageType} ${rwiType}.`);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "save"
    }).render(true);
  }

  async _onRollWound(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Roll 1d20 for the wound table
    const roll = new Roll("1d20");
    await roll.roll();
    const rollResult = roll.total;
    
    // Wound Table data
    const woundTable = {
      1: { location: "Right Leg", effect: "Speed halved.", extremeEffect: "Prone; cannot Stand Up." },
      2: { location: "Left Leg", effect: "Speed halved.", extremeEffect: "Prone; cannot Stand Up." },
      3: { location: "Right Arm", effect: "–5 Might checks.", extremeEffect: "–10 Might checks." },
      4: { location: "Left Arm", effect: "–5 Might checks.", extremeEffect: "–10 Might checks." },
      5: { location: "Right Hand", effect: "–5 Agility checks.", extremeEffect: "–10 Agility checks." },
      6: { location: "Left Hand", effect: "–5 Agility checks.", extremeEffect: "–10 Agility checks." },
      7: { location: "Lower Back", effect: "–5 Agility checks.", extremeEffect: "–10 Agility checks." },
      8: { location: "Upper Back", effect: "–5 Might checks.", extremeEffect: "–10 Might checks." },
      9: { location: "Abdomen", effect: "–5 Endurance checks.", extremeEffect: "–10 Endurance checks." },
      10: { location: "Chest", effect: "–5 Endurance checks.", extremeEffect: "–10 Endurance checks." },
      11: { location: "Head/Skull", effect: "–5 Wits checks.", extremeEffect: "Wits checks Impossible." },
      12: { location: "Face/Jaw", effect: "–5 Charm checks.", extremeEffect: "–10 Charm checks." },
      13: { location: "Right Eye", effect: "–5 Ranged/Perception.", extremeEffect: "–10 Ranged/Perception." },
      14: { location: "Left Eye", effect: "–5 Ranged/Perception.", extremeEffect: "–10 Ranged/Perception." },
      15: { location: "Shoulder", effect: "–2 AC.", extremeEffect: "–5 Might; –2 AC." },
      16: { location: "Neck", effect: "–2 AC.", extremeEffect: "–2 AC; Off-balance." },
      17: { location: "Lungs", effect: "Recovery Energy –1.", extremeEffect: "Recovery Energy –3." },
      18: { location: "Inner Ear", effect: "Off-balance.", extremeEffect: "–10 Agility; Off-balance." },
      19: { location: "Nervous System", effect: "Cannot use Reactions.", extremeEffect: "No Actions with \"Physical\" trait." },
      20: { location: "Vital Organ", effect: "–2 to ALL checks.", extremeEffect: "Roll for additional Wound." }
    };
    
    const woundData = woundTable[rollResult];
    if (!woundData) {
      ui.notifications.error(`Invalid wound roll: ${rollResult}`);
      return;
    }
    
    // Check if this location already exists (Aggravated Injury = Extreme Wound)
    const wounds = foundry.utils.deepClone(this.actor.system.wounds || []);
    const existingWoundIndex = wounds.findIndex(w => w.location === woundData.location);
    let isExtreme = false;
    
    if (existingWoundIndex !== -1) {
      // Location already exists - convert to Extreme Wound (Aggravated Injury)
      wounds[existingWoundIndex] = {
        location: woundData.location,
        effect: woundData.effect,
        extremeEffect: woundData.extremeEffect,
        isExtreme: true, // Convert to Extreme Wound
        roll: rollResult
      };
      isExtreme = true;
    } else {
      // New location - create Standard Wound
      const newWound = {
        location: woundData.location,
        effect: woundData.effect,
        extremeEffect: woundData.extremeEffect,
        isExtreme: false, // Standard Wound
        roll: rollResult
      };
      wounds.push(newWound);
      isExtreme = false;
    }
    
    await this.actor.update({ "system.wounds": wounds });
    
    // Send roll to chat
    const woundTypeText = isExtreme ? "Extreme Wound" : "Standard Wound";
    const effectText = isExtreme ? woundData.extremeEffect : woundData.effect;
    const chatContent = `
      <div class="wound-roll-result">
        <h3>Wound Roll: ${rollResult}</h3>
        <p><strong>Location:</strong> ${woundData.location}</p>
        <p><strong>Type:</strong> ${woundTypeText}</p>
        <p><strong>Effect:</strong> ${effectText}</p>
        ${isExtreme ? `<p class="extreme-warning"><strong>Aggravated Injury!</strong> This wound location already existed, converting it to an Extreme Wound.</p>` : ''}
      </div>
    `;
    
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: chatContent,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
    
    // If it's a Vital Organ Extreme Wound (roll 20 and it already exists), roll an additional wound
    if (rollResult === 20 && isExtreme) {
      ui.notifications.info("Vital Organ Extreme Wound! Rolling for additional wound...");
      // Recursively roll another wound
      setTimeout(() => {
        this._onRollWound(event);
      }, 500);
    }
    
    this.render();
    ui.notifications.info(`${woundTypeText} added: ${woundData.location}`);
  }

  async _onRollExtremeWound(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Roll 1d20 for the wound table (always Extreme Wound for Critical Trauma)
    const roll = new Roll("1d20");
    await roll.roll();
    const rollResult = roll.total;
    
    // Wound Table data (same as standard wound roll)
    const woundTable = {
      1: { location: "Right Leg", effect: "Speed halved.", extremeEffect: "Prone; cannot Stand Up." },
      2: { location: "Left Leg", effect: "Speed halved.", extremeEffect: "Prone; cannot Stand Up." },
      3: { location: "Right Arm", effect: "–5 Might checks.", extremeEffect: "–10 Might checks." },
      4: { location: "Left Arm", effect: "–5 Might checks.", extremeEffect: "–10 Might checks." },
      5: { location: "Right Hand", effect: "–5 Agility checks.", extremeEffect: "–10 Agility checks." },
      6: { location: "Left Hand", effect: "–5 Agility checks.", extremeEffect: "–10 Agility checks." },
      7: { location: "Lower Back", effect: "–5 Agility checks.", extremeEffect: "–10 Agility checks." },
      8: { location: "Upper Back", effect: "–5 Might checks.", extremeEffect: "–10 Might checks." },
      9: { location: "Abdomen", effect: "–5 Endurance checks.", extremeEffect: "–10 Endurance checks." },
      10: { location: "Chest", effect: "–5 Endurance checks.", extremeEffect: "–10 Endurance checks." },
      11: { location: "Head/Skull", effect: "–5 Wits checks.", extremeEffect: "Wits checks Impossible." },
      12: { location: "Face/Jaw", effect: "–5 Charm checks.", extremeEffect: "–10 Charm checks." },
      13: { location: "Right Eye", effect: "–5 Ranged/Perception.", extremeEffect: "–10 Ranged/Perception." },
      14: { location: "Left Eye", effect: "–5 Ranged/Perception.", extremeEffect: "–10 Ranged/Perception." },
      15: { location: "Shoulder", effect: "–2 AC.", extremeEffect: "–5 Might; –2 AC." },
      16: { location: "Neck", effect: "–2 AC.", extremeEffect: "–2 AC; Off-balance." },
      17: { location: "Lungs", effect: "Recovery Energy –1.", extremeEffect: "Recovery Energy –3." },
      18: { location: "Inner Ear", effect: "Off-balance.", extremeEffect: "–10 Agility; Off-balance." },
      19: { location: "Nervous System", effect: "Cannot use Reactions.", extremeEffect: "No Actions with \"Physical\" trait." },
      20: { location: "Vital Organ", effect: "–2 to ALL checks.", extremeEffect: "Roll for additional Wound." }
    };
    
    const woundData = woundTable[rollResult];
    if (!woundData) {
      ui.notifications.error(`Invalid wound roll: ${rollResult}`);
      return;
    }
    
    // Always mark as Extreme Wound (Critical Trauma)
    const wounds = foundry.utils.deepClone(this.actor.system.wounds || []);
    
    // Check if this location already exists - if so, replace it (don't add duplicate)
    const existingWoundIndex = wounds.findIndex(w => w.location === woundData.location);
    
    const newWound = {
      location: woundData.location,
      effect: woundData.effect,
      extremeEffect: woundData.extremeEffect,
      isExtreme: true, // Always Extreme for Critical Trauma
      roll: rollResult
    };
    
    if (existingWoundIndex !== -1) {
      // Location already exists - replace it with the Extreme Wound
      wounds[existingWoundIndex] = newWound;
    } else {
      // New location - add the Extreme Wound
      wounds.push(newWound);
    }
    
    await this.actor.update({ "system.wounds": wounds });
    
    // Send roll to chat
    const chatContent = `
      <div class="wound-roll-result">
        <h3>Extreme Wound Roll: ${rollResult}</h3>
        <p><strong>Location:</strong> ${woundData.location}</p>
        <p><strong>Type:</strong> Extreme Wound (Critical Trauma)</p>
        <p><strong>Effect:</strong> ${woundData.extremeEffect}</p>
        <p class="extreme-warning"><strong>Critical Trauma!</strong> This wound was caused by an Extreme Success attack or Extreme Failure saving throw.</p>
      </div>
    `;
    
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: chatContent,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
    
    // If it's a Vital Organ (roll 20), roll an additional wound
    if (rollResult === 20) {
      ui.notifications.info("Vital Organ Extreme Wound! Rolling for additional wound...");
      // Recursively roll another standard wound
      setTimeout(() => {
        this._onRollWound(event);
      }, 500);
    }
    
    this.render();
    ui.notifications.info(`Extreme Wound added: ${woundData.location}`);
  }

  async _onDeleteWound(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const woundId = parseInt($(event.currentTarget).data("wound-id"));
    const wounds = foundry.utils.deepClone(this.actor.system.wounds || []);
    
    if (woundId >= 0 && woundId < wounds.length) {
      const removed = wounds[woundId];
      wounds.splice(woundId, 1);
      
      await this.actor.update({ "system.wounds": wounds });
      this.render();
      ui.notifications.info(`Removed wound: ${removed.location}`);
    }
  }

  async _onDeleteRWI(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const rwiType = $(event.currentTarget).data("type");
    const id = $(event.currentTarget).data("id");
    
    if (!rwiType || id === undefined) return;
    
    const rwiArray = foundry.utils.deepClone(this.actor.system[rwiType + "s"] || []);
    if (id >= 0 && id < rwiArray.length) {
      const removed = rwiArray[id];
      
      // Prevent deletion of resistances from Bastion's Resistance
      if (removed.source === "Bastion's Resistance") {
        ui.notifications.warn("This resistance comes from the Bastion's Resistance talent. Remove the talent from the Progression tab to remove this resistance.");
        return;
      }
      
      rwiArray.splice(id, 1);
      
      await this.actor.update({ [`system.${rwiType}s`]: rwiArray });
      this.render();
      ui.notifications.info(`Removed ${removed.type} ${rwiType}.`);
    }
  }

  async _onEditSkill(event) {
    event.preventDefault();
    event.stopPropagation();
    const skillName = event.currentTarget.dataset.skill;
    if (!skillName) return;

    const skills = this.actor.system.skills || {};
    const skill = skills[skillName];
    
    if (!skill) {
      ui.notifications.warn(`Skill "${skillName}" not found.`);
      return;
    }

    const template = `
      <form>
        <div class="form-group">
          <label>Skill Name:</label>
          <input type="text" name="skillName" value="${skillName}" required/>
        </div>
        <div class="form-group">
          <label>Associated Ability:</label>
          <select name="ability" required>
            <option value="might" ${skill.ability === "might" ? "selected" : ""}>Might</option>
            <option value="agility" ${skill.ability === "agility" ? "selected" : ""}>Agility</option>
            <option value="endurance" ${skill.ability === "endurance" ? "selected" : ""}>Endurance</option>
            <option value="wits" ${skill.ability === "wits" ? "selected" : ""}>Wits</option>
            <option value="charm" ${skill.ability === "charm" ? "selected" : ""}>Charm</option>
          </select>
        </div>
        <div class="form-group">
          <label>Training Rank:</label>
          <select name="rank" required>
            <option value="Novice" ${skill.rank === "Novice" ? "selected" : ""}>Novice</option>
            <option value="Apprentice" ${skill.rank === "Apprentice" ? "selected" : ""}>Apprentice</option>
            <option value="Competent" ${skill.rank === "Competent" ? "selected" : ""}>Competent</option>
            <option value="Masterful" ${skill.rank === "Masterful" ? "selected" : ""}>Masterful</option>
            <option value="Legendary" ${skill.rank === "Legendary" ? "selected" : ""}>Legendary</option>
          </select>
        </div>
      </form>
    `;

    new Dialog({
      title: "Edit Skill",
      content: template,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: "Save",
          callback: async (html) => {
            const newSkillName = html.find('input[name="skillName"]').val()?.trim();
            const ability = html.find('select[name="ability"]').val();
            const rank = html.find('select[name="rank"]').val();

            if (!newSkillName) {
              ui.notifications.warn("Please enter a skill name.");
              return;
            }

            const skills = foundry.utils.deepClone(this.actor.system.skills || {});
            
            // If the name changed, check if new name already exists
            if (newSkillName !== skillName && skills[newSkillName]) {
              ui.notifications.warn(`Skill "${newSkillName}" already exists.`);
              return;
            }

            // Get the existing skill data (preserve otherBonuses)
            const existingSkill = skills[skillName] || {};
            
            // If name changed, delete old and create new
            if (newSkillName !== skillName) {
              delete skills[skillName];
            }

            skills[newSkillName] = {
              ability: ability.toLowerCase(),
              rank: rank,
              otherBonuses: existingSkill.otherBonuses || 0
            };

            await this.actor.update({ "system.skills": skills });
            this.render(true);
            ui.notifications.info(`Updated skill: ${newSkillName}`);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => {}
        }
      },
      default: "save",
      close: () => {}
    }).render(true);
  }

  async _onUpdateSkillOtherBonuses(event) {
    event.preventDefault();
    const skillName = event.currentTarget.dataset.skill;
    if (!skillName) return;

    const skills = foundry.utils.deepClone(this.actor.system.skills || {});
    if (skills[skillName]) {
      // Check if this skill has locked other bonuses (from talents)
      if (skills[skillName].lockedOtherBonuses) {
        const source = skills[skillName].lockedSource || "a talent";
        ui.notifications.warn(`${skillName} other bonus is locked (comes from ${source}). Cannot be edited.`);
        // Reset the input to the locked value
        event.currentTarget.value = skills[skillName].otherBonuses || 0;
        return;
      }

      const otherBonuses = parseFloat(event.currentTarget.value) || 0;
      skills[skillName].otherBonuses = otherBonuses;
      await this.actor.update({ "system.skills": skills });
      this.render(true);
    }
  }

  async _onRollSkill(event) {
    event.preventDefault();
    const skillName = event.currentTarget.dataset.skill;
    if (!skillName) return;

    const skills = this.actor.system.skills || {};
    const skill = skills[skillName];

    // Get ability score
    const abilityName = skill?.ability || this.actor._getSkillAbility(skillName);
    const abilityScore = this.actor.system.abilities[abilityName] || 0;

    // Get training level bonus
    // According to handbook: Novice +0, Apprentice +4, Competent +8, Masterful +12, Legendary +16
    const trainingBonuses = {
      "Novice": 0,
      "Apprentice": 4,
      "Competent": 8,
      "Masterful": 12,
      "Legendary": 16
    };
    const trainingBonus = trainingBonuses[skill?.rank || "Novice"] || 0;
    const otherBonuses = Number(skill?.otherBonuses) || 0;
    const noisyPenalty = skillName === "Stealth" ? this.actor._getNoisyPenalty() : 0;

    // Capitalize ability name for display
    const abilityDisplay = abilityName.charAt(0).toUpperCase() + abilityName.slice(1);

    const dialogContent = `
      <form class="singularity-roll-dialog">
        <div class="roll-fields-row">
          <div class="form-group-inline">
            <label>Skill Roll:</label>
            <input type="text" id="skill-roll" value="1d20" readonly class="readonly-input"/>
          </div>
          <div class="form-group-inline">
            <label>${abilityDisplay} Score:</label>
            <input type="number" id="ability-score" value="${abilityScore}" readonly class="readonly-input"/>
          </div>
          <div class="form-group-inline">
            <label>Training Bonus:</label>
            <input type="number" id="training-bonus" value="${trainingBonus}" readonly class="readonly-input"/>
          </div>
          <div class="form-group-inline">
            <label>Other Bonuses:</label>
            <input type="number" id="other-bonuses" value="${otherBonuses}" readonly class="readonly-input"/>
          </div>
          ${noisyPenalty > 0 ? `
          <div class="form-group-inline">
            <label>Noisy Penalty:</label>
            <input type="number" id="noisy-penalty" value="-${noisyPenalty}" readonly class="readonly-input"/>
          </div>
          ` : ''}
          <div class="form-group-inline">
            <label>Extra Modifier:</label>
            <input type="text" id="extra-modifier" value="0" placeholder="0 or +1d6" class="editable-input"/>
          </div>
        </div>
        <p class="help-text">Add any extra bonuses (e.g., +2, +1d6, -1). Click "Roll Skill" to roll 1d20 + ${abilityDisplay} + Training Bonus + Other Bonuses + Extra Modifier.</p>
      </form>
    `;

    const dialogTitle = `Roll Skill: ${skillName}`;
    
    const d = new Dialog({
      title: dialogTitle,
      content: dialogContent,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: "Roll Skill",
          callback: async (html) => {
            const abilityScore = parseFloat(html.find("#ability-score").val()) || 0;
            const trainingBonus = parseFloat(html.find("#training-bonus").val()) || 0;
            const otherBonuses = parseFloat(html.find("#other-bonuses").val()) || 0;
            const extra = html.find("#extra-modifier").val().trim() || "0";
            
            // Build roll formula: 1d20 + ability + training + other + extra
            let rollFormula = `1d20 + ${abilityScore} + ${trainingBonus} + ${otherBonuses}`;
            if (noisyPenalty > 0) {
              rollFormula += ` - ${noisyPenalty}`;
            }
            if (extra && extra !== "0") {
              rollFormula += ` + ${extra}`;
            }
            
            const roll = new Roll(rollFormula);
            await roll.evaluate();
            
            const otherText = otherBonuses !== 0 ? ` + ${otherBonuses} (Other)` : "";
            const noisyText = noisyPenalty > 0 ? ` - ${noisyPenalty} (Noisy)` : "";
            const extraText = extra !== "0" ? ` + ${extra} (Extra)` : "";
            const flavor = `<div class="roll-flavor"><b>${skillName} Skill Roll</b><br>1d20 + ${abilityScore} (${abilityDisplay}) + ${trainingBonus} (${skill?.rank || "Novice"})${otherText}${noisyText}${extraText} = <strong>${roll.total}</strong></div>`;
            
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

  async _onItemCreate(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type;
    const itemData = {
      name: `New ${type.capitalize()}`,
      type: type,
      system: {}
    };
    await this.actor.createEmbeddedDocuments("Item", [itemData]);
    // Re-render to update calculated values like land speed
    this.render();
  }

  async _onBuyArmor(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Get armor from the armor compendium
    const armorPack = game.packs.get("singularity.armor");
    if (!armorPack) {
      ui.notifications.error("Armor compendium not found!");
      return;
    }
    
    // Get the index of all armor items
    const index = await armorPack.getIndex();
    const allArmorIndex = Array.from(index.values());
    
    if (allArmorIndex.length === 0) {
      ui.notifications.warn("No armor available in compendium.");
      return;
    }
    
    // Load full armor documents to get system data (price, type, etc.)
    const allArmor = [];
    for (const armorIndex of allArmorIndex) {
      try {
        const armorDoc = await armorPack.getDocument(armorIndex._id);
        if (armorDoc) {
          const armorType = armorDoc.system?.basic?.type || "light";
          const typeLabels = {
            "light": "Light Armor",
            "medium": "Medium Armor",
            "heavy": "Heavy Armor"
          };
          
          allArmor.push({
            _id: armorIndex._id,
            name: armorDoc.name,
            img: armorDoc.img || "icons/svg/shield.svg",
            type: armorType,
            typeLabel: typeLabels[armorType] || armorType,
            price: armorDoc.system?.basic?.price || 0,
            baseAC: armorDoc.system?.basic?.baseAC || 0,
            agilityCap: armorDoc.system?.basic?.agilityCap,
            mightRequirement: armorDoc.system?.basic?.mightRequirement,
            description: armorDoc.system?.description || ""
          });
        }
      } catch (err) {
        console.error(`Singularity | Error loading armor ${armorIndex.name}:`, err);
      }
    }
    
    if (allArmor.length === 0) {
      ui.notifications.warn("No armor available in compendium.");
      return;
    }
    
    // Sort armor alphabetically by name
    const sortedArmor = allArmor.sort((a, b) => {
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });
    
    // Create dialog content
    const content = await renderTemplate("systems/singularity/templates/dialogs/armor-selection.html", {
      armors: sortedArmor
    });
    
    // Create and show dialog
    const dialogTitle = "Buy Armor";
    const dialogId = `armor-buy-dialog-${Date.now()}`;
    
    const dialog = new Dialog({
      title: dialogTitle,
      content: content,
      buttons: {
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "cancel",
      render: (html) => {
        // Handle filter buttons
        html.find(".armor-filter-btn").on("click", (event) => {
          const filter = $(event.currentTarget).data("filter");
          
          // Update active button
          html.find(".armor-filter-btn").removeClass("active");
          $(event.currentTarget).addClass("active");
          
          // Filter armor items
          html.find(".armor-selection-item").each(function() {
            const $item = $(this);
            const armorType = $item.data("armor-type");
            
            if (filter === "all") {
              $item.removeClass("hidden");
            } else {
              if (armorType === filter) {
                $item.removeClass("hidden");
              } else {
                $item.addClass("hidden");
              }
            }
          });
        });
        
        // Handle armor selection
        html.find(".armor-selection-item").on("click", async (event) => {
          const itemId = $(event.currentTarget).data("item-id");
          const itemUuid = `Compendium.singularity.armor.${itemId}`;
          
          // Get the full armor document
          const armor = await armorPack.getDocument(itemId);
          if (!armor) {
            ui.notifications.error("Armor not found!");
            return;
          }
          
          // Check if player has enough credits
          const currentCredits = this.actor.system.equipment?.credits || 0;
          const armorPrice = armor.system.basic?.price || 0;
          
          if (currentCredits < armorPrice) {
            ui.notifications.warn(`You don't have enough credits! This armor costs ${armorPrice} credits, but you only have ${currentCredits}.`);
            return;
          }
          
          // Create a copy of the armor item
          const armorData = armor.toObject();
          
          // Add the armor to the actor's inventory
          await this.actor.createEmbeddedDocuments("Item", [armorData]);
          
          // Deduct credits
          const newCredits = currentCredits - armorPrice;
          await this.actor.update({ "system.equipment.credits": newCredits });
          
          ui.notifications.info(`Purchased ${armor.name} for ${armorPrice} credits. Remaining credits: ${newCredits}.`);
          
          this.render();
          
          // Close the dialog
          dialog.close();
        });
      }
    });
    
    dialog.render(true);
  }

  async _onEquipArmor(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const itemId = $(event.currentTarget).data("item-id");
    const item = this.actor.items.get(itemId);
    
    if (!item || item.type !== "armor") {
      ui.notifications.warn("Armor item not found!");
      return;
    }
    
    // Unequip all other armor first (only one armor can be equipped at a time)
    const allArmor = this.actor.items.filter(i => i.type === "armor");
    const updates = [];
    
    for (const armor of allArmor) {
      if (armor.id === itemId) {
        // Equip this armor
        updates.push({
          _id: armor.id,
          "system.basic.equipped": true
        });
      } else if (armor.system?.basic?.equipped === true) {
        // Unequip all other armor
        updates.push({
          _id: armor.id,
          "system.basic.equipped": false
        });
      }
    }
    
    if (updates.length > 0) {
      await this.actor.updateEmbeddedDocuments("Item", updates);
      ui.notifications.info(`Equipped ${item.name}.`);
      this.render();
    }
  }

  async _onUnequipArmor(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const itemId = $(event.currentTarget).data("item-id");
    const item = this.actor.items.get(itemId);
    
    if (!item || item.type !== "armor") {
      ui.notifications.warn("Armor item not found!");
      return;
    }
    
    await item.update({ "system.basic.equipped": false });
    ui.notifications.info(`Unequipped ${item.name}.`);
    this.render();
  }

  async _onBuyWeapon(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Get weapons from the weapons compendium
    const weaponsPack = game.packs.get("singularity.weapons");
    if (!weaponsPack) {
      ui.notifications.error("Weapons compendium not found!");
      return;
    }
    
    // Get the index of all weapon items
    const index = await weaponsPack.getIndex();
    const allWeaponIndex = Array.from(index.values());
    
    if (allWeaponIndex.length === 0) {
      ui.notifications.warn("No weapons available in compendium.");
      return;
    }
    
    // Load full weapon documents to get system data (price, type, etc.)
    const allWeapons = [];
    for (const weaponIndex of allWeaponIndex) {
      try {
        const weaponDoc = await weaponsPack.getDocument(weaponIndex._id);
        if (weaponDoc) {
          const weaponType = weaponDoc.system?.basic?.type || "melee";
          const typeLabels = {
            "melee": "Melee",
            "ranged": "Ranged"
          };
          
          allWeapons.push({
            _id: weaponIndex._id,
            name: weaponDoc.name,
            img: weaponDoc.img || (weaponType === "melee" ? "icons/svg/sword.svg" : "icons/svg/pistol.svg"),
            type: weaponType,
            typeLabel: typeLabels[weaponType] || weaponType,
            price: weaponDoc.system?.basic?.price || 0,
            damage: weaponDoc.system?.basic?.damage || "",
            range: weaponDoc.system?.basic?.range || "",
            hands: weaponDoc.system?.basic?.hands || 1,
            energyCost: weaponDoc.system?.basic?.energyCost || 1,
            properties: weaponDoc.system?.basic?.properties || [],
            description: weaponDoc.system?.description || ""
          });
        }
      } catch (err) {
        console.error(`Singularity | Error loading weapon ${weaponIndex.name}:`, err);
      }
    }
    
    if (allWeapons.length === 0) {
      ui.notifications.warn("No weapons available in compendium.");
      return;
    }
    
    // Sort weapons alphabetically by name
    const sortedWeapons = allWeapons.sort((a, b) => {
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });
    
    // Create dialog content
    const content = `
      <div class="weapon-selection-dialog">
        <div class="weapon-dialog-container">
          <div class="weapon-filters">
            <button type="button" class="weapon-filter-btn active" data-filter="all">All</button>
            <button type="button" class="weapon-filter-btn" data-filter="melee">Melee</button>
            <button type="button" class="weapon-filter-btn" data-filter="ranged">Ranged</button>
          </div>
          <div class="weapon-content-area">
            <p class="dialog-description">Select a weapon to purchase:</p>
            <div class="weapon-list" style="max-height: 400px; overflow-y: auto;">
              ${sortedWeapons.map(w => `
                <div class="weapon-selection-item" data-item-id="${w._id}" data-weapon-type="${w.type}" style="padding: 10px; margin: 5px 0; border: 1px solid rgba(189, 95, 255, 0.3); border-radius: 3px; cursor: pointer; background: rgba(30, 33, 45, 0.5);">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${w.img}" style="width: 32px; height: 32px; flex-shrink: 0;" onerror="this.src='icons/svg/sword.svg'">
                    <div style="flex: 1;">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-weight: bold;">${w.name}</div>
                        <div style="font-weight: bold; color: #BD5FFF;">${w.price} credits</div>
                      </div>
                      <div style="font-size: 12px; margin-top: 5px; display: flex; gap: 10px; flex-wrap: wrap;">
                        <span class="weapon-type-badge" style="padding: 2px 6px; background: ${w.type === 'melee' ? 'rgba(255, 100, 100, 0.3)' : 'rgba(100, 150, 255, 0.3)'}; border-radius: 3px;">${w.typeLabel}</span>
                        <span>Damage: ${w.damage}</span>
                        ${w.range ? `<span>Range: ${w.range}</span>` : ''}
                        ${w.hands ? `<span>Hands: ${w.hands}</span>` : ''}
                        ${w.properties && w.properties.length > 0 ? `<span>Traits: ${w.properties.join(', ')}</span>` : ''}
                      </div>
                      ${w.description ? `<div style="font-size: 11px; margin-top: 5px; color: rgba(255, 255, 255, 0.7);">${w.description.substring(0, 100)}${w.description.length > 100 ? '...' : ''}</div>` : ''}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Create and show dialog
    const dialogTitle = "Buy Weapon";
    const dialogId = `weapon-buy-dialog-${Date.now()}`;
    
    const dialog = new Dialog({
      title: dialogTitle,
      content: content,
      buttons: {
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "cancel",
      render: (html) => {
        // Handle filter buttons
        html.find(".weapon-filter-btn").on("click", (event) => {
          const filter = $(event.currentTarget).data("filter");
          
          // Update active button
          html.find(".weapon-filter-btn").removeClass("active");
          $(event.currentTarget).addClass("active");
          
          // Filter weapon items
          html.find(".weapon-selection-item").each(function() {
            const $item = $(this);
            const weaponType = $item.data("weapon-type");
            
            if (filter === "all") {
              $item.removeClass("hidden");
            } else {
              if (weaponType === filter) {
                $item.removeClass("hidden");
              } else {
                $item.addClass("hidden");
              }
            }
          });
        });
        
        // Handle weapon selection
        html.find(".weapon-selection-item").on("click", async (event) => {
          const itemId = $(event.currentTarget).data("item-id");
          
          // Get the full weapon document
          const weapon = await weaponsPack.getDocument(itemId);
          if (!weapon) {
            ui.notifications.error("Weapon not found!");
            return;
          }
          
          // Check if player has enough credits
          const currentCredits = this.actor.system.equipment?.credits || 0;
          const weaponPrice = weapon.system.basic?.price || 0;
          
          if (currentCredits < weaponPrice) {
            ui.notifications.warn(`You don't have enough credits! This weapon costs ${weaponPrice} credits, but you only have ${currentCredits}.`);
            return;
          }
          
          // Create a copy of the weapon item
          const weaponData = weapon.toObject();
          
          try {
            // Add the weapon to the actor's inventory
            await this.actor.createEmbeddedDocuments("Item", [weaponData]);
            
            // Deduct credits
            const newCredits = currentCredits - weaponPrice;
            await this.actor.update({ "system.equipment.credits": newCredits });
            
            ui.notifications.info(`Purchased ${weapon.name} for ${weaponPrice} credits. Remaining credits: ${newCredits}.`);
            
            // Close the dialog first
            dialog.close();
            
            // Then render (wrap in try-catch to prevent errors from affecting the purchase)
            try {
              this.render();
            } catch (renderError) {
              console.error("Error rendering sheet after purchase:", renderError);
              // Purchase was successful, just the render failed - show a warning but don't fail the transaction
              ui.notifications.warn("Purchase completed, but there was an error updating the display. Please refresh the sheet.");
            }
          } catch (purchaseError) {
            console.error("Error purchasing weapon:", purchaseError);
            ui.notifications.error(`Failed to purchase ${weapon.name}: ${purchaseError.message}`);
          }
        });
      }
    });
    
    dialog.render(true);
  }

  async _onEquipWeapon(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const itemId = $(event.currentTarget).data("item-id");
    const item = this.actor.items.get(itemId);
    
    if (!item || item.type !== "weapon") {
      ui.notifications.warn("Weapon item not found!");
      return;
    }
    
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
    ui.notifications.info(`Equipped ${item.name}.`);
    this.render();
  }

  async _onUnequipWeapon(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const itemId = $(event.currentTarget).data("item-id");
    const item = this.actor.items.get(itemId);
    
    if (!item || item.type !== "weapon") {
      ui.notifications.warn("Weapon item not found!");
      return;
    }
    
    await item.update({ "system.basic.equipped": false });
    ui.notifications.info(`Unequipped ${item.name}.`);
    this.render();
  }

  _onItemEdit(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (item) {
      item.sheet.render(true);
    }
  }

  _onItemIconClick(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (item) {
      item.sheet.render(true);
    }
  }

  async _onItemDelete(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (item) {
      await item.delete();
      // Re-render to update calculated values like land speed
      this.render();
    }
  }

  async _onAbilityRoll(event) {
    event.preventDefault();
    if (this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed")) {
      ui.notifications.warn("Paralyzed: you cannot take actions or reactions.");
      return;
    }
    if (this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "dazed")) {
      ui.notifications.warn("Dazed: you cannot take reactions.");
    }
    const ability = event.currentTarget.dataset.ability;
    if (!ability) return;

    // Calculate ability score the same way as getData() (must match calculation)
    const actorData = foundry.utils.deepClone(this.actor.system);
    const powersetName = actorData.progression?.level1?.powersetName || actorData.basic?.powerset;
    
    // Calculate ability bonuses from progression (same as getData())
    const abilityBonuses = {
      might: 0,
      agility: 0,
      endurance: 0,
      wits: 0,
      charm: 0
    };
    
    // Check Human ability boost
    if (actorData.progression?.level1?.humanAbilityBoost) {
      const boostAbility = actorData.progression.level1.humanAbilityBoost;
      if (abilityBonuses.hasOwnProperty(boostAbility)) {
        abilityBonuses[boostAbility] += 1;
      }
    }
    
    // Check Terran ability boost
    if (actorData.progression?.level1?.terranAbilityBoost) {
      const boostAbility = actorData.progression.level1.terranAbilityBoost;
      if (abilityBonuses.hasOwnProperty(boostAbility)) {
        abilityBonuses[boostAbility] += 1;
      }
    }
    
    // Check Background ability boost
    if (actorData.progression?.level1?.backgroundAbilityBoost) {
      const boostAbility = actorData.progression.level1.backgroundAbilityBoost;
      if (abilityBonuses.hasOwnProperty(boostAbility)) {
        abilityBonuses[boostAbility] += 1;
      }
    }
    
    // Check powerset benefits
    if (powersetName === "Bastion") {
      abilityBonuses.endurance += 1;
      if (actorData.progression?.level1?.bastionAbilityBoost1) {
        const boostAbility = actorData.progression.level1.bastionAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(boostAbility) && boostAbility !== "endurance") {
          abilityBonuses[boostAbility] += 1;
        }
      }
      if (actorData.progression?.level1?.bastionAbilityBoost2) {
        const boostAbility = actorData.progression.level1.bastionAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(boostAbility) && boostAbility !== "endurance") {
          abilityBonuses[boostAbility] += 1;
        }
      }
    } else if (powersetName === "Paragon") {
      abilityBonuses.might += 1;
      if (actorData.progression?.level1?.paragonAbilityBoost1) {
        const boostAbility = actorData.progression.level1.paragonAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(boostAbility) && boostAbility !== "might") {
          abilityBonuses[boostAbility] += 1;
        }
      }
      if (actorData.progression?.level1?.paragonAbilityBoost2) {
        const boostAbility = actorData.progression.level1.paragonAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(boostAbility) && boostAbility !== "might") {
          abilityBonuses[boostAbility] += 1;
        }
      }
    } else if (powersetName === "Marksman") {
      abilityBonuses.agility += 1;
      if (actorData.progression?.level1?.marksmanAbilityBoost1) {
        const boostAbility = actorData.progression.level1.marksmanAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(boostAbility) && boostAbility !== "agility") {
          abilityBonuses[boostAbility] += 1;
        }
      }
      if (actorData.progression?.level1?.marksmanAbilityBoost2) {
        const boostAbility = actorData.progression.level1.marksmanAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(boostAbility) && boostAbility !== "agility") {
          abilityBonuses[boostAbility] += 1;
        }
      }
    }
    
    const abilityScore = abilityBonuses[ability] || 0;
    const abilityDisplay = ability.charAt(0).toUpperCase() + ability.slice(1);

    const scaredEffect = this.actor?.effects?.find(effect => effect.getFlag("core", "statusId") === "scared");
    const scaredPenalty = Math.max(0, Number(scaredEffect?.getFlag("singularity", "value") ?? 0));
    const pronePenalty = this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "prone") ? 2 : 0;
    const fatiguedEffect = this.actor?.effects?.find(effect => effect.getFlag("core", "statusId") === "fatigued");
    const fatiguedPenalty = Math.max(0, Number(fatiguedEffect?.getFlag("singularity", "value") ?? 0));
    const totalAbilityScore = abilityScore - scaredPenalty;

    const dialogContent = `
      <form class="singularity-roll-dialog">
        <div class="roll-fields-row">
          <div class="form-group-inline">
            <label>Ability Roll:</label>
            <input type="text" id="ability-roll" value="1d20" readonly class="readonly-input"/>
          </div>
          <div class="form-group-inline">
            <label>${abilityDisplay} Score:</label>
            <input type="number" id="ability-score" value="${totalAbilityScore}" readonly class="readonly-input"/>
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
            const scaredText = scaredPenalty > 0 ? ` - ${scaredPenalty} (Scared)` : "";
            const flavor = `<div class="roll-flavor"><b>${abilityDisplay} Check</b><br>1d20 + ${abilityScore} (${abilityDisplay})${scaredText}${extraText} = <strong>${roll.total}</strong></div>`;
            
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

  async _onAbilityNameRoll(event) {
    event.preventDefault();
    event.stopPropagation();
    const ability = event.currentTarget.dataset.ability;
    if (!ability) return;
    
    // Trigger the same roll as the button
    const fakeEvent = { preventDefault: () => {}, currentTarget: { dataset: { ability: ability } } };
    await this._onAbilityRoll(fakeEvent);
  }

  async _onShowAbilityBreakdown(event) {
    event.preventDefault();
    event.stopPropagation();

    const ability = event.currentTarget.dataset.ability;
    if (!ability) return;

    // Get current data (recalculate to ensure it's up to date)
    const sheetData = await this.getData();
    const breakdown = sheetData.abilityBreakdowns?.[ability];

    if (!breakdown) {
      ui.notifications.warn("Ability breakdown data not available.");
      return;
    }

    const abilityDisplay = ability.charAt(0).toUpperCase() + ability.slice(1);
    
    let sourcesHtml = "";
    if (breakdown.sources.length === 0) {
      sourcesHtml = `
        <div class="breakdown-item">
          <label>Base Score:</label>
          <span class="breakdown-value">0</span>
        </div>
        <div class="breakdown-item">
          <label style="font-style: italic; color: #a0aec0;">No bonuses applied</label>
        </div>
      `;
    } else {
      for (const source of breakdown.sources) {
        sourcesHtml += `
          <div class="breakdown-item">
            <label>${source.name}:</label>
            <span class="breakdown-value">+${source.value}</span>
          </div>
        `;
      }
    }

    const dialogContent = `
      <div class="ability-breakdown">
        <h3>${abilityDisplay} Score Breakdown</h3>
        ${sourcesHtml}
        <hr>
        <div class="breakdown-item total">
          <label><strong>Total ${abilityDisplay} Score:</strong></label>
          <span class="breakdown-value"><strong>${breakdown.total}</strong></span>
        </div>
        <p class="help-text">Ability scores start at 0 and are increased by bonuses from phenotypes, backgrounds, and powersets.</p>
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

  async _onShowHpBreakdown(event) {
    event.preventDefault();
    event.stopPropagation();

    // Get current data (recalculate to ensure it's up to date)
    const sheetData = await this.getData();
    const breakdown = sheetData.hpBreakdown;

    if (!breakdown) {
      ui.notifications.warn("HP breakdown data not available.");
      return;
    }

    let sourcesHtml = "";
    for (const source of breakdown.sources) {
      if (source.perLevel) {
        let perLevelValue = source.value * breakdown.levelMultiplier;
        if (source.multiplier) {
          perLevelValue = source.value * source.multiplier * breakdown.levelMultiplier;
          sourcesHtml += `
            <div class="breakdown-item">
              <label>${source.name}:</label>
              <span class="breakdown-value">${source.value} × ${source.multiplier} × ${breakdown.levelMultiplier} = ${perLevelValue}</span>
            </div>
          `;
        } else {
          sourcesHtml += `
            <div class="breakdown-item">
              <label>${source.name}:</label>
              <span class="breakdown-value">${source.value} × ${breakdown.levelMultiplier} = ${perLevelValue}</span>
            </div>
          `;
        }
      } else {
        sourcesHtml += `
          <div class="breakdown-item">
            <label>${source.name}:</label>
            <span class="breakdown-value">+${source.value}</span>
          </div>
        `;
      }
    }

    const dialogContent = `
      <div class="hp-breakdown">
        <h3>Maximum HP Breakdown</h3>
        ${sourcesHtml}
        <hr>
        <div class="breakdown-item total">
          <label><strong>Total Maximum HP:</strong></label>
          <span class="breakdown-value"><strong>${breakdown.total}</strong></span>
        </div>
        <p class="help-text">Formula: ${breakdown.formula}</p>
        <p class="help-text" style="margin-top: 10px; font-size: 0.85rem;">
          ${breakdown.powersetBase > 0 
            ? `Maximum HP is calculated by multiplying (Base HP per Level + Endurance) by your powerset level.` 
            : `Maximum HP is based on your base HP value.`}
          ${breakdown.enhancedVitalityBonus > 0 
            ? `Enhanced Vitality adds +2 per Prime Level as a flat bonus.` 
            : ''}
        </p>
      </div>
    `;

    new Dialog({
      title: "Maximum HP Breakdown",
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

  async _onShowSavingThrowBreakdown(event) {
    event.preventDefault();
    event.stopPropagation();

    const ability = event.currentTarget.dataset.ability;
    if (!ability) return;

    // Get current data (recalculate to ensure it's up to date)
    const sheetData = await this.getData();
    const breakdown = sheetData.savingThrowBreakdowns?.[ability];

    if (!breakdown) {
      ui.notifications.warn("Saving throw breakdown data not available.");
      return;
    }

    const abilityDisplay = ability.charAt(0).toUpperCase() + ability.slice(1);
    
    let sourcesHtml = "";
    for (const source of breakdown.sources) {
      sourcesHtml += `
        <div class="breakdown-item">
          <label>${source.name}:</label>
          <span class="breakdown-value">${source.rank}</span>
        </div>
      `;
    }

    // Calculate training bonus
    const trainingBonuses = {
      "Novice": 0,
      "Apprentice": 4,
      "Competent": 8,
      "Masterful": 12,
      "Legendary": 16
    };
    const trainingBonus = trainingBonuses[breakdown.rank] || 0;

    const dialogContent = `
      <div class="saving-throw-breakdown">
        <h3>${abilityDisplay} Saving Throw Breakdown</h3>
        ${sourcesHtml}
        <hr>
        <div class="breakdown-item">
          <label>Training Bonus (${breakdown.rank}):</label>
          <span class="breakdown-value">+${trainingBonus}</span>
        </div>
        <div class="breakdown-item">
          <label>Other Bonuses:</label>
          <span class="breakdown-value">${breakdown.otherBonuses >= 0 ? '+' : ''}${breakdown.otherBonuses}</span>
        </div>
        <hr>
        <div class="breakdown-item total">
          <label><strong>Total ${abilityDisplay} Saving Throw:</strong></label>
          <span class="breakdown-value"><strong>${abilityDisplay} Score + ${trainingBonus} (Training) + ${breakdown.otherBonuses >= 0 ? breakdown.otherBonuses : breakdown.otherBonuses} (Other)</strong></span>
        </div>
        <p class="help-text">Saving Throw Competence is set by talents and powersets. Click on talents in the Progression tab to change it.</p>
      </div>
    `;

    new Dialog({
      title: `${abilityDisplay} Saving Throw Breakdown`,
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

  async _onRollSavingThrow(event) {
    event.preventDefault();
    event.stopPropagation();
    const ability = event.currentTarget.dataset.savingThrow;
    if (!ability) return;
    const isParalyzed = this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed");
    if (isParalyzed && (ability === "might" || ability === "agility")) {
      const abilityDisplay = ability.charAt(0).toUpperCase() + ability.slice(1);
      const roll = new Roll("0");
      await roll.evaluate();
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `<div class="roll-flavor"><b>${abilityDisplay} Saving Throw</b><br>Extreme Failure (Paralyzed)</div>`
      });
      return;
    }
    const fatiguedEffect = this.actor?.effects?.find(effect => effect.getFlag("core", "statusId") === "fatigued");
    const fatiguedPenalty = Math.max(0, Number(fatiguedEffect?.getFlag("singularity", "value") ?? 0));

    const savingThrows = this.actor.system.savingThrows || {};
    const savingThrow = savingThrows[ability];
    
    if (!savingThrow) {
      ui.notifications.warn(`Saving throw for "${ability}" not found.`);
      return;
    }

    // Calculate ability score the same way as getData()
    // Ability scores are calculated from bonuses (base is 0)
    const abilityBonuses = {
      might: 0,
      agility: 0,
      endurance: 0,
      wits: 0,
      charm: 0
    };
    
    const actorData = this.actor.system;
    const progression = actorData.progression || {};
    
    // Check Human ability boost
    if (progression.level1?.humanAbilityBoost) {
      const boostAbility = progression.level1.humanAbilityBoost;
      if (abilityBonuses.hasOwnProperty(boostAbility)) {
        abilityBonuses[boostAbility] += 1;
      }
    }
    
    // Check Terran ability boost
    if (progression.level1?.terranAbilityBoost) {
      const boostAbility = progression.level1.terranAbilityBoost;
      if (abilityBonuses.hasOwnProperty(boostAbility)) {
        abilityBonuses[boostAbility] += 1;
      }
    }
    
    // Check Background ability boost
    if (progression.level1?.backgroundAbilityBoost) {
      const boostAbility = progression.level1.backgroundAbilityBoost;
      if (abilityBonuses.hasOwnProperty(boostAbility)) {
        abilityBonuses[boostAbility] += 1;
      }
    }
    
    // Check Generic ability boost
    if (progression.level1?.genericAbilityBoost) {
      const boostAbility = progression.level1.genericAbilityBoost;
      if (abilityBonuses.hasOwnProperty(boostAbility)) {
        abilityBonuses[boostAbility] += 1;
      }
    }
    
    // Check Powerset ability boosts
    const powersetName = progression.level1?.powersetName || actorData.basic?.powerset;
    if (powersetName === "Bastion") {
      abilityBonuses.endurance += 1;
      // Bastion additional ability boosts
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
      // Paragon additional ability boosts
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
      // Gadgeteer additional ability boosts
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
      // Marksman additional ability boosts
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
    
    // Check progression levels for ability boosts (for levels 2-20)
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
    }
    
    // Get the calculated ability score for this ability
    const abilityScore = abilityBonuses[ability] || 0;

    // Get training level bonus (same as skills)
    // According to handbook: Novice +0, Apprentice +4, Competent +8, Masterful +12, Legendary +16
    const trainingBonuses = {
      "Novice": 0,
      "Apprentice": 4,
      "Competent": 8,
      "Masterful": 12,
      "Legendary": 16
    };
    const trainingBonus = trainingBonuses[savingThrow.rank] || 0;
    const otherBonuses = Number(savingThrow.otherBonuses) || 0;

    // Capitalize ability name for display
    const abilityDisplay = ability.charAt(0).toUpperCase() + ability.slice(1);

    const dialogContent = `
      <form class="singularity-roll-dialog">
        <div class="roll-fields-row">
          <div class="form-group-inline">
            <label>Saving Throw:</label>
            <input type="text" id="saving-throw-roll" value="1d20" readonly class="readonly-input"/>
          </div>
          <div class="form-group-inline">
            <label>${abilityDisplay} Score:</label>
            <input type="number" id="ability-score" value="${abilityScore}" readonly class="readonly-input"/>
          </div>
          <div class="form-group-inline">
            <label>Competence Bonus:</label>
            <input type="number" id="training-bonus" value="${trainingBonus}" readonly class="readonly-input"/>
          </div>
          <div class="form-group-inline">
            <label>Other Bonuses:</label>
            <input type="number" id="other-bonuses" value="${otherBonuses}" readonly class="readonly-input"/>
          </div>
          <div class="form-group-inline">
            <label>Extra Modifier:</label>
            <input type="text" id="extra-modifier" value="0" placeholder="0 or +1d6" class="editable-input"/>
          </div>
        </div>
        <p class="help-text">Add any extra bonuses (e.g., +2, +1d6, -1). Click "Roll Saving Throw" to roll 1d20 + ${abilityDisplay} + Competence Bonus + Other Bonuses + Extra Modifier.</p>
      </form>
    `;

    const dialogTitle = `Roll ${abilityDisplay} Saving Throw`;
    
    const d = new Dialog({
      title: dialogTitle,
      content: dialogContent,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: "Roll Saving Throw",
          callback: async (html) => {
            const abilityScore = parseFloat(html.find("#ability-score").val()) || 0;
            const trainingBonus = parseFloat(html.find("#training-bonus").val()) || 0;
            const otherBonuses = parseFloat(html.find("#other-bonuses").val()) || 0;
            const extra = html.find("#extra-modifier").val().trim() || "0";
            
            // Build roll formula: 1d20 + ability + training + other + extra
            let rollFormula = `1d20 + ${abilityScore} + ${trainingBonus} + ${otherBonuses}`;
            if (fatiguedPenalty > 0) {
              rollFormula += ` - ${fatiguedPenalty}`;
            }
            if (extra && extra !== "0") {
              rollFormula += ` + ${extra}`;
            }
            
            const roll = new Roll(rollFormula);
            await roll.evaluate();
            
            const otherText = otherBonuses !== 0 ? ` + ${otherBonuses} (Other)` : "";
            const extraText = extra !== "0" ? ` + ${extra} (Extra)` : "";
            const fatiguedText = fatiguedPenalty > 0 ? ` - ${fatiguedPenalty} (Fatigued)` : "";
            const flavor = `<div class="roll-flavor"><b>${abilityDisplay} Saving Throw</b><br>1d20 + ${abilityScore} (${abilityDisplay}) + ${trainingBonus} (${savingThrow.rank})${otherText}${fatiguedText}${extraText} = <strong>${roll.total}</strong></div>`;
            
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

  _onUpdateSavingThrowOtherBonuses(event) {
    event.preventDefault();
    const ability = event.currentTarget.dataset.savingThrow;
    const value = parseFloat(event.currentTarget.value) || 0;

    if (!ability) return;

    const savingThrows = foundry.utils.deepClone(this.actor.system.savingThrows || {});
    if (!savingThrows[ability]) {
      savingThrows[ability] = { rank: "Novice", otherBonuses: 0 };
    }
    savingThrows[ability].otherBonuses = value;

    this.actor.update({ "system.savingThrows": savingThrows });
  }

  async _onIncreaseLevel(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const currentLevel = this.actor.system.basic.primeLevel || 1;
    if (currentLevel >= 20) {
      ui.notifications.warn("Maximum level is 20.");
      return;
    }
    
    await this.actor.update({
      "system.basic.primeLevel": currentLevel + 1
    });
    this.render();
  }

  async _onDecreaseLevel(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const currentLevel = this.actor.system.basic.primeLevel || 1;
    if (currentLevel <= 1) {
      ui.notifications.warn("Minimum level is 1.");
      return;
    }
    
    await this.actor.update({
      "system.basic.primeLevel": currentLevel - 1
    });
    this.render();
  }

  async _onShowInitiativeBreakdown(event) {
    event.preventDefault();
    event.stopPropagation();

    // Get current data (recalculate to ensure it's up to date)
    const sheetData = await this.getData();
    const breakdown = sheetData.initiativeBreakdown;

    if (!breakdown) {
      ui.notifications.warn("Initiative breakdown data not available.");
      return;
    }

    const dialogContent = `
      <div class="initiative-breakdown">
        <h3>Initiative Breakdown</h3>
        <div class="breakdown-item">
          <label>Wits Score:</label>
          <span class="breakdown-value">${breakdown.wits}</span>
        </div>
        <div class="breakdown-item">
          <label>Competence Bonus (${breakdown.trainingRank}):</label>
          <span class="breakdown-value">+${breakdown.trainingBonus}</span>
        </div>
        <div class="breakdown-item">
          <label>Other Bonuses:</label>
          <span class="breakdown-value">${breakdown.otherBonuses >= 0 ? '+' : ''}${breakdown.otherBonuses}</span>
        </div>
        <hr>
        <div class="breakdown-item total">
          <label><strong>Total Initiative:</strong></label>
          <span class="breakdown-value"><strong>${breakdown.total}</strong></span>
        </div>
        <p class="help-text">Initiative = Wits + Competence Bonus + Other Bonuses</p>
      </div>
    `;

    new Dialog({
      title: "Initiative Breakdown",
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

  async _onShowAcBreakdown(event) {
    event.preventDefault();
    event.stopPropagation();

    // Get current data (recalculate to ensure it's up to date)
    const sheetData = await this.getData();
    const breakdown = sheetData.acBreakdown;

    if (!breakdown) {
      ui.notifications.warn("AC breakdown data not available.");
      return;
    }

    let baseAcLabel = breakdown.isArmored ? `Base AC (${breakdown.armorName})` : "Base AC (Unarmored)";
    let agilityLabel = "Agility Modifier";
    if (breakdown.isArmored && breakdown.agilityCap !== null) {
      agilityLabel = `Agility Modifier (capped at ${breakdown.agilityCap})`;
    }
    if (breakdown.isArmored && !breakdown.meetsMightRequirement) {
      agilityLabel = "Agility Modifier (cannot add - Might requirement not met)";
    }
    
    // Add Might requirement warning
    let mightWarning = "";
    if (breakdown.isArmored && breakdown.mightRequirement !== null && breakdown.mightDeficit > 0) {
      if (breakdown.mightDeficit >= 4) {
        mightWarning = `<div class="might-warning immobile"><strong>⚠ Immobile:</strong> Your Might (${breakdown.might}) is ${breakdown.mightDeficit} below the requirement (${breakdown.mightRequirement}). You cannot move under your own power.</div>`;
      } else if (breakdown.mightDeficit >= 1) {
        mightWarning = `<div class="might-warning halved"><strong>⚠ Speed Halved:</strong> Your Might (${breakdown.might}) is ${breakdown.mightDeficit} below the requirement (${breakdown.mightRequirement}). Your movement speed is halved.</div>`;
      }
    }

    // Add untrained armor penalty display
    let untrainedPenaltyDisplay = "";
    if (breakdown.untrainedPenalty < 0) {
      const trainingLevel = breakdown.effectiveTraining === "none" ? "No Training" :
                           breakdown.effectiveTraining === "light" ? "Light Armor Training" :
                           breakdown.effectiveTraining === "medium" ? "Medium Armor Training" :
                           "Heavy Armor Training";
      const armorTypeDisplay = breakdown.armorType ? breakdown.armorType.charAt(0).toUpperCase() + breakdown.armorType.slice(1) : "";
      untrainedPenaltyDisplay = `
        <div class="breakdown-item penalty">
          <label>Untrained Armor Penalty:</label>
          <span class="breakdown-value">${breakdown.untrainedPenalty}</span>
        </div>
        <div class="untrained-warning">
          <strong>⚠ Untrained:</strong> You are wearing ${armorTypeDisplay} armor but only have ${trainingLevel}. This reduces your AC.
        </div>
      `;
    }
    
    const dialogContent = `
      <div class="ac-breakdown">
        <h3>Armor Class Breakdown</h3>
        <div class="breakdown-item">
          <label>${baseAcLabel}:</label>
          <span class="breakdown-value">${breakdown.base}</span>
        </div>
        <div class="breakdown-item">
          <label>${agilityLabel}:</label>
          <span class="breakdown-value">+${breakdown.agility}</span>
        </div>
        ${breakdown.powersetBonus > 0 ? `
        <div class="breakdown-item">
          <label>Powerset Bonus (Bastion):</label>
          <span class="breakdown-value">+${breakdown.powersetBonus}</span>
        </div>
        ` : ''}
        ${untrainedPenaltyDisplay}
        <hr>
        <div class="breakdown-item total">
          <label><strong>Total AC:</strong></label>
          <span class="breakdown-value"><strong>${breakdown.total}</strong></span>
        </div>
        <p class="help-text">
          ${breakdown.isArmored 
            ? `AC = Base AC (from armor) + Agility (up to cap) + Powerset Bonus${breakdown.untrainedPenalty < 0 ? " + Untrained Penalty" : ""}`
            : `AC = 10 (unarmored) + Agility + Powerset Bonus`}
        </p>
        ${mightWarning}
      </div>
    `;

    new Dialog({
      title: "Armor Class Breakdown",
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

  _onSkillRoll(event) {
    event.preventDefault();
    if (this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed")) {
      ui.notifications.warn("Paralyzed: you cannot take actions or reactions.");
      return;
    }
    const skillName = event.currentTarget.dataset.skill;
    if (this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "blinded")) {
      if (skillName === "Perception") {
        const roll = new Roll("0");
        roll.evaluate();
        roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          flavor: "Perception Check — Automatic Failure (Blinded)"
        });
        return;
      }
    }
    if (skillName === "Perception" && this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "deafened")) {
      const roll = new Roll("0");
      roll.evaluate();
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: "Perception Check (hearing) — Automatic Failure (Deafened)"
      });
      return;
    }
    const modifier = this.actor.getSkillModifier(skillName);
    const fatiguedEffect = this.actor?.effects?.find(effect => effect.getFlag("core", "statusId") === "fatigued");
    const fatiguedPenalty = Math.max(0, Number(fatiguedEffect?.getFlag("singularity", "value") ?? 0));
    const roll = new Roll(`1d20 + @mod${fatiguedPenalty ? ` - ${fatiguedPenalty}` : ""}`, { mod: modifier });
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `${skillName} Check${fatiguedPenalty ? ` (Fatigued -${fatiguedPenalty})` : ""}`
    });
  }

  _onWeaponAttack(event) {
    event.preventDefault();
    if (this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed")) {
      ui.notifications.warn("Paralyzed: you cannot take actions or reactions.");
      return;
    }
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    const attackBonus = item.system.basic.attackBonus || 0;
    const agility = this.actor.getAbilityScore("agility");
    const totalBonus = attackBonus + agility;

    const roll = new Roll("1d20 + @bonus", { bonus: totalBonus });
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `${item.name} Attack`
    });
  }

  _onInlineEdit(event) {
    event.stopPropagation();
    event.stopImmediatePropagation();
    const input = event.currentTarget;
    const itemId = input.dataset.itemId;
    const property = input.dataset.itemProperty;
    const value = parseFloat(input.value) || 0;

    if (!itemId || !property) return;

    const item = this.actor.items.get(itemId);
    if (item) {
      const updateData = {};
      updateData[property] = value;
      item.update(updateData);
    }
  }

  _onAddAttack(event) {
    event.preventDefault();
    this._showAttackDialog();
  }

  _onEditAttack(event) {
    event.preventDefault();
    const attackId = event.currentTarget.dataset.attackId;
    const attacks = foundry.utils.deepClone(this.actor.system.attacks || []);
    const attack = attacks[attackId];
    if (attack) {
      this._showAttackDialog(attackId, attack);
    }
  }

  _onDeleteAttack(event) {
    event.preventDefault();
    const attackId = parseInt(event.currentTarget.dataset.attackId);
    const attacks = foundry.utils.deepClone(this.actor.system.attacks || []);
    const attack = attacks[attackId];
    if (!attack) return;
    const isUnarmed = attack.name && attack.name.toLowerCase() === "unarmed strike";
    const isTalentAttack = attack.isTalentAttack === true || (attack.name && attack.name.toLowerCase() === "blast");
    const equippedWeapons = this.actor.items.filter(item => item.type === "weapon" && item.system?.basic?.equipped === true);
    const baseAttackName = attack.name?.replace(/\s*\(Melee\)$/i, "").replace(/\s*\(Thrown\)$/i, "");
    const matchingWeapon = equippedWeapons.find(w => w.name && baseAttackName && w.name.toLowerCase() === baseAttackName.toLowerCase());
    if (isUnarmed || isTalentAttack || attack.weaponId || matchingWeapon || attack.isCustom === false) {
      return;
    }
    attacks.splice(attackId, 1);
    this.actor.update({ "system.attacks": attacks });
  }

  _showAttackDialog(attackId = null, attackData = null) {
    const isEdit = attackId !== null;
    const equippedWeapons = this.actor.items.filter(item => item.type === "weapon" && item.system?.basic?.equipped === true);
    const attack = attackData || { 
      name: "", 
      attackBonus: 0,
      baseAttackBonus: undefined,
      damage: "",
      baseDamage: undefined,
      damageType: "kinetic", 
      icon: "fa-sword",
      range: "",
      ability: "",
      cost: 0,
      type: ""
    };
    
    // For display in edit dialog, use baseAttackBonus/baseDamage if they exist, otherwise use legacy fields
    const displayAttackBonus = attack.baseAttackBonus !== undefined ? attack.baseAttackBonus : (attack.attackBonus || 0);
    const displayDamage = attack.baseDamage || attack.damage || "";
    
    const damageTypes = [
      { value: "acid", label: "Acid" },
      { value: "chaos", label: "Chaos" },
      { value: "cold", label: "Cold" },
      { value: "fire", label: "Fire" },
      { value: "kinetic", label: "Kinetic" },
      { value: "lightning", label: "Lightning" },
      { value: "necrotic", label: "Necrotic" },
      { value: "photonic", label: "Photonic" },
      { value: "poison", label: "Poison" },
      { value: "psychic", label: "Psychic" },
      { value: "radiant", label: "Radiant" },
      { value: "sonic", label: "Sonic" },
      { value: "energy", label: "Energy" }
    ];

    const damageTypeOptions = damageTypes.map(dt => 
      `<option value="${dt.value}" ${attack.damageType === dt.value ? "selected" : ""}>${dt.label}</option>`
    ).join("");

    // Common attack icons
    const attackIcons = [
      { value: "fa-sword", label: "Sword" },
      { value: "fa-axe", label: "Axe" },
      { value: "fa-hammer", label: "Hammer" },
      { value: "fa-bow-arrow", label: "Bow" },
      { value: "fa-gun", label: "Gun" },
      { value: "fa-fist-raised", label: "Fist" },
      { value: "fa-hand-rock", label: "Punch" },
      { value: "fa-knife", label: "Knife" },
      { value: "fa-dagger", label: "Dagger" },
      { value: "fa-wand-magic-sparkles", label: "Magic" },
      { value: "fa-magic", label: "Magic (Base)" },
      { value: "fa-fire", label: "Fire" },
      { value: "fa-bolt", label: "Lightning" },
      { value: "fa-snowflake", label: "Ice" },
      { value: "fa-skull", label: "Necrotic" },
      { value: "fa-star", label: "Radiant" },
      { value: "fa-brain", label: "Psychic" },
      { value: "fa-flask", label: "Poison" },
      { value: "fa-shield", label: "Shield Bash" },
      { value: "fa-paw", label: "Claw" },
      { value: "fa-tooth", label: "Bite" }
    ];

    const iconOptions = attackIcons.map(icon => {
      const selected = attack.icon === icon.value ? "selected" : "";
      return `<option value="${icon.value}" ${selected}>${icon.label}</option>`;
    }).join("");

    const abilityOptions = `
      <option value="" ${!attack.ability ? "selected" : ""}>None</option>
      <option value="might" ${attack.ability === "might" ? "selected" : ""}>Might</option>
      <option value="agility" ${attack.ability === "agility" ? "selected" : ""}>Agility</option>
      <option value="wits" ${attack.ability === "wits" ? "selected" : ""}>Wits</option>
      <option value="charm" ${attack.ability === "charm" ? "selected" : ""}>Charm</option>
    `;

    const dialogContent = `
      <form class="singularity-attack-dialog">
        <div class="form-group">
          <label>Attack Name:</label>
          <input type="text" id="attack-name" value="${attack.name}" placeholder="e.g., Melee Strike"/>
        </div>
        <div class="form-group">
          <label>Icon:</label>
          <select id="attack-icon">
            ${iconOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Base Attack Bonus (Competence):</label>
          <input type="number" id="attack-bonus" value="${displayAttackBonus}" placeholder="0"/>
          <small style="color: #a0aec0;">This is the base bonus from competence level (e.g., +4 for Apprentice). Ability modifier is added automatically.</small>
        </div>
        <div class="form-group">
          <label>Base Damage:</label>
          <input type="text" id="attack-damage" value="${displayDamage}" placeholder="e.g., 1d4"/>
          <small style="color: #a0aec0;">Base damage dice (e.g., 1d4). Ability modifier is added automatically if an ability is selected.</small>
        </div>
        <div class="form-group">
          <label>Damage Type:</label>
          <select id="attack-damage-type">
            ${damageTypeOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Range:</label>
          <input type="text" id="attack-range" value="${attack.range || ""}" placeholder="e.g., Melee, 30 feet, 60 feet"/>
        </div>
        <div class="form-group">
          <label>Ability Score:</label>
          <select id="attack-ability">
            ${abilityOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Energy Cost:</label>
          <input type="number" id="attack-cost" value="${attack.cost || 0}" min="0" placeholder="0"/>
        </div>
        <div class="form-group">
          <label>Type:</label>
          <select id="attack-type">
            <option value="" ${!attack.type ? "selected" : ""}>None</option>
            <option value="melee" ${attack.type === "melee" ? "selected" : ""}>Melee</option>
            <option value="ranged" ${attack.type === "ranged" ? "selected" : ""}>Ranged</option>
          </select>
        </div>
      </form>
    `;

    new Dialog({
      title: isEdit ? "Edit Attack" : "Add Attack",
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: "Save",
          callback: async (html) => {
            const name = html.find("#attack-name").val().trim();
            const icon = html.find("#attack-icon").val() || "fa-sword";
            const baseAttackBonus = parseFloat(html.find("#attack-bonus").val()) || 0;
            const baseDamage = html.find("#attack-damage").val().trim();
            const damageType = html.find("#attack-damage-type").val();
            const range = html.find("#attack-range").val().trim();
            const ability = html.find("#attack-ability").val() || "";
            const cost = parseFloat(html.find("#attack-cost").val()) || 0;
            const type = html.find("#attack-type").val() || "";

            if (!name) {
              ui.notifications.warn("Attack name is required.");
              return;
            }

            const attacks = foundry.utils.deepClone(this.actor.system.attacks || []);
            const baseAttackName = attackData?.name?.replace(/\s*\(Melee\)$/i, "").replace(/\s*\(Thrown\)$/i, "");
            const matchingWeapon = equippedWeapons.find(w => w.name && baseAttackName && w.name.toLowerCase() === baseAttackName.toLowerCase());
            const isUnarmed = attackData?.name && attackData.name.toLowerCase() === "unarmed strike";
            const isWeaponAttack = Boolean(attackData?.weaponId) || Boolean(matchingWeapon);
            const isTalentAttack = attackData?.isTalentAttack === true || (attackData?.name && attackData.name.toLowerCase() === "blast");
            const isCustom = attackData?.isCustom ?? !(isWeaponAttack || isUnarmed || isTalentAttack);
            const newAttack = {
              name: name,
              icon: icon,
              baseAttackBonus: baseAttackBonus, // Store base bonus separately
              baseDamage: baseDamage, // Store base damage separately
              damageType: damageType,
              range: range,
              ability: ability, // Store which ability this attack uses
              cost: cost,
              type: type,
              isCustom: isCustom,
              isTalentAttack: isTalentAttack
            };
            
            // Remove legacy fields if they exist
            delete newAttack.attackBonus;
            delete newAttack.damage;

            if (isEdit) {
              // Remove legacy fields from existing attack
              delete attacks[attackId].attackBonus;
              delete attacks[attackId].damage;
              attacks[attackId] = newAttack;
            } else {
              attacks.push(newAttack);
            }

            await this.actor.update({ "system.attacks": attacks });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => {}
        }
      },
      default: "save"
    }).render(true);
  }

  async _applyBastionBenefits() {
    // Check if Bastion is selected
    const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
    if (powersetName !== "Bastion") {
      return;
    }
    
    const updateData = {};
    const currentLevel = this.actor.system.basic.primeLevel || 1;
    
    // 1. Calculate AC bonus based on level
    // +2 at level 1, +4 at level 5, +6 at level 10, +8 at level 15, +10 at level 20
    let acBonus = 0;
    if (currentLevel >= 20) acBonus = 10;
    else if (currentLevel >= 15) acBonus = 8;
    else if (currentLevel >= 10) acBonus = 6;
    else if (currentLevel >= 5) acBonus = 4;
    else if (currentLevel >= 1) acBonus = 2;
    
    // Store AC bonus in progression
    updateData["system.progression.level1.bastionAcBonus"] = acBonus;
    
    // 2. Add Heavy Armor training (if not already present)
    const skills = foundry.utils.deepClone(this.actor.system.skills || {});
    if (!skills["Heavy Armor"]) {
      skills["Heavy Armor"] = {
        rank: "Apprentice",
        ability: "endurance",
        otherBonuses: 0
      };
      updateData["system.skills"] = skills;
    } else if (skills["Heavy Armor"].rank === "Novice" || !skills["Heavy Armor"].rank) {
      // Upgrade to Apprentice if currently Novice
      skills["Heavy Armor"].rank = "Apprentice";
      updateData["system.skills"] = skills;
    }
    
    // 2b. Remove Light/Medium Armor Training talents (Heavy Armor Training already includes them)
    const progression = foundry.utils.deepClone(this.actor.system.progression || {});
    let removedArmorTalents = [];
    
    for (let lvl = 1; lvl <= 20; lvl++) {
      const levelKey = `level${lvl}`;
      const levelData = progression[levelKey] || {};
      
      // Check generic talent slots
      const armorTrainingSlots = [
        { slot: "genericTalent", name: "genericTalentName", img: "genericTalentImg" },
        { slot: "humanGenericTalent", name: "humanGenericTalentName", img: "humanGenericTalentImg" },
        { slot: "terranGenericTalent", name: "terranGenericTalentName", img: "terranGenericTalentImg" }
      ];
      
      for (const slotInfo of armorTrainingSlots) {
        const talentName = levelData[slotInfo.name];
        if (talentName) {
          const normalizedName = talentName.toLowerCase().trim();
          if (normalizedName.includes("light armor training") || 
              normalizedName.includes("medium armor training")) {
            progression[levelKey][slotInfo.slot] = null;
            progression[levelKey][slotInfo.name] = null;
            progression[levelKey][slotInfo.img] = null;
            removedArmorTalents.push(talentName);
          }
        }
      }
    }
    
    // Also remove any embedded Light/Medium Armor Training talent items
    const armorTrainingItems = this.actor.items.filter(item => {
      if (item.type !== "talent") return false;
      const itemName = (item.name || "").toLowerCase().trim();
      return itemName.includes("light armor training") || itemName.includes("medium armor training");
    });
    
    if (armorTrainingItems.length > 0) {
      await this.actor.deleteEmbeddedDocuments("Item", armorTrainingItems.map(item => item.id));
      removedArmorTalents.push(...armorTrainingItems.map(i => i.name));
    }
    
    if (removedArmorTalents.length > 0) {
      updateData["system.progression"] = progression;
      ui.notifications.info(`Removed ${removedArmorTalents.join(", ")} - Heavy Armor Training already includes Light and Medium Armor Training.`);
    }
    
    // 3. Grant Saving Throw Training (Apprentice) talent
    // Check if it already exists
    const existingTalent = this.actor.items.find(item => 
      item.type === "talent" && 
      (item.name === "Saving Throw Training (Apprentice)" || item.name.includes("Saving Throw Training"))
    );
    
    if (!existingTalent) {
      // Try to get the talent from compendium
      const talentsPack = game.packs.get("singularity.talents");
      if (talentsPack) {
        await talentsPack.getIndex();
        const talentIndex = talentsPack.index.find(i => 
          i.name === "Saving Throw Training (Apprentice)" || i.name.includes("Saving Throw Training")
        );
        
        if (talentIndex) {
          const talentDoc = await talentsPack.getDocument(talentIndex._id);
          if (talentDoc) {
            // Create embedded item from compendium item
            const talentData = talentDoc.toObject();
            talentData.flags = talentData.flags || {};
            await this.actor.createEmbeddedDocuments("Item", [talentData]);
            ui.notifications.info("Saving Throw Training (Apprentice) talent granted!");
          }
        }
      }
    }
    
    // 4. Apply saving throw rank if one was selected
    const selectedSavingThrow = this.actor.system.progression?.level1?.bastionSavingThrow;
    if (selectedSavingThrow) {
      const savingThrows = foundry.utils.deepClone(this.actor.system.savingThrows || {});
      if (!savingThrows[selectedSavingThrow]) {
        savingThrows[selectedSavingThrow] = {
          rank: "Apprentice",
          otherBonuses: 0
        };
      } else {
        savingThrows[selectedSavingThrow].rank = "Apprentice";
      }
      updateData["system.savingThrows"] = savingThrows;
    }
    
    // Apply updates
    if (Object.keys(updateData).length > 0) {
      await this.actor.update(updateData);
    }
  }

  _showBlastAttackDialog() {
    const dialogContent = `
      <form>
        <div class="form-group">
          <label>Damage Type:</label>
          <select id="blast-damage-type">
            <option value="energy">Energy</option>
            <option value="kinetic">Kinetic</option>
            <option value="fire">Fire</option>
            <option value="cold">Cold</option>
            <option value="lightning">Lightning</option>
            <option value="acid">Acid</option>
            <option value="poison">Poison</option>
            <option value="psychic">Psychic</option>
            <option value="radiant">Radiant</option>
            <option value="necrotic">Necrotic</option>
            <option value="photonic">Photonic</option>
            <option value="sonic">Sonic</option>
          </select>
        </div>
        <div class="form-group">
          <label>Ability Score (for attack and damage):</label>
          <select id="blast-ability">
            <option value="might">Might</option>
            <option value="agility">Agility</option>
            <option value="wits">Wits</option>
            <option value="charm">Charm</option>
          </select>
        </div>
        <p class="info-note">
          <strong>Blast Details:</strong><br>
          • Damage: 1d4 + ability modifier<br>
          • Attack Bonus: +4 (Apprentice) + ability modifier<br>
          • Range: 30 feet<br>
          • Energy Cost: 2<br>
          • You can edit all details after creation from the Main tab.
        </p>
      </form>
      <style>
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: #d1d1d1;
          font-weight: bold;
          font-size: 14px;
        }
        .form-group select {
          width: 100%;
          padding: 10px;
          background: rgba(30, 33, 45, 0.95);
          border: 1px solid rgba(189, 95, 255, 0.4);
          border-radius: 3px;
          color: #ffffff;
          font-size: 14px;
        }
        .info-note {
          font-size: 12px;
          color: #a0aec0;
          margin-top: 20px;
          padding: 12px;
          background: rgba(189, 95, 255, 0.1);
          border-left: 3px solid #BD5FFF;
          border-radius: 3px;
          line-height: 1.6;
        }
        .info-note strong {
          color: #BD5FFF;
        }
      </style>
    `;

    new Dialog({
      title: "Configure Blast Attack",
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: "Create Attack",
          callback: async (html) => {
            const damageType = html.find("#blast-damage-type").val();
            const ability = html.find("#blast-ability").val();
            
            // Fixed values
            const name = "Blast";
            const attackBonus = 4; // Base +4 from Apprentice competence
            const damage = "1d4"; // Base damage
            const range = "30 feet"; // Fixed range
            const icon = "fa-magic"; // Base icon, can be changed later

            // Get the ability modifier
            // In Singularity, ability scores start at 0 (average), and the modifier is the score itself
            // 0 = +0, 5 = +5, etc. (not D&D style)
            const abilityScore = this.actor.system.abilities[ability] || 0;
            const abilityModifier = abilityScore; // Modifier equals the ability score directly
            
            // Calculate final attack bonus (base + ability modifier)
            const finalAttackBonus = attackBonus + abilityModifier;
            
            // Calculate damage (base damage + ability modifier)
            const finalDamage = damage + (abilityModifier > 0 ? `+${abilityModifier}` : abilityModifier < 0 ? `${abilityModifier}` : "");

            const attacks = foundry.utils.deepClone(this.actor.system.attacks || []);
            const newAttack = {
              name: name,
              icon: icon,
              baseAttackBonus: attackBonus, // Store base +4 (Apprentice) separately
              ability: ability, // Store which ability this attack uses
              baseDamage: damage, // Store base "1d4" separately
              damageType: damageType,
              range: range,
              cost: 2, // Blast costs 2 energy
              type: "ranged",
              isCustom: false,
              isTalentAttack: true,
              weaponImg: "icons/svg/explosion.svg"
            };

            attacks.push(newAttack);
            await this.actor.update({ "system.attacks": attacks });
            ui.notifications.info(`Blast attack created! Uses ${ability} modifier (+${abilityModifier}). You can edit it from the Main tab.`);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Skip",
          callback: () => {
            ui.notifications.info("You can add the Blast attack later from the Main tab.");
          }
        }
      },
      default: "save"
    }).render(true);
  }

  _showSavingThrowTrainingDialog(level, slotType) {
    // Get current saving throws to check which ones are already trained
    const savingThrows = this.actor.system.savingThrows || {};
    const savingThrowAbilityNames = ["might", "agility", "endurance", "wits", "charm"];
    
    // Filter out saving throws that are already at Apprentice rank or higher
    const availableSavingThrows = savingThrowAbilityNames.filter(ability => {
      const savingThrow = savingThrows[ability] || {};
      const rank = savingThrow.rank || "Novice";
      // Only show if it's Novice (not already trained)
      return rank === "Novice";
    });
    
    if (availableSavingThrows.length === 0) {
      ui.notifications.warn("All saving throws are already trained! You cannot select Saving Throw Training (Apprentice) again.");
      // Clear the talent selection since it can't be used
      const levelKey = `level${level}`;
      const updateData = {
        [`system.progression.${levelKey}.${slotType}`]: null,
        [`system.progression.${levelKey}.${slotType}Name`]: null,
        [`system.progression.${levelKey}.${slotType}Img`]: null
      };
      this.actor.update(updateData);
      this.render();
      return;
    }
    
    const dialogContent = `
      <form>
        <div class="form-group">
          <label>Choose Saving Throw to Train:</label>
          <select id="saving-throw-training-ability" required>
            <option value="">Choose Saving Throw...</option>
            ${availableSavingThrows.map(ability => {
              const abilityDisplay = ability.charAt(0).toUpperCase() + ability.slice(1);
              return `<option value="${ability}">${abilityDisplay}</option>`;
            }).join('')}
          </select>
        </div>
        <p style="font-size: 12px; color: #a0aec0; margin-top: 10px;">
          This will set the selected saving throw to <strong>Apprentice</strong> rank.
        </p>
      </form>
      <style>
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: #d1d1d1;
          font-weight: bold;
          font-size: 14px;
        }
        .form-group select {
          width: 100%;
          padding: 10px;
          background: rgba(30, 33, 45, 0.95);
          border: 1px solid rgba(189, 95, 255, 0.4);
          border-radius: 3px;
          color: #ffffff;
          font-size: 14px;
        }
      </style>
    `;
    
    new Dialog({
      title: "Saving Throw Training - Choose Ability",
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: "Train Saving Throw",
          callback: async (html) => {
            const ability = html.find("#saving-throw-training-ability").val();
            
            if (!ability) {
              ui.notifications.warn("Please select a saving throw.");
              return;
            }
            
            // Update the saving throw rank to Apprentice
            const savingThrows = foundry.utils.deepClone(this.actor.system.savingThrows || {});
            if (!savingThrows[ability]) {
              savingThrows[ability] = {
                rank: "Apprentice",
                otherBonuses: 0
              };
            } else {
              savingThrows[ability].rank = "Apprentice";
            }
            
            // Store which saving throw was trained by this talent
            const levelKey = `level${level}`;
            const updateData = {
              "system.savingThrows": savingThrows,
              [`system.progression.${levelKey}.${slotType}SavingThrow`]: ability
            };
            
            await this.actor.update(updateData);
            this.render();
            ui.notifications.info(`${ability.charAt(0).toUpperCase() + ability.slice(1)} saving throw set to Apprentice rank.`);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: async () => {
            // Clear the talent selection if cancelled
            const levelKey = `level${level}`;
            const updateData = {
              [`system.progression.${levelKey}.${slotType}`]: null,
              [`system.progression.${levelKey}.${slotType}Name`]: null,
              [`system.progression.${levelKey}.${slotType}Img`]: null
            };
            await this.actor.update(updateData);
            this.render();
          }
        }
      },
      default: "save"
    }).render(true);
  }

  _showBastionResistanceDialog() {
    const damageTypes = [
      "Energy",
      "Kinetic",
      "Fire",
      "Cold",
      "Lightning",
      "Acid",
      "Poison",
      "Psychic",
      "Radiant",
      "Necrotic",
      "Force",
      "Thunder"
    ];
    
    const dialogContent = `
      <form>
        <p style="color: #d1d1d1; margin-bottom: 20px;">
          Choose one damage type. You gain <strong>resistance</strong> to the chosen damage type equal to <strong>2 × your Bastion level</strong>.
        </p>
        <div class="form-group">
          <label>Damage Type:</label>
          <select id="bastion-resistance-type" required>
            <option value="">Choose Damage Type...</option>
            ${damageTypes.map(type => `<option value="${type}">${type}</option>`).join('')}
          </select>
        </div>
        <p style="font-size: 12px; color: #a0aec0; margin-top: 10px;">
          <strong>Note:</strong> The resistance value will be calculated dynamically as 2 × your Bastion level. You can take this talent multiple times, choosing a different damage type each time.
        </p>
      </form>
      <style>
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: #d1d1d1;
          font-weight: bold;
          font-size: 14px;
        }
        .form-group select {
          width: 100%;
          padding: 10px;
          background: rgba(30, 33, 45, 0.95);
          border: 1px solid rgba(189, 95, 255, 0.4);
          border-radius: 3px;
          color: #ffffff;
          font-size: 14px;
        }
      </style>
    `;

    new Dialog({
      title: "Bastion's Resistance - Choose Damage Type",
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: "Add Resistance",
          callback: async (html) => {
            const damageType = html.find("#bastion-resistance-type").val();
            
            if (!damageType) {
              ui.notifications.warn("Please select a damage type.");
              return;
            }
            
            // Get current resistances
            const resistances = foundry.utils.deepClone(this.actor.system.resistances || []);
            
            // Check if this resistance already exists
            const existing = resistances.find(r => r.type === damageType && r.source === "Bastion's Resistance");
            if (existing) {
              ui.notifications.warn(`You already have ${damageType} resistance from Bastion's Resistance.`);
              return;
            }
            
            // Add the resistance (value will be calculated dynamically as 2 × Bastion level)
            const newResistance = {
              type: damageType,
              value: null, // null means it's calculated dynamically
              source: "Bastion's Resistance" // Track that this came from the talent
            };
            
            resistances.push(newResistance);
            
            // Store the chosen damage type in progression data
            const updateData = {
              "system.resistances": resistances,
              "system.progression.level1.bastionTalentResistanceType": damageType
            };
            
            await this.actor.update(updateData);
            this.render();
            ui.notifications.info(`Added ${damageType} resistance from Bastion's Resistance.`);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => {}
        }
      },
      default: "save"
    }).render(true);
  }

  async _onRollAttack(event) {
    event.preventDefault();
    if (this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed")) {
      ui.notifications.warn("Paralyzed: you cannot take actions or reactions.");
      return;
    }
    const attackId = parseInt(event.currentTarget.dataset.attackId);
    const attacks = this.actor.system.attacks || [];
    const attack = attacks[attackId];

    if (!attack) return;

    // Get equipped weapons to check weapon type (for ranged weapons)
    const items = this.actor.items || [];
    const equippedWeapons = items.filter(i => i && i.type === "weapon" && i.system?.basic?.equipped === true);
    const matchingWeapon = equippedWeapons.find(w => w.name && attack.name && w.name.toLowerCase() === attack.name.toLowerCase());
    const isRangedAttack = attack.type === "ranged" || attack.weaponMode === "thrown" || matchingWeapon?.system?.basic?.type === "ranged";
    if (isRangedAttack && this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "blinded")) {
      ui.notifications.warn("Blinded: ranged attacks are impossible.");
      return;
    }

    // Calculate dynamic attack bonus (must match the calculation in getData())
    // First, calculate ability bonuses the same way as getData()
    const actorData = foundry.utils.deepClone(this.actor.system);
    const powersetName = actorData.progression?.level1?.powersetName || actorData.basic?.powerset;
    const primeLevel = actorData.basic?.primeLevel || 1;
    
    // Calculate ability bonuses from progression (same as getData())
    const abilityBonuses = {
      might: 0,
      agility: 0,
      endurance: 0,
      wits: 0,
      charm: 0
    };
    
    // Check Human ability boost
    if (actorData.progression?.level1?.humanAbilityBoost) {
      const ability = actorData.progression.level1.humanAbilityBoost;
      if (abilityBonuses.hasOwnProperty(ability)) {
        abilityBonuses[ability] += 1;
      }
    }
    
    // Check Terran ability boost
    if (actorData.progression?.level1?.terranAbilityBoost) {
      const ability = actorData.progression.level1.terranAbilityBoost;
      if (abilityBonuses.hasOwnProperty(ability)) {
        abilityBonuses[ability] += 1;
      }
    }
    
    // Check Background ability boost
    if (actorData.progression?.level1?.backgroundAbilityBoost) {
      const ability = actorData.progression.level1.backgroundAbilityBoost;
      if (abilityBonuses.hasOwnProperty(ability)) {
        abilityBonuses[ability] += 1;
      }
    }
    
    // Check powerset benefits (Bastion, Marksman, Paragon, Gadgeteer)
    const level1 = actorData.progression?.level1 || {};
    if (powersetName === "Bastion") {
      abilityBonuses.endurance += 1;
      if (level1.bastionAbilityBoost1) {
        const ability1 = level1.bastionAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "endurance") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (level1.bastionAbilityBoost2) {
        const ability2 = level1.bastionAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "endurance") {
          abilityBonuses[ability2] += 1;
        }
      }
    } else if (powersetName === "Marksman") {
      abilityBonuses.agility += 1;
      if (level1.marksmanAbilityBoost1) {
        const ability1 = level1.marksmanAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "agility") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (level1.marksmanAbilityBoost2) {
        const ability2 = level1.marksmanAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "agility") {
          abilityBonuses[ability2] += 1;
        }
      }
    } else if (powersetName === "Paragon") {
      abilityBonuses.might += 1;
      if (level1.paragonAbilityBoost1) {
        const ability1 = level1.paragonAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "might") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (level1.paragonAbilityBoost2) {
        const ability2 = level1.paragonAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "might") {
          abilityBonuses[ability2] += 1;
        }
      }
    } else if (powersetName === "Gadgeteer") {
      abilityBonuses.wits += 1;
      if (level1.gadgeteerAbilityBoost1) {
        const ability1 = level1.gadgeteerAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "wits") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (level1.gadgeteerAbilityBoost2) {
        const ability2 = level1.gadgeteerAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "wits") {
          abilityBonuses[ability2] += 1;
        }
      }
    }
    
    // Calculate final ability scores (base 0 + bonuses) - same as getData()
    const calculatedAbilityScores = {};
    const abilityNames = ["might", "agility", "endurance", "wits", "charm"];
    for (const ability of abilityNames) {
      calculatedAbilityScores[ability] = abilityBonuses[ability] || 0;
    }
    
    // Helper function to determine weapon category from weapon name/type
    const getWeaponCategory = (weaponName, weaponType, isThrown = false) => {
      if (!weaponName) return null;
      const name = weaponName.toLowerCase();
      
      // Unarmed Strikes
      if (name.includes("unarmed") || name === "fist" || name === "fists" || name === "kick" || name.includes("natural weapon")) {
        return "Unarmed Strikes";
      }
      
      // Bows
      if (name.includes("bow") || name.includes("shortbow") || name.includes("longbow")) {
        return "Bows";
      }
      
      // Firearms
      if (name.includes("pistol") || name.includes("rifle") || name.includes("shotgun") || name.includes("firearm")) {
        return "Firearms";
      }
      
      // Thrown Weapons (check if actually being thrown)
      if (isThrown || name.includes("throwing") || name.includes("javelin") || name.includes("shuriken")) {
        return "Thrown Weapons";
      }
      
      // Heavy Melee Weapons
      if (name.includes("greatsword") || name.includes("great sword") || name.includes("battleaxe") || name.includes("battle axe") || 
          name.includes("hammer") || name.includes("polearm") || name.includes("pole arm") || name.includes("maul")) {
        return "Heavy Melee Weapons";
      }
      
      // Light Melee Weapons (when used in melee, not thrown)
      if (name.includes("dagger") || name.includes("shortsword") || name.includes("short sword") || name.includes("tonfa") || 
          name.includes("combat knife") || name === "knife") {
        return "Light Melee Weapons";
      }
      
      // Default: if ranged type, check if it's a bow or firearm (already handled above)
      // If melee type, assume it could be light or heavy, but we'll default based on common names
      if (weaponType === "ranged") {
        // Already checked bows and firearms above
        return null;
      }
      
      // For melee weapons, check size/weight indicators
      // This is a heuristic - could be improved with weapon item properties
      return null;
    };
    
    // Determine weapon competence rank and bonus
    let weaponCompetenceRank = "Novice";
    let weaponCompetenceBonus = 0;
    
    // Check for Weapon Training talent bonuses first
    const progression = this.actor.system.progression || {};
    const level1Data = progression.level1 || {};
    const weaponCategory = getWeaponCategory(attack.name, attack.type, false);
    
    // Check all Weapon Training selections
    if (weaponCategory) {
      // Check humanGenericTalentWeaponCategory
      if (level1Data.humanGenericTalentName && 
          (level1Data.humanGenericTalentName.toLowerCase().includes("weapon training") || level1Data.humanGenericTalentName.toLowerCase().includes("weapon training (apprentice)"))) {
        if (level1Data.humanGenericTalentWeaponCategory === weaponCategory) {
          weaponCompetenceRank = "Apprentice";
          weaponCompetenceBonus = 4;
        }
      }
      
      // Check terranGenericTalentWeaponCategory
      if (level1Data.terranGenericTalentName && 
          (level1Data.terranGenericTalentName.toLowerCase().includes("weapon training") || level1Data.terranGenericTalentName.toLowerCase().includes("weapon training (apprentice)"))) {
        if (level1Data.terranGenericTalentWeaponCategory === weaponCategory) {
          weaponCompetenceRank = "Apprentice";
          weaponCompetenceBonus = 4;
        }
      }
      
      // Check genericTalentWeaponCategory (for other levels)
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        if (levelData.genericTalentName && 
            (levelData.genericTalentName.toLowerCase().includes("weapon training") || levelData.genericTalentName.toLowerCase().includes("weapon training (apprentice)"))) {
          if (levelData.genericTalentWeaponCategory === weaponCategory) {
            weaponCompetenceRank = "Apprentice";
            weaponCompetenceBonus = 4;
          }
        }
      }
    }
    
    // Check for Unarmed Strike (Paragon powerset) - apply after Weapon Training checks
    // but only if no Weapon Training was already applied for Unarmed Strikes
    if (attack.name && attack.name.toLowerCase() === "unarmed strike") {
      if (powersetName === "Paragon" && weaponCompetenceBonus === 0) {
        // Paragon gets Apprentice with unarmed at level 1, but only if no Weapon Training was applied
        weaponCompetenceRank = "Apprentice";
        weaponCompetenceBonus = 4; // Apprentice = +4
      } else if (weaponCompetenceBonus === 0) {
        // Only use default if no Weapon Training was applied
        weaponCompetenceRank = "Novice";
        weaponCompetenceBonus = 0; // Novice = +0
      }
    }
    // Check for ranged weapons (Marksman competence) - only if no Weapon Training applied
    else if (attack.type === "ranged" || (matchingWeapon && matchingWeapon.system?.basic?.type === "ranged")) {
      if (powersetName === "Marksman" && weaponCompetenceBonus === 0) {
        // Marksman gets Ranged Weapon Competence: Apprentice at level 1, Competent at 5, Masterful at 10, Legendary at 15
        // Only apply if no Weapon Training was already applied
        if (primeLevel >= 15) {
          weaponCompetenceRank = "Legendary";
          weaponCompetenceBonus = 16;
        } else if (primeLevel >= 10) {
          weaponCompetenceRank = "Masterful";
          weaponCompetenceBonus = 12;
        } else if (primeLevel >= 5) {
          weaponCompetenceRank = "Competent";
          weaponCompetenceBonus = 8;
        } else if (primeLevel >= 1) {
          weaponCompetenceRank = "Apprentice";
          weaponCompetenceBonus = 4;
        }
      }
    }
    // Use stored competence rank if available (and no Weapon Training was applied)
    else if (attack.weaponCompetenceRank && weaponCompetenceBonus === 0) {
      weaponCompetenceRank = attack.weaponCompetenceRank;
      const rankBonuses = {
        "Novice": 0,
        "Apprentice": 4,
        "Competent": 8,
        "Masterful": 12,
        "Legendary": 16
      };
      weaponCompetenceBonus = rankBonuses[weaponCompetenceRank] || 0;
    }
    
    // Check for Deadeye bonus (only applies to ranged weapons)
    let deadeyeBonus = 0;
    const deadeyeData = this.actor.system.combat?.deadeye || { active: false };
    if (deadeyeData.active && (attack.type === "ranged" || (matchingWeapon && matchingWeapon.system?.basic?.type === "ranged"))) {
      deadeyeBonus = 5; // +5 attack bonus from Deadeye
    }
    
    // Calculate final attack bonus
    const scaredEffect = this.actor?.effects?.find(effect => effect.getFlag("core", "statusId") === "scared");
    const scaredPenalty = Math.max(0, Number(scaredEffect?.getFlag("singularity", "value") ?? 0));
    const blindedPenalty = this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "blinded") ? 10 : 0;
    let attackBonus = 0;
    if (attack.baseAttackBonus !== undefined && attack.ability) {
      // New format: baseAttackBonus + weapon competence bonus + current ability score + Deadeye bonus
      const currentAbilityScore = calculatedAbilityScores[attack.ability] || 0;
      attackBonus = attack.baseAttackBonus + weaponCompetenceBonus + currentAbilityScore + deadeyeBonus;
    } else if (attack.attackBonus !== undefined) {
      // Legacy format: use stored attackBonus + weapon competence bonus + Deadeye bonus
      attackBonus = attack.attackBonus + weaponCompetenceBonus + deadeyeBonus;
    } else {
      // No baseAttackBonus, use only competence bonus, ability, and Deadeye bonus
      const currentAbilityScore = calculatedAbilityScores[attack.ability || "might"] || 0;
      attackBonus = weaponCompetenceBonus + currentAbilityScore + deadeyeBonus;
    }
    if (scaredPenalty > 0) {
      attackBonus -= scaredPenalty;
    }
    if (pronePenalty > 0) {
      attackBonus -= pronePenalty;
    }
    if (fatiguedPenalty > 0) {
      attackBonus -= fatiguedPenalty;
    }
    if (blindedPenalty > 0) {
      attackBonus -= blindedPenalty;
    }

    const dialogContent = `
      <form class="singularity-roll-dialog">
        <div class="roll-fields-row">
          <div class="form-group-inline">
            <label>Attack Roll:</label>
            <input type="text" id="attack-roll" value="1d20" readonly class="readonly-input"/>
          </div>
          <div class="form-group-inline">
            <label>Attack Bonus:</label>
            <input type="number" id="attack-bonus" value="${attackBonus}" readonly class="readonly-input"/>
          </div>
          <div class="form-group-inline">
            <label>Extra Modifier:</label>
            <input type="text" id="extra-modifier" value="0" placeholder="0 or +1d6" class="editable-input"/>
          </div>
        </div>
        <p class="help-text">Add any extra bonuses (e.g., +2, +1d6, -1). Click "Roll Attack" to roll 1d20 + Attack Bonus + Extra Modifier.</p>
      </form>
    `;

    const dialogTitle = `Roll Attack: ${attack.name}`;
    
    const d = new Dialog({
      title: dialogTitle,
      content: dialogContent,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: "Roll Attack",
          callback: async (html) => {
            const bonus = parseFloat(html.find("#attack-bonus").val()) || 0;
            const extra = html.find("#extra-modifier").val().trim() || "0";
            
            const hasParalyzedTarget = Array.from(game.user?.targets || []).some(
              target => target.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed")
            );
            const dieFormula = hasParalyzedTarget ? "2d20kh" : "1d20";
            // Build roll formula: d20 + bonus + extra
            let rollFormula = `${dieFormula} + ${bonus}`;
            if (extra && extra !== "0") {
              rollFormula += ` + ${extra}`;
            }
            
            const roll = new Roll(rollFormula);
            await roll.evaluate();
            
            const extraText = extra !== "0" ? ` + ${extra} (Extra)` : "";
            // Add Deadeye info if applicable
            const deadeyeData = this.actor.system.combat?.deadeye || { active: false };
            const isDeadeyeActive = deadeyeData.active && (attack.type === "ranged" || (matchingWeapon && matchingWeapon.system?.basic?.type === "ranged"));
            const deadeyeInfo = isDeadeyeActive ? ` (includes +5 Deadeye)` : "";
            const scaredText = scaredPenalty > 0 ? ` (includes -${scaredPenalty} Scared)` : "";
            const proneText = pronePenalty > 0 ? ` (includes -${pronePenalty} Prone)` : "";
            const fatiguedText = fatiguedPenalty > 0 ? ` (includes -${fatiguedPenalty} Fatigued)` : "";
            const blindedText = blindedPenalty > 0 ? ` (includes -${blindedPenalty} Blinded)` : "";
            const advantageText = hasParalyzedTarget ? " (advantage vs Paralyzed)" : "";
            const flavor = `<div class="roll-flavor"><b>${attack.name} - Attack Roll</b><br>${dieFormula} + ${bonus} (Attack Bonus${deadeyeInfo}${scaredText}${proneText}${fatiguedText}${blindedText})${advantageText}${extraText} = <strong>${roll.total}</strong></div>`;
            
            const message = await roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              flavor: flavor
            });
            
            // Store attack roll result for AC comparison when rolling damage
            await message.setFlag("singularity", "attackRoll", {
              total: roll.total,
              attackId: attackId,
              attackName: attack.name
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

  async _onRollDamage(event) {
    event.preventDefault();
    if (this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed")) {
      ui.notifications.warn("Paralyzed: you cannot take actions or reactions.");
      return;
    }
    const attackId = parseInt(event.currentTarget.dataset.attackId);
    const attacks = this.actor.system.attacks || [];
    const attack = attacks[attackId];

    if (!attack) {
      ui.notifications.warn("Attack not found.");
      return;
    }

    // Calculate ability scores the same way as getData() (must match calculation)
    const actorData = foundry.utils.deepClone(this.actor.system);
    const powersetName = actorData.progression?.level1?.powersetName || actorData.basic?.powerset;
    const primeLevel = actorData.basic?.primeLevel || 1;
    
    // Calculate ability bonuses from progression (same as getData() and _onRollAttack)
    const abilityBonuses = {
      might: 0,
      agility: 0,
      endurance: 0,
      wits: 0,
      charm: 0
    };
    
    // Check Human ability boost
    if (actorData.progression?.level1?.humanAbilityBoost) {
      const ability = actorData.progression.level1.humanAbilityBoost;
      if (abilityBonuses.hasOwnProperty(ability)) {
        abilityBonuses[ability] += 1;
      }
    }
    
    // Check Terran ability boost
    if (actorData.progression?.level1?.terranAbilityBoost) {
      const ability = actorData.progression.level1.terranAbilityBoost;
      if (abilityBonuses.hasOwnProperty(ability)) {
        abilityBonuses[ability] += 1;
      }
    }
    
    // Check Background ability boost
    if (actorData.progression?.level1?.backgroundAbilityBoost) {
      const ability = actorData.progression.level1.backgroundAbilityBoost;
      if (abilityBonuses.hasOwnProperty(ability)) {
        abilityBonuses[ability] += 1;
      }
    }
    
    // Check powerset benefits (Bastion, Marksman, Paragon, Gadgeteer)
    const level1 = actorData.progression?.level1 || {};
    if (powersetName === "Bastion") {
      abilityBonuses.endurance += 1;
      if (level1.bastionAbilityBoost1) {
        const ability1 = level1.bastionAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "endurance") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (level1.bastionAbilityBoost2) {
        const ability2 = level1.bastionAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "endurance") {
          abilityBonuses[ability2] += 1;
        }
      }
    } else if (powersetName === "Marksman") {
      abilityBonuses.agility += 1;
      if (level1.marksmanAbilityBoost1) {
        const ability1 = level1.marksmanAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "agility") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (level1.marksmanAbilityBoost2) {
        const ability2 = level1.marksmanAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "agility") {
          abilityBonuses[ability2] += 1;
        }
      }
    } else if (powersetName === "Paragon") {
      abilityBonuses.might += 1;
      if (level1.paragonAbilityBoost1) {
        const ability1 = level1.paragonAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "might") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (level1.paragonAbilityBoost2) {
        const ability2 = level1.paragonAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "might") {
          abilityBonuses[ability2] += 1;
        }
      }
    } else if (powersetName === "Gadgeteer") {
      abilityBonuses.wits += 1;
      if (level1.gadgeteerAbilityBoost1) {
        const ability1 = level1.gadgeteerAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "wits") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (level1.gadgeteerAbilityBoost2) {
        const ability2 = level1.gadgeteerAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "wits") {
          abilityBonuses[ability2] += 1;
        }
      }
    }
    
    // Calculate final ability scores (base 0 + bonuses) - same as getData()
    const calculatedAbilityScores = {};
    const abilityNames = ["might", "agility", "endurance", "wits", "charm"];
    for (const ability of abilityNames) {
      calculatedAbilityScores[ability] = abilityBonuses[ability] || 0;
    }

    // Calculate dynamic damage formula
    let damageFormula = "";
    if (attack.baseDamage && attack.ability) {
      // New format: baseDamage + calculated ability score
      const currentAbilityScore = calculatedAbilityScores[attack.ability] || 0;
      if (currentAbilityScore > 0) {
        damageFormula = `${attack.baseDamage}+${currentAbilityScore}`;
      } else if (currentAbilityScore < 0) {
        damageFormula = `${attack.baseDamage}${currentAbilityScore}`;
      } else {
        damageFormula = attack.baseDamage;
      }
    } else if (attack.damage) {
      // Legacy format: use stored damage
      damageFormula = attack.damage;
    } else {
      ui.notifications.warn("This attack has no damage formula.");
      return;
    }
    
    // Check for Supersonic Moment bonus (only applies to melee attacks)
    let supersonicBonus = 0;
    const supersonicData = this.actor.system.combat?.supersonicMoment || { active: false, distance: 0 };
    if (supersonicData.active && attack.range === "Melee") {
      const distance = Number(supersonicData.distance) || 0;
      supersonicBonus = Math.floor(distance / 15) * 2; // +2 per 15 feet
    }

    const dialogContent = `
      <form class="singularity-roll-dialog">
        <div class="roll-fields-row">
          <div class="form-group-inline">
            <label>Damage Formula:</label>
            <input type="text" id="damage-formula" value="${damageFormula}" readonly class="readonly-input"/>
          </div>
          ${supersonicBonus > 0 ? `
          <div class="form-group-inline">
            <label>Supersonic Moment:</label>
            <input type="number" id="supersonic-bonus" value="${supersonicBonus}" readonly class="readonly-input" style="color: #BD5FFF; font-weight: bold;" title="+2 damage per 15 feet flown"/>
          </div>
          ` : ''}
          <div class="form-group-inline">
            <label>Extra Modifier:</label>
            <input type="text" id="extra-modifier" value="0" placeholder="0 or +1d6" class="editable-input"/>
          </div>
        </div>
        <p class="help-text">Add any extra damage (e.g., +2, +1d6, -1). Base: ${damageFormula} (${attack.damageType}).${supersonicBonus > 0 ? ` Supersonic Moment: +${supersonicBonus} damage.` : ''} Click "Roll Damage" to roll the formula + extra modifier.</p>
      </form>
    `;

    const dialogTitle = `Roll Damage: ${attack.name}`;
    
    const d = new Dialog({
      title: dialogTitle,
      content: dialogContent,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: "Roll Damage",
          callback: async (html) => {
            const damageFormula = html.find("#damage-formula").val().trim();
            const extra = html.find("#extra-modifier").val().trim() || "0";
            // Get Supersonic bonus from the input field if it exists, otherwise calculate it
            const supersonicBonusInput = html.find("#supersonic-bonus");
            let supersonicBonus = 0;
            if (supersonicBonusInput.length > 0) {
              supersonicBonus = parseFloat(supersonicBonusInput.val()) || 0;
            } else {
              // Fallback: calculate from actor data
              const supersonicData = this.actor.system.combat?.supersonicMoment || { active: false, distance: 0 };
              if (supersonicData.active && attack.range === "Melee") {
                const distance = Number(supersonicData.distance) || 0;
                supersonicBonus = Math.floor(distance / 15) * 2;
              }
            }
            
            // Build roll formula: damageFormula + supersonicBonus + extra
            let rollFormula = damageFormula;
            if (supersonicBonus > 0) {
              rollFormula += ` + ${supersonicBonus}`;
            }
            if (extra && extra !== "0") {
              rollFormula += ` + ${extra}`;
            }
            
            const roll = new Roll(rollFormula);
            await roll.evaluate();
            
            const supersonicText = supersonicBonus > 0 ? ` + ${supersonicBonus} (Supersonic Moment)` : "";
            const extraText = extra !== "0" ? ` + ${extra} (Extra)` : "";
            
            // Try to get the last attack roll result for this attack to compare against AC
            let attackRollTotal = null;
            let targetAC = null;
            let acComparison = "";
            
            // Look for the most recent attack roll message for this attack
            const recentMessages = game.messages.contents.slice(-20).reverse(); // Check last 20 messages, most recent first
            for (const msg of recentMessages) {
              const attackRollData = msg.getFlag("singularity", "attackRoll");
              if (attackRollData && attackRollData.attackId === attackId) {
                attackRollTotal = attackRollData.total;
                break;
              }
            }
            
            // Check for targeted tokens to get AC
            const targets = Array.from(game.user.targets);
            if (targets.length > 0 && attackRollTotal !== null) {
              // Get the first target's AC
              const targetToken = targets[0];
              const targetActor = targetToken.actor;
              if (targetActor && targetActor.system) {
                targetAC = targetActor.system.combat?.ac || null;
                
                if (targetAC !== null) {
                  const difference = attackRollTotal - targetAC;
                  
                  if (difference >= 10) {
                    acComparison = `<br><span style="color: #00ff00; font-weight: bold;">Extreme Success! (+${difference} over AC ${targetAC})</span>`;
                  } else if (difference >= 0) {
                    acComparison = `<br><span style="color: #90ee90; font-weight: bold;">Success! (Hit AC ${targetAC})</span>`;
                  } else if (difference >= -9) {
                    acComparison = `<br><span style="color: #ffa500; font-weight: bold;">Failure (${difference} vs AC ${targetAC})</span>`;
                  } else {
                    acComparison = `<br><span style="color: #ff0000; font-weight: bold;">Extreme Failure (${difference} vs AC ${targetAC})</span>`;
                  }
                }
              }
            }
            
            const isIncorporeal = this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "incorporeal");
            const hasCorporealTarget = isIncorporeal && Array.from(game.user?.targets || []).some(
              target => !target.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "incorporeal")
            );
            const finalTotal = hasCorporealTarget ? Math.floor(roll.total / 2) : roll.total;
            const incorporealText = hasCorporealTarget ? ` (half vs corporeal: ${finalTotal})` : "";
            const criticalButton = `<div class="chat-card-buttons" style="margin-top: 5px;"><button type="button" class="critical-hit-button" data-roll-total="${finalTotal}" data-damage-type="${attack.damageType}" data-attack-name="${attack.name}" style="padding: 4px 8px; background: rgba(220, 53, 69, 0.5); color: #ffffff; border: 1px solid rgba(220, 53, 69, 0.8); border-radius: 3px; cursor: pointer; font-size: 11px;"><i class="fas fa-bolt"></i> Critical Hit (Double Damage)</button></div>`;
            const flavor = `<div class="roll-flavor"><b>${attack.name} - Damage</b><br>${damageFormula} (${attack.damageType})${supersonicText}${extraText} = <strong>${roll.total}</strong>${incorporealText}${acComparison}${criticalButton}</div>`;
            
            const message = await roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              flavor: flavor
            });
            
            // Store the original roll data in the message flags for critical hit
            await message.setFlag("singularity", "damageRoll", {
              total: finalTotal,
              formula: rollFormula,
              damageType: attack.damageType,
              attackName: attack.name
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

  async _onSupersonicToggle(event) {
    event.preventDefault();
    const isActive = event.currentTarget.checked;
    const supersonicData = foundry.utils.deepClone(this.actor.system.combat?.supersonicMoment || { active: false, distance: 0 });
    supersonicData.active = isActive;
    
    // If deactivating, reset distance to 0
    if (!isActive) {
      supersonicData.distance = 0;
    }
    
    await this.actor.update({ "system.combat.supersonicMoment": supersonicData });
    this.render();
  }

  async _onSupersonicDistanceChange(event) {
    event.preventDefault();
    const distance = parseInt(event.currentTarget.value) || 0;
    const supersonicData = foundry.utils.deepClone(this.actor.system.combat?.supersonicMoment || { active: false, distance: 0 });
    supersonicData.distance = Math.max(0, distance); // Ensure non-negative
    
    await this.actor.update({ "system.combat.supersonicMoment": supersonicData });
    this.render();
  }

  async _onDeadeyeToggle(event) {
    event.preventDefault();
    const isActive = event.currentTarget.checked;
    
    await this.actor.update({ "system.combat.deadeye": { active: isActive } });
    this.render();
  }

  async _onEnoughPrepTimeToggle(event) {
    event.preventDefault();
    const isActive = event.currentTarget.checked;
    const enoughPrepTimeData = foundry.utils.deepClone(this.actor.system.combat?.enoughPrepTime || { active: false, enemyName: "" });
    enoughPrepTimeData.active = isActive;
    
    // If deactivating, clear enemy name
    if (!isActive) {
      enoughPrepTimeData.enemyName = "";
    }
    
    await this.actor.update({ "system.combat.enoughPrepTime": enoughPrepTimeData });
    this.render();
  }

  async _onEnoughPrepTimeEnemyChange(event) {
    event.preventDefault();
    const enemyName = event.currentTarget.value.trim();
    const enoughPrepTimeData = foundry.utils.deepClone(this.actor.system.combat?.enoughPrepTime || { active: false, enemyName: "" });
    enoughPrepTimeData.enemyName = enemyName;
    
    await this.actor.update({ "system.combat.enoughPrepTime": enoughPrepTimeData });
    this.render();
  }

  async _onAddGadget(event) {
    event.preventDefault();
    const gadgetLevel = parseInt(event.currentTarget.dataset.gadgetLevel);
    
    // Open gadget selection dialog from gadgets compendium
    const gadgetsPack = game.packs.find(p => p.metadata.name === "gadgets" && p.metadata.packageName === "singularity");
    if (!gadgetsPack) {
      ui.notifications.warn("Gadgets compendium not found. Please create it first.");
      return;
    }
    
    await gadgetsPack.getIndex();
    const allGadgets = gadgetsPack.index.filter(g => {
      try {
        // Filter by level - need to get the actual document to check level
        return true; // We'll filter in the dialog
      } catch (e) {
        return false;
      }
    });
    
    // Create selection dialog with async loading
    const content = `
      <div class="gadget-selection-dialog">
        <p>Loading Level ${gadgetLevel} gadgets...</p>
      </div>
    `;
    
    const dialog = new Dialog({
      title: `Select Level ${gadgetLevel} Gadget`,
      content: content,
      buttons: {
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "cancel"
    });
    
    dialog.render(true);
    
    // Set dialog size after rendering - make it much taller to show more gadgets
    setTimeout(() => {
      const windowElement = dialog.element.closest(".window-app");
      if (windowElement) {
        windowElement.css({
          "width": "650px",
          "min-width": "650px",
          "max-width": "650px",
          "height": "700px",
          "min-height": "700px",
          "max-height": "700px"
        });
        // Also set the content area height
        const contentElement = dialog.element.find(".window-content");
        if (contentElement) {
          contentElement.css({
            "height": "600px",
            "min-height": "600px",
            "max-height": "600px",
            "overflow-y": "auto"
          });
        }
      }
    }, 100);
    
    // Get current prepared gadgets to check for duplicates (Level 0 only)
    const currentGadgets = this.actor.system.gadgets?.prepared || { level0: [], level1: [] };
    const levelKey = `level${gadgetLevel}`;
    const alreadyPrepared = (currentGadgets[levelKey] || []).filter(g => g && g.name).map(g => g.name.toLowerCase());
    
    // Get the slot index from the button if specified
    const slotIndex = parseInt(event.currentTarget.dataset.slotIndex);
    
    // Load gadgets and update dialog
    const gadgetItems = [];
    for (const gadgetIndex of allGadgets) {
      try {
        const gadgetDoc = await gadgetsPack.getDocument(gadgetIndex._id);
        if (gadgetDoc && gadgetDoc.system?.basic?.level === gadgetLevel) {
          // For Level 0, check if already prepared
          const isDuplicate = gadgetLevel === 0 && alreadyPrepared.includes(gadgetDoc.name.toLowerCase());
          
          // Construct full UUID for compendium item
          const gadgetUuid = `Compendium.${gadgetsPack.metadata.packageName || "singularity"}.${gadgetsPack.metadata.name || "gadgets"}.${gadgetIndex._id}`;
          
          gadgetItems.push({
            id: gadgetUuid,
            name: gadgetDoc.name,
            description: gadgetDoc.system?.description || "",
            isDuplicate: isDuplicate
          });
        }
      } catch (err) {
        console.error(`Error loading gadget ${gadgetIndex.name}:`, err);
      }
    }
    
    if (gadgetItems.length === 0) {
      dialog.element.find(".gadget-selection-dialog").html(`<p>No Level ${gadgetLevel} gadgets found in compendium.</p>`);
      return;
    }
    
    // Sort gadgets alphabetically by name
    gadgetItems.sort((a, b) => a.name.localeCompare(b.name));
    
    const updatedContent = `
      <div class="gadget-selection-dialog" style="height: 100%; display: flex; flex-direction: column;">
        <p style="margin-bottom: 15px; font-weight: bold; flex-shrink: 0;">Select a Level ${gadgetLevel} gadget to prepare:</p>
        <div class="gadget-list" style="flex: 1; overflow-y: auto; min-height: 550px; max-height: 550px;">
          ${gadgetItems.map(g => `
            <div class="gadget-item-selectable ${g.isDuplicate ? 'gadget-duplicate' : ''}" data-gadget-id="${g.id}" data-gadget-name="${g.name}" style="padding: 12px; margin: 8px 0; border: 1px solid rgba(189, 95, 255, 0.3); border-radius: 3px; cursor: ${g.isDuplicate ? 'not-allowed' : 'pointer'}; background: rgba(30, 33, 45, ${g.isDuplicate ? '0.3' : '0.5'}); opacity: ${g.isDuplicate ? '0.5' : '1'};">
              <strong>${g.name}</strong>
              ${g.isDuplicate ? '<span style="color: #dc3545; font-size: 11px; margin-left: 10px;">(Already prepared)</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    dialog.element.find(".gadget-selection-dialog").replaceWith(updatedContent);
    
    // Re-apply sizing after content update to ensure dialog is tall enough
    setTimeout(() => {
      const windowElement = dialog.element.closest(".window-app");
      if (windowElement) {
        windowElement.css({
          "width": "650px",
          "min-width": "650px",
          "max-width": "650px",
          "height": "700px",
          "min-height": "700px",
          "max-height": "700px"
        });
        const contentElement = dialog.element.find(".window-content");
        if (contentElement) {
          contentElement.css({
            "height": "600px",
            "min-height": "600px",
            "max-height": "600px",
            "overflow-y": "auto"
          });
        }
      }
    }, 50);
    
    // Add click handlers
    dialog.element.find(".gadget-item-selectable").click(async (event) => {
      const gadgetId = $(event.currentTarget).data("gadget-id");
      const gadgetName = $(event.currentTarget).data("gadget-name");
      const isDuplicate = $(event.currentTarget).hasClass("gadget-duplicate");
      
      // Prevent adding duplicate Level 0 gadgets
      if (isDuplicate && gadgetLevel === 0) {
        ui.notifications.warn(`"${gadgetName}" is already prepared. Level 0 gadgets cannot be prepared twice.`);
        return;
      }
      
      // Get the full gadget document to get its image
      let gadgetImg = "icons/svg/mystery-man.svg";
      try {
        const gadgetDoc = await fromUuid(gadgetId);
        if (gadgetDoc && gadgetDoc.img) {
          gadgetImg = gadgetDoc.img;
        }
      } catch (err) {
        console.warn(`Could not load gadget image for ${gadgetName}:`, err);
      }
      
      const gadgets = foundry.utils.deepClone(this.actor.system.gadgets?.prepared || { level0: [], level1: [] });
      
      if (!gadgets[levelKey]) {
        gadgets[levelKey] = [];
      }
      
      // If slotIndex is specified, insert at that position; otherwise append
      if (slotIndex !== undefined && slotIndex !== null && !isNaN(slotIndex)) {
        gadgets[levelKey][slotIndex] = {
          id: gadgetId,
          name: gadgetName,
          img: gadgetImg,
          used: false
        };
      } else {
        gadgets[levelKey].push({
          id: gadgetId,
          name: gadgetName,
          img: gadgetImg,
          used: false
        });
      }
      
      await this.actor.update({ "system.gadgets.prepared": gadgets });
      this.render();
      dialog.close();
    });
  }

  async _onUseGadget(event) {
    event.preventDefault();
    const gadgetLevel = parseInt(event.currentTarget.dataset.gadgetLevel);
    const gadgetIndex = parseInt(event.currentTarget.dataset.gadgetIndex);
    
    const gadgets = foundry.utils.deepClone(this.actor.system.gadgets?.prepared || { level0: [], level1: [] });
    const levelKey = `level${gadgetLevel}`;
    
    if (gadgets[levelKey] && gadgets[levelKey][gadgetIndex]) {
      // Level 0 gadgets can be used unlimited times, Level 1+ can only be used once
      if (gadgetLevel === 0) {
        ui.notifications.info(`${gadgets[levelKey][gadgetIndex].name} used! (Level 0 gadgets can be used unlimited times)`);
      } else {
        gadgets[levelKey][gadgetIndex].used = true;
        await this.actor.update({ "system.gadgets.prepared": gadgets });
        this.render();
        ui.notifications.info(`${gadgets[levelKey][gadgetIndex].name} used!`);
      }
    }
  }

  async _onRemoveGadget(event) {
    event.preventDefault();
    event.stopPropagation(); // Prevent triggering the gadget item click
    const gadgetLevel = parseInt($(event.currentTarget).data("gadget-level"));
    const gadgetIndex = parseInt($(event.currentTarget).data("gadget-index"));
    
    const gadgets = foundry.utils.deepClone(this.actor.system.gadgets?.prepared || { level0: [], level1: [] });
    const levelKey = `level${gadgetLevel}`;
    
    if (gadgets[levelKey] && gadgets[levelKey][gadgetIndex]) {
      // Set the slot to null to maintain slot positions (template will show empty slot button)
      gadgets[levelKey][gadgetIndex] = null;
      // Filter out nulls to keep storage clean (will be padded again in getData)
      gadgets[levelKey] = gadgets[levelKey].filter(g => g !== null);
      await this.actor.update({ "system.gadgets.prepared": gadgets });
      this.render();
    }
  }

  async _onGadgetItemClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Don't do anything if clicking controls (use button, remove button)
    if ($(event.target).closest(".gadget-controls").length || 
        $(event.target).closest(".gadget-remove").length ||
        $(event.target).closest(".gadget-use").length) {
      return;
    }
    
    const gadgetId = $(event.currentTarget).data("gadget-id");
    if (!gadgetId) {
      return;
    }
    
    // Check if clicking on the icon (picture) or the name
    const isIconClick = $(event.target).hasClass("gadget-icon") || $(event.target).hasClass("item-icon") || $(event.target).closest(".gadget-icon, .item-icon").length;
    const isNameClick = $(event.target).hasClass("gadget-name") || $(event.target).hasClass("item-name") || $(event.target).closest(".gadget-name, .item-name").length;
    
    try {
      // Get the item from its UUID (could be compendium or world item)
      let item = await fromUuid(gadgetId);
      
      // If not found and it's not a full UUID, try constructing the UUID
      if (!item && !gadgetId.includes("Compendium.")) {
        const gadgetsPack = game.packs.find(p => p.metadata.name === "gadgets" && p.metadata.packageName === "singularity");
        if (gadgetsPack) {
          const constructedUuid = `Compendium.singularity.gadgets.${gadgetId}`;
          item = await fromUuid(constructedUuid);
        }
      }
      
      if (!item) {
        ui.notifications.warn("Could not find gadget details.");
        return;
      }
      
      if (isIconClick) {
        // Send gadget to chat
        const content = await renderTemplate("systems/singularity/templates/chat/item-card.html", {
          item: item,
          actor: this.actor
        });
        
        await ChatMessage.create({
          content: content,
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          type: CONST.CHAT_MESSAGE_TYPES.OTHER
        });
      } else if (isNameClick || (!isIconClick && !isNameClick)) {
        // Open gadget sheet (default behavior if clicking elsewhere on the gadget-item)
        if (item.sheet) {
          item.sheet.render(true);
        } else {
          ui.notifications.warn("Could not open gadget details.");
        }
      }
    } catch (error) {
      console.error("Singularity | Error handling gadget click:", error);
      ui.notifications.error("Error handling gadget action.");
    }
  }

  async _onLongRest(event) {
    event.preventDefault();
    
    // Confirm with the user
    const confirmed = await Dialog.confirm({
      title: "Long Rest",
      content: "<p>Perform a Long Rest? This will:</p><ul><li>Restore HP to maximum</li><li>Remove all wounds (but not extreme wounds)</li><li>Refresh all used gadgets</li></ul>",
      yes: () => true,
      no: () => false,
      defaultYes: true
    });
    
    if (!confirmed) {
      return;
    }
    
    const updateData = {};
    
    // 1. Restore HP to max - calculate it the same way as getData() does
    // This ensures we use the exact same value that's displayed to the user
    const actorData = this.actor;
    const primeLevel = actorData.system.basic?.primeLevel || 1;
    const powersetName = actorData.system.basic?.powerset || "";
    
    // Calculate ability bonuses the same way as getData() does
    const abilityBonuses = {
      might: 0,
      agility: 0,
      endurance: 0,
      wits: 0,
      charm: 0
    };
    
    // Check Human ability boost
    if (actorData.system.progression?.level1?.humanAbilityBoost) {
      const ability = actorData.system.progression.level1.humanAbilityBoost;
      if (abilityBonuses.hasOwnProperty(ability)) {
        abilityBonuses[ability] += 1;
      }
    }
    
    // Check Terran ability boost
    if (actorData.system.progression?.level1?.terranAbilityBoost) {
      const ability = actorData.system.progression.level1.terranAbilityBoost;
      if (abilityBonuses.hasOwnProperty(ability)) {
        abilityBonuses[ability] += 1;
      }
    }
    
    // Check Background ability boost
    if (actorData.system.progression?.level1?.backgroundAbilityBoost) {
      const ability = actorData.system.progression.level1.backgroundAbilityBoost;
      if (abilityBonuses.hasOwnProperty(ability)) {
        abilityBonuses[ability] += 1;
      }
    }
    
    // Check powerset benefits
    if (powersetName === "Bastion") {
      // +1 Endurance boost at level 1
      abilityBonuses.endurance += 1;
      
      // +2 ability boost distribution (stored in bastionAbilityBoost1 and bastionAbilityBoost2)
      if (actorData.system.progression?.level1?.bastionAbilityBoost1) {
        const ability1 = actorData.system.progression.level1.bastionAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1)) {
          abilityBonuses[ability1] += 1;
        }
      }
      if (actorData.system.progression?.level1?.bastionAbilityBoost2) {
        const ability2 = actorData.system.progression.level1.bastionAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2)) {
          abilityBonuses[ability2] += 1;
        }
      }
    } else if (powersetName === "Paragon") {
      // +1 Might boost at level 1
      abilityBonuses.might += 1;
      
      // +2 ability boost distribution
      if (actorData.system.progression?.level1?.paragonAbilityBoost1) {
        const ability1 = actorData.system.progression.level1.paragonAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "might") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (actorData.system.progression?.level1?.paragonAbilityBoost2) {
        const ability2 = actorData.system.progression.level1.paragonAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "might") {
          abilityBonuses[ability2] += 1;
        }
      }
    } else if (powersetName === "Marksman") {
      // +1 Agility boost at level 1
      abilityBonuses.agility += 1;
      
      // +2 ability boost distribution
      if (actorData.system.progression?.level1?.marksmanAbilityBoost1) {
        const ability1 = actorData.system.progression.level1.marksmanAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "agility") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (actorData.system.progression?.level1?.marksmanAbilityBoost2) {
        const ability2 = actorData.system.progression.level1.marksmanAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "agility") {
          abilityBonuses[ability2] += 1;
        }
      }
    }
    
    // Get calculated endurance score from bonuses (same as getData)
    const enduranceScore = abilityBonuses.endurance || 0;
    
    // Check for Enhanced Vitality talent
    let hasEnhancedVitality = false;
    const progression = actorData.system.progression || {};
    for (const levelKey in progression) {
      const levelData = progression[levelKey];
      if (levelData) {
        for (const slotKey in levelData) {
          const slot = levelData[slotKey];
          if (slot && typeof slot === 'string' && slot.toLowerCase().includes("enhanced vitality")) {
            hasEnhancedVitality = true;
            break;
          }
          // Also check talent name fields
          const talentFields = [
            levelData.genericTalentName,
            levelData.humanGenericTalentName,
            levelData.terranGenericTalentName,
            levelData.powersetTalentName,
            levelData.bastionTalentName
          ];
          for (const talentName of talentFields) {
            if (talentName && talentName.toLowerCase().includes("enhanced vitality")) {
              hasEnhancedVitality = true;
              break;
            }
          }
          if (hasEnhancedVitality) break;
        }
        if (hasEnhancedVitality) break;
      }
    }
    
    // Check for Ironbound talent (Bastion only)
    let hasIronbound = false;
    if (powersetName === "Bastion") {
      const bastionTalentName = progression?.level1?.bastionTalentName || "";
      if (bastionTalentName && bastionTalentName.toLowerCase().includes("ironbound")) {
        hasIronbound = true;
      }
    }
    
    // Calculate max HP exactly as getData() does
    let calculatedMaxHp = 0;
    
    if (powersetName === "Bastion") {
      const bastionLevel = primeLevel;
      let enduranceContribution = enduranceScore;
      if (hasIronbound) {
        enduranceContribution = enduranceScore * 2;
      }
      calculatedMaxHp = (14 + enduranceContribution) * bastionLevel;
      if (hasEnhancedVitality) {
        calculatedMaxHp += 2 * primeLevel;
      }
    } else if (powersetName === "Paragon") {
      const paragonLevel = primeLevel;
      calculatedMaxHp = (12 + enduranceScore) * paragonLevel;
      if (hasEnhancedVitality) {
        calculatedMaxHp += 2 * primeLevel;
      }
    } else if (powersetName === "Gadgeteer") {
      const gadgeteerLevel = primeLevel;
      calculatedMaxHp = (8 + enduranceScore) * gadgeteerLevel;
      if (hasEnhancedVitality) {
        calculatedMaxHp += 2 * primeLevel;
      }
    } else if (powersetName === "Marksman") {
      const marksmanLevel = primeLevel;
      calculatedMaxHp = (8 + enduranceScore) * marksmanLevel;
      if (hasEnhancedVitality) {
        calculatedMaxHp += 2 * primeLevel;
      }
    } else if (hasEnhancedVitality) {
      const baseMaxHp = actorData.system.combat?.hp?.max || 0;
      const enhancedVitalityBonus = 2 * primeLevel;
      calculatedMaxHp = baseMaxHp + enhancedVitalityBonus;
    } else {
      calculatedMaxHp = actorData.system.combat?.hp?.max || 0;
    }
    
    updateData["system.combat.hp.value"] = calculatedMaxHp;
    
    // 2. Remove wounds (but not extreme wounds)
    const wounds = foundry.utils.deepClone(this.actor.system.wounds || []);
    const remainingWounds = wounds.filter(wound => wound.isExtreme === true);
    updateData["system.wounds"] = remainingWounds;
    
    // 3. Refresh used gadgets (set used = false for all gadgets)
    const gadgets = foundry.utils.deepClone(this.actor.system.gadgets?.prepared || { level0: [], level1: [] });
    if (gadgets.level0) {
      gadgets.level0 = gadgets.level0.map(gadget => {
        if (gadget) {
          return { ...gadget, used: false };
        }
        return gadget;
      });
    }
    if (gadgets.level1) {
      gadgets.level1 = gadgets.level1.map(gadget => {
        if (gadget) {
          return { ...gadget, used: false };
        }
        return gadget;
      });
    }
    updateData["system.gadgets.prepared"] = gadgets;
    
    await this.actor.update(updateData);
    this.render();
    
    ui.notifications.info("Long Rest completed! HP restored, wounds removed (except extreme wounds), and gadgets refreshed.");
  }

  /** @override */
  async _onDropItem(event, data) {
    // Check if this is a progression slot drop
    const dropZone = $(event.target).closest("[data-drop-zone='progression']");
    if (dropZone.length) {
      event.preventDefault();
      const level = parseInt(dropZone.data("level"));
      const slotType = dropZone.data("slot-type");
      
      if (!level || !slotType) {
        return false;
      }

      // Get the item from the drop data
      const item = await Item.fromDropData(data);
      if (!item) {
        return false;
      }

      // Validate item type - must be a talent
      if (item.type !== "talent") {
        ui.notifications.warn("This slot only accepts talent items.");
        return false;
      }

      // Check if subtype requires a phenotype to be selected first
      if (slotType === "subtype") {
        const phenotypeId = this.actor.system.progression?.level1?.phenotype;
        const phenotypeName = this.actor.system.progression?.level1?.phenotypeName || this.actor.system.basic?.phenotype;
        
        if (!phenotypeId && !phenotypeName) {
          ui.notifications.warn("Please choose a Phenotype first before selecting a Subtype.");
          return false;
        }
        
        // Check if the subtype is compatible with the selected phenotype
        const itemPrerequisites = item.system?.basic?.prerequisites || "";
        if (itemPrerequisites && phenotypeName) {
          // Check if the phenotype name matches the prerequisite (case-insensitive)
          const prerequisiteMatch = itemPrerequisites.toLowerCase().split(/[,\s]+/).some(prereq => 
            prereq === phenotypeName.toLowerCase()
          );
          
          if (!prerequisiteMatch) {
            ui.notifications.warn(`This subtype requires the "${itemPrerequisites}" phenotype, but you have selected "${phenotypeName}".`);
            return false;
          }
        }
      }

      // Validate item category based on slot type
      const itemCategory = item.system?.basic?.type || "";
      console.log(`Singularity | Drop validation - Slot: ${slotType}, Item: ${item.name}, Category: ${itemCategory}`);
      
      const validCategories = {
        phenotype: ["phenotype"],
        subtype: ["subtype"],
        background: ["background"],
        powerset: ["powerset"],
        genericTalent: ["generic"], // Generic talents
        powersetTalent: ["powersetTalent"], // Powerset-specific talents
        humanAbilityBoost: [], // Accept any talent type for ability boost selection
        humanGenericTalent: ["generic"], // Generic talents only
        terranAbilityBoost: [], // Accept any talent type for ability boost selection
        terranGenericTalent: ["generic"] // Generic talents only
      };

      // Check if the slot has specific category requirements
      if (validCategories[slotType] && validCategories[slotType].length > 0) {
        if (!validCategories[slotType].includes(itemCategory)) {
          const categoryNames = {
            phenotype: "phenotype",
            subtype: "subtype",
            background: "background",
            powerset: "powerset",
            generic: "generic talent",
            powersetTalent: "powerset talent"
          };
          const expectedCategory = validCategories[slotType].map(cat => categoryNames[cat] || cat).join(" or ");
          console.warn(`Singularity | Validation failed - Expected: ${expectedCategory}, Got: ${itemCategory || "unknown"}`);
          ui.notifications.warn(`This slot only accepts ${expectedCategory} items. The dropped item "${item.name}" is a ${categoryNames[itemCategory] || itemCategory || "unknown type"}. Please check the item's type in its details.`);
          return false;
        }
      }

      // Store the item UUID (for compendium items) or ID (for owned items)
      const levelKey = `level${level}`;
      const itemReference = item.uuid || item.id;
      
      // Also store item name and img for display
      const updateData = {
        [`system.progression.${levelKey}.${slotType}`]: itemReference,
        [`system.progression.${levelKey}.${slotType}Name`]: item.name,
        [`system.progression.${levelKey}.${slotType}Img`]: item.img
      };
      
      // If dropping phenotype, also update the header field
      if (slotType === "phenotype") {
        updateData["system.basic.phenotype"] = item.name;
      }
      // If dropping subtype, also update the header field
      if (slotType === "subtype") {
        updateData["system.basic.subtype"] = item.name;
      }
      
      await this.actor.update(updateData);
      this.render();
      return false;
    }

    // Default behavior for other drops
    return super._onDropItem(event, data);
  }

  async _onProgressionItemClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Don't do anything if clicking the delete button
    if ($(event.target).closest(".slot-delete").length) {
      return;
    }
    
    const itemId = $(event.currentTarget).data("item-id");
    if (!itemId) {
      return;
    }
    
    // Check if clicking on the icon (picture) or the name
    const isIconClick = $(event.target).hasClass("item-icon") || $(event.target).closest(".item-icon").length;
    const isNameClick = $(event.target).hasClass("item-name") || $(event.target).closest(".item-name").length;
    
    try {
      // Get the item from its UUID (could be compendium or world item)
      const item = await fromUuid(itemId);
      if (!item) {
        ui.notifications.warn("Could not find item details.");
        return;
      }
      
      if (isIconClick) {
        // Send item to chat
        const content = await renderTemplate("systems/singularity/templates/chat/item-card.html", {
          item: item,
          actor: this.actor
        });
        
        await ChatMessage.create({
          content: content,
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          type: CONST.CHAT_MESSAGE_TYPES.OTHER
        });
      } else if (isNameClick || (!isIconClick && !isNameClick)) {
        // Open item sheet (default behavior if clicking elsewhere on the slot-item)
        if (item.sheet) {
          item.sheet.render(true);
        } else {
          ui.notifications.warn("Could not open item details.");
        }
      }
    } catch (error) {
      console.error("Singularity | Error handling item click:", error);
      ui.notifications.error("Error handling item action.");
    }
  }

  async _onTalentSlotClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Don't open dialog if clicking the delete button
    if ($(event.target).closest(".slot-delete").length) {
      return;
    }
    
    // Don't open dialog if clicking on talent detail select (dropdown)
    if ($(event.target).closest(".talent-detail-select").length) {
      return;
    }
    
    // Don't open dialog if slot already has an item
    if ($(event.currentTarget).find(".slot-item").length) {
      return;
    }
    
    const level = parseInt($(event.currentTarget).data("level"));
    const slotType = $(event.currentTarget).data("slot-type");
    
    if (!level || !slotType) {
      return;
    }
    
    // Open talent selection dialog
    await this._openTalentSelectionDialog(level, slotType);
  }

  async _openTalentSelectionDialog(level, slotType) {
    // Get talents from the talents compendium
    const talentsPack = game.packs.get("singularity.talents");
    if (!talentsPack) {
      ui.notifications.error("Talents compendium not found!");
      return;
    }
    
    // Collect all already-selected talents from all progression slots
    const selectedTalents = new Map(); // Map of talent name -> { variations: Set, counts: number }
    const progression = this.actor.system.progression || {};
    
    // Helper function to add a selected talent
    const addSelectedTalent = (talentName, variation = null) => {
      if (!talentName) return;
      const normalizedName = talentName.toLowerCase().trim();
      if (!selectedTalents.has(normalizedName)) {
        selectedTalents.set(normalizedName, { variations: new Set(), count: 0 });
      }
      const entry = selectedTalents.get(normalizedName);
      entry.count++;
      if (variation) {
        entry.variations.add(variation.toLowerCase().trim());
      }
    };
    
    // Check all progression slots for selected talents
    for (let lvl = 1; lvl <= 20; lvl++) {
      const levelKey = `level${lvl}`;
      const levelData = progression[levelKey] || {};
      
      // Check generic talents
      if (levelData.genericTalentName) {
        addSelectedTalent(levelData.genericTalentName);
      }
      
      // Check human generic talent
      if (levelData.humanGenericTalentName) {
        // For Blast, check the damage type from the attack
        if (levelData.humanGenericTalentName.toLowerCase().includes("blast")) {
          const attacks = this.actor.system.attacks || [];
          const blastAttack = attacks.find(a => a.name === "Blast");
          if (blastAttack && blastAttack.damageType) {
            addSelectedTalent(levelData.humanGenericTalentName, blastAttack.damageType);
          } else {
            addSelectedTalent(levelData.humanGenericTalentName);
          }
        } else {
          addSelectedTalent(levelData.humanGenericTalentName);
        }
      }
      
      // Check terran generic talent
      if (levelData.terranGenericTalentName) {
        // For Blast, check the damage type from the attack
        if (levelData.terranGenericTalentName.toLowerCase().includes("blast")) {
          const attacks = this.actor.system.attacks || [];
          const blastAttack = attacks.find(a => a.name === "Blast");
          if (blastAttack && blastAttack.damageType) {
            addSelectedTalent(levelData.terranGenericTalentName, blastAttack.damageType);
          } else {
            addSelectedTalent(levelData.terranGenericTalentName);
          }
        } else {
          addSelectedTalent(levelData.terranGenericTalentName);
        }
      }
      
      // Check powerset talents
      if (levelData.powersetTalentName) {
        addSelectedTalent(levelData.powersetTalentName);
      }
      
      // Check bastion talent
      if (levelData.bastionTalentName) {
        // For Bastion's Resistance, check the resistance type
        if (levelData.bastionTalentName.toLowerCase().includes("resistance")) {
          const resistances = this.actor.system.resistances || [];
          const bastionResistances = resistances.filter(r => r.source === "Bastion's Resistance");
          for (const res of bastionResistances) {
            addSelectedTalent(levelData.bastionTalentName, res.type);
          }
        } else {
          addSelectedTalent(levelData.bastionTalentName);
        }
      }
    }
    
    // Also check embedded items for Saving Throw Training, Skill Training, Weapon Training
    for (const item of this.actor.items) {
      if (item.type === "talent") {
        const talentName = item.name || "";
        const normalizedName = talentName.toLowerCase().trim();
        
        // For Saving Throw Training, check which saving throw is at Apprentice rank
        if (normalizedName.includes("saving throw") && normalizedName.includes("apprentice")) {
          const savingThrows = this.actor.system.savingThrows || {};
          for (const [ability, st] of Object.entries(savingThrows)) {
            if (st.rank === "Apprentice") {
              addSelectedTalent(talentName, ability);
            }
          }
        }
        
        // For Skill Training, check which skill is trained
        if (normalizedName.includes("skill training") && normalizedName.includes("apprentice")) {
          const skills = this.actor.system.skills || {};
          for (const [skillName, skill] of Object.entries(skills)) {
            if (skill.rank === "Apprentice" || skill.rank === "Competent" || skill.rank === "Masterful" || skill.rank === "Legendary") {
              addSelectedTalent(talentName, skillName);
            }
          }
        }
        
        // For Weapon Training, check which weapon type is trained
        if (normalizedName.includes("weapon training")) {
          // This would need to check weapon proficiencies - for now, just track by name
          addSelectedTalent(talentName);
        }
      }
    }
    
    // Get the index of all talents (store for use in render callback)
    const index = await talentsPack.getIndex();
    let allTalents = Array.from(index.values());
    
    // Filter talents based on slot type
    if (slotType === "bastionTalent") {
      // Filter for Bastion talents only
      const bastionTalents = [];
      for (const talentIndex of allTalents) {
        try {
          const talentDoc = await talentsPack.getDocument(talentIndex._id);
          if (talentDoc && talentDoc.system?.basic?.type === "bastion") {
            bastionTalents.push(talentIndex);
          }
        } catch (err) {
          // If we can't get the document, fall back to name matching
          const name = (talentIndex.name || "").toLowerCase();
          const bastionTalentNames = [
        "bastion's resistance", "bastions resistance", "bastion resistance",
        "enlarged presence", "ironbound", "protect the weak",
        "defensive stance", "increased resistance", "intercept attack",
        "regenerative fortitude", "protective barrier"
      ];
          if (name.includes("bastion") || 
              bastionTalentNames.some(btName => name.includes(btName.toLowerCase()))) {
            bastionTalents.push(talentIndex);
          }
        }
      }
      allTalents = bastionTalents;
    } else if (slotType === "paragonTalent") {
      // Filter for Paragon talents only
      const paragonTalents = [];
      for (const talentIndex of allTalents) {
        try {
          const talentDoc = await talentsPack.getDocument(talentIndex._id);
          if (talentDoc && talentDoc.system?.basic?.type === "paragon") {
            paragonTalents.push(talentIndex);
          }
        } catch (err) {
          // If we can't get the document, fall back to name matching
          const name = (talentIndex.name || "").toLowerCase();
          const paragonTalentNames = [
            "dominating presence", "impact control", "noble presence", "supersonic moment",
            "crushing blow", "enhanced flight", "improved impact control", "space breathing",
            "aerial evasion", "aerial maneuverability", "breakers force", "meteor slam",
            "shockwave landing", "unbreakable will", "improved supersonic moment", "thunderclap",
            "inspiring presence", "legendary presence", "aerial mastery", "reinforced breaker",
            "improved meteor slam", "overwhelming presence", "perfect flight", "unstoppable force",
            "apex predator", "hard breaker", "ultimate impact", "colossal slam", "supreme velocity",
            "legendary impact", "transcendent presence", "ultimate breaker", "worldbreaker"
          ];
          if (name.includes("paragon") || 
              paragonTalentNames.some(ptName => name.includes(ptName.toLowerCase()))) {
            paragonTalents.push(talentIndex);
          }
        }
      }
      allTalents = paragonTalents;
    } else if (slotType === "gadgeteerTalent") {
      // Filter for Gadgeteer talents only
      const gadgeteerTalents = [];
      for (const talentIndex of allTalents) {
        try {
          const talentDoc = await talentsPack.getDocument(talentIndex._id);
          if (talentDoc && talentDoc.system?.basic?.type === "gadgeteer") {
            gadgeteerTalents.push(talentIndex);
          }
        } catch (err) {
          // If we can't get the document, fall back to name matching
          const name = (talentIndex.name || "").toLowerCase();
          const gadgeteerTalentNames = [
            "enough prep time", "expanded loadout", "improvised gadget",
            "rapid deployment", "improved improvisation", "gadget mastery",
            "rapid preparation", "reliable gadgets", "advanced loadout",
            "gadget efficiency", "gadget overcharge", "multiple preparations",
            "superior engineering", "gadget synergy", "sustained tuning",
            "gadget arsenal", "master improvisation", "ultimate preparation"
          ];
          if (name.includes("gadgeteer") || 
              gadgeteerTalentNames.some(gtName => name.includes(gtName.toLowerCase()))) {
            gadgeteerTalents.push(talentIndex);
          }
        }
      }
      allTalents = gadgeteerTalents;
    } else if (slotType === "marksmanTalent") {
      // Filter for Marksman talents only
      const marksmanTalents = [];
      for (const talentIndex of allTalents) {
        try {
          const talentDoc = await talentsPack.getDocument(talentIndex._id);
          if (talentDoc && talentDoc.system?.basic?.type === "marksman") {
            marksmanTalents.push(talentIndex);
          }
        } catch (err) {
          // If we can't get the document, fall back to name matching
          const name = (talentIndex.name || "").toLowerCase();
          const marksmanTalentNames = [
            "deadeye", "quickdraw", "suppressive fire",
            "fast reload", "stabilized movement",
            "surgical precision",
            "improved deadeye", "trick shot",
            "rapid fire", "specialized ammunition",
            "enhanced precision", "tripoint trauma",
            "lightning reload", "perfect aim", "ricochet shot",
            "master marksman", "pinpoint accuracy",
            "versatile arsenal",
            "deadly focus", "master ricochet", "penetrating shot",
            "unerring aim",
            "impossible shot", "perfect shot"
          ];
          if (name.includes("marksman") || 
              marksmanTalentNames.some(mtName => name.includes(mtName.toLowerCase()))) {
            marksmanTalents.push(talentIndex);
          }
        }
      }
      allTalents = marksmanTalents;
    } else if (slotType === "genericTalent" || slotType === "humanGenericTalent" || slotType === "terranGenericTalent") {
      // Filter OUT Bastion and Paragon talents for generic talent slots
      const genericTalents = [];
      const bastionTalentNames = [
        "bastion's resistance", "bastions resistance", "bastion resistance",
        "enlarged presence", "ironbound", "protect the weak",
        "defensive stance", "increased resistance", "intercept attack",
        "regenerative fortitude", "protective barrier"
      ];
      const paragonTalentNames = [
        "dominating presence", "impact control", "noble presence", "supersonic moment",
        "crushing blow", "enhanced flight", "improved impact control", "space breathing",
        "aerial evasion", "aerial maneuverability", "breakers force", "meteor slam",
        "shockwave landing", "unbreakable will", "improved supersonic moment", "thunderclap",
        "inspiring presence", "legendary presence", "aerial mastery", "reinforced breaker",
        "improved meteor slam", "overwhelming presence", "perfect flight", "unstoppable force",
        "apex predator", "hard breaker", "ultimate impact", "colossal slam", "supreme velocity",
        "legendary impact", "transcendent presence", "ultimate breaker", "worldbreaker"
      ];
      
      const marksmanTalentNames = [
        "deadeye", "quickdraw", "suppressive fire",
        "fast reload", "stabilized movement",
        "surgical precision",
        "improved deadeye", "trick shot",
        "rapid fire", "specialized ammunition",
        "enhanced precision", "tripoint trauma",
        "lightning reload", "perfect aim", "ricochet shot",
        "master marksman", "pinpoint accuracy",
        "versatile arsenal",
        "deadly focus", "master ricochet", "penetrating shot",
        "unerring aim",
        "impossible shot", "perfect shot"
      ];
      const gadgeteerTalentNames = [
        "enough prep time", "expanded loadout", "improvised gadget",
        "rapid deployment", "improved improvisation", "gadget mastery",
        "rapid preparation", "reliable gadgets", "advanced loadout",
        "gadget efficiency", "gadget overcharge", "multiple preparations",
        "superior engineering", "gadget synergy", "sustained tuning",
        "gadget arsenal", "master improvisation", "ultimate preparation"
      ];
      
      for (const talentIndex of allTalents) {
        try {
          const talentDoc = await talentsPack.getDocument(talentIndex._id);
          // Exclude talents with type "bastion", "paragon", "gadgeteer", or "marksman"
          if (talentDoc && talentDoc.system?.basic?.type !== "bastion" && 
              talentDoc.system?.basic?.type !== "paragon" && 
              talentDoc.system?.basic?.type !== "gadgeteer" &&
              talentDoc.system?.basic?.type !== "marksman") {
            genericTalents.push(talentIndex);
          }
        } catch (err) {
          // If we can't get the document, fall back to name matching
          const name = (talentIndex.name || "").toLowerCase();
          const isBastionTalent = name.includes("bastion") || 
              bastionTalentNames.some(btName => name.includes(btName.toLowerCase()));
          const isParagonTalent = name.includes("paragon") || 
              paragonTalentNames.some(ptName => name.includes(ptName.toLowerCase()));
          const isGadgeteerTalent = name.includes("gadgeteer") || 
              gadgeteerTalentNames.some(gtName => name.includes(gtName.toLowerCase()));
          const isMarksmanTalent = name.includes("marksman") || 
              marksmanTalentNames.some(mtName => name.includes(mtName.toLowerCase()));
          if (!isBastionTalent && !isParagonTalent && !isGadgeteerTalent && !isMarksmanTalent) {
            genericTalents.push(talentIndex);
          }
        }
      }
      allTalents = genericTalents;
    }
    
    // Group talents by level (for now, all are Level 1, but prepare for future)
    // In the future, we can check talent.system.level or similar
    const talentsByLevel = {};
    const availableLevels = [];
    
    // Process all talents and group by level
    for (const talent of allTalents) {
      // For now, assume all talents are Level 1 unless specified
      // Later: const talentLevel = talent.system?.level || 1;
      const talentLevel = 1; // Default to Level 1 for now
      
      if (!talentsByLevel[talentLevel]) {
        talentsByLevel[talentLevel] = [];
      }
      talentsByLevel[talentLevel].push({
        ...talent,
        level: talentLevel
      });
    }
    
    // Create level filter list
    for (let lvl = 1; lvl <= 20; lvl++) {
      const count = talentsByLevel[lvl]?.length || 0;
      if (count > 0 || lvl === level) { // Show level if it has talents or is the current level
        availableLevels.push({
          level: lvl,
          count: count,
          selected: lvl === level
        });
      }
    }
    
    // Sort talents alphabetically by name
    const sortTalents = (talents) => {
      return talents.sort((a, b) => {
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB);
      });
    };
    
    // Get talents for the selected level and sort them
    const selectedLevelTalents = sortTalents(talentsByLevel[level] || []);
    
    if (selectedLevelTalents.length === 0) {
      ui.notifications.warn(`No talents available for Level ${level}.`);
      return;
    }
    
    // Create dialog content
    const content = await renderTemplate("systems/singularity/templates/dialogs/talent-selection.html", {
      level: level,
      slotType: slotType,
      talents: selectedLevelTalents,
      availableLevels: availableLevels
    });
    
    // Create and show dialog
    // Use a plain string title to avoid Foundry's localization/actor type formatting
          let dialogTitle = `Select Talent (Level ${level})`;
          if (slotType === "bastionTalent") {
            dialogTitle = `Select Bastion Talent (Level ${level})`;
          } else if (slotType === "paragonTalent") {
            dialogTitle = `Select Paragon Talent (Level ${level})`;
          } else if (slotType === "gadgeteerTalent") {
            dialogTitle = `Select Gadgeteer Talent (Level ${level})`;
          } else if (slotType === "marksmanTalent") {
            dialogTitle = `Select Marksman Talent (Level ${level})`;
          }
    
    // Create dialog with explicit title - use a unique ID to track it
    const dialogId = `talent-dialog-${Date.now()}`;
    
    // Create dialog data object with explicit title
    const dialogData = {
      title: dialogTitle,
      content: content,
      buttons: {
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "cancel",
      render: (html) => {
        // Store references for use in callbacks
        const self = this;
        const originalLevel = level;
        
        // Immediately fix the title in the HTML before Foundry can change it
        const $html = $(html);
        const dialogWindow = $html.closest('.window-app');
        if (dialogWindow.length) {
          dialogWindow.attr('data-dialog-id', dialogId);
          // Set dialog width to 1200px
          dialogWindow.css({
            'width': '1200px',
            'min-width': '1200px',
            'max-width': '1200px'
          });
          // Find and replace the title immediately
          const titleElements = dialogWindow.find('.window-header .window-title, h4.window-title, .window-title, .window-header h4');
          titleElements.each(function() {
            $(this).text(dialogTitle).html(dialogTitle);
          });
        }
        
        // Also fix in the html directly
        $html.find('.window-title, h4').each(function() {
          $(this).text(dialogTitle).html(dialogTitle);
        });
        
        // Force set the title and width multiple times to catch Foundry's override
        const setTitleAndWidth = () => {
          const allDialogs = $('.window-app[data-dialog-id="' + dialogId + '"], .window-app.dialog');
          allDialogs.each(function() {
            const $dialog = $(this);
            // Set width if this is a talent selection dialog
            if ($dialog.find('.talent-selection-dialog').length) {
              $dialog.css({
                'width': '1200px',
                'min-width': '1200px',
                'max-width': '1200px'
              });
            }
            // Set title
            const titleSelectors = [
              '.window-header .window-title',
              'h4.window-title',
              '.window-title',
              '.window-header h4',
              'header h4'
            ];
            titleSelectors.forEach(selector => {
              const titleElement = $dialog.find(selector);
              if (titleElement.length) {
                const currentTitle = titleElement.text();
                // Replace if it contains TYPES or looks like a localization key
                if (currentTitle.includes('TYPES.') || currentTitle.includes('Actor.')) {
                  titleElement.text(dialogTitle);
                  titleElement.html(dialogTitle); // Also set HTML
                }
              }
            });
          });
        };
        
        // Set title and width multiple times with different delays
        setTimeout(setTitleAndWidth, 0);
        setTimeout(setTitleAndWidth, 10);
        setTimeout(setTitleAndWidth, 50);
        setTimeout(setTitleAndWidth, 100);
        setTimeout(setTitleAndWidth, 200);
        
        // Helper function to update talent list
        const updateTalentList = async (selectedLevel) => {
          // Get all talents for the selected level
          const talentsByLevel = {};
          let allTalents = Array.from(index.values());
          
          // Filter for Bastion talents if this is a bastionTalent slot
          if (slotType === "bastionTalent") {
            // Filter by type "bastion" if available, otherwise fall back to name matching
            const bastionTalents = [];
            for (const talentIndex of allTalents) {
              try {
                const talentDoc = await talentsPack.getDocument(talentIndex._id);
                if (talentDoc && talentDoc.system?.basic?.type === "bastion") {
                  bastionTalents.push(talentIndex);
                }
              } catch (err) {
                // If we can't get the document, fall back to name matching
                const name = (talentIndex.name || "").toLowerCase();
                const bastionTalentNames = [
                  "bastion's resistance", "bastions resistance", "bastion resistance",
                  "enlarged presence", "ironbound", "protect the weak",
                  "defensive stance", "increased resistance", "intercept attack",
                  "regenerative fortitude", "protective barrier"
                ];
                if (name.includes("bastion") || 
                    bastionTalentNames.some(btName => name.includes(btName.toLowerCase()))) {
                  bastionTalents.push(talentIndex);
                }
              }
            }
            allTalents = bastionTalents;
          } else if (slotType === "genericTalent" || slotType === "humanGenericTalent" || slotType === "terranGenericTalent") {
            // Filter OUT Bastion talents for generic talent slots
            const genericTalents = [];
            const bastionTalentNames = [
              "bastion's resistance", "bastions resistance", "bastion resistance",
              "enlarged presence", "ironbound", "protect the weak",
              "defensive stance", "increased resistance", "intercept attack",
              "regenerative fortitude", "protective barrier"
            ];
            
            for (const talentIndex of allTalents) {
              try {
                const talentDoc = await talentsPack.getDocument(talentIndex._id);
                // Exclude talents with type "bastion"
                if (talentDoc && talentDoc.system?.basic?.type !== "bastion") {
                  genericTalents.push(talentIndex);
                }
              } catch (err) {
                // If we can't get the document, fall back to name matching
                const name = (talentIndex.name || "").toLowerCase();
                const isBastionTalent = name.includes("bastion") || 
                    bastionTalentNames.some(btName => name.includes(btName.toLowerCase()));
                if (!isBastionTalent) {
                  genericTalents.push(talentIndex);
                }
              }
            }
            allTalents = genericTalents;
          }
          
          for (const talent of allTalents) {
            const talentName = talent.name || "";
            const normalizedName = talentName.toLowerCase().trim();
            
            // Check if this talent is already selected
            if (selectedTalents.has(normalizedName)) {
              const entry = selectedTalents.get(normalizedName);
              
              // Special handling for talents that can be taken multiple times with different variations
              const canRepeatWithVariations = 
                normalizedName.includes("saving throw") && normalizedName.includes("apprentice") ||
                normalizedName.includes("skill training") && normalizedName.includes("apprentice") ||
                normalizedName.includes("weapon training") ||
                normalizedName.includes("blast");
              
              if (canRepeatWithVariations) {
                // Allow this talent to show - the user can select a different variation
                // (The actual variation checking happens when they select it)
              } else {
                // Skip this talent - it's already selected and can't be repeated
                continue;
              }
            }
            
            const talentLevel = 1; // Default to Level 1 for now
            if (!talentsByLevel[talentLevel]) {
              talentsByLevel[talentLevel] = [];
            }
            talentsByLevel[talentLevel].push({
              ...talent,
              level: talentLevel
            });
          }
          
          // Sort talents alphabetically
          const sortTalents = (talents) => {
            return talents.sort((a, b) => {
              const nameA = a.name || "";
              const nameB = b.name || "";
              return nameA.localeCompare(nameB);
            });
          };
          
          const filteredTalents = sortTalents(talentsByLevel[selectedLevel] || []);
          
          // Update the talent list
          const talentList = html.find(".talent-list");
          talentList.empty();
          
          if (filteredTalents.length === 0) {
            talentList.append(`<p style="color: #a0aec0; padding: 20px; text-align: center;">No talents available for Level ${selectedLevel}.</p>`);
          } else {
            filteredTalents.forEach(talent => {
              const talentItem = $(`
                <div class="talent-item" data-talent-id="${talent._id}" data-talent-level="${talent.level}">
                  <img class="talent-icon" src="${talent.img || 'icons/svg/mystery-man.svg'}" alt="${talent.name}" onerror="this.src='icons/svg/mystery-man.svg'">
                  <div class="talent-info">
                    <div class="talent-name">${talent.name}</div>
                  </div>
                </div>
              `);
              talentList.append(talentItem);
            });
          }
          
          // Re-attach click handlers to new items
          attachTalentClickHandlers(html, originalLevel, slotType, talentsPack, dialog, self);
        };
        
        // Helper function to attach click handlers
        const attachTalentClickHandlers = (html, slotLevel, slotType, pack, dialog, self) => {
          html.find(".talent-item").off("click").on("click", async (event) => {
            const talentId = $(event.currentTarget).data("talent-id");
            const talentUuid = `Compendium.singularity.talents.${talentId}`;
            
            // Get the full talent document
            const talent = await pack.getDocument(talentId);
            if (!talent) {
              ui.notifications.error("Talent not found!");
              return;
            }
            
            // Check if this talent is already selected
            const talentName = talent.name || "";
            const normalizedName = talentName.toLowerCase().trim();
            const isSelected = selectedTalents.has(normalizedName);
            
            if (isSelected) {
              // Check if this is a repeatable talent with variations
              const canRepeatWithVariations = 
                normalizedName.includes("saving throw") && normalizedName.includes("apprentice") ||
                normalizedName.includes("skill training") && normalizedName.includes("apprentice") ||
                normalizedName.includes("weapon training") ||
                normalizedName.includes("blast");
              
              if (!canRepeatWithVariations) {
                ui.notifications.warn(`You have already selected "${talentName}".`);
                return;
              }
              
              // For repeatable talents, continue - the variation will be checked in their respective dialogs
              // (e.g., Blast checks damage type, Saving Throw checks ability)
            }
            
            // Update the progression slot (use original slot level, not filtered level)
            const levelKey = `level${slotLevel}`;
            const updateData = {
              [`system.progression.${levelKey}.${slotType}`]: talentUuid,
              [`system.progression.${levelKey}.${slotType}Name`]: talent.name,
              [`system.progression.${levelKey}.${slotType}Img`]: talent.img || "icons/svg/mystery-man.svg"
            };
            
            await self.actor.update(updateData);
            
            // If this is a Paragon talent that grants skill bonuses, add the skill
            if (slotType === "paragonTalent") {
              const talentNameLower = talent.name.toLowerCase();
              const skills = foundry.utils.deepClone(self.actor.system.skills || {});
              let skillsUpdated = false;
              
              // If selecting Dominating Presence, add Intimidation skill
              if (talentNameLower.includes("dominating") && talentNameLower.includes("presence")) {
                if (!skills["Intimidation"] || skills["Intimidation"].lockedSource !== "Dominating Presence") {
                  skills["Intimidation"] = {
                    rank: "Novice",
                    ability: "charm",
                    otherBonuses: 4, // +4 bonus while flying
                    lockedOtherBonuses: true,
                    lockedSource: "Dominating Presence"
                  };
                  skillsUpdated = true;
                }
              }
              
              // If selecting Noble Presence, add Persuasion skill
              if (talentNameLower.includes("noble") && talentNameLower.includes("presence")) {
                if (!skills["Persuasion"] || skills["Persuasion"].lockedSource !== "Noble Presence") {
                  skills["Persuasion"] = {
                    rank: "Novice",
                    ability: "charm",
                    otherBonuses: 4, // +4 bonus while flying
                    lockedOtherBonuses: true,
                    lockedSource: "Noble Presence"
                  };
                  skillsUpdated = true;
                }
              }
              
              if (skillsUpdated) {
                await self.actor.update({ "system.skills": skills });
              }
            }
            
            // If this is the Blast talent, show attack configuration dialog
            if (talent.name === "Blast (Apprentice)" || talent.name.includes("Blast")) {
              // Wait a moment for the update to complete, then show the Blast configuration dialog
              setTimeout(() => {
                self._showBlastAttackDialog();
              }, 100);
            }
            
            // If this is Initiative Training, update initiative rank
            if (talent.name && talent.name.toLowerCase().includes("initiative training")) {
              let newRank = "Novice";
              if (talent.name.toLowerCase().includes("apprentice")) {
                newRank = "Apprentice";
              } else if (talent.name.toLowerCase().includes("competent")) {
                newRank = "Competent";
              } else if (talent.name.toLowerCase().includes("masterful")) {
                newRank = "Masterful";
              } else if (talent.name.toLowerCase().includes("legendary")) {
                newRank = "Legendary";
              }
              
              const initiative = foundry.utils.deepClone(self.actor.system.combat.initiative || { rank: "Novice", otherBonuses: 0 });
              initiative.rank = newRank;
              
              await self.actor.update({ "system.combat.initiative": initiative });
              ui.notifications.info(`Initiative proficiency set to ${newRank}!`);
            }
            
            // If this is Bastion's Resistance, show resistance selection dialog
            const talentNameLower = (talent.name || "").toLowerCase();
            if (talentNameLower.includes("bastion") && talentNameLower.includes("resistance")) {
              // Wait a moment for the update to complete, then show the resistance selection dialog
              setTimeout(() => {
                self._showBastionResistanceDialog();
              }, 100);
            }
            
            // If this is Saving Throw Training (Apprentice), no dialog needed - user can select from dropdown in progression table
            
            // If this is Enlarged Presence, set size to Large
            if (talentNameLower.includes("enlarged") && talentNameLower.includes("presence")) {
              const currentSize = self.actor.system.basic.size || "Medium";
              // Only update if not already Large (to preserve if it was manually set)
              if (currentSize !== "Large") {
                await self.actor.update({ "system.basic.size": "Large" });
              }
            }
            
            self.render();
            
            // Close the dialog
            dialog.close();
          });
        };
        
        // Handle level filter changes
        html.find('input[name="levelFilter"]').on("change", async (event) => {
          const selectedLevel = parseInt(event.target.value);
          await updateTalentList(selectedLevel);
        });
        
        // Attach initial click handlers
        attachTalentClickHandlers(html, originalLevel, slotType, talentsPack, dialog, self);
      }
    };
    
    const dialog = new Dialog(dialogData);
    
    // Store the correct title on the dialog IMMEDIATELY after creation
    dialog._singularityDialogTitle = dialogTitle;
    // Also store it in the data object
    if (dialog.data) {
      dialog.data.title = dialogTitle;
    }
    
    dialog.render(true);
  }

  async _onPhenotypeSlotClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Don't open dialog if clicking the delete button
    if ($(event.target).closest(".slot-delete").length) {
      return;
    }
    
    // Don't open dialog if slot already has an item
    if ($(event.currentTarget).find(".slot-item").length) {
      return;
    }
    
    const level = parseInt($(event.currentTarget).data("level"));
    const slotType = $(event.currentTarget).data("slot-type");
    
    if (!level || !slotType) {
      return;
    }
    
    // Open phenotype selection dialog
    await this._openItemSelectionDialog(level, slotType, "phenotypes", "Phenotype");
  }

  async _onSubtypeSlotClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Don't open dialog if clicking the delete button
    if ($(event.target).closest(".slot-delete").length) {
      return;
    }
    
    // Don't open dialog if slot already has an item
    if ($(event.currentTarget).find(".slot-item").length) {
      return;
    }
    
    const level = parseInt($(event.currentTarget).data("level"));
    const slotType = $(event.currentTarget).data("slot-type");
    
    if (!level || !slotType) {
      return;
    }
    
    // Check if phenotype is selected first
    const phenotypeId = this.actor.system.progression?.level1?.phenotype;
    const phenotypeName = this.actor.system.progression?.level1?.phenotypeName || this.actor.system.basic?.phenotype;
    
    if (!phenotypeId && !phenotypeName) {
      ui.notifications.warn("Please choose a Phenotype first before selecting a Subtype.");
      return;
    }
    
    // Open subtype selection dialog
    await this._openItemSelectionDialog(level, slotType, "subtypes", "Subtype", phenotypeName);
  }

  async _onBackgroundSlotClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Don't open dialog if clicking the delete button
    if ($(event.target).closest(".slot-delete").length) {
      return;
    }
    
    // Don't open dialog if slot already has an item
    if ($(event.currentTarget).find(".slot-item").length) {
      return;
    }
    
    const level = parseInt($(event.currentTarget).data("level"));
    const slotType = $(event.currentTarget).data("slot-type");
    
    if (!level || !slotType) {
      return;
    }
    
    // Open background selection dialog
    await this._openItemSelectionDialog(level, slotType, "backgrounds", "Background");
  }

  async _onPowersetSlotClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Don't open dialog if clicking the delete button
    if ($(event.target).closest(".slot-delete").length) {
      return;
    }
    
    // Don't open dialog if slot already has an item
    if ($(event.currentTarget).find(".slot-item").length) {
      return;
    }
    
    const level = parseInt($(event.currentTarget).data("level"));
    const slotType = $(event.currentTarget).data("slot-type");
    
    if (!level || !slotType) {
      return;
    }
    
    // Open powerset selection dialog
    await this._openItemSelectionDialog(level, slotType, "powersets", "Powerset");
  }

  async _openItemSelectionDialog(level, slotType, compendiumName, itemTypeLabel, filterPhenotype = null) {
    // Get items from the compendium
    const pack = game.packs.get(`singularity.${compendiumName}`);
    if (!pack) {
      ui.notifications.error(`${itemTypeLabel} compendium not found!`);
      return;
    }
    
    // Get the index of all items
    const index = await pack.getIndex();
    const allItems = Array.from(index.values());
    
    // Filter items if needed (e.g., subtypes by phenotype)
    let availableItems = allItems;
    if (filterPhenotype && compendiumName === "subtypes") {
      // Filter subtypes by phenotype prerequisite
      availableItems = allItems.filter(item => {
        const prerequisites = item.system?.basic?.prerequisites || "";
        if (!prerequisites) return true; // No prerequisite, show it
        // Check if the phenotype matches the prerequisite (case-insensitive)
        return prerequisites.toLowerCase().split(/[,\s]+/).some(prereq => 
          prereq === filterPhenotype.toLowerCase()
        );
      });
    }
    
    if (availableItems.length === 0) {
      ui.notifications.warn(`No ${itemTypeLabel.toLowerCase()}s available.`);
      return;
    }
    
    // Sort items alphabetically by name
    const sortItems = (items) => {
      return items.sort((a, b) => {
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB);
      });
    };
    
    const sortedItems = sortItems(availableItems);
    
    // Create dialog content using a generic template
    const content = await renderTemplate("systems/singularity/templates/dialogs/item-selection.html", {
      level: level,
      slotType: slotType,
      items: sortedItems,
      itemTypeLabel: itemTypeLabel
    });
    
    // Create and show dialog
    // Use a plain string title to avoid Foundry's localization/actor type formatting
    const dialogTitle = `Select ${String(itemTypeLabel || "Item")}`;
    
    // Create dialog with explicit title - use a unique ID to track it
    const dialogId = `item-dialog-${Date.now()}`;
    
    const dialog = new Dialog({
      title: dialogTitle,
      content: content,
      buttons: {
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "cancel",
      render: (html) => {
        // Add data attribute to identify this dialog
        const dialogElement = $(html).closest('.window-app');
        if (dialogElement.length) {
          dialogElement.attr('data-dialog-id', dialogId);
        }
        
        // Force set the title multiple times to catch Foundry's override
        const setTitle = () => {
          const allDialogs = $('.window-app[data-dialog-id="' + dialogId + '"], .window-app.dialog');
          allDialogs.each(function() {
            const $dialog = $(this);
            const titleSelectors = [
              '.window-header .window-title',
              'h4.window-title',
              '.window-title',
              '.window-header h4',
              'header h4'
            ];
            titleSelectors.forEach(selector => {
              const titleElement = $dialog.find(selector);
              if (titleElement.length) {
                const currentTitle = titleElement.text();
                // Replace if it contains TYPES or looks like a localization key
                if (currentTitle.includes('TYPES.') || currentTitle.includes('Actor.')) {
                  titleElement.text(dialogTitle);
                  titleElement.html(dialogTitle); // Also set HTML
                }
                
        // Store the title for continuous fixes
        dialog._singularityDialogTitle = dialogTitle;
              }
            });
          });
        };
        
        // Set title multiple times with different delays
        setTimeout(setTitle, 0);
        setTimeout(setTitle, 10);
        setTimeout(setTitle, 50);
        setTimeout(setTitle, 100);
        setTimeout(setTitle, 200);
        
        // Use MutationObserver to watch for title changes and fix them immediately
        setTimeout(() => {
          const allDialogs = $('.window-app[data-dialog-id="' + dialogId + '"], .window-app.dialog');
          allDialogs.each(function() {
            const $dialog = $(this);
            const titleElement = $dialog.find('.window-header .window-title, h4.window-title, .window-title').first();
            if (titleElement.length) {
              const observer = new MutationObserver(() => {
                const currentTitle = titleElement.text();
                if (currentTitle.includes('TYPES.') || currentTitle.includes('Actor.') || currentTitle !== dialogTitle) {
                  titleElement.text(dialogTitle);
                  titleElement.html(dialogTitle);
                }
              });
              observer.observe(titleElement[0], { 
                childList: true, 
                subtree: true, 
                characterData: true 
              });
              
              // Store observer on dialog for cleanup if needed
              $dialog.data('titleObserver', observer);
              
              // Also set up a continuous interval to fix the title (as a fallback)
              const titleFixInterval = setInterval(() => {
                const currentTitle = titleElement.text();
                if (currentTitle.includes('TYPES.') || currentTitle.includes('Actor.') || currentTitle !== dialogTitle) {
                  titleElement.text(dialogTitle);
                  titleElement.html(dialogTitle);
                }
              }, 100);
              
              // Store interval for cleanup
              $dialog.data('titleFixInterval', titleFixInterval);
              
              // Clean up when dialog closes
              $dialog.on('dialog:close', () => {
                if (observer) observer.disconnect();
                if (titleFixInterval) clearInterval(titleFixInterval);
              });
            }
          });
        }, 50);
        
        // Handle item selection
        html.find(".item-selection-item").on("click", async (event) => {
          const itemId = $(event.currentTarget).data("item-id");
          const itemUuid = `Compendium.singularity.${compendiumName}.${itemId}`;
          
          // Get the full item document
          const item = await pack.getDocument(itemId);
          if (!item) {
            ui.notifications.error(`${itemTypeLabel} not found!`);
            return;
          }
          
          // Update the progression slot
          const levelKey = `level${level}`;
          const updateData = {
            [`system.progression.${levelKey}.${slotType}`]: itemUuid,
            [`system.progression.${levelKey}.${slotType}Name`]: item.name,
            [`system.progression.${levelKey}.${slotType}Img`]: item.img || "icons/svg/mystery-man.svg"
          };
          
          // If phenotype, also update the header field
          if (slotType === "phenotype") {
            updateData["system.basic.phenotype"] = item.name;
          }
          // If subtype, also update the header field
          if (slotType === "subtype") {
            updateData["system.basic.subtype"] = item.name;
          }
          // If background, also update the header field
          if (slotType === "background") {
            updateData["system.basic.background"] = item.name;
          }
          // If powerset, also update the header field
          if (slotType === "powerset") {
            updateData["system.basic.powerset"] = item.name;
            
            // If Paragon is selected, clear any "Unarmed Strikes" weapon category selections
            if (item.name === "Paragon") {
              const level1Data = this.actor.system.progression?.level1 || {};
              // Check humanGenericTalentWeaponCategory
              if (level1Data.humanGenericTalentWeaponCategory === "Unarmed Strikes") {
                updateData["system.progression.level1.humanGenericTalentWeaponCategory"] = "";
              }
              // Check terranGenericTalentWeaponCategory
              if (level1Data.terranGenericTalentWeaponCategory === "Unarmed Strikes") {
                updateData["system.progression.level1.terranGenericTalentWeaponCategory"] = "";
              }
              // Check genericTalentWeaponCategory for all levels
              for (let lvl = 1; lvl <= 20; lvl++) {
                const levelKey = `level${lvl}`;
                const levelData = this.actor.system.progression?.[levelKey] || {};
                if (levelData.genericTalentWeaponCategory === "Unarmed Strikes") {
                  updateData[`system.progression.${levelKey}.genericTalentWeaponCategory`] = "";
                }
              }
            }
            
            // If Bastion is selected, apply Bastion benefits
            if (item.name === "Bastion") {
              await this.actor.update(updateData);
              // Apply other Bastion benefits (AC bonus, armor training, etc.)
              await this._applyBastionBenefits();
              this.render();
              dialog.close();
              return;
            }
          }
          
          await this.actor.update(updateData);
          
          this.render();
          
          // Close the dialog
          dialog.close();
        });
      }
    });
    
    // Store the correct title on the dialog IMMEDIATELY after creation
    dialog._singularityDialogTitle = dialogTitle;
    // Also store it in the data object
    if (dialog.data) {
      dialog.data.title = dialogTitle;
    }
    
    dialog.render(true);
  }

  async _onDeleteProgressionSlot(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const level = parseInt($(event.currentTarget).data("level"));
    const slotType = $(event.currentTarget).data("slot-type");
    
    if (!level || !slotType) {
      return;
    }

    const levelKey = `level${level}`;
    const updateData = {
      [`system.progression.${levelKey}.${slotType}`]: null,
      [`system.progression.${levelKey}.${slotType}Name`]: null,
      [`system.progression.${levelKey}.${slotType}Img`]: null
    };
    
    // If deleting phenotype, also clear the header field and related bonuses
    if (slotType === "phenotype") {
      updateData["system.basic.phenotype"] = "";
      
      // If deleting Human phenotype, clear Human-specific bonuses
      const phenotypeName = this.actor.system.progression?.[levelKey]?.phenotypeName;
      if (phenotypeName === "Human" || this.actor.system.basic?.phenotype === "Human") {
        updateData[`system.progression.${levelKey}.humanAbilityBoost`] = null;
        
        // Check if Human had Blast talent before clearing it
        const humanGenericTalentName = this.actor.system.progression?.[levelKey]?.humanGenericTalentName;
        if (humanGenericTalentName && (humanGenericTalentName === "Blast (Apprentice)" || humanGenericTalentName.includes("Blast"))) {
          // Remove the Blast attack if it exists
          const attacks = foundry.utils.deepClone(this.actor.system.attacks || []);
          const blastAttackIndex = attacks.findIndex(attack => attack.name === "Blast");
          if (blastAttackIndex !== -1) {
            attacks.splice(blastAttackIndex, 1);
            updateData["system.attacks"] = attacks;
          }
        }
        
        updateData[`system.progression.${levelKey}.humanGenericTalent`] = null;
        updateData[`system.progression.${levelKey}.humanGenericTalentName`] = null;
        updateData[`system.progression.${levelKey}.humanGenericTalentImg`] = null;
      }
    }
    
    // If deleting subtype, also clear the header field and related bonuses
    if (slotType === "subtype") {
      updateData["system.basic.subtype"] = "";
      
      // If deleting Terran subtype, clear Terran-specific bonuses
      const subtypeName = this.actor.system.progression?.[levelKey]?.subtypeName;
      if (subtypeName === "Terran" || this.actor.system.basic?.subtype === "Terran") {
        updateData[`system.progression.${levelKey}.terranAbilityBoost`] = null;
        
        // Check if Terran had Blast talent before clearing it
        const terranGenericTalentName = this.actor.system.progression?.[levelKey]?.terranGenericTalentName;
        if (terranGenericTalentName && (terranGenericTalentName === "Blast (Apprentice)" || terranGenericTalentName.includes("Blast"))) {
          // Remove the Blast attack if it exists
          const attacks = foundry.utils.deepClone(this.actor.system.attacks || []);
          const blastAttackIndex = attacks.findIndex(attack => attack.name === "Blast");
          if (blastAttackIndex !== -1) {
            attacks.splice(blastAttackIndex, 1);
            updateData["system.attacks"] = attacks;
          }
        }
        
        updateData[`system.progression.${levelKey}.terranGenericTalent`] = null;
        updateData[`system.progression.${levelKey}.terranGenericTalentName`] = null;
        updateData[`system.progression.${levelKey}.terranGenericTalentImg`] = null;
      }
    }
    
    // If deleting a talent slot, check if it's Blast and remove the corresponding attack
    if (slotType === "genericTalent" || slotType === "humanGenericTalent" || slotType === "terranGenericTalent") {
      const talentName = this.actor.system.progression?.[levelKey]?.[`${slotType}Name`];
      
      // If deleting Blast talent, remove the Blast attack
      if (talentName && (talentName === "Blast (Apprentice)" || talentName.includes("Blast"))) {
        const attacks = foundry.utils.deepClone(this.actor.system.attacks || []);
        // Find and remove the Blast attack
        const blastAttackIndex = attacks.findIndex(attack => attack.name === "Blast");
        if (blastAttackIndex !== -1) {
          attacks.splice(blastAttackIndex, 1);
          updateData["system.attacks"] = attacks;
        }
      }
    }
    
    // If deleting a Bastion talent slot, check if it's Bastion's Resistance and remove the corresponding resistance
    if (slotType === "bastionTalent") {
      const talentName = this.actor.system.progression?.[levelKey]?.[`${slotType}Name`];
      const talentNameLower = (talentName || "").toLowerCase();
      
      // If deleting Bastion's Resistance, remove the resistance(s) added by it
      if (talentNameLower.includes("bastion") && talentNameLower.includes("resistance")) {
        const resistances = foundry.utils.deepClone(this.actor.system.resistances || []);
        // Remove all resistances that came from Bastion's Resistance
        const filteredResistances = resistances.filter(r => r.source !== "Bastion's Resistance");
        if (filteredResistances.length !== resistances.length) {
          updateData["system.resistances"] = filteredResistances;
        }
        // Clear the stored damage type
        updateData[`system.progression.${levelKey}.bastionTalentResistanceType`] = null;
      }
      
      // If deleting Enlarged Presence, reset size to Medium (default)
      if (talentNameLower.includes("enlarged") && talentNameLower.includes("presence")) {
        updateData["system.basic.size"] = "Medium";
      }
    }
    
    // If deleting any talent slot, check if it's Initiative Training and reset initiative rank
    if (slotType === "genericTalent" || slotType === "humanGenericTalent" || slotType === "terranGenericTalent" || slotType === "bastionTalent" || slotType === "paragonTalent") {
      const talentName = this.actor.system.progression?.[levelKey]?.[`${slotType}Name`];
      const talentNameLower = (talentName || "").toLowerCase();
      
      // If deleting Saving Throw Training, reset the trained saving throw to Novice
      if (talentNameLower.includes("saving throw") && talentNameLower.includes("apprentice")) {
        const trainedSavingThrow = this.actor.system.progression?.[levelKey]?.[`${slotType}SavingThrow`];
        if (trainedSavingThrow) {
          const savingThrows = foundry.utils.deepClone(this.actor.system.savingThrows || {});
          // Only reset if it's currently at Apprentice (might have been upgraded)
          if (savingThrows[trainedSavingThrow] && savingThrows[trainedSavingThrow].rank === "Apprentice") {
            savingThrows[trainedSavingThrow].rank = "Novice";
            updateData["system.savingThrows"] = savingThrows;
          }
          // Clear the stored saving throw reference
          updateData[`system.progression.${levelKey}.${slotType}SavingThrow`] = null;
        } else {
          // Fallback: if we don't have the stored reference, find any Apprentice saving throw that's not from Bastion
          const savingThrows = foundry.utils.deepClone(this.actor.system.savingThrows || {});
          const bastionSavingThrow = this.actor.system.progression?.level1?.bastionSavingThrow;
          for (const [ability, st] of Object.entries(savingThrows)) {
            if (st.rank === "Apprentice" && ability !== bastionSavingThrow) {
              st.rank = "Novice";
              updateData["system.savingThrows"] = savingThrows;
              break; // Only reset one, in case there are multiple
            }
          }
        }
      }
      
      // If deleting Initiative Training, reset initiative rank to Novice
      if (talentNameLower.includes("initiative") && talentNameLower.includes("training")) {
        const initiative = foundry.utils.deepClone(this.actor.system.combat.initiative || { rank: "Novice", otherBonuses: 0 });
        initiative.rank = "Novice";
        updateData["system.combat.initiative"] = initiative;
      }
      
      // If deleting Paragon talents, remove associated skills
      if (slotType === "paragonTalent") {
        const skills = foundry.utils.deepClone(this.actor.system.skills || {});
        let skillsUpdated = false;
        
        // If deleting Dominating Presence, remove Intimidation skill (if it came from this talent)
        if (talentNameLower.includes("dominating") && talentNameLower.includes("presence")) {
          if (skills["Intimidation"] && skills["Intimidation"].lockedSource === "Dominating Presence") {
            delete skills["Intimidation"];
            skillsUpdated = true;
          }
        }
        
        // If deleting Noble Presence, remove Persuasion skill (if it came from this talent)
        if (talentNameLower.includes("noble") && talentNameLower.includes("presence")) {
          if (skills["Persuasion"] && skills["Persuasion"].lockedSource === "Noble Presence") {
            delete skills["Persuasion"];
            skillsUpdated = true;
          }
        }
        
        if (skillsUpdated) {
          updateData["system.skills"] = skills;
        }
      }
    }
    
    // If deleting background, also clear the header field
    if (slotType === "background") {
      updateData["system.basic.background"] = "";
    }
    
    // If deleting powerset, remove powerset benefits
    if (slotType === "powerset") {
      const powersetName = this.actor.system.progression?.[levelKey]?.powersetName;
      if (powersetName === "Bastion") {
        // Clear Bastion-specific bonuses
        updateData[`system.progression.${levelKey}.bastionAbilityBoost1`] = null;
        updateData[`system.progression.${levelKey}.bastionAbilityBoost2`] = null;
        updateData[`system.progression.${levelKey}.bastionAcBonus`] = null;
        updateData[`system.progression.${levelKey}.bastionTalent`] = null;
        updateData[`system.progression.${levelKey}.bastionTalentName`] = null;
        updateData[`system.progression.${levelKey}.bastionTalentImg`] = null;
        
        // Remove Heavy Armor skill if it was granted by Bastion
        // Check if the skill exists and was likely granted by Bastion (rank is Apprentice)
        const skills = foundry.utils.deepClone(this.actor.system.skills || {});
        if (skills["Heavy Armor"]) {
          // Only remove if it's at Apprentice rank (which is what Bastion grants)
          // If the player somehow got it to a higher rank, we'll still remove it since Bastion grants it
          delete skills["Heavy Armor"];
          updateData["system.skills"] = skills;
          console.log("Singularity | Removed Heavy Armor skill after deleting Bastion");
        }
        
        // Remove Saving Throw Training (Apprentice) talent if it was granted by Bastion
        const savingThrowTalent = this.actor.items.find(item => 
          item.type === "talent" && 
          (item.name === "Saving Throw Training (Apprentice)" || item.name.includes("Saving Throw Training"))
        );
        if (savingThrowTalent) {
          await savingThrowTalent.delete();
        }
        
        // Remove resistances from Bastion's Resistance if it was selected
        const resistances = foundry.utils.deepClone(this.actor.system.resistances || []);
        const filteredResistances = resistances.filter(r => r.source !== "Bastion's Resistance");
        if (filteredResistances.length !== resistances.length) {
          updateData["system.resistances"] = filteredResistances;
          console.log("Singularity | Removed resistances from Bastion's Resistance after deleting Bastion");
        }
        // Clear the stored damage type for Bastion's Resistance
        updateData[`system.progression.${levelKey}.bastionTalentResistanceType`] = null;
        
        // Check if Enlarged Presence was selected and reset size to Medium
        const bastionTalentName = this.actor.system.progression?.[levelKey]?.bastionTalentName || "";
        const talentNameLower = bastionTalentName.toLowerCase();
        if (talentNameLower.includes("enlarged") && talentNameLower.includes("presence")) {
          updateData["system.basic.size"] = "Medium";
          console.log("Singularity | Reset size to Medium after deleting Bastion (Enlarged Presence)");
        }
        
        // Reset the saving throw rank that was set by Bastion
        const selectedSavingThrow = this.actor.system.progression?.[levelKey]?.bastionSavingThrow;
        if (selectedSavingThrow) {
          const savingThrows = foundry.utils.deepClone(this.actor.system.savingThrows || {});
          if (savingThrows[selectedSavingThrow] && savingThrows[selectedSavingThrow].rank === "Apprentice") {
            savingThrows[selectedSavingThrow].rank = "Novice";
            updateData["system.savingThrows"] = savingThrows;
          }
        }
        
        // Clear the saving throw selection
        updateData[`system.progression.${levelKey}.bastionSavingThrow`] = null;
      }
      updateData["system.basic.powerset"] = "";
    }
    
    await this.actor.update(updateData);
    this.render();
  }

  async _onAbilityBoostChange(event) {
    event.preventDefault();
    const select = event.currentTarget;
    const value = select.value;
    const slotType = $(select).closest(".progression-slot").data("slot-type");
    
    // For Bastion ability boosts, validate that Endurance is not selected
    if (slotType === "bastionAbilityBoost1" || slotType === "bastionAbilityBoost2") {
      if (value === "endurance") {
        ui.notifications.warn("Endurance cannot be increased through Bastion ability boosts. The +1 Endurance is already applied automatically.");
        select.value = "";
        return;
      }
    }
    
    // For Paragon ability boosts, validate that Might is not selected
    if (slotType === "paragonAbilityBoost1" || slotType === "paragonAbilityBoost2") {
      if (value === "might") {
        ui.notifications.warn("Might cannot be increased through Paragon ability boosts. The +1 Might is already applied automatically.");
        this.render();
        return;
      }
    }
    
    // For Marksman ability boosts, validate that Agility is not selected
    if (slotType === "marksmanAbilityBoost1" || slotType === "marksmanAbilityBoost2") {
      if (value === "agility") {
        ui.notifications.warn("Agility cannot be increased through Marksman ability boosts. The +1 Agility is already applied automatically.");
        this.render();
        return;
      }
    }
    
    // For Paragon ability boosts, validate that Might is not selected
    if (slotType === "paragonAbilityBoost1" || slotType === "paragonAbilityBoost2") {
      if (value === "might") {
        ui.notifications.warn("Might cannot be increased through Paragon ability boosts. The +1 Might is already applied automatically.");
        select.value = "";
        return;
      }
    }
    
    // For Gadgeteer ability boosts, validate that Wits is not selected
    if (slotType === "gadgeteerAbilityBoost1" || slotType === "gadgeteerAbilityBoost2") {
      if (value === "wits") {
        ui.notifications.warn("Wits cannot be increased through Gadgeteer ability boosts. The +1 Wits is already applied automatically.");
        select.value = "";
        return;
      }
    }
    
    // Handle Paragon skill training
    if (slotType === "paragonSkillTraining" && value) {
      // Parse skill name and ability from value like "Athletics (Might)"
      const match = value.match(/^(.+?)\s*\((.+?)\)$/);
      if (match) {
        const skillName = match[1].trim();
        const ability = match[2].trim().toLowerCase();
        
        const skills = foundry.utils.deepClone(this.actor.system.skills || {});
        if (!skills[skillName]) {
          skills[skillName] = {
            rank: "Apprentice",
            ability: ability,
            otherBonuses: 0
          };
        } else {
          // Upgrade to Apprentice if currently Novice
          if (skills[skillName].rank === "Novice" || !skills[skillName].rank) {
            skills[skillName].rank = "Apprentice";
          }
        }
        
        await this.actor.update({
          "system.skills": skills,
          [`system.progression.level1.${slotType}`]: value
        });
        this.render();
        return;
      }
    }
    
    // Handle Gadgeteer skill training
    if (slotType === "gadgeteerSkillTraining" && value) {
      // Parse skill name and ability from value like "Electricity (Wits)"
      const skillMatch = value.match(/([^ (]+)\s*\((\w+)\)/);
      if (skillMatch) {
        const skillName = skillMatch[1].trim();
        const ability = skillMatch[2].trim().toLowerCase();
        
        const skills = foundry.utils.deepClone(this.actor.system.skills || {});
        if (!skills[skillName]) {
          skills[skillName] = {
            rank: "Apprentice",
            ability: ability,
            otherBonuses: 0
          };
        } else {
          if (skills[skillName].rank === "Novice" || !skills[skillName].rank) {
            skills[skillName].rank = "Apprentice";
          }
        }
        
        await this.actor.update({
          "system.skills": skills,
          [`system.progression.level1.${slotType}`]: value
        });
        this.render();
        return;
      }
    }
    
    // Handle Marksman skill training (bonus skill)
    if (slotType === "marksmanSkillTraining" && value) {
      // The value is just the skill name (e.g., "Stealth", "Investigation")
      const skillName = value.trim();
      
      // Get the ability for this skill (using the standard skill mapping)
      const skillAbilityMap = {
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
      
      const ability = skillAbilityMap[skillName] || "wits";
      
      const skills = foundry.utils.deepClone(this.actor.system.skills || {});
      if (!skills[skillName]) {
        skills[skillName] = {
          rank: "Apprentice",
          ability: ability,
          otherBonuses: 0
        };
      } else {
        if (skills[skillName].rank === "Novice" || !skills[skillName].rank) {
          skills[skillName].rank = "Apprentice";
        }
      }
      
      await this.actor.update({
        "system.skills": skills,
        [`system.progression.level1.${slotType}`]: value
      });
      this.render();
      return;
    }
    
    if (!slotType) {
      return;
    }
    
    // Update the progression slot
    const updateData = {
      [`system.progression.level1.${slotType}`]: value || null
    };
    
    // If this is the Bastion Saving Throw selection, update the saving throw rank
    if (slotType === "bastionSavingThrow") {
      const savingThrows = foundry.utils.deepClone(this.actor.system.savingThrows || {});
      
      // Reset previous saving throw rank if one was selected
      const previousSelection = this.actor.system.progression?.level1?.bastionSavingThrow;
      if (previousSelection && savingThrows[previousSelection]) {
        // Only reset if it was set to Apprentice by Bastion (we'll assume if it's Apprentice and Bastion was selected, it was from this)
        // For now, we'll just reset it to Novice if it was Apprentice
        if (savingThrows[previousSelection].rank === "Apprentice") {
          savingThrows[previousSelection].rank = "Novice";
        }
      }
      
      // Set new saving throw rank to Apprentice if an ability is selected
      if (value && savingThrows[value]) {
        savingThrows[value].rank = "Apprentice";
        updateData["system.savingThrows"] = savingThrows;
      } else if (value) {
        // Initialize if it doesn't exist
        savingThrows[value] = {
          rank: "Apprentice",
          otherBonuses: 0
        };
        updateData["system.savingThrows"] = savingThrows;
      } else {
        // If clearing the selection, just update saving throws without changing ranks
        updateData["system.savingThrows"] = savingThrows;
      }
    }
    
    // Handle Saving Throw Training talent saving throw selection (Human, Terran, or Generic)
    if (slotType === "humanGenericTalentSavingThrow" || slotType === "terranGenericTalentSavingThrow" || slotType === "genericTalentSavingThrow") {
      const savingThrows = foundry.utils.deepClone(this.actor.system.savingThrows || {});
      const level = $(select).closest(".progression-slot").data("level") || 1;
      const levelKey = `level${level}`;
      
      // Determine which talent slot this is for
      let talentSlotType;
      if (slotType === "humanGenericTalentSavingThrow") {
        talentSlotType = "humanGenericTalent";
      } else if (slotType === "terranGenericTalentSavingThrow") {
        talentSlotType = "terranGenericTalent";
      } else {
        talentSlotType = "genericTalent";
      }
      
      // Reset previous saving throw rank if one was selected
      const previousSelection = this.actor.system.progression?.[levelKey]?.[slotType];
      if (previousSelection && savingThrows[previousSelection]) {
        // Only reset if it's currently at Apprentice (might have been from this talent)
        if (savingThrows[previousSelection].rank === "Apprentice") {
          // Check if it's not from Bastion
          const bastionSavingThrow = this.actor.system.progression?.level1?.bastionSavingThrow;
          if (previousSelection !== bastionSavingThrow) {
            savingThrows[previousSelection].rank = "Novice";
          }
        }
      }
      
      // Set new saving throw rank to Apprentice if an ability is selected
      if (value) {
        if (savingThrows[value]) {
          savingThrows[value].rank = "Apprentice";
        } else {
          savingThrows[value] = {
            rank: "Apprentice",
            otherBonuses: 0
          };
        }
        updateData["system.savingThrows"] = savingThrows;
      }
    }
    
    // Handle Weapon Training weapon category selection
    if (slotType === "humanGenericTalentWeaponCategory" || slotType === "terranGenericTalentWeaponCategory" || slotType === "genericTalentWeaponCategory") {
      const level = $(select).closest(".progression-slot").data("level") || 1;
      const levelKey = `level${level}`;
      
      // Prevent selecting "Unarmed Strikes" if Paragon powerset is selected
      const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
      if (value === "Unarmed Strikes" && powersetName === "Paragon") {
        ui.notifications.warn("Unarmed Strikes training is already granted by the Paragon powerset. Please choose a different weapon category.");
        select.value = "";
        // Clear the stored value
        const updateData = {};
        updateData[`system.progression.${levelKey}.${slotType}`] = "";
        await this.actor.update(updateData);
        this.render();
        return;
      }
      
      // Store the weapon category in the progression data
      // No additional processing needed - the attack roll logic will check this
    }
    
    // Recalculate all ability scores from bonuses
    const abilityBonuses = {
      might: 0,
      agility: 0,
      endurance: 0,
      wits: 0,
      charm: 0
    };
    
    // Get current progression data (including the new value we're about to set)
    const progression = foundry.utils.deepClone(this.actor.system.progression || {});
    const level1 = progression.level1 || {};
    level1[slotType] = value || null;
    
    // Calculate bonuses
    if (level1.humanAbilityBoost) {
      abilityBonuses[level1.humanAbilityBoost] += 1;
    }
    if (level1.terranAbilityBoost) {
      abilityBonuses[level1.terranAbilityBoost] += 1;
    }
    
    // Check powerset benefits
    const powersetName = level1.powersetName || this.actor.system.basic?.powerset;
    if (powersetName === "Bastion") {
      // +1 Endurance boost at level 1
      abilityBonuses.endurance += 1;
      
      // +2 ability boost distribution (stored in bastionAbilityBoost1 and bastionAbilityBoost2)
      // Can be +2 to one ability or +1 to two different abilities (not Endurance)
      if (level1.bastionAbilityBoost1) {
        const ability1 = level1.bastionAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "endurance") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (level1.bastionAbilityBoost2) {
        const ability2 = level1.bastionAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "endurance") {
          abilityBonuses[ability2] += 1;
        }
      }
    } else if (powersetName === "Paragon") {
      // +1 Might boost at level 1
      abilityBonuses.might += 1;
      
      // +2 ability boost distribution (stored in paragonAbilityBoost1 and paragonAbilityBoost2)
      // Can be +2 to one ability or +1 to two different abilities (not Might)
      if (level1.paragonAbilityBoost1) {
        const ability1 = level1.paragonAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "might") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (level1.paragonAbilityBoost2) {
        const ability2 = level1.paragonAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "might") {
          abilityBonuses[ability2] += 1;
        }
      }
    } else if (powersetName === "Gadgeteer") {
      // +1 Wits boost at level 1
      abilityBonuses.wits += 1;
      
      // +2 ability boost distribution (stored in gadgeteerAbilityBoost1 and gadgeteerAbilityBoost2)
      // Can be +2 to one ability or +1 to two different abilities (not Wits)
      if (level1.gadgeteerAbilityBoost1) {
        const ability1 = level1.gadgeteerAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "wits") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (level1.gadgeteerAbilityBoost2) {
        const ability2 = level1.gadgeteerAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "wits") {
          abilityBonuses[ability2] += 1;
        }
      }
    } else if (powersetName === "Marksman") {
      // +1 Agility boost at level 1
      abilityBonuses.agility += 1;
      
      // +2 ability boost distribution (stored in marksmanAbilityBoost1 and marksmanAbilityBoost2)
      // Can be +2 to one ability or +1 to two different abilities (not Agility)
      if (level1.marksmanAbilityBoost1) {
        const ability1 = level1.marksmanAbilityBoost1;
        if (abilityBonuses.hasOwnProperty(ability1) && ability1 !== "agility") {
          abilityBonuses[ability1] += 1;
        }
      }
      if (level1.marksmanAbilityBoost2) {
        const ability2 = level1.marksmanAbilityBoost2;
        if (abilityBonuses.hasOwnProperty(ability2) && ability2 !== "agility") {
          abilityBonuses[ability2] += 1;
        }
      }
    }
    
    // Update ability scores based on bonuses (base is always 0)
    const abilities = ["might", "agility", "endurance", "wits", "charm"];
    for (const ability of abilities) {
      updateData[`system.abilities.${ability}`] = abilityBonuses[ability] || 0;
    }
    
    await this.actor.update(updateData);
    this.render();
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
