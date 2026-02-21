/**
 * Hero Character Sheet (Application V2)
 * @extends {foundry.applications.api.DocumentSheetV2}
 */
console.log('Singularity | hero-sheet.js loaded');
const BaseActorSheetV2 = foundry.applications.api.ActorSheetV2 || foundry.applications.api.DocumentSheetV2;
export class SingularityActorSheetHero extends foundry.applications.api.HandlebarsApplicationMixin(BaseActorSheetV2) {
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
  static TEMPLATE = "systems/singularity/templates/actor-sheets/hero-sheet.html";

  /** @override */
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["singularity", "sheet", "actor", "hero"],
    position: { width: 800, height: 900 },
    window: { resizable: true },
    tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }],
    scrollY: [".sheet-body"]
  });

  static PARTS = {
    body: { template: "systems/singularity/templates/actor-sheets/hero-sheet.html" }
  };

  get actor() {
    return this.document;
  }

  get title() {
    return this.actor?.name || "Unnamed Hero";
  }

  /** @override */
  getTitle() {
    return this.title;
  }

  _captureScrollPositions() {
    if (!this.element) return;
    const $html = this.element instanceof jQuery ? this.element : $(this.element);
    const $sheetBody = $html.find(".sheet-body");
    const $activeTab = $html.find(".tab.active");
    const tabName = $activeTab.data("tab");
    if (tabName) {
      this._preferredTab = tabName;
    }
    this._scrollPositions = {
      ...(this._scrollPositions || {}),
      [tabName]: $activeTab.scrollTop(),
      sheetBody: $sheetBody.scrollTop()
    };
  }

  /** @override */
  render(...args) {
    this._captureScrollPositions();
    return super.render(...args);
  }

  /** @override */
  async _prepareContext(options = {}) {
    return this.getData(options);
  }

  /** @override */
  async _onRender(context, options) {
    if (super._onRender) {
      await super._onRender(context, options);
    }
    if (this.element) {
      if (!this._singularitySized) {
        this.setPosition({ width: 800, height: 900 });
        this._singularitySized = true;
      }
      const $html = this.element instanceof jQuery ? this.element : $(this.element);
      this.activateListeners($html);
      const tabToShow = this._preferredTab || "main";
      this._activateTab($html, tabToShow);
      if (this._scrollPositions?.[tabToShow] !== undefined) {
        $html.find(`.tab.${tabToShow}`).scrollTop(this._scrollPositions[tabToShow]);
      }
      if (this._scrollPositions?.sheetBody !== undefined) {
        $html.find(".sheet-body").scrollTop(this._scrollPositions.sheetBody);
      }
    }
  }

  /** @override */
  async getData(options = {}) {
    try {
      const context = {
        actor: this.actor,
        system: this.actor?.system || {},
        data: this.actor?.system || {},
        items: this.actor?.items || [],
        effects: this.actor?.effects || [],
        cssClass: "singularity sheet actor hero"
      };
      // Ensure cssClass is set correctly for template
      context.cssClass = "singularity sheet actor hero";
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

      const getParagonUnarmedRank = (level) => {
        if (level >= 15) return "Legendary";
        if (level >= 10) return "Masterful";
        if (level >= 5) return "Competent";
        return "Apprentice";
      };
      const getParagonUnarmedBonus = (level) => {
        const rank = getParagonUnarmedRank(level);
        return rank === "Legendary" ? 16 : rank === "Masterful" ? 12 : rank === "Competent" ? 8 : 4;
      };
      if (powersetName === "Paragon") {
        context.paragonUnarmedRank = getParagonUnarmedRank(primeLevel);
      }
      
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
            const paragonBonus = getParagonUnarmedBonus(primeLevel);
            if (paragonBonus > highestBonus) {
              highestRank = getParagonUnarmedRank(primeLevel);
              highestBonus = paragonBonus;
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
            weaponCompetenceRank = getParagonUnarmedRank(primeLevel);
            weaponCompetenceBonus = getParagonUnarmedBonus(primeLevel);
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
    
    const asiLevels = [3, 5, 8, 10, 13, 15, 18, 20];

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

    // Apply Ability Score Improvements from later levels
    for (const level of asiLevels) {
      const levelKey = `level${level}`;
      const levelData = actorData.system.progression?.[levelKey] || {};
      const boosts = [levelData.abilityScoreImprovement1, levelData.abilityScoreImprovement2];
      for (const boost of boosts) {
        if (boost && abilityBonuses.hasOwnProperty(boost)) {
          abilityBonuses[boost] += 1;
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
      
      // Add Ability Score Improvements from later levels
      for (const level of asiLevels) {
        const levelKey = `level${level}`;
        const levelData = actorData.system.progression?.[levelKey] || {};
        if (levelData.abilityScoreImprovement1 === ability) {
          breakdown.sources.push({ name: `Ability Score Improvement (Level ${level})`, value: 1 });
        }
        if (levelData.abilityScoreImprovement2 === ability) {
          breakdown.sources.push({ name: `Ability Score Improvement (Level ${level})`, value: 1 });
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
    
    const equippedArmorForNoisy = actorData.items?.find(i => i.type === "armor" && i.system?.basic?.equipped);
    const traits = equippedArmorForNoisy?.system?.basic?.traits || equippedArmorForNoisy?.system?.basic?.properties || [];
    const armorMods = equippedArmorForNoisy?.system?.basic?.modifications || [];
    const silenceReduction = Array.isArray(armorMods)
      ? armorMods.filter(mod => mod?.type === "silence").reduce((total, mod) => total + (Number(mod.value) || 0), 0)
      : 0;
    const traitList = Array.isArray(traits) ? traits : String(traits || "").split(",").map(t => t.trim());
    let noisyPenalty = 0;
    let stealthyBonus = 0;
    for (const trait of traitList) {
      const noisyMatch = String(trait).match(/Noisy\s*\((\d+)\)/i);
      if (noisyMatch) {
        noisyPenalty = Math.max(noisyPenalty, Number(noisyMatch[1]));
      } else if (/^Noisy$/i.test(String(trait))) {
        noisyPenalty = Math.max(noisyPenalty, 1);
      }

      const stealthyMatch = String(trait).match(/Stealthy\s*\((\d+)\)/i);
      if (stealthyMatch) {
        stealthyBonus = Math.max(stealthyBonus, Number(stealthyMatch[1]));
      } else if (/^Stealthy$/i.test(String(trait))) {
        stealthyBonus = Math.max(stealthyBonus, 1);
      }
    }

    noisyPenalty = Math.max(0, noisyPenalty - silenceReduction);
    const armorStealthModifier = stealthyBonus - noisyPenalty;
    const hasArmorStealthModifier = stealthyBonus > 0 || noisyPenalty > 0;
    // If wearing armor with Stealthy/Noisy, add or update Stealth skill with armor modifier
    if (hasArmorStealthModifier) {
      const parts = [];
      if (stealthyBonus > 0) parts.push(`Stealthy +${stealthyBonus}`);
      if (noisyPenalty > 0) parts.push(`Noisy -${noisyPenalty}`);
      const sourceLabel = `Armor Traits (${parts.join(", ")})`;

      if (!skills["Stealth"]) {
        // Auto-add Stealth with Novice training and armor modifier as locked other bonus
        skills["Stealth"] = {
          rank: "Novice",
          ability: "agility",
          otherBonuses: armorStealthModifier,
          lockedOtherBonuses: true,
          lockedSource: sourceLabel,
          _addedByArmor: true
        };
      } else if (skills["Stealth"]._addedByArmor) {
        // Update the armor modifier if Stealth was previously added by armor
        skills["Stealth"].otherBonuses = armorStealthModifier;
        skills["Stealth"].lockedSource = sourceLabel;
      } else {
        // Player has training in Stealth - add armor modifier to other bonuses (display only)
        const existingBonus = Number(skills["Stealth"].otherBonuses) || 0;
        skills["Stealth"].otherBonuses = existingBonus + armorStealthModifier;
      }
    } else if (skills["Stealth"]?._addedByArmor) {
      // Armor removed and Stealth was only added by armor - remove it
      delete skills["Stealth"];
    }

    const powersetSkillNames = new Set();
    const paragonSkillTraining = actorData.system.progression?.level1?.paragonSkillTraining;
    const gadgeteerSkillTraining = actorData.system.progression?.level1?.gadgeteerSkillTraining;
    const marksmanSkillTraining = actorData.system.progression?.level1?.marksmanSkillTraining;
    if (paragonSkillTraining) {
      const match = String(paragonSkillTraining).match(/^(.+?)\s*\(/);
      if (match?.[1]) powersetSkillNames.add(match[1].trim());
    }
    if (gadgeteerSkillTraining) {
      const match = String(gadgeteerSkillTraining).match(/^(.+?)\s*\(/);
      if (match?.[1]) powersetSkillNames.add(match[1].trim());
    }
    if (marksmanSkillTraining) {
      powersetSkillNames.add(String(marksmanSkillTraining).trim());
    }
    if (powersetName === "Marksman") {
      powersetSkillNames.add("Perception");
    }
    if (powersetName === "Gadgeteer") {
      powersetSkillNames.add("Gadget Tuning");
    }

    for (const [skillName, skill] of Object.entries(skills)) {
      const abilityName = skill.ability;
      const abilityScore = calculatedAbilityScores[abilityName] || 0;
      const trainingBonus = trainingBonuses[skill.rank] || 0;
    // Ensure otherBonuses exists, default to 0, and parse as number
    const otherBonuses = (skill.otherBonuses !== undefined && skill.otherBonuses !== null) ? Number(skill.otherBonuses) || 0 : 0;
    // Note: Noisy penalty is now included in otherBonuses (as a negative value), not calculated separately
    const totalBonus = Number(abilityScore) + Number(trainingBonus) + Number(otherBonuses);
      
      // Format bonus for display (add + sign for positive numbers)
      const bonusDisplay = totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}`;
      
      const skillData = {
        ...skill,
        otherBonuses: otherBonuses,
        totalBonus: totalBonus,
        bonusDisplay: bonusDisplay,
        lockedOtherBonuses: skill.lockedOtherBonuses || false, // Preserve locked status
        lockedSource: skill.lockedSource || null, // Preserve source
        lockedByPowerset: skill.lockedByPowerset || powersetSkillNames.has(skillName)
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
        rank: getParagonUnarmedRank(primeLevel)
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
        const marksmanTalentName = levelData.marksmanTalentName || levelData.powersetTalentName || "";
        if (marksmanTalentName && marksmanTalentName.toLowerCase().includes("deadeye")) {
          hasDeadeye = true;
          break;
        }
      }
    }
    context.hasDeadeye = hasDeadeye;

    // Check for Improved Deadeye talent (requires Deadeye, Marksman L7+)
    let hasImprovedDeadeye = false;
    if (hasDeadeye) {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        const talentName = (levelData.marksmanTalentName || levelData.powersetTalentName || "").toLowerCase();
        if (talentName.includes("improved deadeye")) {
          hasImprovedDeadeye = true;
          break;
        }
      }
      // Also check embedded talent items
      if (!hasImprovedDeadeye) {
        const embedded = actorData.items || [];
        hasImprovedDeadeye = embedded.some(i => i.type === "talent" && (i.name || "").toLowerCase().includes("improved deadeye"));
      }
    }
    context.hasImprovedDeadeye = hasImprovedDeadeye;

    // Check for Enhanced Precision talent (requires Deadeye, Marksman L10+)
    let hasEnhancedPrecision = false;
    if (hasDeadeye) {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        const talentName = (levelData.marksmanTalentName || levelData.powersetTalentName || "").toLowerCase();
        if (talentName.includes("enhanced precision")) {
          hasEnhancedPrecision = true;
          break;
        }
      }
      if (!hasEnhancedPrecision) {
        const embedded = actorData.items || [];
        hasEnhancedPrecision = embedded.some(i => i.type === "talent" && (i.name || "").toLowerCase().includes("enhanced precision"));
      }
    }
    context.hasEnhancedPrecision = hasEnhancedPrecision;

    // Check for Stabilized Movement talent (requires Deadeye)
    let hasStabilizedMovement = false;
    if (hasDeadeye) {
      const allLevelTalents = [];
      for (let lvl = 1; lvl <= 20; lvl++) {
        const ld = progression[`level${lvl}`] || {};
        allLevelTalents.push((ld.marksmanTalentName || ld.powersetTalentName || ld.genericTalentName || "").toLowerCase());
      }
      hasStabilizedMovement = allLevelTalents.some(n => n.includes("stabilized movement"))
        || (actorData.items || []).some(i => i.type === "talent" && (i.name || "").toLowerCase().includes("stabilized movement"));
    }
    context.hasStabilizedMovement = hasStabilizedMovement;

    // Check for Specialized Ammunition talent (Marksman 9)
    let hasSpecializedAmmo = false;
    if (powersetName === "Marksman") {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const ld = progression[`level${lvl}`] || {};
        const tn = (ld.marksmanTalentName || ld.powersetTalentName || "").toLowerCase();
        if (tn.includes("specialized ammunition")) { hasSpecializedAmmo = true; break; }
      }
      if (!hasSpecializedAmmo) {
        hasSpecializedAmmo = (actorData.items || []).some(i => i.type === "talent" && (i.name || "").toLowerCase().includes("specialized ammunition"));
      }
    }
    context.hasSpecializedAmmo = hasSpecializedAmmo;
    if (hasSpecializedAmmo) {
      const ammoData = actorData.system.combat?.specializedAmmo || { used: 0 };
      const wits = calculatedAbilityScores.wits || 0;
      context.specializedAmmoMax = Math.max(1, wits);
      context.specializedAmmoUsed = Math.min(ammoData.used || 0, context.specializedAmmoMax);
      context.specializedAmmoRemaining = context.specializedAmmoMax - context.specializedAmmoUsed;
    }

    // Check for Lightning Reload talent (Marksman 12, requires Fast Reload)
    let hasLightningReload = false;
    if (powersetName === "Marksman") {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const ld = progression[`level${lvl}`] || {};
        const tn = (ld.marksmanTalentName || ld.powersetTalentName || "").toLowerCase();
        if (tn.includes("lightning reload")) { hasLightningReload = true; break; }
      }
      if (!hasLightningReload) {
        hasLightningReload = (actorData.items || []).some(i => i.type === "talent" && (i.name || "").toLowerCase().includes("lightning reload"));
      }
    }
    context.hasLightningReload = hasLightningReload;
    if (hasLightningReload) {
      const lrData = actorData.system.combat?.lightningReload || { used: 0 };
      const agility = calculatedAbilityScores.agility || 0;
      context.lightningReloadMax = Math.max(1, agility);
      context.lightningReloadUsed = Math.min(lrData.used || 0, context.lightningReloadMax);
      context.lightningReloadRemaining = context.lightningReloadMax - context.lightningReloadUsed;
    }

    // Check for Deadly Focus talent (Marksman 17, requires Deadeye)
    let hasDeadlyFocus = false;
    if (hasDeadeye) {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const ld = progression[`level${lvl}`] || {};
        const tn = (ld.marksmanTalentName || ld.powersetTalentName || "").toLowerCase();
        if (tn.includes("deadly focus")) { hasDeadlyFocus = true; break; }
      }
      if (!hasDeadlyFocus) {
        hasDeadlyFocus = (actorData.items || []).some(i => i.type === "talent" && (i.name || "").toLowerCase().includes("deadly focus"));
      }
    }
    context.hasDeadlyFocus = hasDeadlyFocus;
    if (hasDeadlyFocus) {
      const dfData = actorData.system.combat?.deadlyFocus || { used: 0 };
      const agility = calculatedAbilityScores.agility || 0;
      context.deadlyFocusMax = Math.max(1, agility);
      context.deadlyFocusUsed = Math.min(dfData.used || 0, context.deadlyFocusMax);
      context.deadlyFocusRemaining = context.deadlyFocusMax - context.deadlyFocusUsed;
    }

    // Check for Impossible Shot talent (Marksman 20)
    let hasImpossibleShot = false;
    if (powersetName === "Marksman") {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const ld = progression[`level${lvl}`] || {};
        const tn = (ld.marksmanTalentName || ld.powersetTalentName || "").toLowerCase();
        if (tn.includes("impossible shot")) { hasImpossibleShot = true; break; }
      }
      if (!hasImpossibleShot) {
        hasImpossibleShot = (actorData.items || []).some(i => i.type === "talent" && (i.name || "").toLowerCase().includes("impossible shot"));
      }
    }
    context.hasImpossibleShot = hasImpossibleShot;
    if (hasImpossibleShot) {
      const isData = actorData.system.combat?.impossibleShot || { used: false };
      context.impossibleShotUsed = !!isData.used;
    }

    // Check for Perfect Shot talent (Marksman 20, requires Unerring Aim)
    let hasPerfectShot = false;
    if (powersetName === "Marksman") {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const ld = progression[`level${lvl}`] || {};
        const tn = (ld.marksmanTalentName || ld.powersetTalentName || "").toLowerCase();
        if (tn.includes("perfect shot")) { hasPerfectShot = true; break; }
      }
      if (!hasPerfectShot) {
        hasPerfectShot = (actorData.items || []).some(i => i.type === "talent" && (i.name || "").toLowerCase().includes("perfect shot"));
      }
    }
    context.hasPerfectShot = hasPerfectShot;
    if (hasPerfectShot) {
      const psData = actorData.system.combat?.perfectShot || { used: false };
      context.perfectShotUsed = !!psData.used;
    }

    // Check for Regenerative Fortitude talent (check all levels, but only if Bastion powerset is selected)
    let hasRegenerativeFortitude = false;
    if (powersetName === "Bastion") {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        const bastionTalentName = levelData.bastionTalentName || "";
        if (bastionTalentName && bastionTalentName.toLowerCase().includes("regenerative fortitude")) {
          hasRegenerativeFortitude = true;
          break;
        }
      }
    }
    context.hasRegenerativeFortitude = hasRegenerativeFortitude;

    if (hasRegenerativeFortitude) {
      const regenerativeData = actorData.system.combat?.regenerativeFortitude || { used: false };
      context.regenerativeFortitudeUsed = !!regenerativeData.used;
      context.regenerativeFortitudeReduction = calculatedAbilityScores.endurance || 0;
    }

    // Check for Protective Barrier talent (check all levels, but only if Bastion powerset is selected)
    let hasProtectiveBarrier = false;
    if (powersetName === "Bastion") {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        const bastionTalentName = levelData.bastionTalentName || "";
        if (bastionTalentName && bastionTalentName.toLowerCase().includes("protective barrier")) {
          hasProtectiveBarrier = true;
          break;
        }
      }
    }
    context.hasProtectiveBarrier = hasProtectiveBarrier;

    if (hasProtectiveBarrier) {
      const protectiveBarrierData = actorData.system.combat?.protectiveBarrier || { active: false };
      const protectiveBarrierLevel = Number(actorData.system.basic?.primeLevel || 1);
      let protectiveBarrierBonus = 1;
      if (protectiveBarrierLevel >= 20) {
        protectiveBarrierBonus = 3;
      } else if (protectiveBarrierLevel >= 15) {
        protectiveBarrierBonus = 2;
      }
      context.protectiveBarrierActive = !!protectiveBarrierData.active;
      context.protectiveBarrierBonus = protectiveBarrierBonus;
    }

    // Check for Indomitable Will talent (check all levels, but only if Bastion powerset is selected)
    let hasIndomitableWill = false;
    if (powersetName === "Bastion") {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        const bastionTalentName = levelData.bastionTalentName || "";
        if (bastionTalentName && bastionTalentName.toLowerCase().includes("indomitable will")) {
          hasIndomitableWill = true;
          break;
        }
      }
    }
    context.hasIndomitableWill = hasIndomitableWill;
    
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

      if (hasIndomitableWill && (ability === "wits" || ability === "charm")) {
        breakdown.otherBonuses += 2;
        breakdown.sources.push({
          name: "Indomitable Will",
          bonus: 2
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
        const multiplier = Number(resistance.bastionMultiplier) || 2;
        resistanceCopy.calculatedValue = multiplier * bastionLevel;
      } else if (resistance.value !== null && resistance.value !== undefined) {
        resistanceCopy.calculatedValue = resistance.value;
      }
      return resistanceCopy;
    });
    if (equippedArmorForNoisy?.system?.basic?.modifications) {
      const armorResistanceMods = equippedArmorForNoisy.system.basic.modifications
        .filter(mod => mod?.type === "resistance" && mod.damageType)
        .map(mod => ({
          type: mod.damageType,
          value: Number(mod.value) || 3,
          calculatedValue: Number(mod.value) || 3,
          source: `Armor Mod: ${equippedArmorForNoisy.name}`
        }));
      calculatedResistances.push(...armorResistanceMods);
    }
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
        calculatedMaxHp += primeLevel;
      }
    } else if (powersetName === "Paragon") {
      // Paragon HP: (12 + Endurance) × Paragon level
      const paragonLevel = primeLevel;
      calculatedMaxHp = (12 + enduranceScore) * paragonLevel;
      
      // Add Enhanced Vitality bonus
      if (hasEnhancedVitality) {
        calculatedMaxHp += primeLevel;
      }
    } else if (powersetName === "Gadgeteer") {
      // Gadgeteer HP: (8 + Endurance) × Gadgeteer level
      const gadgeteerLevel = primeLevel;
      calculatedMaxHp = (8 + enduranceScore) * gadgeteerLevel;
      
      // Add Enhanced Vitality bonus
      if (hasEnhancedVitality) {
        calculatedMaxHp += primeLevel;
      }
    } else if (powersetName === "Marksman") {
      // Marksman HP: (8 + Endurance) × Marksman level
      const marksmanLevel = primeLevel;
      calculatedMaxHp = (8 + enduranceScore) * marksmanLevel;
      
      // Add Enhanced Vitality bonus
      if (hasEnhancedVitality) {
        calculatedMaxHp += primeLevel;
      }
    } else if (hasEnhancedVitality) {
      // For characters without powerset but with Enhanced Vitality: use stored max HP only.
      // The +2/level bonus is applied once when the talent is selected (no re-add here to avoid loop).
      calculatedMaxHp = safeCombat.hp.max || 0;
    } else {
      // For characters without powerset and without Enhanced Vitality, use stored value
      calculatedMaxHp = safeCombat.hp.max || 0;
    }
    
    // Always set calculatedMaxHp (never null - it's always calculated or from stored value)
    context.calculatedMaxHp = calculatedMaxHp;

    // Keep actor max HP in sync with calculated value for token bars
    if (this.actor?.isOwner && this.actor.system?.combat?.hp?.max !== calculatedMaxHp) {
      try {
        await this.actor.update({
          "system.combat.hp.max": calculatedMaxHp,
          "system.combat.hp.value": Math.min(this.actor.system?.combat?.hp?.value ?? 0, calculatedMaxHp)
        });
      } catch (err) {
        console.warn("Singularity | Failed to sync max HP:", err);
      }
    }
    
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
      const storedMax = safeCombat.hp.max || 0;
      hpBreakdown.baseHp = hasEnhancedVitality
        ? Math.max(0, storedMax - primeLevel)
        : storedMax;
      hpBreakdown.sources.push({ 
        name: `Base HP`, 
        value: hpBreakdown.baseHp,
        perLevel: false
      });
      hpBreakdown.formula = `Base HP`;
    }
    
    // Add Enhanced Vitality bonus if applicable
    if (hasEnhancedVitality) {
      hpBreakdown.enhancedVitalityBonus = primeLevel;
      hpBreakdown.sources.push({ 
        name: `Enhanced Vitality (+1 per Prime Level)`, 
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
      const preparedGadgetsData = actorData.system.gadgets?.prepared || { level0: [], level1: [], level2: [], level3: [] };
      
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
        },
        level2: {
          total: slots.level2 || 0,
          used: (preparedGadgetsData.level2 || []).length,
          available: Math.max(0, (slots.level2 || 0) - (preparedGadgetsData.level2 || []).length)
        },
        level3: {
          total: slots.level3 || 0,
          used: (preparedGadgetsData.level3 || []).length,
          available: Math.max(0, (slots.level3 || 0) - (preparedGadgetsData.level3 || []).length)
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
          // Normalize legacy fields for display
          gadget.damage = gadget.damage || gadget.damageFormula || gadget.damageRoll || gadget.attackDamage;
          gadget.healing = gadget.healing || gadget.healingFormula || gadget.heal || gadget.healFormula;
          gadget.canHeal = Boolean(gadget.healing) || /trauma\s*stabilizer/i.test(gadget.name || "");
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
          // Normalize legacy fields for display
          gadget.damage = gadget.damage || gadget.damageFormula || gadget.damageRoll || gadget.attackDamage;
          gadget.healing = gadget.healing || gadget.healingFormula || gadget.heal || gadget.healFormula;
          gadget.canHeal = Boolean(gadget.healing) || /trauma\s*stabilizer/i.test(gadget.name || "");
        }
        return gadget;
      });
      const paddedLevel2 = Array(slots.level2 || 0).fill(null).map((_, index) => {
        const gadget = (preparedGadgetsData.level2 || [])[index] || null;
        if (gadget) {
          if (!gadget.img || gadget.img === "icons/svg/cog.svg") {
            // Fix old cog.svg icon or set default image if missing
            gadget.img = "icons/svg/item-bag.svg";
          }
          // Normalize legacy fields for display
          gadget.damage = gadget.damage || gadget.damageFormula || gadget.damageRoll || gadget.attackDamage;
          gadget.healing = gadget.healing || gadget.healingFormula || gadget.heal || gadget.healFormula;
          gadget.canHeal = Boolean(gadget.healing) || /trauma\s*stabilizer/i.test(gadget.name || "");
        }
        return gadget;
      });
      const paddedLevel3 = Array(slots.level3 || 0).fill(null).map((_, index) => {
        const gadget = (preparedGadgetsData.level3 || [])[index] || null;
        if (gadget) {
          if (!gadget.img || gadget.img === "icons/svg/cog.svg") {
            // Fix old cog.svg icon or set default image if missing
            gadget.img = "icons/svg/item-bag.svg";
          }
          // Normalize legacy fields for display
          gadget.damage = gadget.damage || gadget.damageFormula || gadget.damageRoll || gadget.attackDamage;
          gadget.healing = gadget.healing || gadget.healingFormula || gadget.heal || gadget.healFormula;
          gadget.canHeal = Boolean(gadget.healing) || /trauma\s*stabilizer/i.test(gadget.name || "");
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
      const level2SlotArray = paddedLevel2.map((gadget, index) => ({
        gadget: gadget,
        slotNumber: index + 1,
        isEmpty: !gadget
      }));
      const level3SlotArray = paddedLevel3.map((gadget, index) => ({
        gadget: gadget,
        slotNumber: index + 1,
        isEmpty: !gadget
      }));
      
      context.preparedGadgets = {
        level0: paddedLevel0,
        level1: paddedLevel1,
        level2: paddedLevel2,
        level3: paddedLevel3
      };
      context.gadgetSlotsArray = {
        level0: level0SlotArray,
        level1: level1SlotArray,
        level2: level2SlotArray,
        level3: level3SlotArray
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
      const gadgetTuningAttackBonus = skillModifier;
      let gadgetTuningDC = 10 + wits + skillModifier;
      
      // Add "Enough Prep Time" bonus if active
      if (hasEnoughPrepTime) {
        const enoughPrepTimeData = actorData.system.combat?.enoughPrepTime || { active: false };
        if (enoughPrepTimeData.active) {
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
      context.gadgetTuningAttackBonus = gadgetTuningAttackBonus;
      
      // Calculate "Enough Prep Time" attack bonus if active
      if (hasEnoughPrepTime) {
        const enoughPrepTimeData = actorData.system.combat?.enoughPrepTime || { active: false };
        context.enoughPrepTimeActive = enoughPrepTimeData.active;
        if (enoughPrepTimeData.active) {
          context.enoughPrepTimeAttackBonus = gadgeteerLevel; // +1 per Gadgeteer level
        } else {
          context.enoughPrepTimeAttackBonus = 0;
        }
      } else {
        context.enoughPrepTimeActive = false;
        context.enoughPrepTimeAttackBonus = 0;
      }
    } else {
      // If not Gadgeteer, set defaults
      context.gadgetTuningRank = "Novice";
      context.gadgetTuningDC = null;
      context.enoughPrepTimeActive = false;
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

      const gadgetAttackEntries = [];
      if (hasGadgeteer) {
        const preparedGadgets = actorData.system.gadgets?.prepared || { level0: [], level1: [], level2: [], level3: [] };
        const gadgetEntries = [
          ...(preparedGadgets.level0 || []),
          ...(preparedGadgets.level1 || []),
          ...(preparedGadgets.level2 || []),
          ...(preparedGadgets.level3 || [])
        ].filter(Boolean);
        for (const gadgetEntry of gadgetEntries) {
          let damageFormula = gadgetEntry.damage || gadgetEntry.damageFormula || gadgetEntry.damageRoll || gadgetEntry.attackDamage;
          let damageType = gadgetEntry.damageType;
          let range = gadgetEntry.range;
          let energyCost = gadgetEntry.energyCost;
          let attackBonus = gadgetEntry.attackBonus;
          let gadgetDoc = null;

          if (!damageFormula || !damageType || !range || attackBonus === undefined || attackBonus === null || attackBonus === "") {
            try {
              gadgetDoc = await fromUuid(gadgetEntry.id);
            } catch (err) {
              console.warn("Singularity | Failed to load gadget for attack data:", err);
            }
          }

          const basic = gadgetDoc?.system?.basic || {};
          if (!damageFormula && gadgetDoc) {
            damageFormula = this._getGadgetDamageFormula(gadgetDoc);
          }
          if (!damageFormula) {
            continue;
          }

          const description = gadgetDoc?.system?.description || gadgetDoc?.system?.details?.description || "";
          const parsedDamageType = this._getGadgetDamageTypeFromDescription(description);
          damageType =
            damageType ||
            parsedDamageType ||
            basic.damageType ||
            "Kinetic";
          range = range || basic.range || "Ranged";
          energyCost = energyCost ?? basic.energyCost ?? 0;
          if (Number.isFinite(Number(attackBonus))) {
            attackBonus = Number(attackBonus);
          } else if (Number.isFinite(Number(basic.attackBonus))) {
            attackBonus = Number(basic.attackBonus);
          } else {
            attackBonus = context.gadgetTuningAttackBonus || 0;
          }

          const attackType = basic.type || (String(range || "").toLowerCase().includes("melee") ? "melee" : "ranged");

          gadgetAttackEntries.push({
            name: gadgetEntry.name || gadgetDoc?.name || "Gadget Attack",
            baseAttackBonus: attackBonus,
            baseDamage: damageFormula,
            ability: "wits",
            damageType: damageType,
            range: range,
            cost: energyCost,
            type: attackType,
            weaponImg: gadgetEntry.img || gadgetDoc?.img,
            isCustom: false,
            isGadgetAttack: true,
            gadgetId: gadgetEntry.id,
            gadgetTuningBonus: context.gadgetTuningAttackBonus || 0
          });
        }
      }

      const hasBlastDamageEnhancement = this._hasBlastDamageEnhancement(actorData);

      // Process attacks to calculate dynamic attack bonuses and damage
      const attacksWithCalculations = ([...(actorData.system.attacks || []), ...gadgetAttackEntries]).map(attack => {
        const attackCopy = { ...attack };
        const isGadgetAttack = attack.isGadgetAttack === true;
        attackCopy.isGadgetAttack = isGadgetAttack;
        if (isGadgetAttack) {
          attackCopy.gadgetId = attack.gadgetId;
        }
        
        // Try to match attack name with equipped weapon name (case-insensitive)
        // For dual-mode weapons, strip the mode suffix (e.g., "Combat Knife (Melee)" -> "Combat Knife")
        const baseAttackName = attack.name?.replace(/\s*\(Melee\)$/i, "").replace(/\s*\(Thrown\)$/i, "");
        const matchingWeapon = !isGadgetAttack
          ? equippedWeapons.find(w => w.name && baseAttackName && w.name.toLowerCase() === baseAttackName.toLowerCase())
          : null;
        if (!isGadgetAttack && matchingWeapon && matchingWeapon.img) {
          attackCopy.weaponImg = matchingWeapon.img;
        }
        const isWeaponAttack = !isGadgetAttack && (Boolean(attack.weaponId) || Boolean(matchingWeapon));
        const isUnarmed = attack.name && attack.name.toLowerCase() === "unarmed strike";
        attackCopy.isUnarmed = Boolean(isUnarmed);
        const isTalentAttack = !isGadgetAttack && (attack.isTalentAttack === true || (attack.name && attack.name.toLowerCase() === "blast"));
        const isBlastAttack = isTalentAttack && (attack.name && attack.name.toLowerCase() === "blast");
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
            : (!isWeaponAttack && !isUnarmed && !isTalentAttack && !isGadgetAttack);
        
        // Determine weapon competence rank and bonus
        let weaponCompetenceRank = "Novice"; // Default
        let weaponCompetenceBonus = 0; // Novice = +0
        const gadgetTuningBonus = Number(attack.gadgetTuningBonus ?? 0);
        
        // Get weapon categories from matching weapon item
        const weaponCategories = matchingWeapon?.system?.basic?.categories || [];
        const weaponType = matchingWeapon?.system?.basic?.type || attack.type || "melee";
        const weaponMode = attack.weaponMode; // "melee", "thrown", or undefined
        
        // Check for Unarmed Strike
        if (isGadgetAttack) {
          weaponCompetenceRank = "Gadget Tuning";
          weaponCompetenceBonus = 0;
        } else if (attack.name && attack.name.toLowerCase() === "unarmed strike") {
          // Unarmed Strike: Novice by default, scaled if Paragon
          if (powersetName === "Paragon") {
            weaponCompetenceRank = getParagonUnarmedRank(primeLevel);
            weaponCompetenceBonus = getParagonUnarmedBonus(primeLevel);
          } else {
            weaponCompetenceRank = "Novice";
            weaponCompetenceBonus = 0; // Novice = +0
          }
        }
        // If this is a talent-based attack (e.g., Blast) and it stores a baseAttackBonus,
        // treat that stored baseAttackBonus as the talent competence instead of a separate base bonus.
        if (!isGadgetAttack && isTalentAttack && (attack.baseAttackBonus || attack.baseAttackBonus === 0)) {
          const rankBonuses = {
            "Novice": 0,
            "Apprentice": 4,
            "Competent": 8,
            "Masterful": 12,
            "Legendary": 16
          };
          const reverseMap = Object.fromEntries(Object.entries(rankBonuses).map(([k, v]) => [String(v), k]));
          weaponCompetenceBonus = Number(attack.baseAttackBonus) || 0;
          weaponCompetenceRank = reverseMap[String(weaponCompetenceBonus)] || weaponCompetenceRank;
        }
        // Check weapon categories for Weapon Training talents
        // For dual-mode weapons, only check categories relevant to the current mode
        else if (!isGadgetAttack && weaponCategories.length > 0) {
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
            const paragonBonus = getParagonUnarmedBonus(primeLevel);
            if (paragonBonus > highestBonus) {
              highestRank = getParagonUnarmedRank(primeLevel);
              highestBonus = paragonBonus;
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
        else if (!isGadgetAttack && (weaponType === "ranged" || attack.type === "ranged")) {
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
        else if (!isGadgetAttack && attack.weaponCompetenceRank) {
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
        if (!isGadgetAttack && deadeyeData.active && (attack.type === "ranged" || (matchingWeapon && matchingWeapon.system?.basic?.type === "ranged"))) {
          deadeyeBonus = 5; // +5 attack bonus from Deadeye
        }
        
        // If attack has baseAttackBonus and ability, calculate dynamic bonus
        if (attack.baseAttackBonus !== undefined && attack.ability) {
          const currentAbilityScore = calculatedAbilityScores[attack.ability] || 0;
          // Add weapon competence bonus, Deadeye bonus, and ability score to baseAttackBonus
          attackCopy.calculatedAttackBonus = attack.baseAttackBonus + weaponCompetenceBonus + deadeyeBonus + currentAbilityScore;
          // Build breakdown string
          const parts = [];
          if (isGadgetAttack) {
            parts.push(`${gadgetTuningBonus >= 0 ? "+" : ""}${gadgetTuningBonus} (Gadget Tuning)`);
          } else if (weaponCompetenceBonus > 0) {
            parts.push(`+${weaponCompetenceBonus} (${weaponCompetenceRank})`);
          } else if (weaponCompetenceRank === "Novice") {
            parts.push(`+0 (Novice)`);
          }
          if (deadeyeBonus > 0) {
            parts.push(`+${deadeyeBonus} (Deadeye)`);
          }
          if (attack.baseAttackBonus > 0 && !isTalentAttack && !isGadgetAttack) {
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
          if (isGadgetAttack) {
            parts.push(`${gadgetTuningBonus >= 0 ? "+" : ""}${gadgetTuningBonus} (Gadget Tuning)`);
          } else if (weaponCompetenceBonus > 0) {
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
          if (isGadgetAttack) {
            parts.push(`${gadgetTuningBonus >= 0 ? "+" : ""}${gadgetTuningBonus} (Gadget Tuning)`);
          } else if (weaponCompetenceBonus > 0) {
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
          const baseDamage = isBlastAttack && hasBlastDamageEnhancement ? "3d4" : attack.baseDamage;
          const currentAbilityScore = calculatedAbilityScores[attack.ability] || 0;
          if (currentAbilityScore > 0) {
            attackCopy.calculatedDamage = `${baseDamage}+${currentAbilityScore}`;
          } else if (currentAbilityScore < 0) {
            attackCopy.calculatedDamage = `${baseDamage}${currentAbilityScore}`;
          } else {
            attackCopy.calculatedDamage = baseDamage;
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
        const textEditor = foundry.applications?.ux?.TextEditor?.implementation || TextEditor;
        context.enrichedNotes = await textEditor.enrichHTML(notes, { async: true, secrets: this.actor.isOwner, relativeTo: this.actor });
        context.enrichedBackstory = await textEditor.enrichHTML(backstory, { async: true, secrets: this.actor.isOwner, relativeTo: this.actor });
        context.enrichedAppearance = await textEditor.enrichHTML(appearance, { async: true, secrets: this.actor.isOwner, relativeTo: this.actor });
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
      
      const hasSwiftRunner = allTalentNames.includes("Swift Runner");
      
      if (hasSwiftRunner) {
        landSpeed += 5;
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

      const hasEnhancedFlight = (() => {
        for (let lvl = 1; lvl <= 20; lvl++) {
          const levelData = progression[`level${lvl}`] || {};
          const names = [
            levelData.paragonTalentName,
            levelData.powersetTalentName
          ].filter(Boolean);
          if (names.some(name => String(name).toLowerCase().includes("enhanced flight"))) {
            return true;
          }
        }
        return false;
      })();

      const hasAerialMastery = (() => {
        for (let lvl = 1; lvl <= 20; lvl++) {
          const levelData = progression[`level${lvl}`] || {};
          const names = [
            levelData.paragonTalentName,
            levelData.powersetTalentName
          ].filter(Boolean);
          if (names.some(name => String(name).toLowerCase().includes("aerial mastery"))) {
            return true;
          }
        }
        return false;
      })();

      const hasPerfectFlight = (() => {
        for (let lvl = 1; lvl <= 20; lvl++) {
          const levelData = progression[`level${lvl}`] || {};
          const names = [
            levelData.paragonTalentName,
            levelData.powersetTalentName
          ].filter(Boolean);
          if (names.some(name => String(name).toLowerCase().includes("perfect flight"))) {
            return true;
          }
        }
        return false;
      })();

      // Calculate flying speed - check if Paragon is selected
      // Reuse powersetName that was already declared earlier in the function
      let calculatedFlyingSpeed = null;
      if (powersetName === "Paragon") {
        // Paragon grants 15 ft flying speed at level 1
        calculatedFlyingSpeed = 15 + (hasEnhancedFlight ? 10 : 0) + (hasAerialMastery ? 15 : 0) + (hasPerfectFlight ? 20 : 0);
        context.speeds.flying = calculatedFlyingSpeed;
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
      if (this.element) {
        const currentActiveTab = this.element.find('.sheet-tabs .item.active, .tab.active');
        if (currentActiveTab.length) {
          activeTab = currentActiveTab.first().data('tab');
        }
      }
      
      await super._render(force, options);
      // Debug: Check if our template was used
      if (this.element) {
        const hasOurClasses = this.element.hasClass('singularity');
        // Intentionally no noisy logging during renders.
        
        if (!hasOurClasses) {
          console.error("Singularity | WARNING: Template not loaded correctly! Using base sheet instead.");
          ui.notifications.error("Character sheet template failed to load. Please check console for errors.");
        } else {
          // Ensure the sheet body is visible and tabs are activated
          const sheetBody = this.element.find('.sheet-body');
          if (sheetBody.length) {
            sheetBody.css('display', 'block');
            
            // Prefer the currently active tab, fall back to preferred/default
            const tabToActivate = activeTab || this._preferredTab || "main";
            this._preferredTab = tabToActivate;
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
        // Inline edit for equipment name and quantity
        html.on("change", 'input[name="system.basic.quantity"]', async (event) => {
          const itemId = event.currentTarget.closest(".item").dataset.itemId;
          const item = this.actor.items.get(itemId);
          if (item && item.type === "equipment") {
            this._preferredTab = "equipment";
            const nextQty = Number(event.currentTarget.value) || 0;
            if (nextQty <= 0) {
              await item.delete();
              this.render(true);
              return;
            }
            await item.update({ "system.basic.quantity": nextQty });
          }
        });
        html.on("change", 'input[name="name"]', (event) => {
          const itemId = event.currentTarget.closest(".item").dataset.itemId;
          const item = this.actor.items.get(itemId);
          if (item && item.type === "equipment") {
            this._preferredTab = "equipment";
            item.update({ name: event.currentTarget.value.trim() });
          }
        });
    if (super.activateListeners) {
      super.activateListeners(html);
    }
    html.find(".sheet-tabs .item").on("click", (event) => {
      event.preventDefault();
      const tab = event.currentTarget.dataset.tab;
      if (tab) {
        this._activateTab(html, tab);
      }
    });

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;
    // Prevent default form submit to avoid unexpected reloads
    html.on('submit', 'form', (ev) => {
      ev.preventDefault();
      return false;
    });

    // Inline immediate-save for critical fields (name, HP) to avoid form submit issues
    html.on('change', 'input[name="name"], input[name="system.combat.hp.value"], input[name="system.combat.hp.max"]', this._onInlineFieldChange.bind(this));
    // Inline immediate-save for initiative rank
    html.on('change', 'select[name="system.combat.initiative.rank"]', this._onInlineSelectChange.bind(this));
    html.on('keydown', 'input[name="name"], input[name="system.combat.hp.value"], input[name="system.combat.hp.max"]', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        ev.currentTarget.blur();
      }
    });
 
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

    // Add item (exclude buy buttons which are separate flows)
    html.find(".item-create:not(.buy-weapon):not(.buy-armor):not(.buy-consumables)").click(this._onItemCreate.bind(this));
    
    // Buy armor from compendium
    html.find(".buy-armor").click(this._onBuyArmor.bind(this));
    
    // Equip/Unequip armor
    html.find(".armor-equip").click(this._onEquipArmor.bind(this));
    html.find(".armor-unequip").click(this._onUnequipArmor.bind(this));

    // Buy weapon from compendium
    html.find(".buy-weapon").click(this._onBuyWeapon.bind(this));

    // Buy consumables from list
    html.find(".buy-consumables, .buy-equipment").click(this._onBuyConsumables.bind(this));

    // Use consumables
    html.find(".equipment-use").click(this._onUseConsumable.bind(this));

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

    // Roll saving throw (handled by data-action binding below)

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
    html.off("click", ".rwi-delete");
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

    // Regenerative Fortitude controls
    html.find(".regenerative-fortitude-toggle").on("change", this._onRegenerativeFortitudeToggle.bind(this));

    // Specialized Ammunition controls
    html.find(".specialized-ammo-use").on("click", this._onSpecializedAmmoUse.bind(this));
    html.find(".specialized-ammo-reset").on("click", this._onSpecializedAmmoReset.bind(this));

    // Lightning Reload controls
    html.find(".lightning-reload-use").on("click", this._onLightningReloadUse.bind(this));
    html.find(".lightning-reload-reset").on("click", this._onLightningReloadReset.bind(this));

    // Deadly Focus controls
    html.find(".deadly-focus-use").on("click", this._onDeadlyFocusUse.bind(this));
    html.find(".deadly-focus-reset").on("click", this._onDeadlyFocusReset.bind(this));

    // Impossible Shot controls
    html.find(".impossible-shot-toggle").on("change", this._onImpossibleShotToggle.bind(this));

    // Perfect Shot controls
    html.find(".perfect-shot-toggle").on("change", this._onPerfectShotToggle.bind(this));

    // Protective Barrier controls
    html.find(".protective-barrier-toggle").on("change", this._onProtectiveBarrierToggle.bind(this));

    // Gadgets management
    html.find(".add-gadget").click(this._onAddGadget.bind(this));
    html.find(".gadget-use").click(this._onUseGadget.bind(this));
    html.on("click", ".gadget-remove", this._onRemoveGadget.bind(this));
    html.on("click", ".gadget-item-clickable", this._onGadgetItemClick.bind(this));

    // Long Rest button
    html.find(".long-rest-button").click(this._onLongRest.bind(this));

    // Progression slot management
    html.off("click", ".slot-delete");
    html.on("click", ".slot-delete", this._onDeleteProgressionSlot.bind(this));
    
    // Handle clicks on progression slot items to show details (but not on delete button)
    html.on("click", ".progression-slot .slot-item", this._onProgressionItemClick.bind(this));
    
    // Handle clicks on talent progression slots to open talent selection dialog (off first to prevent duplicate modals)
    const talentSlotSelector = ".progression-slot[data-slot-type='genericTalent'], .progression-slot[data-slot-type='humanGenericTalent'], .progression-slot[data-slot-type='terranGenericTalent'], .progression-slot[data-slot-type='powersetTalent'], .progression-slot[data-slot-type='bastionTalent'], .progression-slot[data-slot-type='paragonTalent'], .progression-slot[data-slot-type='gadgeteerTalent'], .progression-slot[data-slot-type='marksmanTalent']";
    html.off("click", talentSlotSelector);
    html.on("click", talentSlotSelector, this._onTalentSlotClick.bind(this));
    
    // Handle clicks on phenotype, subtype, background, powerset (off first to prevent duplicate modals)
    const itemSlotSelector = ".progression-slot[data-slot-type='phenotype'], .progression-slot[data-slot-type='subtype'], .progression-slot[data-slot-type='background'], .progression-slot[data-slot-type='powerset']";
    html.off("click", itemSlotSelector);
    html.on("click", ".progression-slot[data-slot-type='phenotype']", this._onPhenotypeSlotClick.bind(this));
    html.on("click", ".progression-slot[data-slot-type='subtype']", this._onSubtypeSlotClick.bind(this));
    html.on("click", ".progression-slot[data-slot-type='background']", this._onBackgroundSlotClick.bind(this));
    html.on("click", ".progression-slot[data-slot-type='powerset']", this._onPowersetSlotClick.bind(this));
    
    // Handle ability boost selection changes
    html.find(".ability-boost-select").on("change", this._onAbilityBoostChange.bind(this));
    html.find(".talent-detail-select").on("change", this._onAbilityBoostChange.bind(this));

    // Marksman bonus skill manual save
    html.on("click", ".marksman-skill-save", this._onSaveMarksmanSkillTraining.bind(this));
    html.on("keydown", ".marksman-skill-input", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this._onSaveMarksmanSkillTraining(event);
      }
    });
    
    // Prevent talent slot click when clicking on talent detail select
    html.find(".talent-detail-select").on("click", (event) => {
      event.stopPropagation();
    });

    // Handle Initiative breakdown click
    html.off("click", "[data-action='show-initiative-breakdown']");
    html.on("click", "[data-action='show-initiative-breakdown']", this._onShowInitiativeBreakdown.bind(this));
    
    // Handle AC breakdown click
    html.off("click", "[data-action='show-ac-breakdown']");
    html.on("click", "[data-action='show-ac-breakdown']", this._onShowAcBreakdown.bind(this));
    
    // Handle ability breakdown click
    html.off("click", "[data-action='show-ability-breakdown']");
    html.on("click", "[data-action='show-ability-breakdown']", this._onShowAbilityBreakdown.bind(this));
    
    // Handle ability name click (roll)
    html.off("click", "[data-action='roll-ability']");
    html.on("click", "[data-action='roll-ability']", this._onAbilityNameRoll.bind(this));
    
    // Handle HP breakdown click
    html.off("click", "[data-action='show-hp-breakdown']");
    html.on("click", "[data-action='show-hp-breakdown']", this._onShowHpBreakdown.bind(this));
    
    // Handle saving throw breakdown click
    html.off("click", "[data-action='show-saving-throw-breakdown']");
    html.on("click", "[data-action='show-saving-throw-breakdown']", this._onShowSavingThrowBreakdown.bind(this));
    
    // Handle saving throw name click (roll)
    html.on("click", "[data-action='roll-saving-throw']", this._onRollSavingThrow.bind(this));
    
    // Handle Prime Level increase/decrease buttons
    html.off("click", "[data-action='increase-level']");
    html.off("click", "[data-action='decrease-level']");
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

    this._applyProgressionLockState(html);
  }

  _activateTab(html, tabName) {
    const $tabs = html.find(".sheet-tabs .item");
    const $panes = html.find(".sheet-body .tab");
    $tabs.removeClass("active");
    $panes.removeClass("active");
    html.find(`.sheet-tabs .item[data-tab="${tabName}"]`).addClass("active");
    html.find(`.sheet-body .tab[data-tab="${tabName}"]`).addClass("active");
    this._preferredTab = tabName;
  }

  _applyProgressionLockState(html) {
    const primeLevel = Number(this.actor?.system?.basic?.primeLevel) || 1;
    html.find(".progression-slot[data-level]").each((_, slot) => {
      const $slot = $(slot);
      const level = Number($slot.data("level"));
      const isLocked = Number.isFinite(level) && level < primeLevel;

      if (isLocked) {
        $slot.addClass("progression-locked").attr("data-locked", "true");
        $slot.find("select, input, button, textarea").each((__, control) => {
          if (!control.disabled) {
            control.dataset.lockedDisabled = "true";
            control.disabled = true;
          }
        });
        $slot.find(".slot-delete").addClass("is-disabled").attr("aria-disabled", "true").attr("tabindex", "-1");
      } else {
        $slot.removeClass("progression-locked").removeAttr("data-locked");
        $slot.find("select, input, button, textarea").each((__, control) => {
          if (control.dataset.lockedDisabled === "true") {
            control.disabled = false;
            delete control.dataset.lockedDisabled;
          }
        });
        $slot.find(".slot-delete").removeClass("is-disabled").removeAttr("aria-disabled").removeAttr("tabindex");
      }
    });
  }

  _getIncompleteProgressionLevels(maxLevel, htmlOverride) {
    const root = htmlOverride || this.element;
    const container = root instanceof jQuery ? root : $(root);
    if (!container || !container.length) return [];

    const incomplete = [];
    for (let lvl = 1; lvl < maxLevel; lvl++) {
      const slots = container.find(`.progression-slot[data-level="${lvl}"]`);
      let levelIncomplete = false;

      slots.each((_, slot) => {
        if (levelIncomplete) return;
        const $slot = $(slot);

        if ($slot.find(".slot-placeholder").length) {
          levelIncomplete = true;
          return;
        }

        $slot.find("select.ability-boost-select").each((__, select) => {
          if (levelIncomplete || select.disabled) return;
          if (!String(select.value || "").trim()) {
            levelIncomplete = true;
          }
        });

        $slot.find("input[data-manual-save='true'], input.marksman-skill-input").each((__, input) => {
          if (levelIncomplete || input.disabled) return;
          if (!String(input.value || "").trim()) {
            levelIncomplete = true;
          }
        });
      });

      if (levelIncomplete) {
        incomplete.push(lvl);
      }
    }

    return incomplete;
  }

  _canAccessProgressionLevel(level, htmlOverride) {
    const primeLevel = Number(this.actor?.system?.basic?.primeLevel) || 1;
    if (Number.isFinite(level) && level > primeLevel) {
      ui.notifications.warn("Increase Prime Level before selecting higher-level progression slots.");
      return false;
    }

    const incomplete = this._getIncompleteProgressionLevels(level, htmlOverride);
    if (incomplete.length) {
      const first = incomplete[0];
      ui.notifications.warn(`Complete all Level ${first} selections before choosing higher levels.`);
      return false;
    }

    return true;
  }

  async _onInlineFieldChange(event) {
    try {
      event.preventDefault();
      const input = event.currentTarget;
      const name = input.name;
      let value = input.type === 'number' ? (input.value === '' ? 0 : Number(input.value)) : input.value;
      // Build update data and expand
      const data = {};
      data[name] = value;
      const updateData = foundry.utils.expandObject(data);
      console.log('Singularity | Hero inline update', updateData);
      await this.actor.update(updateData);
      // re-render slightly later
      setTimeout(() => this.render(true), 50);
    } catch (err) {
      console.warn('Singularity | Failed inline update on hero field:', err);
    }
  }

  async _onInlineSelectChange(event) {
    try {
      event.preventDefault();
      const select = event.currentTarget;
      const name = select.name;
      const value = select.value;
      const data = {};
      data[name] = value;
      const updateData = foundry.utils.expandObject(data);
      console.log('Singularity | Hero inline select update', updateData);
      await this.actor.update(updateData);
      setTimeout(() => this.render(true), 50);
    } catch (err) {
      console.warn('Singularity | Failed inline select update on hero field:', err);
    }
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

    // Expand dotted form keys and explicitly update the actor to ensure values persist
    try {
      console.log("Singularity | Hero _updateObject formData:", formData);
      const updateData = foundry.utils.expandObject(formData);
      console.log("Singularity | Hero _updateObject updateData:", updateData);
      const updated = await this.actor.update(updateData);
      console.log("Singularity | Hero actor updated:", updated);
      setTimeout(() => this.render(true), 50);
      return;
    } catch (err) {
      console.warn("Singularity | Failed to update Hero actor from sheet, falling back to super:", err);
      return super._updateObject(event, formData);
    }
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

    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    let dialog;
    const getDialogForm = (event) => {
      if (dialog?.element?.length) {
        const el = dialog.element[0] || dialog.element;
        return el.querySelector("form");
      }
      if (event?.currentTarget?.closest) {
        return event.currentTarget.closest("form");
      }
      if (event?.closest) {
        return event.closest("form");
      }
      if (event?.target?.closest) {
        return event.target.closest("form");
      }
      return null;
    };

    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: "Add Skill",
          content: template,
          buttons: [
            {
              action: "add",
              icon: '<i class="fas fa-check"></i>',
              label: "Add",
              callback: async (event) => {
                const dialogEl = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
                const root = dialogEl instanceof HTMLElement ? dialogEl : document;
                const rawName = String(root.querySelector('input[name="skillName"]')?.value ?? "");
                const skillName = rawName.trim().replace(/\s+/g, " ");
                const normalizedSkillName = skillName
                  ? skillName.charAt(0).toUpperCase() + skillName.slice(1).toLowerCase()
                  : "";
                const ability = root.querySelector('select[name="ability"]')?.value;
                const rank = root.querySelector('select[name="rank"]')?.value;

                if (!normalizedSkillName) {
                  ui.notifications.warn("Please enter a skill name.");
                  return;
                }

                const skills = foundry.utils.deepClone(this.actor.system.skills || {});
                
                // Check if skill already exists
                if (skills[normalizedSkillName]) {
                  ui.notifications.warn(`Skill "${normalizedSkillName}" already exists.`);
                  return;
                }

                skills[normalizedSkillName] = {
                  ability: ability.toLowerCase(),
                  rank: rank,
                  otherBonuses: 0
                };

                await this.actor.update({ "system.skills": skills });
                // Force a full re-render and stay on Skills tab
                this.render(true);
                setTimeout(() => {
                  this._activateTab($(this.element), "skills");
                }, 0);
                ui.notifications.info(`Added skill: ${normalizedSkillName}`);
              }
            },
            {
              action: "cancel",
              icon: '<i class="fas fa-times"></i>',
              label: "Cancel"
            }
          ],
          default: "add"
        }
      : {
          title: "Add Skill",
          content: template,
          buttons: {
            add: {
              icon: '<i class="fas fa-check"></i>',
              label: "Add",
              callback: async (html) => {
                const $html = html instanceof jQuery ? html : $(html);
                const rawName = $html.find('input[name="skillName"]').val() ?? "";
                const skillName = String(rawName).trim().replace(/\s+/g, " ");
                const normalizedSkillName = skillName
                  ? skillName.charAt(0).toUpperCase() + skillName.slice(1).toLowerCase()
                  : "";
                const ability = $html.find('select[name="ability"]').val();
                const rank = $html.find('select[name="rank"]').val();

            if (!normalizedSkillName) {
              ui.notifications.warn("Please enter a skill name.");
              return;
            }

            const skills = foundry.utils.deepClone(this.actor.system.skills || {});
            
            // Check if skill already exists
            if (skills[normalizedSkillName]) {
              ui.notifications.warn(`Skill "${normalizedSkillName}" already exists.`);
              return;
            }

            skills[normalizedSkillName] = {
              ability: ability.toLowerCase(),
              rank: rank,
              otherBonuses: 0
            };

            await this.actor.update({ "system.skills": skills });
            // Force a full re-render
            this.render(true);
            ui.notifications.info(`Added skill: ${normalizedSkillName}`);
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
        };
    dialogOptions.position = { width: 520 };
    dialogOptions.window = { resizable: true };
    dialog = new DialogClass(dialogOptions);
    dialog.render(true);
  }

  async _onDeleteSkill(skillName) {
    if (!skillName) {
      console.warn("No skill name provided for deletion");
      return;
    }

    // Check if this skill comes from a talent (locked)
    const skills = this.actor.system.skills || {};
    const skill = skills[skillName];
    const progressionLevel1 = this.actor.system.progression?.level1 || {};
    const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
    const powersetSkillNames = new Set();
    if (progressionLevel1.paragonSkillTraining) {
      const match = String(progressionLevel1.paragonSkillTraining).match(/^(.+?)\s*\(/);
      if (match?.[1]) powersetSkillNames.add(match[1].trim());
    }
    if (progressionLevel1.gadgeteerSkillTraining) {
      const match = String(progressionLevel1.gadgeteerSkillTraining).match(/^(.+?)\s*\(/);
      if (match?.[1]) powersetSkillNames.add(match[1].trim());
    }
    if (progressionLevel1.marksmanSkillTraining) {
      powersetSkillNames.add(String(progressionLevel1.marksmanSkillTraining).trim());
    }
    if (powersetName === "Marksman") {
      powersetSkillNames.add("Perception");
    }
    if (powersetName === "Gadgeteer") {
      powersetSkillNames.add("Gadget Tuning");
    }

    if (powersetSkillNames.has(skillName)) {
      ui.notifications.warn(`Cannot delete ${skillName}. This skill comes from a powerset. Change it in the Progression tab.`);
      return;
    }
    if (skill && (skill.lockedByPowerset || skill.lockedSource === "Marksman Skill Training" || skill.lockedSource === "Paragon Skill Training" || skill.lockedSource === "Gadgeteer Skill Training")) {
      const source = skill.lockedSource || "a powerset";
      ui.notifications.warn(`Cannot delete ${skillName}. This skill comes from ${source}. Change it in the Progression tab.`);
      return;
    }
    if (skill && skill.lockedOtherBonuses) {
      const source = skill.lockedSource || "a talent";
      ui.notifications.warn(`Cannot delete ${skillName}. This skill comes from ${source}. Remove the talent from the Progression tab to remove this skill.`);
      return;
    }

    // Store reference to this for use in callback
    const self = this;
    const actor = this.actor;

    // Confirm deletion using DialogV2 when available
    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    let dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: "Delete Skill",
          content: `<p>Are you sure you want to delete the skill "<strong>${skillName}</strong>"?</p>`,
          buttons: [
            {
              action: "yes",
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
              setTimeout(() => {
                self._activateTab($(self.element), "skills");
              }, 0);
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
            {
              action: "no",
              icon: '<i class="fas fa-times"></i>',
              label: "Cancel"
            }
          ],
          default: "no"
        }
      : {
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
                  setTimeout(() => {
                    self._activateTab($(self.element), "skills");
                  }, 0);
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
        };
    dialogOptions.position = { width: 420 };
    dialogOptions.window = { resizable: true };
    dialog = new DialogClass(dialogOptions);
    dialog.render(true);
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
    const rwiKey = rwiType === "weakness" ? "weaknesses" : rwiType === "immunity" ? "immunities" : `${rwiType}s`;
    
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
          <label>Value${rwiType === "resistance" || rwiType === "weakness" ? "" : " (optional)"}:</label>
          <input type="number" name="value" ${rwiType === "resistance" || rwiType === "weakness" ? 'min="1" required' : 'min="0"'} placeholder="e.g., 5"/>
          ${rwiType === "resistance" || rwiType === "weakness" ? "" : '<p style="font-size: 11px; color: #a0aec0; margin-top: 5px;">Leave empty if the value is determined by other factors (e.g., 2 × Bastion level)</p>'}
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
    
    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogTitle = `Add ${rwiType.charAt(0).toUpperCase() + rwiType.slice(1)}`;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: dialogTitle,
          content: template,
          buttons: [
            { action: "save", icon: '<i class="fas fa-check"></i>', label: "Add" },
            { action: "cancel", icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          ],
          default: "save",
          submit: async (result, dialog) => {
            if (result !== "save") return;
            const root = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
            const container = root?.shadowRoot || root;
            const damageType = container?.querySelector('select[name="damageType"]')?.value;
            const value = container?.querySelector('input[name="value"]')?.value;
            
            if (!damageType) {
              ui.notifications.warn("Please select a damage type.");
              return;
            }

            let parsedValue = value !== undefined && value !== "" ? parseInt(value, 10) : null;
            if (parsedValue !== null && Number.isNaN(parsedValue)) parsedValue = null;
            if ((rwiType === "resistance" || rwiType === "weakness") && (!parsedValue || parsedValue <= 0)) {
              ui.notifications.warn(`Please enter a ${rwiType} value greater than 0.`);
              return;
            }

            const rwiArray = foundry.utils.deepClone(this.actor.system[rwiKey] || []);
            const newItem = {
              type: damageType,
              value: parsedValue
            };
            
            rwiArray.push(newItem);
            
            await this.actor.update({ [`system.${rwiKey}`]: rwiArray });
            this.render();
            ui.notifications.info(`Added ${damageType} ${rwiType}.`);
          }
        }
      : {
          title: dialogTitle,
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

                let parsedValue = value !== undefined && value !== "" ? parseInt(value, 10) : null;
                if (parsedValue !== null && Number.isNaN(parsedValue)) parsedValue = null;
                if ((rwiType === "resistance" || rwiType === "weakness") && (!parsedValue || parsedValue <= 0)) {
                  ui.notifications.warn(`Please enter a ${rwiType} value greater than 0.`);
                  return;
                }

                const rwiArray = foundry.utils.deepClone(this.actor.system[rwiKey] || []);
                const newItem = {
                  type: damageType,
                  value: parsedValue
                };
                
                rwiArray.push(newItem);
                
                await this.actor.update({ [`system.${rwiKey}`]: rwiArray });
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
        };
    dialogOptions.position = { width: 420, height: "auto" };
    dialogOptions.window = { resizable: true };
    const dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
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
      style: CONST.CHAT_MESSAGE_STYLES.OTHER
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
      style: CONST.CHAT_MESSAGE_STYLES.OTHER
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
    const rwiKey = rwiType === "weakness" ? "weaknesses" : rwiType === "immunity" ? "immunities" : `${rwiType}s`;
    
    const rwiArray = foundry.utils.deepClone(this.actor.system[rwiKey] || []);
    if (id >= 0 && id < rwiArray.length) {
      const removed = rwiArray[id];
      
      // Prevent deletion of resistances from Bastion's Resistance
      if (removed.source === "Bastion's Resistance") {
        ui.notifications.warn("This resistance comes from the Bastion's Resistance talent. Remove the talent from the Progression tab to remove this resistance.");
        return;
      }
      
      rwiArray.splice(id, 1);
      
      await this.actor.update({ [`system.${rwiKey}`]: rwiArray });
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

    const progressionLevel1 = this.actor.system.progression?.level1 || {};
    const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
    const powersetSkillNames = new Set();
    if (progressionLevel1.paragonSkillTraining) {
      const match = String(progressionLevel1.paragonSkillTraining).match(/^(.+?)\s*\(/);
      if (match?.[1]) powersetSkillNames.add(match[1].trim());
    }
    if (progressionLevel1.gadgeteerSkillTraining) {
      const match = String(progressionLevel1.gadgeteerSkillTraining).match(/^(.+?)\s*\(/);
      if (match?.[1]) powersetSkillNames.add(match[1].trim());
    }
    if (progressionLevel1.marksmanSkillTraining) {
      powersetSkillNames.add(String(progressionLevel1.marksmanSkillTraining).trim());
    }
    if (powersetName === "Marksman") {
      powersetSkillNames.add("Perception");
    }
    if (powersetName === "Gadgeteer") {
      powersetSkillNames.add("Gadget Tuning");
    }

    if (powersetSkillNames.has(skillName)) {
      ui.notifications.warn(`Cannot edit ${skillName}. This skill comes from a powerset. Change it in the Progression tab.`);
      return;
    }

    if (skill.lockedByPowerset || skill.lockedSource === "Marksman Skill Training" || skill.lockedSource === "Paragon Skill Training" || skill.lockedSource === "Gadgeteer Skill Training") {
      const source = skill.lockedSource || "a powerset";
      ui.notifications.warn(`Cannot edit ${skillName}. This skill comes from ${source}. Change it in the Progression tab.`);
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

    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: "Edit Skill",
          content: template,
          buttons: [
            { action: "save", icon: '<i class="fas fa-check"></i>', label: "Save" },
            { action: "cancel", icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          ],
          default: "save",
          submit: async (result, dialog) => {
            if (result !== "save") return;
            const root = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
            const container = root?.shadowRoot || root;
            const rawName = String(container?.querySelector('input[name="skillName"]')?.value ?? "");
            const skillNameInput = rawName.trim().replace(/\s+/g, " ");
            const normalizedSkillName = skillNameInput
              ? skillNameInput.charAt(0).toUpperCase() + skillNameInput.slice(1).toLowerCase()
              : "";
            const ability = container?.querySelector('select[name="ability"]')?.value;
            const rank = container?.querySelector('select[name="rank"]')?.value;

            if (!normalizedSkillName) {
              ui.notifications.warn("Please enter a skill name.");
              return;
            }

            const skills = foundry.utils.deepClone(this.actor.system.skills || {});
            const currentNormalized = skillName
              ? skillName.trim().replace(/\s+/g, " ").charAt(0).toUpperCase() + skillName.trim().replace(/\s+/g, " ").slice(1).toLowerCase()
              : "";
            
            // If the name changed, check if normalized name already exists
            if (normalizedSkillName !== currentNormalized) {
              const hasDuplicate = Object.keys(skills).some(name => {
                const normalized = name
                  ? name.trim().replace(/\s+/g, " ").charAt(0).toUpperCase() + name.trim().replace(/\s+/g, " ").slice(1).toLowerCase()
                  : "";
                return normalized === normalizedSkillName;
              });
              if (hasDuplicate) {
                ui.notifications.warn(`Skill "${normalizedSkillName}" already exists.`);
                return;
              }
            }

            // Get the existing skill data (preserve otherBonuses)
            const existingSkill = skills[skillName] || {};
            
            // If name changed, delete old and create new
            if (normalizedSkillName !== skillName) {
              delete skills[skillName];
            }

            skills[normalizedSkillName] = {
              ability: ability?.toLowerCase() || "might",
              rank: rank || "Novice",
              otherBonuses: existingSkill.otherBonuses || 0
            };

            await this.actor.update({ "system.skills": skills });
            this._preferredTab = "skills";
            await this.render(true);
            this._activateTab($(this.element), "skills");
            ui.notifications.info(`Updated skill: ${normalizedSkillName}`);
          }
        }
      : {
          title: "Edit Skill",
          content: template,
          buttons: {
            save: {
              icon: '<i class="fas fa-check"></i>',
              label: "Save",
              callback: async (html) => {
                const rawName = String(html.find('input[name="skillName"]').val() ?? "");
                const skillNameInput = rawName.trim().replace(/\s+/g, " ");
                const normalizedSkillName = skillNameInput
                  ? skillNameInput.charAt(0).toUpperCase() + skillNameInput.slice(1).toLowerCase()
                  : "";
                const ability = html.find('select[name="ability"]').val();
                const rank = html.find('select[name="rank"]').val();

                if (!normalizedSkillName) {
                  ui.notifications.warn("Please enter a skill name.");
                  return;
                }

                const skills = foundry.utils.deepClone(this.actor.system.skills || {});
                const currentNormalized = skillName
                  ? skillName.trim().replace(/\s+/g, " ").charAt(0).toUpperCase() + skillName.trim().replace(/\s+/g, " ").slice(1).toLowerCase()
                  : "";
                
                // If the name changed, check if normalized name already exists
                if (normalizedSkillName !== currentNormalized) {
                  const hasDuplicate = Object.keys(skills).some(name => {
                    const normalized = name
                      ? name.trim().replace(/\s+/g, " ").charAt(0).toUpperCase() + name.trim().replace(/\s+/g, " ").slice(1).toLowerCase()
                      : "";
                    return normalized === normalizedSkillName;
                  });
                  if (hasDuplicate) {
                    ui.notifications.warn(`Skill "${normalizedSkillName}" already exists.`);
                    return;
                  }
                }

                // Get the existing skill data (preserve otherBonuses)
                const existingSkill = skills[skillName] || {};
                
                // If name changed, delete old and create new
                if (normalizedSkillName !== skillName) {
                  delete skills[skillName];
                }

                skills[normalizedSkillName] = {
                  ability: ability.toLowerCase(),
                  rank: rank,
                  otherBonuses: existingSkill.otherBonuses || 0
                };

                await this.actor.update({ "system.skills": skills });
                this._preferredTab = "skills";
                await this.render(true);
                this._activateTab($(this.element), "skills");
                ui.notifications.info(`Updated skill: ${normalizedSkillName}`);
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
        };
    dialogOptions.position = { width: 520, height: "auto" };
    dialogOptions.window = { resizable: true };
    const dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
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
    // Note: Noisy penalty is now included in otherBonuses, not calculated separately

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
            if (extra && extra !== "0") {
              rollFormula += ` + ${extra}`;
            }
            
            const roll = new Roll(rollFormula);
            await roll.evaluate();
            
            const otherText = otherBonuses !== 0 ? ` + ${otherBonuses} (Other)` : "";
            const extraText = extra !== "0" ? ` + ${extra} (Extra)` : "";
            const flavor = `<div class="roll-flavor"><b>${skillName} Skill Roll</b><br>1d20 + ${abilityScore} (${abilityDisplay}) + ${trainingBonus} (${skill?.rank || "Novice"})${otherText}${extraText} = <strong>${roll.total}</strong></div>`;
            
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
    if (!type) {
      ui.notifications.warn("Item type is missing.");
      return;
    }
    const itemData = {
      name: `New ${type ? type.charAt(0).toUpperCase() + type.slice(1) : "Item"}`,
      type: type,
      system: {}
    };
    // Store equipment tab to preserve it after render
    this._preferredTab = "equipment";
    this._scrollPositions = this._scrollPositions || {};
    if (this.element) {
      const $sheet = this.element instanceof jQuery ? this.element : $(this.element);
      this._scrollPositions.equipment = $sheet.find(".tab.equipment").scrollTop() || 0;
    }
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
    
    const stripHtml = (value) => String(value || "").replace(/<[^>]*>/g, "").trim();
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
          
          const rawDescription = armorDoc.system?.description || "";
          const descriptionText = stripHtml(rawDescription);
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
            description: descriptionText,
            descriptionShort: descriptionText.length > 100
              ? `${descriptionText.substring(0, 100)}...`
              : descriptionText
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
    const content = await foundry.applications.handlebars.renderTemplate("systems/singularity/templates/dialogs/armor-selection.html", {
      armors: sortedArmor
    });
    
    // Create and show dialog
    const dialogTitle = "Buy Armor";
    const dialogId = `armor-buy-dialog-${Date.now()}`;
    
    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    let dialog;
    const bindArmorDialog = (html) => {
      const root = html instanceof jQuery ? html[0] : html;
      const dialogEl = root || dialog?.element || null;
      if (!dialogEl) return;
      const containers = [
        dialogEl,
        dialogEl.shadowRoot,
        dialogEl.querySelector?.(".window-content"),
        dialogEl.shadowRoot?.querySelector?.(".window-content")
      ].filter(Boolean);
      const selectAll = (selector) => {
        const results = [];
        for (const container of containers) {
          results.push(...Array.from(container.querySelectorAll(selector)));
        }
        return results;
      };

      const applyFilterStyles = (buttonEl, isActive) => {
        const $button = $(buttonEl);
        $button.css({
          background: isActive ? "rgba(189, 95, 255, 0.3)" : "rgba(189, 95, 255, 0.1)",
          borderColor: isActive ? "#BD5FFF" : "rgba(189, 95, 255, 0.3)",
          color: isActive ? "#ffffff" : "#d1d1d1",
          fontWeight: isActive ? "bold" : "normal"
        });
        $button.toggleClass("active", isActive);
      };

      const setActiveFilter = (buttonEl) => {
        selectAll(".armor-filter-btn").forEach((el) => applyFilterStyles(el, false));
        if (buttonEl) {
          applyFilterStyles(buttonEl, true);
        }
      };

      const applyFilter = (filter) => {
        const normalizedFilter = String(filter || "all").toLowerCase();
        selectAll(".armor-selection-item").forEach((el) => {
          const armorType = String(el.dataset?.armorType || el.getAttribute("data-armor-type") || "").toLowerCase();
          if (normalizedFilter === "all" || armorType === normalizedFilter) {
            el.classList.remove("hidden");
            el.style.display = "flex";
          } else {
            el.classList.add("hidden");
            el.style.display = "none";
          }
        });
      };

      const bindOnce = () => {
        const filterButtons = selectAll(".armor-filter-btn");
        const armorItems = selectAll(".armor-selection-item");
        if (filterButtons.length === 0 || armorItems.length === 0) {
          setTimeout(bindOnce, 50);
          return;
        }
        if (dialogEl.dataset?.armorDialogBound === "1") {
          return;
        }
        filterButtons.forEach((buttonEl) => {
          if (buttonEl.dataset.armorFilterBound === "1") return;
          buttonEl.dataset.armorFilterBound = "1";
          buttonEl.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const filter = buttonEl.dataset.filter || "all";
            setActiveFilter(buttonEl);
            applyFilter(filter);
          });
        });

        armorItems.forEach((itemEl) => {
          if (itemEl.dataset.armorItemBound === "1") return;
          itemEl.dataset.armorItemBound = "1";
          itemEl.addEventListener("click", async (event) => {
            event.preventDefault();
            const itemId = itemEl.dataset.itemId || itemEl.getAttribute("data-item-id");
        
            // Get the full armor document
            const armor = await armorPack.getDocument(itemId);
            if (!armor) {
              ui.notifications.error("Armor not found!");
              return;
            }
            
            // Check if player has enough credits
            const actorCredits = this.actor?.system?.equipment?.credits;
            let currentCredits = Number(actorCredits);
            if (Number.isNaN(currentCredits)) {
              currentCredits = 0;
            }
            if (this.element) {
              const $sheet = this.element instanceof jQuery ? this.element : $(this.element);
              const inputVal = $sheet.find('input[name="system.equipment.credits"]').val();
              if (inputVal !== undefined && inputVal !== null && inputVal !== "") {
                const parsed = Number(inputVal);
                if (!Number.isNaN(parsed)) {
                  currentCredits = parsed;
                }
              }
            }
            const armorPrice = armor.system.basic?.price || 0;
            
            if (currentCredits < armorPrice) {
              ui.notifications.warn(`You don't have enough credits! This armor costs ${armorPrice} credits, but you only have ${currentCredits}.`);
              return;
            }
            
            // Create a copy of the armor item
            const armorData = armor.toObject();
            if (!armorData.type) {
              armorData.type = armor.type;
            }
            
            // Add the armor to the actor's inventory
            await this.actor.createEmbeddedDocuments("Item", [armorData]);
            
            // Deduct credits
            const newCredits = currentCredits - armorPrice;
            await this.actor.update({ "system.equipment.credits": newCredits });
            
            ui.notifications.info(`Purchased ${armor.name} for ${armorPrice} credits. Remaining credits: ${newCredits}.`);
            
            this._preferredTab = "equipment";
            this._scrollPositions = this._scrollPositions || {};
            if (this.element) {
              const $sheet = this.element instanceof jQuery ? this.element : $(this.element);
              this._scrollPositions.equipment = $sheet.find(".tab.equipment").scrollTop() || 0;
            }
            this.render();
            
            // Close the dialog
            dialog.close();
          });
        });

        const defaultButton = selectAll(".armor-filter-btn[data-filter='all']")[0];
        setActiveFilter(defaultButton);
        applyFilter("all");
        dialogEl.dataset.armorDialogBound = "1";
      };

      setTimeout(bindOnce, 0);
    };

    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: dialogTitle,
          content: content,
          buttons: [
            { action: "cancel", icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          ],
          default: "cancel"
        }
      : {
          title: dialogTitle,
          content: content,
          buttons: {
            cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          },
          default: "cancel",
          render: (html) => {
            bindArmorDialog(html);
          }
        };
    dialogOptions.position = { width: 900, height: 700 };
    dialogOptions.window = { resizable: true };
    dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
    if (DialogClass?.name === "DialogV2") {
      const dialogEl = dialog.element instanceof jQuery ? dialog.element[0] : dialog.element;
      if (dialogEl) {
        bindArmorDialog(dialogEl);
      }
    }
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
    
    this._preferredTab = "equipment";
    this._scrollPositions = this._scrollPositions || {};
    this._scrollPositions.equipment = $(this.element).find(".tab.equipment").scrollTop() || 0;

    const itemId = $(event.currentTarget).data("item-id");
    const item = this.actor.items.get(itemId);
    
    if (!item || item.type !== "armor") {
      ui.notifications.warn("Armor item not found!");
      return;
    }
    
    await item.update({ "system.basic.equipped": false });
    ui.notifications.info(`Unequipped ${item.name}.`);
    this.render(true);
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
    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    let dialog;
    const bindWeaponDialog = (html) => {
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
          const actorCredits = this.actor?.system?.equipment?.credits;
          let currentCredits = Number(actorCredits);
          if (Number.isNaN(currentCredits)) {
            currentCredits = 0;
          }
          if (this.element) {
            const $sheet = this.element instanceof jQuery ? this.element : $(this.element);
            const inputVal = $sheet.find('input[name="system.equipment.credits"]').val();
            if (inputVal !== undefined && inputVal !== null && inputVal !== "") {
              const parsed = Number(String(inputVal).replace(/,/g, "").trim());
              if (!Number.isNaN(parsed)) {
                currentCredits = parsed;
              }
            }
          }
          const weaponPrice = Number(weapon.system.basic?.price) || 0;
          
          if (currentCredits < weaponPrice) {
            ui.notifications.warn(`You don't have enough credits! This weapon costs ${weaponPrice} credits, but you only have ${currentCredits}.`);
            return;
          }
          
          // Create a copy of the weapon item
          const weaponData = weapon.toObject();
          if (!weaponData.type) {
            weaponData.type = weapon.type;
          }
          
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
              this._preferredTab = "equipment";
              this._scrollPositions = this._scrollPositions || {};
              if (this.element) {
                const $sheet = this.element instanceof jQuery ? this.element : $(this.element);
                this._scrollPositions.equipment = $sheet.find(".tab.equipment").scrollTop() || 0;
              }
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
    };

    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: dialogTitle,
          content: content,
          buttons: [
            { action: "cancel", icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          ],
          default: "cancel"
        }
      : {
          title: dialogTitle,
          content: content,
          buttons: {
            cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          },
          default: "cancel",
          render: (html) => {
            bindWeaponDialog(html);
          }
        };
    dialogOptions.position = { width: 900, height: 700 };
    dialogOptions.window = { resizable: true };
    dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
    if (DialogClass?.name === "DialogV2") {
      const dialogEl = dialog.element instanceof jQuery ? dialog.element[0] : dialog.element;
      const $html = dialogEl ? $(dialogEl) : null;
      if ($html) {
        bindWeaponDialog($html);
      }
    }
  }

  async _onBuyConsumables(event) {
    event.preventDefault();
    event.stopPropagation();

    const primeLevel = Number(this.actor?.system?.basic?.primeLevel) || 1;
    const equipmentCatalog = [
      {
        name: "Glow Stick",
        price: 2,
        requirement: 1,
        type: "Consumable",
        img: "icons/svg/light.svg",
        description: [
          "A small, flexible tube containing two separate chemical compounds.",
          "When bent, the inner barrier breaks, mixing the chemicals to produce a steady, non-heat-producing light.",
          "The glow stick is waterproof and can be attached to equipment or thrown to illuminate an area.",
          "<strong>Usage:</strong> Activating the glow stick costs 1 energy.",
          "<strong>Effect:</strong> Emits bright light in a 10-foot radius and dim light for an additional 10 feet for 6 hours."
        ].join(" ")
      },
      {
        name: "Med-Gel I",
        price: 5,
        requirement: 1,
        type: "Consumable",
        img: "icons/svg/heal.svg",
        healing: "1d6+1",
        description: [
          "A thick, bio-active gel contained in a single-use applicator.",
          "The gel contains nano-medical particles and regenerative compounds that accelerate natural healing when applied to wounds.",
          "The applicator can be used on yourself or another creature within reach.",
          "<strong>Usage:</strong> Applying the med-gel costs 1 energy.",
          "<strong>Effect:</strong> The target creature immediately regains 1d6 + 1 HP."
        ].join(" ")
      },
      {
        name: "Underwater Breathing Gel",
        price: 5,
        requirement: 1,
        type: "Consumable",
        img: "icons/svg/item-bag.svg",
        description: [
          "A thick, translucent gel infused with oxygenating nano-particles and specialized chemical compounds.",
          "When applied, it creates a thin membrane that extracts oxygen from water and allows you to breathe underwater.",
          "The gel is contained in a small, airtight tube that prevents it from losing its potency.",
          "<strong>Usage:</strong> Applying the gel costs 1 energy.",
          "<strong>Effect:</strong> You can breathe underwater for 1 hour."
        ].join(" ")
      }
    ];

    const availableEquipment = equipmentCatalog.filter((item) => (item.requirement || 1) <= primeLevel);
    if (availableEquipment.length === 0) {
      ui.notifications.warn("No equipment available for your current Prime Level.");
      return;
    }

    const sortedEquipment = availableEquipment.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const content = `
      <div class="equipment-selection-dialog">
        <div class="equipment-content-area">
          <p class="dialog-description">Select equipment to purchase:</p>
          <div class="equipment-list" style="max-height: 400px; overflow-y: auto;">
            ${sortedEquipment.map(item => `
              <div class="equipment-selection-item" data-item-name="${item.name}" style="padding: 10px; margin: 5px 0; border: 1px solid rgba(189, 95, 255, 0.3); border-radius: 3px; cursor: pointer; background: rgba(30, 33, 45, 0.5);">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <img src="${item.img}" style="width: 32px; height: 32px; flex-shrink: 0;" onerror="this.src='icons/svg/item-bag.svg'">
                  <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <div style="font-weight: bold;">${item.name}</div>
                      <div style="font-weight: bold; color: #BD5FFF;">${item.price} credits</div>
                    </div>
                    <div style="font-size: 12px; margin-top: 5px; display: flex; gap: 10px; flex-wrap: wrap;">
                      <span style="padding: 2px 6px; background: rgba(100, 150, 255, 0.2); border-radius: 3px;">${item.type}</span>
                      <span>Req: Prime Level ${item.requirement}</span>
                    </div>
                    ${item.description ? `<div style="font-size: 11px; margin-top: 5px; color: rgba(255, 255, 255, 0.7);">${item.description}</div>` : ""}
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;

    const dialogTitle = "Buy Consumables";
    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    let dialog;
    const bindEquipmentDialog = (root) => {
      const $root = root instanceof jQuery ? root : $(root);
      $root.find(".equipment-selection-item").on("click", async (clickEvent) => {
        const itemName = $(clickEvent.currentTarget).data("item-name");
        const equipment = equipmentCatalog.find((entry) => entry.name === itemName);
        if (!equipment) {
          ui.notifications.error("Equipment not found!");
          return;
        }

        const actorCredits = this.actor?.system?.equipment?.credits;
        let currentCredits = Number(actorCredits);
        if (Number.isNaN(currentCredits)) {
          currentCredits = 0;
        }
        if (this.element) {
          const $sheet = this.element instanceof jQuery ? this.element : $(this.element);
          const inputVal = $sheet.find('input[name="system.equipment.credits"]').val();
          if (inputVal !== undefined && inputVal !== null && inputVal !== "") {
            const parsed = Number(String(inputVal).replace(/,/g, "").trim());
            if (!Number.isNaN(parsed)) {
              currentCredits = parsed;
            }
          }
        }

        const itemPrice = Number(equipment.price) || 0;
        if (currentCredits < itemPrice) {
          ui.notifications.warn(`You don't have enough credits! This item costs ${itemPrice} credits, but you only have ${currentCredits}.`);
          return;
        }

        const existingItem = this.actor.items.find(i => i.type === "equipment" && i.name?.toLowerCase() === equipment.name.toLowerCase());
        if (existingItem) {
          const currentQty = Number(existingItem.system?.basic?.quantity) || 0;
          await existingItem.update({ "system.basic.quantity": currentQty + 1 });
        } else {
          const equipmentData = {
            name: equipment.name,
            type: "equipment",
            img: equipment.img || "icons/svg/item-bag.svg",
            system: {
              basic: {
                quantity: 1,
                price: equipment.price,
                requirement: equipment.requirement,
                type: equipment.type,
                healing: equipment.healing || ""
              },
              description: equipment.description
            }
          };
          await this.actor.createEmbeddedDocuments("Item", [equipmentData]);
        }

        const newCredits = currentCredits - itemPrice;
        await this.actor.update({ "system.equipment.credits": newCredits });

        ui.notifications.info(`Purchased ${equipment.name} for ${itemPrice} credits. Remaining credits: ${newCredits}.`);

        this._preferredTab = "equipment";
        this._scrollPositions = this._scrollPositions || {};
        if (this.element) {
          const $sheet = this.element instanceof jQuery ? this.element : $(this.element);
          this._scrollPositions.equipment = $sheet.find(".tab.equipment").scrollTop() || 0;
        }
        this.render();

        dialog.close();
      });
    };

    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: dialogTitle,
          content: content,
          buttons: [
            { action: "cancel", icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          ],
          default: "cancel"
        }
      : {
          title: dialogTitle,
          content: content,
          buttons: {
            cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          },
          default: "cancel",
          render: (html) => {
            bindEquipmentDialog(html);
          }
        };
    dialogOptions.position = { width: 720, height: 600 };
    dialogOptions.window = { resizable: true };
    dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
    if (DialogClass?.name === "DialogV2") {
      const dialogEl = dialog.element instanceof jQuery ? dialog.element[0] : dialog.element;
      if (dialogEl) {
        bindEquipmentDialog(dialogEl);
      }
    }
  }

  async _onEquipWeapon(event) {
    event.preventDefault();
    event.stopPropagation();
    
    this._preferredTab = "equipment";
    this._scrollPositions = this._scrollPositions || {};
    this._scrollPositions.equipment = $(this.element).find(".tab.equipment").scrollTop() || 0;

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
    this.render(true);
  }

  async _onUnequipWeapon(event) {
    event.preventDefault();
    event.stopPropagation();
    
    this._preferredTab = "equipment";
    this._scrollPositions = this._scrollPositions || {};
    this._scrollPositions.equipment = $(this.element).find(".tab.equipment").scrollTop() || 0;

    const itemId = $(event.currentTarget).data("item-id");
    const item = this.actor.items.get(itemId);
    
    if (!item || item.type !== "weapon") {
      ui.notifications.warn("Weapon item not found!");
      return;
    }
    
    await item.update({ "system.basic.equipped": false });
    ui.notifications.info(`Unequipped ${item.name}.`);
    this.render(true);
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
      // Store equipment tab to preserve it after render
      this._preferredTab = "equipment";
      this._scrollPositions = this._scrollPositions || {};
      if (this.element) {
        const $sheet = this.element instanceof jQuery ? this.element : $(this.element);
        this._scrollPositions.equipment = $sheet.find(".tab.equipment").scrollTop() || 0;
      }
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
    
    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: dialogTitle,
          content: dialogContent,
          buttons: [
            { action: "roll", icon: '<i class="fas fa-dice-d20"></i>', label: "Roll Ability" },
            { action: "cancel", icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          ],
          default: "roll",
          submit: async (result, dialog) => {
            if (result !== "roll") return;
            const root = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
            const container = root?.shadowRoot || root;
            const abilityScore = parseFloat(container?.querySelector("#ability-score")?.value || "0") || 0;
            const extra = (container?.querySelector("#extra-modifier")?.value || "0").trim() || "0";
            
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
        }
      : {
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
        };
    dialogOptions.position = { width: 520, height: "auto" };
    dialogOptions.window = { resizable: true };
    const dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
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

    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: `${abilityDisplay} Score Breakdown`,
          content: dialogContent,
          buttons: [
            { action: "close", icon: '<i class="fas fa-times"></i>', label: "Close" }
          ],
          default: "close"
        }
      : {
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
        };
    dialogOptions.position = { width: 500, height: "auto" };
    dialogOptions.window = { resizable: true };
    const dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
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
            ? `Enhanced Vitality adds +1 per Prime Level as a flat bonus.` 
            : ''}
        </p>
      </div>
    `;

    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: "Maximum HP Breakdown",
          content: dialogContent,
          buttons: [
            { action: "close", icon: '<i class="fas fa-times"></i>', label: "Close" }
          ],
          default: "close"
        }
      : {
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
        };
    dialogOptions.position = { width: 500, height: "auto" };
    dialogOptions.window = { resizable: true };
    const dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
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
      const sourceValue = source.rank !== undefined
        ? source.rank
        : (Number.isFinite(source.bonus) ? `+${source.bonus}` : "");
      sourcesHtml += `
        <div class="breakdown-item">
          <label>${source.name}:</label>
          <span class="breakdown-value">${sourceValue}</span>
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

    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: `${abilityDisplay} Saving Throw Breakdown`,
          content: dialogContent,
          buttons: [
            { action: "close", icon: '<i class="fas fa-times"></i>', label: "Close" }
          ],
          default: "close"
        }
      : {
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
        };
    dialogOptions.position = { width: 520, height: "auto" };
    dialogOptions.window = { resizable: true };
    const dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
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
    let hasIndomitableWill = false;
    let hasImmovableObject = false;
    if (powersetName === "Bastion") {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelKey = `level${lvl}`;
        const levelData = progression[levelKey] || {};
        const bastionTalentName = levelData.bastionTalentName || "";
        if (!bastionTalentName) continue;
        const normalizedTalent = bastionTalentName.toLowerCase();
        if (normalizedTalent.includes("indomitable will")) {
          hasIndomitableWill = true;
        }
        if (normalizedTalent.includes("immovable object")) {
          hasImmovableObject = true;
        }
        if (hasIndomitableWill && hasImmovableObject) break;
      }
    }
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
    let otherBonuses = Number(savingThrow.otherBonuses) || 0;
    if (hasIndomitableWill && (ability === "wits" || ability === "charm")) {
      otherBonuses += 2;
    }

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
        ${hasIndomitableWill ? `
        <div class="roll-options-row">
          <label class="roll-option">
            <input type="checkbox" id="indomitable-will-advantage"/>
            <span>Advantage vs Paralyzed, Staggered, or Dazed</span>
          </label>
        </div>
        ` : ""}
        ${hasImmovableObject ? `
        <div class="roll-options-row">
          <label class="roll-option">
            <input type="checkbox" id="immovable-object-advantage"/>
            <span>Advantage vs Prone</span>
          </label>
        </div>
        ` : ""}
        <p class="help-text">Add any extra bonuses (e.g., +2, +1d6, -1). Click "Roll Saving Throw" to roll 1d20 + ${abilityDisplay} + Competence Bonus + Other Bonuses + Extra Modifier.</p>
      </form>
    `;

    const dialogTitle = `Roll ${abilityDisplay} Saving Throw`;
    
    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: dialogTitle,
          content: dialogContent,
          buttons: [
            { action: "roll", icon: '<i class="fas fa-dice-d20"></i>', label: "Roll Saving Throw" },
            { action: "cancel", icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          ],
          default: "roll",
          submit: async (result, dialog) => {
            if (result !== "roll") return;
            const root = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
            const container = root?.shadowRoot || root;
            const abilityScore = parseFloat(container?.querySelector("#ability-score")?.value || "0") || 0;
            const trainingBonus = parseFloat(container?.querySelector("#training-bonus")?.value || "0") || 0;
            const otherBonuses = parseFloat(container?.querySelector("#other-bonuses")?.value || "0") || 0;
            const extra = (container?.querySelector("#extra-modifier")?.value || "0").trim() || "0";
            const useAdvantage = !!container?.querySelector("#indomitable-will-advantage")?.checked
              || !!container?.querySelector("#immovable-object-advantage")?.checked;
            const rollDie = useAdvantage ? "2d20kh" : "1d20";
            
            // Build roll formula: 1d20 + ability + training + other + extra
            let rollFormula = `${rollDie} + ${abilityScore} + ${trainingBonus} + ${otherBonuses}`;
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
            const flavor = `<div class="roll-flavor"><b>${abilityDisplay} Saving Throw</b><br>${rollDie} + ${abilityScore} (${abilityDisplay}) + ${trainingBonus} (${savingThrow.rank})${otherText}${fatiguedText}${extraText} = <strong>${roll.total}</strong></div>`;
            
            await roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              flavor: flavor
            });
          }
        }
      : {
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
                const useAdvantage = html.find("#indomitable-will-advantage").is(":checked")
                  || html.find("#immovable-object-advantage").is(":checked");
                const rollDie = useAdvantage ? "2d20kh" : "1d20";
                
                // Build roll formula: 1d20 + ability + training + other + extra
                let rollFormula = `${rollDie} + ${abilityScore} + ${trainingBonus} + ${otherBonuses}`;
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
                const flavor = `<div class="roll-flavor"><b>${abilityDisplay} Saving Throw</b><br>${rollDie} + ${abilityScore} (${abilityDisplay}) + ${trainingBonus} (${savingThrow.rank})${otherText}${fatiguedText}${extraText} = <strong>${roll.total}</strong></div>`;
                
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
        };
    dialogOptions.position = { width: 560, height: "auto" };
    dialogOptions.window = { resizable: true };
    const dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
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

    if (this._updatingPrimeLevel) return;
    this._updatingPrimeLevel = true;
    
    const currentLevel = this.actor.system.basic.primeLevel || 1;
    if (currentLevel >= 20) {
      ui.notifications.warn("Maximum level is 20.");
      this._updatingPrimeLevel = false;
      return;
    }

    const incomplete = this._getIncompleteProgressionLevels(currentLevel + 1);
    if (incomplete.length) {
      const first = incomplete[0];
      ui.notifications.warn(`Complete all Level ${first} selections before leveling up.`);
      this._updatingPrimeLevel = false;
      return;
    }
    
    await this.actor.update({
      "system.basic.primeLevel": currentLevel + 1
    });
    this.render();
    this._updatingPrimeLevel = false;
  }

  async _onDecreaseLevel(event) {
    event.preventDefault();
    event.stopPropagation();

    if (this._updatingPrimeLevel) return;
    this._updatingPrimeLevel = true;
    
    const currentLevel = this.actor.system.basic.primeLevel || 1;
    if (currentLevel <= 1) {
      ui.notifications.warn("Minimum level is 1.");
      this._updatingPrimeLevel = false;
      return;
    }
    
    await this.actor.update({
      "system.basic.primeLevel": currentLevel - 1
    });
    this.render();
    this._updatingPrimeLevel = false;
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

    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: "Initiative Breakdown",
          content: dialogContent,
          buttons: [
            { action: "close", icon: '<i class="fas fa-times"></i>', label: "Close" }
          ],
          default: "close"
        }
      : {
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
        };
    dialogOptions.position = { width: 500, height: "auto" };
    dialogOptions.window = { resizable: true };
    const dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
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

    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: "Armor Class Breakdown",
          content: dialogContent,
          buttons: [
            { action: "close", icon: '<i class="fas fa-times"></i>', label: "Close" }
          ],
          default: "close"
        }
      : {
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
        };
    dialogOptions.position = { width: 500, height: "auto" };
    dialogOptions.window = { resizable: true };
    const dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
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

    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    let dialog;
    const getDialogRoot = () => {
      const el = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
      return el instanceof HTMLElement ? el : document;
    };
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: isEdit ? "Edit Attack" : "Add Attack",
          content: dialogContent,
          buttons: [
            {
              action: "save",
              icon: '<i class="fas fa-check"></i>',
              label: "Save",
              callback: async () => {
                const root = getDialogRoot();
                const name = String(root.querySelector("#attack-name")?.value ?? "").trim();
                const icon = root.querySelector("#attack-icon")?.value || "fa-sword";
                const baseAttackBonus = parseFloat(root.querySelector("#attack-bonus")?.value) || 0;
                const baseDamage = String(root.querySelector("#attack-damage")?.value ?? "").trim();
                const damageType = root.querySelector("#attack-damage-type")?.value;
                const range = String(root.querySelector("#attack-range")?.value ?? "").trim();
                const ability = root.querySelector("#attack-ability")?.value || "";
                const cost = parseFloat(root.querySelector("#attack-cost")?.value) || 0;
                const type = root.querySelector("#attack-type")?.value || "";

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
            {
              action: "cancel",
              icon: '<i class="fas fa-times"></i>',
              label: "Cancel"
            }
          ],
          default: "save"
        }
      : {
          title: isEdit ? "Edit Attack" : "Add Attack",
          content: dialogContent,
          buttons: {
            save: {
              icon: '<i class="fas fa-check"></i>',
              label: "Save",
              callback: async (html) => {
                const $html = html instanceof jQuery ? html : $(html);
                const name = $html.find("#attack-name").val().trim();
                const icon = $html.find("#attack-icon").val() || "fa-sword";
                const baseAttackBonus = parseFloat($html.find("#attack-bonus").val()) || 0;
                const baseDamage = $html.find("#attack-damage").val().trim();
                const damageType = $html.find("#attack-damage-type").val();
                const range = $html.find("#attack-range").val().trim();
                const ability = $html.find("#attack-ability").val() || "";
                const cost = parseFloat($html.find("#attack-cost").val()) || 0;
                const type = $html.find("#attack-type").val() || "";
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
        };
    dialogOptions.position = { width: 620 };
    dialogOptions.window = { resizable: true };
    dialog = new DialogClass(dialogOptions);
    dialog.render(true);
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

  _showSavingThrowTrainingDialog(level, slotType, targetRank = "Apprentice") {
    // Get current saving throws to check which ones are already trained
    const savingThrows = this.actor.system.savingThrows || {};
    const savingThrowAbilityNames = ["might", "agility", "endurance", "wits", "charm"];
    const rankOrder = { "Novice": 0, "Apprentice": 1, "Competent": 2, "Masterful": 3, "Legendary": 4 };
    const requiredRank = Object.keys(rankOrder).find(rank => rankOrder[rank] === rankOrder[targetRank] - 1) || "Novice";
    
    // Filter to saving throws at the required rank for this upgrade
    const availableSavingThrows = savingThrowAbilityNames.filter(ability => {
      const savingThrow = savingThrows[ability] || {};
      const rank = savingThrow.rank || "Novice";
      return rank === requiredRank;
    });
    
    if (availableSavingThrows.length === 0) {
      ui.notifications.warn(`No saving throws are currently ${requiredRank}. You cannot apply Saving Throw Training (${targetRank}).`);
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
          This will set the selected saving throw to <strong>${targetRank}</strong> rank.
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
    
    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogTitle = `Saving Throw Training (${targetRank}) - Choose Ability`;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: dialogTitle,
          content: dialogContent,
          buttons: [
            { action: "save", icon: '<i class="fas fa-check"></i>', label: "Train Saving Throw" },
            { action: "cancel", icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          ],
          default: "save",
          submit: async (result, dialog) => {
            const levelKey = `level${level}`;
            if (result !== "save") {
              const updateData = {
                [`system.progression.${levelKey}.${slotType}`]: null,
                [`system.progression.${levelKey}.${slotType}Name`]: null,
                [`system.progression.${levelKey}.${slotType}Img`]: null
              };
              await this.actor.update(updateData);
              this.render();
              return;
            }

            const root = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
            const container = root?.shadowRoot || root;
            const ability = container?.querySelector("#saving-throw-training-ability")?.value;
            if (!ability) {
              ui.notifications.warn("Please select a saving throw.");
              return;
            }

            const savingThrows = foundry.utils.deepClone(this.actor.system.savingThrows || {});
            if (!savingThrows[ability]) {
              savingThrows[ability] = {
                rank: targetRank,
                otherBonuses: 0
              };
            } else {
              savingThrows[ability].rank = targetRank;
            }

            const updateData = {
              "system.savingThrows": savingThrows,
              [`system.progression.${levelKey}.${slotType}SavingThrow`]: ability
            };
            await this.actor.update(updateData);
            this.render();
            ui.notifications.info(`${ability.charAt(0).toUpperCase() + ability.slice(1)} saving throw set to ${targetRank} rank.`);
          }
        }
      : {
          title: dialogTitle,
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

                const savingThrows = foundry.utils.deepClone(this.actor.system.savingThrows || {});
                if (!savingThrows[ability]) {
                  savingThrows[ability] = {
                    rank: targetRank,
                    otherBonuses: 0
                  };
                } else {
                  savingThrows[ability].rank = targetRank;
                }

                const levelKey = `level${level}`;
                const updateData = {
                  "system.savingThrows": savingThrows,
                  [`system.progression.${levelKey}.${slotType}SavingThrow`]: ability
                };
                await this.actor.update(updateData);
                this.render();
                ui.notifications.info(`${ability.charAt(0).toUpperCase() + ability.slice(1)} saving throw set to ${targetRank} rank.`);
              }
            },
            cancel: {
              icon: '<i class="fas fa-times"></i>',
              label: "Cancel",
              callback: async () => {
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
        };

    const dialog = new DialogClass(dialogOptions);
    dialog.render(true);
  }

  _showBastionResistanceDialog(level = 1) {
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

    const levelKey = `level${level}`;
    const existingResistances = (this.actor.system.resistances || [])
      .filter(r => r?.source === "Bastion's Resistance")
      .map(r => String(r.type || "").toLowerCase());
    const existingResistanceSet = new Set(existingResistances);
    
    const dialogContent = `
      <form>
        <p style="color: #d1d1d1; margin-bottom: 20px;">
          Choose one damage type. You gain <strong>resistance</strong> to the chosen damage type equal to <strong>2 × your Bastion level</strong>.
        </p>
        <div class="form-group">
          <label>Damage Type:</label>
          <select id="bastion-resistance-type" required>
            <option value="">Choose Damage Type...</option>
            ${damageTypes.map(type => {
              const isTaken = existingResistanceSet.has(type.toLowerCase());
              const label = isTaken ? `${type} (already chosen)` : type;
              const disabled = isTaken ? " disabled" : "";
              return `<option value="${type}"${disabled}>${label}</option>`;
            }).join('')}
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
              source: "Bastion's Resistance", // Track that this came from the talent
              bastionMultiplier: 2,
              sourceLevel: levelKey
            };
            
            resistances.push(newResistance);
            
            // Store the chosen damage type in progression data
            const updateData = {
              "system.resistances": resistances,
              [`system.progression.${levelKey}.bastionTalentResistanceType`]: damageType
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

  _showAdaptiveDefenseDialog() {
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

    const adaptiveDefenseData = foundry.utils.deepClone(this.actor.system.combat?.adaptiveDefense || { types: [] });
    const existingTypes = (adaptiveDefenseData.types || []).map(type => String(type || "").toLowerCase());
    const existingTypeSet = new Set(existingTypes);

    const dialogContent = `
      <form>
        <p style="color: #d1d1d1; margin-bottom: 20px;">
          Choose the damage type you were just hit by. You gain <strong>Resistance 5</strong> to that type
          for the remainder of the encounter.
        </p>
        <div class="form-group">
          <label>Damage Type:</label>
          <select id="adaptive-defense-type" required>
            <option value="">Choose Damage Type...</option>
            ${damageTypes.map(type => {
              const isTaken = existingTypeSet.has(type.toLowerCase());
              const label = isTaken ? `${type} (already adapted)` : type;
              const disabled = isTaken ? " disabled" : "";
              return `<option value="${type}"${disabled}>${label}</option>`;
            }).join("")}
          </select>
        </div>
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
      title: "Adaptive Defense - Choose Damage Type",
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: "Apply",
          callback: async (html) => {
            const damageType = html.find("#adaptive-defense-type").val();
            if (!damageType) {
              ui.notifications.warn("Please select a damage type.");
              return;
            }

            if (existingTypeSet.has(String(damageType).toLowerCase())) {
              ui.notifications.warn(`${damageType} has already adapted this encounter.`);
              return;
            }

            const resistances = foundry.utils.deepClone(this.actor.system.resistances || []);
            resistances.push({
              type: damageType,
              value: 5,
              source: "Adaptive Defense"
            });

            adaptiveDefenseData.types = [...(adaptiveDefenseData.types || []), damageType];

            await this.actor.update({
              "system.resistances": resistances,
              "system.combat.adaptiveDefense": adaptiveDefenseData
            });
            this.render();
            ui.notifications.info(`Adaptive Defense: gained resistance to ${damageType}.`);
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

  _showBastionResistanceUpgradeDialog(level = 1) {
    const levelKey = `level${level}`;
    const resistances = foundry.utils.deepClone(this.actor.system.resistances || []);
    const bastionResistances = resistances.filter(r => r?.source === "Bastion's Resistance");

    if (bastionResistances.length === 0) {
      ui.notifications.warn("You must take Bastion's Resistance before selecting Increased Resistance.");
      return;
    }

    const dialogContent = `
      <form>
        <p style="color: #d1d1d1; margin-bottom: 20px;">
          Choose one of your existing Bastion's Resistance types. That resistance increases to
          <strong>4 × your Bastion level</strong>.
        </p>
        <div class="form-group">
          <label>Resistance Type:</label>
          <select id="bastion-increased-resistance-type" required>
            <option value="">Choose Resistance...</option>
            ${bastionResistances.map(resistance => {
              const isEnhanced = Number(resistance.bastionMultiplier) === 4;
              const label = isEnhanced ? `${resistance.type} (currently increased)` : resistance.type;
              return `<option value="${resistance.type}">${label}</option>`;
            }).join("")}
          </select>
        </div>
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
      title: "Increased Resistance - Choose Type",
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: "Apply",
          callback: async (html) => {
            const damageType = html.find("#bastion-increased-resistance-type").val();
            if (!damageType) {
              ui.notifications.warn("Please select a resistance type.");
              return;
            }

            const updatedResistances = resistances.map(resistance => {
              if (resistance.source !== "Bastion's Resistance") return resistance;
              if (String(resistance.type).toLowerCase() === String(damageType).toLowerCase()) {
                return { ...resistance, bastionMultiplier: 4 };
              }
              if (Number(resistance.bastionMultiplier) === 4) {
                return { ...resistance, bastionMultiplier: 2 };
              }
              return resistance;
            });

            const updateData = {
              "system.resistances": updatedResistances,
              [`system.progression.${levelKey}.bastionTalentResistanceType`]: damageType
            };

            await this.actor.update(updateData);
            this.render();
            ui.notifications.info(`Increased ${damageType} resistance.`);
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

  _showBastionTotalImmunityDialog(level = 1) {
    const levelKey = `level${level}`;
    const resistances = foundry.utils.deepClone(this.actor.system.resistances || []);
    const increasedResistances = resistances.filter(r => r?.source === "Bastion's Resistance" && Number(r?.bastionMultiplier) === 4);

    if (increasedResistances.length === 0) {
      ui.notifications.warn("You must take Increased Resistance before selecting Total Immunity.");
      return;
    }

    const dialogContent = `
      <form>
        <p style="color: #d1d1d1; margin-bottom: 20px;">
          Choose the damage type you enhanced with Increased Resistance. You will gain Immunity to that type.
        </p>
        <div class="form-group">
          <label>Damage Type:</label>
          <select id="bastion-total-immunity-type" required>
            <option value="">Choose Damage Type...</option>
            ${increasedResistances.map(resistance => `<option value="${resistance.type}">${resistance.type}</option>`).join("")}
          </select>
        </div>
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
      title: "Total Immunity - Choose Type",
      content: dialogContent,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: "Apply",
          callback: async (html) => {
            const damageType = html.find("#bastion-total-immunity-type").val();
            if (!damageType) {
              ui.notifications.warn("Please select a damage type.");
              return;
            }

            const immunities = foundry.utils.deepClone(this.actor.system.immunities || []);
            const existing = immunities.find(imm => imm.type === damageType && imm.source === "Total Immunity");
            if (existing) {
              ui.notifications.warn(`You already have ${damageType} immunity from Total Immunity.`);
              return;
            }

            const newImmunity = {
              type: damageType,
              value: null,
              source: "Total Immunity",
              sourceLevel: levelKey
            };
            immunities.push(newImmunity);

            const updateData = {
              "system.immunities": immunities,
              [`system.progression.${levelKey}.bastionTalentResistanceType`]: damageType
            };

            await this.actor.update(updateData);
            this.render();
            ui.notifications.info(`Added ${damageType} immunity.`);
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
    const gadgetId = event.currentTarget.dataset.gadgetId;
    const attackId = parseInt(event.currentTarget.dataset.attackId);
    const attacks = this.actor.system.attacks || [];
    const attack = gadgetId ? await this._buildGadgetAttackFromUuid(gadgetId) : attacks[attackId];

    if (!attack) return;
    const isGadgetAttack = Boolean(gadgetId) || attack.isGadgetAttack === true;

    // Get equipped weapons to check weapon type (for ranged weapons)
    const items = this.actor.items || [];
    const equippedWeapons = items.filter(i => i && i.type === "weapon" && i.system?.basic?.equipped === true);
    const matchingWeapon = !isGadgetAttack
      ? equippedWeapons.find(w => w.name && attack.name && w.name.toLowerCase() === attack.name.toLowerCase())
      : null;
    const isRangedAttack = attack.type === "ranged" || attack.weaponMode === "thrown" || matchingWeapon?.system?.basic?.type === "ranged";
    if (isRangedAttack && this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "blinded")) {
      ui.notifications.warn("Blinded: ranged attacks are impossible.");
      return;
    }

    const isMeleeAttack = attack.type === "melee" || (!attack.type && !isRangedAttack) || matchingWeapon?.system?.basic?.type === "melee";
    const hasAerialTalent = (actor, talentName) => {
      if (!actor) return false;
      const powersetName = actor.system?.progression?.level1?.powersetName || actor.system?.basic?.powerset;
      if (powersetName !== "Paragon") return false;
      const normalized = String(talentName || "").toLowerCase();
      if (!normalized) return false;
      if (actor.items?.some(item => item.type === "talent" && (item.name || "").toLowerCase().includes(normalized))) {
        return true;
      }
      const progression = actor.system?.progression || {};
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelData = progression[`level${lvl}`] || {};
        const names = [levelData.paragonTalentName, levelData.powersetTalentName].filter(Boolean);
        if (names.some(name => String(name).toLowerCase().includes(normalized))) {
          return true;
        }
      }
      return false;
    };
    const getAerialEvasionBonus = (actor) => {
      if (!isMeleeAttack) return 0;
      const isFlying = actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "flying");
      if (!isFlying || !hasAerialTalent(actor, "aerial evasion")) return 0;
      return 2;
    };
    const getAerialManeuverabilityBonus = (actor) => {
      if (!isRangedAttack) return 0;
      const isFlying = actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "flying");
      if (!isFlying || !hasAerialTalent(actor, "aerial maneuverability")) return 0;
      return 2;
    };

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
    
    if (!isGadgetAttack) {
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
          if (primeLevel >= 15) {
            weaponCompetenceRank = "Legendary";
            weaponCompetenceBonus = 16;
          } else if (primeLevel >= 10) {
            weaponCompetenceRank = "Masterful";
            weaponCompetenceBonus = 12;
          } else if (primeLevel >= 5) {
            weaponCompetenceRank = "Competent";
            weaponCompetenceBonus = 8;
          } else {
            weaponCompetenceRank = "Apprentice";
            weaponCompetenceBonus = 4;
          }
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
    } else {
      weaponCompetenceRank = "Gadget Tuning";
      weaponCompetenceBonus = 0;
    }
    
    // Check for Deadeye bonus (only applies to ranged weapons)
    let deadeyeBonus = 0;
    const deadeyeData = this.actor.system.combat?.deadeye || { active: false };
    if (!isGadgetAttack && deadeyeData.active && (attack.type === "ranged" || (matchingWeapon && matchingWeapon.system?.basic?.type === "ranged"))) {
      deadeyeBonus = 5; // +5 attack bonus from Deadeye
    }
    
    // Calculate final attack bonus
    const scaredEffect = this.actor?.effects?.find(effect => effect.getFlag("core", "statusId") === "scared");
    const scaredPenalty = Math.max(0, Number(scaredEffect?.getFlag("singularity", "value") ?? 0));
    const pronePenalty = this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "prone") ? 2 : 0;
    const fatiguedEffect = this.actor?.effects?.find(effect => effect.getFlag("core", "statusId") === "fatigued");
    const fatiguedPenalty = Math.max(0, Number(fatiguedEffect?.getFlag("singularity", "value") ?? 0));
    const blindedPenalty = this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "blinded") ? 10 : 0;
    // Restricted ranged combat penalty: -5 for Climbing or Flying when making ranged attacks
    let restrictedRangedPenalty = 0;
    let restrictedRangedSource = null;
    if (isRangedAttack) {
      if (this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "climbing")) {
        restrictedRangedPenalty = 5;
        restrictedRangedSource = "Climbing";
      } else if (this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "flying")) {
        restrictedRangedPenalty = 5;
        restrictedRangedSource = "Flying";
      }
    }
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
    if (restrictedRangedPenalty > 0) {
      attackBonus -= restrictedRangedPenalty;
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
          <div class="form-group-inline">
            <label>Repeated Penalty:</label>
            <select id="repeated-penalty" class="editable-input">
              <option value="0">None</option>
              <option value="-5">-5</option>
              <option value="-10">-10</option>
              <option value="-15">-15</option>
              <option value="-20">-20</option>
            </select>
          </div>
        </div>
        <p class="help-text">Add any extra bonuses (e.g., +2, +1d6, -1). Click "Roll Attack" to roll 1d20 + Attack Bonus + Repeated Penalty + Extra Modifier.</p>
      </form>
    `;

    const dialogTitle = `Roll Attack: ${attack.name}`;
    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    let dialog;
    const getDialogRoot = () => {
      const el = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
      return el instanceof HTMLElement ? el : document;
    };
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: dialogTitle,
          content: dialogContent,
          buttons: [
            {
              action: "roll",
              icon: '<i class="fas fa-dice-d20"></i>',
              label: "Roll Attack",
              callback: async () => {
                const root = getDialogRoot();
                const bonus = parseFloat(root.querySelector("#attack-bonus")?.value) || 0;
                const extra = String(root.querySelector("#extra-modifier")?.value ?? "0").trim() || "0";
                const repeatedPenalty = parseFloat(root.querySelector("#repeated-penalty")?.value) || 0;
            
            const hasParalyzedTarget = Array.from(game.user?.targets || []).some(
              target => target.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed")
            );
            const dieFormula = hasParalyzedTarget ? "2d20kh" : "1d20";
            // Build roll formula: d20 + bonus + extra
            let rollFormula = `${dieFormula} + ${bonus}`;
            if (repeatedPenalty) {
              rollFormula += ` + ${repeatedPenalty}`;
            }
            if (extra && extra !== "0") {
              rollFormula += ` + ${extra}`;
            }
            
            const roll = new Roll(rollFormula);
            await roll.evaluate();
            
            const repeatedText = repeatedPenalty ? ` ${repeatedPenalty} (Repeated)` : "";
            const extraText = extra !== "0" ? ` + ${extra} (Extra)` : "";
            // Add Deadeye info if applicable
            const deadeyeData = this.actor.system.combat?.deadeye || { active: false };
            const isDeadeyeActive = !isGadgetAttack && deadeyeData.active && (attack.type === "ranged" || (matchingWeapon && matchingWeapon.system?.basic?.type === "ranged"));
            const deadeyeInfo = isDeadeyeActive ? ` (includes +5 Deadeye)` : "";
            const scaredText = scaredPenalty > 0 ? ` (includes -${scaredPenalty} Scared)` : "";
            const proneText = pronePenalty > 0 ? ` (includes -${pronePenalty} Prone)` : "";
            const fatiguedText = fatiguedPenalty > 0 ? ` (includes -${fatiguedPenalty} Fatigued)` : "";
            const blindedText = blindedPenalty > 0 ? ` (includes -${blindedPenalty} Blinded)` : "";
            const restrictedText = restrictedRangedPenalty > 0 ? ` (includes -${restrictedRangedPenalty} ${restrictedRangedSource})` : "";
            const advantageText = hasParalyzedTarget ? " (advantage vs Paralyzed)" : "";
            let acComparison = "";
            let targetAC = null;
            let effectiveTargetAC = null;
            const targets = Array.from(game.user.targets);
            if (targets.length > 0) {
              const targetToken = targets[0];
              const targetName = targetToken.name || targetToken.actor?.name || "Target";
              const targetActor = targetToken.actor;
              const getTargetAc = async (actor) => {
                if (!actor) return null;
                if (actor.type === "hero" && actor.sheet?.getData) {
                  const sheetData = await actor.sheet.getData();
                  return sheetData?.calculatedAc ?? actor.system?.combat?.ac ?? null;
                }
                return actor.system?.combat?.ac ?? null;
              };
              targetAC = await getTargetAc(targetActor);
              if (targetAC !== null) {
                const aerialBonus = getAerialEvasionBonus(targetActor) + getAerialManeuverabilityBonus(targetActor);
                effectiveTargetAC = targetAC + aerialBonus;
                const acLabel = aerialBonus ? `${effectiveTargetAC} (+${aerialBonus} Aerial)` : `${effectiveTargetAC}`;
                const difference = roll.total - effectiveTargetAC;
                if (difference >= 10) {
                  acComparison = `<span style="color: #2b9a5b; font-weight: bold;">Extreme Success vs ${targetName}! (+${difference} over AC ${acLabel})</span>`;
                } else if (difference >= 0) {
                  acComparison = `<span style="color: #4caf50; font-weight: bold;">Success vs ${targetName}! (Hit AC ${acLabel})</span>`;
                } else if (difference >= -9) {
                  acComparison = `<span style="color: #d78f1f; font-weight: bold;">Failure vs ${targetName} (${difference} vs AC ${acLabel})</span>`;
                } else {
                  acComparison = `<span style="color: #c03a3a; font-weight: bold;">Extreme Failure vs ${targetName} (${difference} vs AC ${acLabel})</span>`;
                }
              }
            }
            const acLine = acComparison ? `<br>${acComparison}` : "";
            const flavor = `<div class="roll-flavor"><b>${attack.name} - Attack Roll</b><br>${dieFormula} + ${bonus} (Attack Bonus${deadeyeInfo}${scaredText}${proneText}${fatiguedText}${blindedText}${restrictedText})${advantageText}${repeatedText}${extraText} = <strong>${roll.total}</strong>${acLine}</div>`;
            
            const message = await roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              flavor: flavor
            });
            
            // Store attack roll result for AC comparison when rolling damage
            await message.setFlag("singularity", "attackRoll", {
              total: roll.total,
              attackId: isGadgetAttack ? gadgetId : attackId,
              attackName: attack.name
            });
            // If this was a success or extreme success vs a target, open the Roll Damage dialog automatically
            if (effectiveTargetAC !== null) {
              const difference = roll.total - effectiveTargetAC;
              if (difference >= 0) {
                try {
                  await this._onRollDamage({ preventDefault: () => {}, currentTarget: { dataset: { attackId: attackId, gadgetId: gadgetId } } });
                } catch (err) {
                  console.warn("Singularity | Failed to open Roll Damage dialog:", err);
                }
              }
            }
            if (dialog?.close) {
              dialog.close();
            }
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
          title: dialogTitle,
          content: dialogContent,
          buttons: {
            roll: {
              icon: '<i class="fas fa-dice-d20"></i>',
              label: "Roll Attack",
              callback: async (html) => {
                const $html = html instanceof jQuery ? html : $(html);
                const bonus = parseFloat($html.find("#attack-bonus").val()) || 0;
                const extra = $html.find("#extra-modifier").val().trim() || "0";
                const repeatedPenalty = parseFloat($html.find("#repeated-penalty").val()) || 0;
                
                const hasParalyzedTarget = Array.from(game.user?.targets || []).some(
                  target => target.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed")
                );
                const dieFormula = hasParalyzedTarget ? "2d20kh" : "1d20";
                // Build roll formula: d20 + bonus + extra
                let rollFormula = `${dieFormula} + ${bonus}`;
                if (repeatedPenalty) {
                  rollFormula += ` + ${repeatedPenalty}`;
                }
                if (extra && extra !== "0") {
                  rollFormula += ` + ${extra}`;
                }
                
                const roll = new Roll(rollFormula);
                await roll.evaluate();
                
                const repeatedText = repeatedPenalty ? ` ${repeatedPenalty} (Repeated)` : "";
                const extraText = extra !== "0" ? ` + ${extra} (Extra)` : "";
                // Add Deadeye info if applicable
                const deadeyeData = this.actor.system.combat?.deadeye || { active: false };
                const isDeadeyeActive = !isGadgetAttack && deadeyeData.active && (attack.type === "ranged" || (matchingWeapon && matchingWeapon.system?.basic?.type === "ranged"));
                const deadeyeInfo = isDeadeyeActive ? ` (includes +5 Deadeye)` : "";
                const scaredText = scaredPenalty > 0 ? ` (includes -${scaredPenalty} Scared)` : "";
                const proneText = pronePenalty > 0 ? ` (includes -${pronePenalty} Prone)` : "";
                const fatiguedText = fatiguedPenalty > 0 ? ` (includes -${fatiguedPenalty} Fatigued)` : "";
                const blindedText = blindedPenalty > 0 ? ` (includes -${blindedPenalty} Blinded)` : "";
                const advantageText = hasParalyzedTarget ? " (advantage vs Paralyzed)" : "";
                let acComparison = "";
                let effectiveTargetAC = null;
                const targets = Array.from(game.user.targets);
                if (targets.length > 0) {
                  const targetToken = targets[0];
                  const targetName = targetToken.name || targetToken.actor?.name || "Target";
                  const targetActor = targetToken.actor;
                  const getTargetAc = async (actor) => {
                    if (!actor) return null;
                    if (actor.type === "hero" && actor.sheet?.getData) {
                      const sheetData = await actor.sheet.getData();
                      return sheetData?.calculatedAc ?? actor.system?.combat?.ac ?? null;
                    }
                    return actor.system?.combat?.ac ?? null;
                  };
                  const targetAC = await getTargetAc(targetActor);
                  if (targetAC !== null) {
                    const aerialBonus = getAerialEvasionBonus(targetActor) + getAerialManeuverabilityBonus(targetActor);
                    effectiveTargetAC = targetAC + aerialBonus;
                    const acLabel = aerialBonus ? `${effectiveTargetAC} (+${aerialBonus} Aerial)` : `${effectiveTargetAC}`;
                    const difference = roll.total - effectiveTargetAC;
                    if (difference >= 10) {
                      acComparison = `<span style="color: #2b9a5b; font-weight: bold;">Extreme Success vs ${targetName}! (+${difference} over AC ${acLabel})</span>`;
                    } else if (difference >= 0) {
                      acComparison = `<span style="color: #4caf50; font-weight: bold;">Success vs ${targetName}! (Hit AC ${acLabel})</span>`;
                    } else if (difference >= -9) {
                      acComparison = `<span style="color: #d78f1f; font-weight: bold;">Failure vs ${targetName} (${difference} vs AC ${acLabel})</span>`;
                    } else {
                      acComparison = `<span style="color: #c03a3a; font-weight: bold;">Extreme Failure vs ${targetName} (${difference} vs AC ${acLabel})</span>`;
                    }
                  }
                }
                const acLine = acComparison ? `<br>${acComparison}` : "";
                const flavor = `<div class="roll-flavor"><b>${attack.name} - Attack Roll</b><br>${dieFormula} + ${bonus} (Attack Bonus${deadeyeInfo}${scaredText}${proneText}${fatiguedText}${blindedText})${advantageText}${repeatedText}${extraText} = <strong>${roll.total}</strong>${acLine}</div>`;
                
                const message = await roll.toMessage({
                  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                  flavor: flavor
                });
                
                // Store attack roll result for AC comparison when rolling damage
                await message.setFlag("singularity", "attackRoll", {
                  total: roll.total,
                  attackId: isGadgetAttack ? gadgetId : attackId,
                  gadgetId: isGadgetAttack ? gadgetId : null,
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
        };
    dialogOptions.position = { width: 560 };
    dialogOptions.window = { resizable: true };
    dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
  }

  async _onRollDamage(event) {
    event.preventDefault();
    if (this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "paralyzed")) {
      ui.notifications.warn("Paralyzed: you cannot take actions or reactions.");
      return;
    }
    const gadgetId = event.currentTarget.dataset.gadgetId;
    const attackId = parseInt(event.currentTarget.dataset.attackId);
    const attacks = this.actor.system.attacks || [];
    const attack = gadgetId ? await this._buildGadgetAttackFromUuid(gadgetId) : attacks[attackId];

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
      const hasBlastDamageEnhancement = this._hasBlastDamageEnhancement(this.actor);
      const isBlastAttack = (attack.name || "").toLowerCase().trim() === "blast";
      const baseDamage = isBlastAttack && hasBlastDamageEnhancement ? "3d4" : attack.baseDamage;
      // New format: baseDamage + calculated ability score
      const currentAbilityScore = calculatedAbilityScores[attack.ability] || 0;
      if (currentAbilityScore > 0) {
        damageFormula = `${baseDamage}+${currentAbilityScore}`;
      } else if (currentAbilityScore < 0) {
        damageFormula = `${baseDamage}${currentAbilityScore}`;
      } else {
        damageFormula = baseDamage;
      }
    } else if (attack.damage) {
      // Legacy format: use stored damage
      damageFormula = attack.damage;
    } else {
      ui.notifications.warn("This attack has no damage formula.");
      return;
    }

    const hasUltimateImpact = (() => {
      const normalized = (attack.name || "").toLowerCase();
      if (normalized !== "unarmed strike") return false;
      const embedded = (this.actor.items || []).some(item =>
        item.type === "talent" && String(item.name || "").toLowerCase().includes("ultimate impact")
      );
      if (embedded) return true;
      const progression = this.actor.system?.progression || {};
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelData = progression[`level${lvl}`] || {};
        const names = [levelData.paragonTalentName, levelData.powersetTalentName].filter(Boolean);
        if (names.some(name => String(name).toLowerCase().includes("ultimate impact"))) {
          return true;
        }
      }
      return false;
    })();
    const hasLegendaryImpact = (() => {
      const normalized = (attack.name || "").toLowerCase();
      if (normalized !== "unarmed strike") return false;
      const embedded = (this.actor.items || []).some(item =>
        item.type === "talent" && String(item.name || "").toLowerCase().includes("legendary impact")
      );
      if (embedded) return true;
      const progression = this.actor.system?.progression || {};
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelData = progression[`level${lvl}`] || {};
        const names = [levelData.paragonTalentName, levelData.powersetTalentName].filter(Boolean);
        if (names.some(name => String(name).toLowerCase().includes("legendary impact"))) {
          return true;
        }
      }
      return false;
    })();
    const impactBonus = hasLegendaryImpact ? "2d12" : (hasUltimateImpact ? "1d12" : "");
    if (impactBonus) {
      damageFormula += ` + ${impactBonus}`;
    }
    
    // Check for Supersonic Moment bonus (only applies to melee attacks)
    let supersonicBonus = 0;
    const supersonicData = this.actor.system.combat?.supersonicMoment || { active: false, distance: 0 };
    const supersonicStep = (() => {
      if (!supersonicData.active || attack.range !== "Melee") return 0;
      const progression = this.actor.system?.progression || {};
      const names = [];
      for (let lvl = 1; lvl <= 20; lvl++) {
        const levelData = progression[`level${lvl}`] || {};
        if (levelData.paragonTalentName) names.push(levelData.paragonTalentName);
        if (levelData.powersetTalentName) names.push(levelData.powersetTalentName);
      }
      const embedded = (this.actor.items || [])
        .filter(item => item.type === "talent")
        .map(item => String(item.name || "").toLowerCase());
      const allNames = names.map(name => String(name).toLowerCase()).concat(embedded);
      if (allNames.some(name => name.includes("supreme velocity"))) return 6;
      if (allNames.some(name => name.includes("improved supersonic moment"))) return 4;
      return 2;
    })();
    if (supersonicStep > 0) {
      const distance = Number(supersonicData.distance) || 0;
      supersonicBonus = Math.floor(distance / 15) * supersonicStep;
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
        <p class="help-text">Add any extra damage (e.g., +2, +1d6, -1). Base: ${damageFormula} (${attack.damageType}).${supersonicBonus > 0 ? ` Supersonic Moment: +${supersonicBonus} damage.` : ''}${hasLegendaryImpact ? " Legendary Impact: +2d12 damage (replaces Ultimate Impact)." : (hasUltimateImpact ? " Ultimate Impact: +1d12 damage." : "")} Click "Roll Damage" to roll the formula + extra modifier.</p>
      </form>
    `;

    const dialogTitle = `Roll Damage: ${attack.name}`;
    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    let dialog;
    const getDialogRoot = () => {
      const el = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
      return el instanceof HTMLElement ? el : document;
    };
    const rollDamage = async (root) => {
      const damageFormula = String(root.querySelector("#damage-formula")?.value ?? "").trim();
      const extra = String(root.querySelector("#extra-modifier")?.value ?? "0").trim() || "0";
      // Get Supersonic bonus from the input field if it exists, otherwise calculate it
      const supersonicBonusInput = root.querySelector("#supersonic-bonus");
      let supersonicBonus = 0;
      if (supersonicBonusInput) {
        supersonicBonus = parseFloat(supersonicBonusInput.value) || 0;
      } else {
        // Fallback: calculate from actor data
        const supersonicData = this.actor.system.combat?.supersonicMoment || { active: false, distance: 0 };
        const supersonicStep = (() => {
          if (!supersonicData.active || attack.range !== "Melee") return 0;
          const progression = this.actor.system?.progression || {};
          const names = [];
          for (let lvl = 1; lvl <= 20; lvl++) {
            const levelData = progression[`level${lvl}`] || {};
            if (levelData.paragonTalentName) names.push(levelData.paragonTalentName);
            if (levelData.powersetTalentName) names.push(levelData.powersetTalentName);
          }
          const embedded = (this.actor.items || [])
            .filter(item => item.type === "talent")
            .map(item => String(item.name || "").toLowerCase());
          const allNames = names.map(name => String(name).toLowerCase()).concat(embedded);
          if (allNames.some(name => name.includes("supreme velocity"))) return 6;
          if (allNames.some(name => name.includes("improved supersonic moment"))) return 4;
          return 2;
        })();
        if (supersonicStep > 0) {
          const distance = Number(supersonicData.distance) || 0;
          supersonicBonus = Math.floor(distance / 15) * supersonicStep;
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
      const impactText = hasLegendaryImpact
        ? " + 2d12 (Legendary Impact)"
        : (hasUltimateImpact ? " + 1d12 (Ultimate Impact)" : "");
      
      const isIncorporeal = this.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "incorporeal");
      const hasCorporealTarget = isIncorporeal && Array.from(game.user?.targets || []).some(
        target => !target.actor?.effects?.some(effect => effect.getFlag("core", "statusId") === "incorporeal")
      );
      const finalTotal = hasCorporealTarget ? Math.floor(roll.total / 2) : roll.total;
      const incorporealText = hasCorporealTarget ? ` (half vs corporeal: ${finalTotal})` : "";
      const actionButtons = `<div class="chat-card-buttons" style="margin-top: 5px;">
        <button type="button" class="apply-damage-button" data-roll-total="${finalTotal}" data-damage-type="${attack.damageType}" data-attack-name="${attack.name}" style="padding: 4px 8px; background: rgba(40, 110, 70, 0.5); color: #ffffff; border: 1px solid rgba(40, 110, 70, 0.8); border-radius: 3px; cursor: pointer; font-size: 11px;"><i class="fas fa-bullseye"></i> Apply Damage</button>
        <button type="button" class="critical-hit-button" data-roll-total="${finalTotal}" data-damage-type="${attack.damageType}" data-attack-name="${attack.name}" style="padding: 4px 8px; background: rgba(220, 53, 69, 0.5); color: #ffffff; border: 1px solid rgba(220, 53, 69, 0.8); border-radius: 3px; cursor: pointer; font-size: 11px; margin-left: 6px;"><i class="fas fa-bolt"></i> Apply Critical (x2)</button>
      </div>`;
      const impactNote = hasLegendaryImpact
        ? "<br><em>Legendary Impact:</em> On a critical hit with an unarmed attack, maximize all dice for this attack, and the target must succeed a Might Save against your Might DC or be Stunned until the end of their next turn. You can also push the target up to 20 feet (Ultimate Impact)."
        : (hasUltimateImpact
          ? "<br><em>Ultimate Impact:</em> On a critical hit with an unarmed attack, you can push the target up to 20 feet."
          : "");
      const flavor = `<div class="roll-flavor"><b>${attack.name} - Damage</b><br>${damageFormula} (${attack.damageType})${supersonicText}${impactText}${extraText} = <strong>${roll.total}</strong>${incorporealText}${actionButtons}${impactNote}</div>`;
      
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
    };

    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: dialogTitle,
          content: dialogContent,
          buttons: [
            {
              action: "roll",
              icon: '<i class="fas fa-dice-d20"></i>',
              label: "Roll Damage",
              callback: async () => {
                const root = getDialogRoot();
                await rollDamage(root);
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
          title: dialogTitle,
          content: dialogContent,
          buttons: {
            roll: {
              icon: '<i class="fas fa-dice-d20"></i>',
              label: "Roll Damage",
              callback: async (html) => {
                const $html = html instanceof jQuery ? html : $(html);
                await rollDamage($html[0] || $html.get(0));
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
    dialogOptions.position = { width: 560 };
    dialogOptions.window = { resizable: true };
    dialog = new DialogClass(dialogOptions);
    dialog.render(true);
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
    // Don't call render() to preserve current tab state
  }

  async _onSupersonicDistanceChange(event) {
    event.preventDefault();
    const distance = parseInt(event.currentTarget.value) || 0;
    const supersonicData = foundry.utils.deepClone(this.actor.system.combat?.supersonicMoment || { active: false, distance: 0 });
    supersonicData.distance = Math.max(0, distance); // Ensure non-negative
    
    await this.actor.update({ "system.combat.supersonicMoment": supersonicData });
    // Don't call render() to preserve current tab state
  }

  async _onDeadeyeToggle(event) {
    event.preventDefault();
    const isActive = event.currentTarget.checked;
    
    await this.actor.update({ "system.combat.deadeye": { active: isActive } });
    // Don't call render() to preserve current tab state
  }

  async _onEnoughPrepTimeToggle(event) {
    event.preventDefault();
    const isActive = event.currentTarget.checked;
    const enoughPrepTimeData = foundry.utils.deepClone(this.actor.system.combat?.enoughPrepTime || { active: false });
    enoughPrepTimeData.active = isActive;
    await this.actor.update({ "system.combat.enoughPrepTime": enoughPrepTimeData });
    // Don't call render() to preserve current tab state
  }

  async _onRegenerativeFortitudeToggle(event) {
    event.preventDefault();
    const isUsed = event.currentTarget.checked;
    const regenerativeData = foundry.utils.deepClone(this.actor.system.combat?.regenerativeFortitude || { used: false });
    regenerativeData.used = isUsed;
    await this.actor.update({ "system.combat.regenerativeFortitude": regenerativeData });
    // Don't call render() to preserve current tab state
  }

  async _onSpecializedAmmoUse(event) {
    event.preventDefault();
    const max = parseInt(event.currentTarget.dataset.max) || 1;
    const ammoData = foundry.utils.deepClone(this.actor.system.combat?.specializedAmmo || { used: 0 });
    ammoData.used = Math.min((ammoData.used || 0) + 1, max);
    await this.actor.update({ "system.combat.specializedAmmo": ammoData });
  }

  async _onSpecializedAmmoReset(event) {
    event.preventDefault();
    await this.actor.update({ "system.combat.specializedAmmo": { used: 0 } });
  }

  async _onLightningReloadUse(event) {
    event.preventDefault();
    const max = parseInt(event.currentTarget.dataset.max) || 1;
    const lrData = foundry.utils.deepClone(this.actor.system.combat?.lightningReload || { used: 0 });
    lrData.used = Math.min((lrData.used || 0) + 1, max);
    await this.actor.update({ "system.combat.lightningReload": lrData });
  }

  async _onLightningReloadReset(event) {
    event.preventDefault();
    await this.actor.update({ "system.combat.lightningReload": { used: 0 } });
  }

  async _onDeadlyFocusUse(event) {
    event.preventDefault();
    const max = parseInt(event.currentTarget.dataset.max) || 1;
    const dfData = foundry.utils.deepClone(this.actor.system.combat?.deadlyFocus || { used: 0 });
    dfData.used = Math.min((dfData.used || 0) + 1, max);
    await this.actor.update({ "system.combat.deadlyFocus": dfData });
  }

  async _onDeadlyFocusReset(event) {
    event.preventDefault();
    await this.actor.update({ "system.combat.deadlyFocus": { used: 0 } });
  }

  async _onImpossibleShotToggle(event) {
    event.preventDefault();
    const isUsed = event.currentTarget.checked;
    await this.actor.update({ "system.combat.impossibleShot": { used: isUsed } });
  }

  async _onPerfectShotToggle(event) {
    event.preventDefault();
    const isUsed = event.currentTarget.checked;
    await this.actor.update({ "system.combat.perfectShot": { used: isUsed } });
  }

  async _onProtectiveBarrierToggle(event) {
    event.preventDefault();
    const isActive = event.currentTarget.checked;
    const protectiveBarrierData = foundry.utils.deepClone(this.actor.system.combat?.protectiveBarrier || { active: false });
    protectiveBarrierData.active = isActive;
    await this.actor.update({ "system.combat.protectiveBarrier": protectiveBarrierData });
    // Don't call render() to preserve current tab state
  }

  async _onAdaptiveDefenseAdd(event) {
    event.preventDefault();
    event.stopPropagation();
    await this._showAdaptiveDefenseDialog();
  }

  async _onAdaptiveDefenseReset(event) {
    event.preventDefault();
    event.stopPropagation();
    const resistances = foundry.utils.deepClone(this.actor.system.resistances || []);
    const filteredResistances = resistances.filter(resistance => resistance.source !== "Adaptive Defense");
    const adaptiveDefenseData = foundry.utils.deepClone(this.actor.system.combat?.adaptiveDefense || { types: [] });
    adaptiveDefenseData.types = [];
    await this.actor.update({
      "system.resistances": filteredResistances,
      "system.combat.adaptiveDefense": adaptiveDefenseData
    });
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
    
    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    let dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: `Select Level ${gadgetLevel} Gadget`,
          content: content,
          buttons: [
            {
              action: "cancel",
              icon: '<i class="fas fa-times"></i>',
              label: "Cancel",
              callback: () => dialog?.close?.()
            }
          ],
          default: "cancel"
        }
      : {
          title: `Select Level ${gadgetLevel} Gadget`,
          content: content,
          buttons: {
            cancel: {
              icon: '<i class="fas fa-times"></i>',
              label: "Cancel",
              callback: () => dialog?.close?.()
            }
          },
          default: "cancel"
        };
    dialog = new DialogClass(dialogOptions);
    dialog.render(true);

    const getDialogRoot = () => {
      const el = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
      return el instanceof HTMLElement ? el : null;
    };
    
    // Set dialog size after rendering - make it much taller to show more gadgets
    setTimeout(() => {
      const root = getDialogRoot();
      const windowElement = root ? root.closest(".window-app") : null;
      if (windowElement) {
        windowElement.style.width = "650px";
        windowElement.style.minWidth = "650px";
        windowElement.style.maxWidth = "650px";
        windowElement.style.height = "700px";
        windowElement.style.minHeight = "700px";
        windowElement.style.maxHeight = "700px";
        // Also set the content area height
        const contentElement = root?.querySelector(".window-content");
        if (contentElement) {
          contentElement.style.height = "600px";
          contentElement.style.minHeight = "600px";
          contentElement.style.maxHeight = "600px";
          contentElement.style.overflowY = "auto";
        }
      }
    }, 100);
    
    // Get current prepared gadgets to check for duplicates (Level 0 only)
    const currentGadgets = this.actor.system.gadgets?.prepared || { level0: [], level1: [], level2: [], level3: [] };
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
      const root = getDialogRoot();
      const selection = root?.querySelector(".gadget-selection-dialog");
      if (selection) {
        selection.innerHTML = `<p>No Level ${gadgetLevel} gadgets found in compendium.</p>`;
      }
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
    
    {
      const root = getDialogRoot();
      const selection = root?.querySelector(".gadget-selection-dialog");
      if (selection) {
        selection.outerHTML = updatedContent;
      }
    }
    
    // Re-apply sizing after content update to ensure dialog is tall enough
    setTimeout(() => {
      const root = getDialogRoot();
      const windowElement = root ? root.closest(".window-app") : null;
      if (windowElement) {
        windowElement.style.width = "650px";
        windowElement.style.minWidth = "650px";
        windowElement.style.maxWidth = "650px";
        windowElement.style.height = "700px";
        windowElement.style.minHeight = "700px";
        windowElement.style.maxHeight = "700px";
        const contentElement = root?.querySelector(".window-content");
        if (contentElement) {
          contentElement.style.height = "600px";
          contentElement.style.minHeight = "600px";
          contentElement.style.maxHeight = "600px";
          contentElement.style.overflowY = "auto";
        }
      }
    }, 50);
    
    // Add click handlers
    {
      const root = getDialogRoot();
      const selectable = root?.querySelectorAll(".gadget-item-selectable") || [];
      selectable.forEach((element) => {
        element.addEventListener("click", async (event) => {
          const target = event.currentTarget;
          const gadgetId = target?.dataset?.gadgetId;
          const gadgetName = target?.dataset?.gadgetName;
          const isDuplicate = target?.classList?.contains("gadget-duplicate");
      
      // Prevent adding duplicate Level 0 gadgets
          if (isDuplicate && gadgetLevel === 0) {
            ui.notifications.warn(`"${gadgetName}" is already prepared. Level 0 gadgets cannot be prepared twice.`);
            return;
          }
      
      // Get the full gadget document to get its image
          let gadgetImg = "icons/svg/mystery-man.svg";
          let gadgetBasic = {};
          try {
            const gadgetDoc = await fromUuid(gadgetId);
            if (gadgetDoc && gadgetDoc.img) {
              gadgetImg = gadgetDoc.img;
            }
            gadgetBasic = gadgetDoc?.system?.basic || {};
          } catch (err) {
            console.warn(`Could not load gadget image for ${gadgetName}:`, err);
          }
      
          const gadgets = foundry.utils.deepClone(this.actor.system.gadgets?.prepared || { level0: [], level1: [], level2: [], level3: [] });
          const damageFormula = this._getGadgetDamageFormulaFromBasic(gadgetBasic);
          const healingFormula = this._getGadgetHealingFormulaFromBasic(gadgetBasic);
          
          if (!gadgets[levelKey]) {
            gadgets[levelKey] = [];
          }
          
          // If slotIndex is specified, insert at that position; otherwise append
          if (slotIndex !== undefined && slotIndex !== null && !isNaN(slotIndex)) {
            gadgets[levelKey][slotIndex] = {
              id: gadgetId,
              name: gadgetName,
              img: gadgetImg,
              used: false,
              damage: damageFormula,
              damageType: gadgetBasic.damageType,
              range: gadgetBasic.range,
              energyCost: gadgetBasic.energyCost,
              attackBonus: gadgetBasic.attackBonus,
              healing: healingFormula
            };
          } else {
            gadgets[levelKey].push({
              id: gadgetId,
              name: gadgetName,
              img: gadgetImg,
              used: false,
              damage: damageFormula,
              damageType: gadgetBasic.damageType,
              range: gadgetBasic.range,
              energyCost: gadgetBasic.energyCost,
              attackBonus: gadgetBasic.attackBonus,
              healing: healingFormula
            });
          }
          
          this._preferredTab = "gadgets";
          await this.actor.update({ "system.gadgets.prepared": gadgets });
          this.render();
          dialog?.close?.();
        });
      });
    }
  }

  async _onUseGadget(event) {
    event.preventDefault();
    event.stopPropagation();
    const gadgetLevel = parseInt(event.currentTarget.dataset.gadgetLevel);
    const gadgetIndex = parseInt(event.currentTarget.dataset.gadgetIndex);
    
    const gadgets = foundry.utils.deepClone(this.actor.system.gadgets?.prepared || { level0: [], level1: [], level2: [], level3: [] });
    const levelKey = `level${gadgetLevel}`;
    
    if (gadgets[levelKey] && gadgets[levelKey][gadgetIndex]) {
      // Level 0 gadgets can be used unlimited times, Level 1+ can only be used once
      const gadgetEntry = gadgets[levelKey][gadgetIndex];
      const gadgetId = gadgetEntry?.id;
      const gadgetName = gadgetEntry?.name || "Gadget";

      if (gadgetId) {
        try {
          const gadgetDoc = await fromUuid(gadgetId);
          if (gadgetDoc) {
            const gadgetActions = this._getGadgetChatActions(gadgetDoc);
            if (gadgetActions?.canSave) {
              gadgetActions.showSaveButton = (game.user?.targets?.size || 0) > 0;
            }
            const content = await foundry.applications.handlebars.renderTemplate("systems/singularity/templates/chat/item-card.html", {
              item: gadgetDoc,
              actor: this.actor,
              gadgetActions: gadgetActions,
              talentActions: this._getTalentChatActions(gadgetDoc),
              hideImage: true
            });
            await ChatMessage.create({
              content: content,
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              style: CONST.CHAT_MESSAGE_STYLES.OTHER
            });
          }
        } catch (err) {
          console.warn("Singularity | Failed to post gadget card:", err);
        }
      }

      await this._markGadgetUsed(gadgets, levelKey, gadgetIndex, gadgetLevel, gadgetName);
    }
  }

  async _onUseConsumable(event) {
    event.preventDefault();
    event.stopPropagation();
    this._preferredTab = "equipment";

    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item || item.type !== "equipment") {
      ui.notifications.warn("Consumable not found!");
      return;
    }

    // Post item card to chat (same flow as gadgets)
    try {
      const content = await foundry.applications.handlebars.renderTemplate("systems/singularity/templates/chat/item-card.html", {
        item: item,
        actor: this.actor,
        talentActions: this._getTalentChatActions(item),
        hideImage: true
      });
      await ChatMessage.create({
        content: content,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        style: CONST.CHAT_MESSAGE_STYLES.OTHER
      });
    } catch (err) {
      console.warn("Singularity | Failed to post consumable card:", err);
    }

    const rawHealing =
      item.system?.basic?.healing ||
      item.system?.basic?.healingFormula ||
      (item.name && /med\s*[-]?\s*gel/i.test(item.name) ? "1d6+1" : "");
    if (rawHealing) {
      await this._rollConsumableHealing(String(rawHealing), item.name);
    }

    const rawQty = Number(item.system?.basic?.quantity);
    const currentQty = Number.isFinite(rawQty) ? rawQty : 1;
    const nextQty = currentQty - 1;
    if (nextQty <= 0) {
      await item.delete();
    } else {
      await item.update({ "system.basic.quantity": nextQty });
    }
    this.render(true);
  }

  async _rollConsumableHealing(healFormula, itemName) {
    const formula = String(healFormula || "").trim();
    if (!formula) {
      return false;
    }

    const targets = Array.from(game.user?.targets || []);
    const targetToken = targets[0];
    if (!targetToken) {
      ui.notifications.warn("Select a target to report consumable healing.");
      return false;
    }

    const roll = new Roll(formula);
    await roll.evaluate();
    const targetName = targetToken.name || targetToken.actor?.name || "Target";
    const healContent = `<div class="roll-flavor"><b>${itemName}</b><br>${targetName} heals for <strong>${roll.total}</strong> (${formula})</div>`;
    const message = await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: healContent
    });
    await message.setFlag("singularity", "healRoll", {
      total: roll.total,
      formula: formula,
      gadgetName: itemName,
      healerActorId: this.actor?.id
    });

    return true;
  }

  async _onHealGadget(event) {
    event.preventDefault();
    event.stopPropagation();
    this._preferredTab = "gadgets";
    const gadgetLevel = parseInt(event.currentTarget.dataset.gadgetLevel);
    const gadgetIndex = parseInt(event.currentTarget.dataset.gadgetIndex);
    const gadgets = foundry.utils.deepClone(this.actor.system.gadgets?.prepared || { level0: [], level1: [], level2: [], level3: [] });
    const levelKey = `level${gadgetLevel}`;

    if (gadgets[levelKey] && gadgets[levelKey][gadgetIndex]) {
      const gadgetEntry = gadgets[levelKey][gadgetIndex];
      const gadgetId = gadgetEntry?.id;
      const gadgetName = gadgetEntry?.name || "Gadget";
      let gadgetDoc = null;

      if (gadgetId) {
        try {
          gadgetDoc = await fromUuid(gadgetId);
        } catch (err) {
          console.warn("Singularity | Failed to load gadget for healing:", err);
        }
      }

      const didHeal = await this._rollGadgetHealing(gadgetEntry, gadgetDoc);
      if (!didHeal) {
        ui.notifications.warn(`${gadgetName} has no healing formula to roll.`);
        return;
      }

      await this._markGadgetUsed(gadgets, levelKey, gadgetIndex, gadgetLevel, gadgetName);
    }
  }

  async _markGadgetUsed(gadgets, levelKey, gadgetIndex, gadgetLevel, gadgetName) {
    if (gadgetLevel === 0) {
      ui.notifications.info(`${gadgetName} used! (Level 0 gadgets can be used unlimited times)`);
      return;
    }

    gadgets[levelKey][gadgetIndex].used = true;
    await this.actor.update({ "system.gadgets.prepared": gadgets });
    this.render();
    ui.notifications.info(`${gadgetName} used!`);
  }

  async _rollGadgetHealing(gadgetEntry, gadgetDoc) {
    const healFormula =
      gadgetEntry?.healing ||
      (gadgetDoc ? this._getGadgetHealingFormula(gadgetDoc) : "");
    if (!healFormula) {
      return false;
    }

    const targets = Array.from(game.user?.targets || []);
    const targetToken = targets[0];
    if (!targetToken) {
      ui.notifications.warn("Select a target to report gadget healing.");
      return false;
    }

    const roll = new Roll(healFormula);
    await roll.evaluate();
    const targetName = targetToken.name || targetToken.actor?.name || "Target";
    const gadgetName = gadgetDoc?.name || gadgetEntry?.name || "Gadget";
    const healContent = `<div class="roll-flavor"><b>${gadgetName}</b><br>${targetName} heals for <strong>${roll.total}</strong> (${healFormula})</div>`;
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: healContent
    });

    return true;
  }

  _getGadgetHealingFormula(gadgetDoc) {
    if (!gadgetDoc?.system) return "";
    const basicFormula = this._getGadgetHealingFormulaFromBasic(gadgetDoc.system.basic || {});
    if (basicFormula) return basicFormula;
    return this._getGadgetHealingFormulaFromDescription(
      gadgetDoc.system.description || gadgetDoc.system.details?.description || ""
    );
  }

  _getGadgetHealingFormulaFromBasic(basic) {
    if (!basic) return "";
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

    return formula;
  }

  _getGadgetHealingFormulaFromDescription(description) {
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
  }

  _getGadgetDamageFormula(gadgetDoc) {
    if (!gadgetDoc?.system) return "";
    const basicFormula = this._getGadgetDamageFormulaFromBasic(gadgetDoc.system.basic || {});
    if (basicFormula) return basicFormula;
    return this._getGadgetDamageFormulaFromDescription(
      gadgetDoc.system.description || gadgetDoc.system.details?.description || ""
    );
  }

  _getGadgetDamageFormulaFromBasic(basic) {
    if (!basic) return "";
    const direct = basic.damage || basic.damageFormula || basic.damageRoll || basic.attackDamage;
    if (direct) return String(direct).trim();

    const flatValue = basic.damageValue ?? basic.damageAmount ?? null;
    const dice = basic.damageDice || basic.damageDie || basic.damageDiceFormula;
    const diceCount = basic.damageDiceCount || basic.damageCount || basic.damageDiceNumber;
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

    const bonus = Number(basic.damageBonus ?? basic.damageMod ?? basic.damageModifier ?? 0);
    if (formula && Number.isFinite(bonus) && bonus !== 0) {
      formula += bonus > 0 ? `+${bonus}` : `${bonus}`;
    }

    return formula;
  }

  _getGadgetDamageFormulaFromDescription(description) {
    const raw = String(description || "");
    if (!raw) return "";
    const text = raw
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return "";

    const diceMatch = text.match(/(?:damage|deals?)[^0-9d]*([0-9]+d[0-9]+(?:\s*[+-]\s*[0-9]+)*)/i);
    if (diceMatch?.[1]) {
      return diceMatch[1].replace(/\s+/g, "");
    }

    const flatMatch = text.match(/(?:damage|deals?)[^0-9]*([0-9]+)(?!d)/i);
    if (flatMatch?.[1]) {
      return flatMatch[1];
    }

    return "";
  }

  _getGadgetDamageTypeFromDescription(description) {
    const raw = String(description || "");
    if (!raw) return "";
    const text = raw
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return "";

    const damageTypeMatch = text.match(/\b(Acid|Chaos|Cold|Energy|Fire|Force|Kinetic|Lightning|Necrotic|Photonic|Poison|Psychic|Radiant|Sonic|Thunder)\b\s+damage\b/i);
    if (damageTypeMatch?.[1]) {
      return damageTypeMatch[1].charAt(0).toUpperCase() + damageTypeMatch[1].slice(1).toLowerCase();
    }

    const labeledTypeMatch = text.match(/\b(?:damage\s*type|type)\s*[:\-]\s*(Acid|Chaos|Cold|Energy|Fire|Force|Kinetic|Lightning|Necrotic|Photonic|Poison|Psychic|Radiant|Sonic|Thunder)\b/i);
    if (labeledTypeMatch?.[1]) {
      return labeledTypeMatch[1].charAt(0).toUpperCase() + labeledTypeMatch[1].slice(1).toLowerCase();
    }

    const types = [
      "Acid",
      "Chaos",
      "Cold",
      "Fire",
      "Force",
      "Kinetic",
      "Lightning",
      "Necrotic",
      "Photonic",
      "Poison",
      "Psychic",
      "Radiant",
      "Sonic",
      "Thunder"
    ];

    for (const type of types) {
      const regex = new RegExp(`\\b${type}\\b`, "i");
      if (regex.test(text)) {
        return type;
      }
    }

    return "";
  }

  _getGadgetChatActions(gadgetDoc) {
    if (!gadgetDoc) return null;
    const damageFormula = this._getGadgetDamageFormula(gadgetDoc);
    const healFormula = this._getGadgetHealingFormula(gadgetDoc);
    const canAttack = Boolean(damageFormula);
    const canDamage = Boolean(damageFormula);
    const canHeal = Boolean(healFormula);
    const gadgetName = String(gadgetDoc.name || "").trim();
    const gadgetKey = gadgetName.toLowerCase();
    const saveAbilityMap = {
      "sonic grenade": "agility",
      "electrostatic web": "agility",
      "holo-decoy": "wits",
      "force cannon": "endurance"
    };
    const saveAbility = saveAbilityMap[gadgetKey];
    const canSave = Boolean(saveAbility);
    if (!canAttack && !canHeal && !canSave) return null;

    return {
      gadgetId: gadgetDoc.uuid || gadgetDoc.id,
      gadgetName: gadgetName || "Gadget",
      actorId: this.actor?.id,
      canAttack: canAttack,
      canDamage: canDamage,
      canHeal: canHeal,
      healFormula: healFormula,
      canSave: canSave,
      saveAbility: saveAbility || "agility",
      showSaveButton: false
    };
  }

  _getTalentChatActions(item) {
    if (!item || item.type !== "talent") return null;
    const name = String(item.name || "").toLowerCase().trim();
    if (name !== "meteor slam" && name !== "thunderclap") return null;

    return {
      canMeteorSlam: name === "meteor slam",
      canThunderclap: name === "thunderclap",
      actorId: this.actor?.id,
      talentName: item.name || "Talent"
    };
  }

  _getGadgetTuningBonus() {
    const gadgetTuningSkill = this.actor?.system?.skills?.["Gadget Tuning"] || {};
    const gadgetTuningRank = gadgetTuningSkill.rank || "Novice";
    const rankModifiers = {
      "Novice": 0,
      "Apprentice": 2,
      "Competent": 5,
      "Masterful": 9,
      "Legendary": 14
    };
    return rankModifiers[gadgetTuningRank] || 0;
  }

  _hasBlastDamageEnhancement(actorData) {
    const data = actorData?.system ? actorData : this.actor;
    const progression = data?.system?.progression || {};
    const embeddedTalents = (data?.items || []).filter(i => i && i.type === "talent").map(t => t.name);
    const progressionTalentNames = [];

    for (let level = 1; level <= 20; level++) {
      const levelData = progression[`level${level}`] || {};
      if (level === 1) {
        if (levelData.humanGenericTalentName) progressionTalentNames.push(levelData.humanGenericTalentName);
        if (levelData.terranGenericTalentName) progressionTalentNames.push(levelData.terranGenericTalentName);
        if (levelData.bastionTalentName) progressionTalentNames.push(levelData.bastionTalentName);
        if (levelData.paragonTalentName) progressionTalentNames.push(levelData.paragonTalentName);
        if (levelData.gadgeteerTalentName) progressionTalentNames.push(levelData.gadgeteerTalentName);
        if (levelData.marksmanTalentName) progressionTalentNames.push(levelData.marksmanTalentName);
      }
      if (levelData.genericTalentName) progressionTalentNames.push(levelData.genericTalentName);
      if (levelData.powersetTalentName) progressionTalentNames.push(levelData.powersetTalentName);
    }

    return [...embeddedTalents, ...progressionTalentNames].some(name =>
      (name || "").toLowerCase().trim() === "blast damage enhancement i"
    );
  }

  async _buildGadgetAttackFromUuid(gadgetId) {
    if (!gadgetId) return null;
    let gadgetDoc = null;
    try {
      gadgetDoc = await fromUuid(gadgetId);
    } catch (err) {
      console.warn("Singularity | Failed to load gadget for attack:", err);
      return null;
    }
    if (!gadgetDoc) return null;

    const damageFormula = this._getGadgetDamageFormula(gadgetDoc);
    if (!damageFormula) return null;

    const basic = gadgetDoc.system?.basic || {};
    const range = basic.range || "Ranged";
    const attackType = basic.type || (String(range || "").toLowerCase().includes("melee") ? "melee" : "ranged");
    const gadgetTuningBonus = this._getGadgetTuningBonus();
    const attackBonus = Number.isFinite(Number(basic.attackBonus)) ? Number(basic.attackBonus) : gadgetTuningBonus;
    const description = gadgetDoc.system?.description || gadgetDoc.system?.details?.description || "";
    const parsedDamageType = this._getGadgetDamageTypeFromDescription(description);
    const damageType =
      parsedDamageType ||
      basic.damageType ||
      "Kinetic";

    return {
      name: gadgetDoc.name || "Gadget Attack",
      baseAttackBonus: attackBonus,
      baseDamage: damageFormula,
      ability: "wits",
      damageType: damageType,
      range: range,
      cost: basic.energyCost ?? 0,
      type: attackType,
      weaponImg: gadgetDoc.img,
      isCustom: false,
      isGadgetAttack: true,
      gadgetId: gadgetId,
      gadgetTuningBonus: gadgetTuningBonus
    };
  }

  async _onRemoveGadget(event) {
    event.preventDefault();
    event.stopPropagation(); // Prevent triggering the gadget item click
    const gadgetLevel = parseInt($(event.currentTarget).data("gadget-level"));
    const gadgetIndex = parseInt($(event.currentTarget).data("gadget-index"));
    
    const gadgets = foundry.utils.deepClone(this.actor.system.gadgets?.prepared || { level0: [], level1: [], level2: [], level3: [] });
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
        const content = await foundry.applications.handlebars.renderTemplate("systems/singularity/templates/chat/item-card.html", {
          item: item,
          actor: this.actor,
          talentActions: this._getTalentChatActions(item),
          hideImage: true
        });
        
        await ChatMessage.create({
          content: content,
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          style: CONST.CHAT_MESSAGE_STYLES.OTHER
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
    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: "Long Rest",
          content: "<p>Perform a Long Rest? This will:</p><ul><li>Restore HP to maximum</li><li>Remove all wounds (but not extreme wounds)</li><li>Refresh all used gadgets</li></ul>",
          buttons: [
            { action: "yes", label: "Yes" },
            { action: "no", label: "No" }
          ],
          default: "yes"
        }
      : {
          title: "Long Rest",
          content: "<p>Perform a Long Rest? This will:</p><ul><li>Restore HP to maximum</li><li>Remove all wounds (but not extreme wounds)</li><li>Refresh all used gadgets</li></ul>",
          yes: () => true,
          no: () => false,
          defaultYes: true
        };
    const confirmed = DialogClass?.name === "DialogV2"
      ? (await DialogClass.wait(dialogOptions)) === "yes"
      : await Dialog.confirm(dialogOptions);
    
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
        calculatedMaxHp += primeLevel;
      }
    } else if (powersetName === "Paragon") {
      const paragonLevel = primeLevel;
      calculatedMaxHp = (12 + enduranceScore) * paragonLevel;
      if (hasEnhancedVitality) {
        calculatedMaxHp += primeLevel;
      }
    } else if (powersetName === "Gadgeteer") {
      const gadgeteerLevel = primeLevel;
      calculatedMaxHp = (8 + enduranceScore) * gadgeteerLevel;
      if (hasEnhancedVitality) {
        calculatedMaxHp += primeLevel;
      }
    } else if (powersetName === "Marksman") {
      const marksmanLevel = primeLevel;
      calculatedMaxHp = (8 + enduranceScore) * marksmanLevel;
      if (hasEnhancedVitality) {
        calculatedMaxHp += primeLevel;
      }
    } else if (hasEnhancedVitality) {
      calculatedMaxHp = actorData.system.combat?.hp?.max || 0;
    } else {
      calculatedMaxHp = actorData.system.combat?.hp?.max || 0;
    }
    
    updateData["system.combat.hp.value"] = this.actor.system?.combat?.hp?.max ?? 0;
    
    // 2. Remove wounds (but not extreme wounds)
    const wounds = foundry.utils.deepClone(this.actor.system.wounds || []);
    const remainingWounds = wounds.filter(wound => wound.isExtreme === true);
    updateData["system.wounds"] = remainingWounds;
    
    // 3. Refresh used gadgets (set used = false for all gadgets)
    const gadgets = foundry.utils.deepClone(this.actor.system.gadgets?.prepared || { level0: [], level1: [], level2: [], level3: [] });
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
    if (gadgets.level2) {
      gadgets.level2 = gadgets.level2.map(gadget => {
        if (gadget) {
          return { ...gadget, used: false };
        }
        return gadget;
      });
    }
    if (gadgets.level3) {
      gadgets.level3 = gadgets.level3.map(gadget => {
        if (gadget) {
          return { ...gadget, used: false };
        }
        return gadget;
      });
    }
    updateData["system.gadgets.prepared"] = gadgets;

    const regenerativeData = foundry.utils.deepClone(this.actor.system.combat?.regenerativeFortitude || { used: false });
    regenerativeData.used = false;
    updateData["system.combat.regenerativeFortitude"] = regenerativeData;

    const unbreakableData = foundry.utils.deepClone(this.actor.system.combat?.unbreakable || { used: 0 });
    unbreakableData.used = 0;
    updateData["system.combat.unbreakable"] = unbreakableData;

    updateData["system.combat.specializedAmmo"] = { used: 0 };
    updateData["system.combat.lightningReload"] = { used: 0 };
    updateData["system.combat.deadlyFocus"] = { used: 0 };
    updateData["system.combat.impossibleShot"] = { used: false };
    updateData["system.combat.perfectShot"] = { used: false };
    
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
        const gadgetActions = this._getGadgetChatActions(item);
        const content = await foundry.applications.handlebars.renderTemplate("systems/singularity/templates/chat/item-card.html", {
          item: item,
          actor: this.actor,
          gadgetActions: gadgetActions,
          talentActions: this._getTalentChatActions(item),
          hideImage: item?.type === "gadget"
        });
        
        await ChatMessage.create({
          content: content,
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          style: CONST.CHAT_MESSAGE_STYLES.OTHER
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

  async _ensureGenericLevel2Talents(talentsPack) {
    if (!talentsPack) return;

    const wasLocked = talentsPack.locked;
    if (wasLocked) {
      await talentsPack.configure({ locked: false });
    }

    try {

    let index;
    try {
      index = await talentsPack.getIndex();
    } catch (err) {
      console.warn("Singularity | Failed to read talents compendium index:", err);
      return;
    }

    const existing = new Set(index.map(entry => (entry.name || "").toLowerCase()));
    const talentDefinitions = [
      {
        name: "Medium Armor Training",
        type: "generic",
        level: 2,
        prerequisites: "Prime Level 2; Light Armor Training",
        description: "<p><strong>Requirements</strong> Prime Level 2; Light Armor Training</p><p>Your character learns to wear medium armor effectively, balancing protection and mobility.</p><p><strong>Effect</strong> You are now trained in Medium Armor. You can wear medium armor without penalties to movement or defense.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Power Strike",
        type: "generic",
        level: 2,
        prerequisites: "Prime Level 2",
        description: "<p><strong>Requirements</strong> Prime Level 2</p><p>You've mastered channeling your strength into devastating melee strikes. When you put your full force behind an attack, your blows carry significantly more destructive power, leaving enemies reeling from the impact.</p><p><strong>Effect</strong> Before making a melee weapon attack, you can choose to spend 1 additional energy beyond the normal attack cost. If you do, you add +2 to your damage roll for that attack only. This effect applies only to the next attack you make, and can be used with any melee weapon attack, including unarmed strikes.</p>",
        img: "icons/svg/sword.svg"
      },
      {
        name: "Wall Crawler",
        type: "generic",
        level: 2,
        prerequisites: "Prime Level 2",
        description: "<p><strong>Requirements</strong> Prime Level 2</p><p>You can scale walls and obstacles with greater ease than most, finding handholds and footholds that others miss. Your movements are fluid and instinctive, allowing you to traverse vertical surfaces that would challenge others.</p><p><strong>Effect</strong> You gain a climbing speed of 15 feet. You can climb without making ability checks on surfaces that would normally require them, as long as you have one hand free to grip holds.</p><p><strong>Notes</strong> You must have at least one hand free to use your climbing speed. While climbing, you suffer the same penalties as other climbing creatures. See Restricted Ranged Combat for details.</p>",
        img: "icons/svg/upgrade.svg"
      }
    ];


    for (const def of talentDefinitions) {
      if (!existing.has(def.name.toLowerCase())) {
        continue;
      }

      const indexEntry = index.find(entry => (entry.name || "").toLowerCase() === def.name.toLowerCase());
      if (!indexEntry?._id) continue;

      try {
        const existingDoc = await talentsPack.getDocument(indexEntry._id);
        if (!existingDoc) continue;

        const nextLevel = Number(existingDoc.system?.basic?.level) || 0;
        const needsUpdate = nextLevel !== def.level ||
          existingDoc.system?.basic?.type !== def.type ||
          existingDoc.system?.basic?.prerequisites !== def.prerequisites ||
          existingDoc.img !== def.img ||
          (existingDoc.system?.description || "") !== def.description;

        if (needsUpdate) {
          await existingDoc.update({
            img: def.img,
            system: {
              description: def.description,
              basic: {
                type: def.type,
                level: def.level,
                prerequisites: def.prerequisites
              }
            }
          });
        }
      } catch (err) {
        console.warn("Singularity | Failed to update existing level 2 talent:", err);
      }
    }

    const toCreate = talentDefinitions
      .filter(def => !existing.has(def.name.toLowerCase()))
      .map(def => ({
        name: def.name,
        type: "talent",
        img: def.img,
        system: {
          description: def.description,
          basic: {
            type: def.type,
            level: def.level,
            prerequisites: def.prerequisites
          }
        }
      }));

    if (toCreate.length) {
      try {
        const createdItems = await Item.createDocuments(toCreate, { render: false });
        for (const item of createdItems) {
          await talentsPack.importDocument(item);
          await item.delete();
        }
        await talentsPack.getIndex({ force: true });
      } catch (err) {
        console.warn("Singularity | Failed to seed generic level 2 talents:", err);
      }
    }

    // Seed level 6 talents
    index = await talentsPack.getIndex();
    const existing6 = new Set(index.map(entry => (entry.name || "").toLowerCase()));
    const level6Definitions = [
      {
        name: "Blast (Competent)",
        type: "generic",
        level: 6,
        prerequisites: "Prime Level 6; Blast (Apprentice)",
        description: "<p><strong>Requirements</strong> Prime Level 6; Blast (Apprentice)</p><p>Through practice and refinement, you've learned to channel your blasts with greater precision and control. Your attacks are more accurate and reliable.</p><p><strong>Effect</strong> Your proficiency in Blast attacks increases to Competent.</p>",
        img: "icons/svg/explosion.svg"
      },
      {
        name: "Heavy Armor Training",
        type: "generic",
        level: 6,
        prerequisites: "Prime Level 6; Medium Armor Training",
        description: "<p><strong>Requirements</strong> Prime Level 6; Medium Armor Training</p><p>Your character masters wearing heavy armor, maximizing protection while tolerating its weight.</p><p><strong>Effect</strong> You are now trained in Heavy Armor. You can wear heavy armor without penalties to movement or defense.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Initiative Training (Competent)",
        type: "generic",
        level: 6,
        prerequisites: "Prime Level 6; Initiative Training (Apprentice)",
        description: "<p><strong>Requirements</strong> Prime Level 6; Initiative Training (Apprentice)</p><p>Your tactical awareness has developed beyond basic reactions. You've learned to read situations with professional expertise, positioning yourself optimally before conflicts even begin.</p><p><strong>Effect</strong> Your proficiency in Initiative checks increases to Competent.</p>",
        img: "icons/svg/lightning.svg"
      },
      {
        name: "Saving Throw Training (Competent)",
        type: "generic",
        level: 6,
        prerequisites: "Prime Level 6; Saving Throw Training (Apprentice)",
        description: "<p><strong>Requirements</strong> Prime Level 6; Saving Throw Training (Apprentice)</p><p>Through repeated exposure to danger and refined instinct, your character's ability to resist harmful effects becomes a professional standard.</p><p><strong>Effect</strong> Choose one saving throw in which your character is Apprentice. Your proficiency in that saving throw increases to Competent.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Skill Training (Competent)",
        type: "generic",
        level: 6,
        prerequisites: "Prime Level 6; Skill Training (Apprentice)",
        description: "<p><strong>Requirements</strong> Prime Level 6; Skill Training (Apprentice)</p><p>Your character pushes their expertise further, moving beyond basic proficiency toward professional mastery of a specific discipline.</p><p><strong>Effect</strong> Choose one skill in which your character is Apprentice. Your proficiency in that skill increases to Competent.</p>",
        img: "icons/svg/book.svg"
      },
      {
        name: "Weapon Training (Competent)",
        type: "generic",
        level: 6,
        prerequisites: "Prime Level 6; Weapon Training (Apprentice)",
        description: "<p><strong>Requirements</strong> Prime Level 6; Weapon Training (Apprentice)</p><p>Your character moves beyond basic martial knowledge, developing the muscle memory and tactical awareness required to be truly effective on the battlefield.</p><p><strong>Effect</strong> Choose one weapon category in which your character is currently Apprentice. Your training level in that category increases to Competent.</p><p><strong>Weapon Categories</strong> Unarmed Strikes, Light Melee Weapons, Heavy Melee Weapons, Thrown Weapons, Bows, Firearms, Improvised Weapons.</p>",
        img: "icons/svg/sword.svg"
      }
    ];

    for (const def of level6Definitions) {
      if (!existing6.has(def.name.toLowerCase())) {
        continue;
      }

      const indexEntry = index.find(entry => (entry.name || "").toLowerCase() === def.name.toLowerCase());
      if (!indexEntry?._id) continue;

      try {
        const existingDoc = await talentsPack.getDocument(indexEntry._id);
        if (!existingDoc) continue;

        const nextLevel = Number(existingDoc.system?.basic?.level) || 0;
        const needsUpdate = nextLevel !== def.level ||
          existingDoc.system?.basic?.type !== def.type ||
          existingDoc.system?.basic?.prerequisites !== def.prerequisites ||
          existingDoc.img !== def.img ||
          (existingDoc.system?.description || "") !== def.description;

        if (needsUpdate) {
          await existingDoc.update({
            img: def.img,
            system: {
              description: def.description,
              basic: {
                type: def.type,
                level: def.level,
                prerequisites: def.prerequisites
              }
            }
          });
        }
      } catch (err) {
        console.warn("Singularity | Failed to update existing level 6 talent:", err);
      }
    }

    const toCreate6 = level6Definitions
      .filter(def => !existing6.has(def.name.toLowerCase()))
      .map(def => ({
        name: def.name,
        type: "talent",
        img: def.img,
        system: {
          description: def.description,
          basic: {
            type: def.type,
            level: def.level,
            prerequisites: def.prerequisites
          }
        }
      }));

    if (toCreate6.length) {
      try {
        const createdItems6 = await Item.createDocuments(toCreate6, { render: false });
        for (const item of createdItems6) {
          await talentsPack.importDocument(item);
          await item.delete();
        }
        await talentsPack.getIndex({ force: true });
      } catch (err) {
        console.warn("Singularity | Failed to seed generic level 6 talents:", err);
      }
    }

    // Seed level 8 talents
    index = await talentsPack.getIndex();
    const existing8 = new Set(index.map(entry => (entry.name || "").toLowerCase()));
    const level8Definitions = [
      {
        name: "Blast Damage Enhancement II",
        type: "generic",
        level: 8,
        prerequisites: "Prime Level 8; Blast Damage Enhancement I",
        description: "<p><strong>Requirements</strong> Prime Level 8; Blast Damage Enhancement I</p><p>Your mastery over energy channeling has reached new heights, allowing you to unleash even more devastating blasts.</p><p><strong>Effect</strong> Your Blast damage increases to 5d4 + chosen ability modifier (instead of 3d4 + chosen ability modifier).</p>",
        img: "icons/svg/explosion.svg"
      },
      {
        name: "Handless Climber",
        type: "generic",
        level: 8,
        prerequisites: "Prime Level 8; Wall Crawler",
        description: "<p><strong>Requirements</strong> Prime Level 8; Wall Crawler</p><p>You've developed techniques that allow you to scale surfaces using your feet, knees, and even minimal contact points, freeing your hands for combat or other tasks.</p><p><strong>Effect</strong> You no longer need a free hand to climb.</p><p><strong>Notes</strong> While climbing, you still suffer the same penalties as other climbing creatures.</p>",
        img: "icons/svg/upgrade.svg"
      }
    ];

    for (const def of level8Definitions) {
      if (!existing8.has(def.name.toLowerCase())) {
        continue;
      }

      const indexEntry = index.find(entry => (entry.name || "").toLowerCase() === def.name.toLowerCase());
      if (!indexEntry?._id) continue;

      try {
        const existingDoc = await talentsPack.getDocument(indexEntry._id);
        if (!existingDoc) continue;

        const nextLevel = Number(existingDoc.system?.basic?.level) || 0;
        const needsUpdate = nextLevel !== def.level ||
          existingDoc.system?.basic?.type !== def.type ||
          existingDoc.system?.basic?.prerequisites !== def.prerequisites ||
          existingDoc.img !== def.img ||
          (existingDoc.system?.description || "") !== def.description;

        if (needsUpdate) {
          await existingDoc.update({
            img: def.img,
            system: {
              description: def.description,
              basic: {
                type: def.type,
                level: def.level,
                prerequisites: def.prerequisites
              }
            }
          });
        }
      } catch (err) {
        console.warn("Singularity | Failed to update existing level 8 talent:", err);
      }
    }

    const toCreate8 = level8Definitions
      .filter(def => !existing8.has(def.name.toLowerCase()))
      .map(def => ({
        name: def.name,
        type: "talent",
        img: def.img,
        system: {
          description: def.description,
          basic: {
            type: def.type,
            level: def.level,
            prerequisites: def.prerequisites
          }
        }
      }));

    if (toCreate8.length) {
      try {
        const createdItems8 = await Item.createDocuments(toCreate8, { render: false });
        for (const item of createdItems8) {
          await talentsPack.importDocument(item);
          await item.delete();
        }
        await talentsPack.getIndex({ force: true });
      } catch (err) {
        console.warn("Singularity | Failed to seed generic level 8 talents:", err);
      }
    }

    // Seed level 11 talents
    index = await talentsPack.getIndex();
    const existing11 = new Set(index.map(entry => (entry.name || "").toLowerCase()));
    const level11Definitions = [
      {
        name: "Blast (Masterful)",
        type: "generic",
        level: 11,
        prerequisites: "Prime Level 11; Blast (Competent)",
        description: "<p><strong>Requirements</strong> Prime Level 11; Blast (Competent)</p><p>Your mastery over energy manipulation has reached new heights. Your blasts strike with exceptional precision and consistency, finding their mark even in the most challenging situations.</p><p><strong>Effect</strong> Your proficiency in Blast attacks increases to Masterful.</p>",
        img: "icons/svg/explosion.svg"
      },
      {
        name: "Initiative Training (Masterful)",
        type: "generic",
        level: 11,
        prerequisites: "Prime Level 11; Initiative Training (Competent)",
        description: "<p><strong>Requirements</strong> Prime Level 11; Initiative Training (Competent)</p><p>Your reflexes have reached an almost supernatural level. You can sense danger before it manifests, moving with instinctive precision that leaves others struggling to keep pace.</p><p><strong>Effect</strong> Your proficiency in Initiative checks increases to Masterful.</p>",
        img: "icons/svg/lightning.svg"
      },
      {
        name: "Indomitable Will",
        type: "bastion",
        level: 10,
        prerequisites: "Bastion 10",
        description: "<h2>Description</h2><p>Your mental fortitude matches your physical resilience, allowing you to resist effects that would control or disable you.</p><h3>Requirements</h3><ul><li>Bastion 10</li></ul><h3>Effect</h3><p>You have advantage on saving throws against effects that would cause you to be Paralyzed, Staggered, or Dazed. Additionally, you gain a +2 bonus to all Wits and Charm saving throws.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Saving Throw Training (Masterful)",
        type: "generic",
        level: 11,
        prerequisites: "Prime Level 11; Saving Throw Training (Competent)",
        description: "<p><strong>Requirements</strong> Prime Level 11; Saving Throw Training (Competent)</p><p>Your character's reflexes, mental fortitude, and physical durability reach an elite level, allowing them to shrug off effects that would incapacitate others.</p><p><strong>Effect</strong> Choose one saving throw in which your character is Competent. Your proficiency in that saving throw increases to Masterful.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Skill Training (Masterful)",
        type: "generic",
        level: 11,
        prerequisites: "Prime Level 11; Skill Training (Competent)",
        description: "<p><strong>Requirements</strong> Prime Level 11; Skill Training (Competent)</p><p>Your character has reached the pinnacle of their craft, possessing a level of expertise that few in the world can match.</p><p><strong>Effect</strong> Choose one skill in which your character is Competent. Your proficiency in that skill increases to Masterful.</p>",
        img: "icons/svg/book.svg"
      },
      {
        name: "Weapon Training (Masterful)",
        type: "generic",
        level: 11,
        prerequisites: "Prime Level 11; Weapon Training (Competent)",
        description: "<p><strong>Requirements</strong> Prime Level 11; Weapon Training (Competent)</p><p>Your character has achieved an elite level of martial prowess. Your movements are fluid, precise, and deadly, allowing you to dominate combat with your chosen weaponry.</p><p><strong>Effect</strong> Choose one weapon category in which your character is currently Competent. Your training level in that category increases to Masterful.</p><p><strong>Weapon Categories</strong> Unarmed Strikes, Light Melee Weapons, Heavy Melee Weapons, Thrown Weapons, Bows, Firearms, Improvised Weapons.</p><p><strong>Notes</strong> If you have training in Light Melee Weapons, the bonus applies only when the weapon is used in melee. Throwing the weapon does not grant the bonus. If you have training in Thrown Weapons, the bonus applies only when the weapon is thrown. Using a thrown weapon in melee does not grant the bonus.</p>",
        img: "icons/svg/sword.svg"
      }
    ];

    for (const def of level11Definitions) {
      if (!existing11.has(def.name.toLowerCase())) {
        continue;
      }

      const indexEntry = index.find(entry => (entry.name || "").toLowerCase() === def.name.toLowerCase());
      if (!indexEntry?._id) continue;

      try {
        const existingDoc = await talentsPack.getDocument(indexEntry._id);
        if (!existingDoc) continue;

        const nextLevel = Number(existingDoc.system?.basic?.level) || 0;
        const needsUpdate = nextLevel !== def.level ||
          existingDoc.system?.basic?.type !== def.type ||
          existingDoc.system?.basic?.prerequisites !== def.prerequisites ||
          existingDoc.img !== def.img ||
          (existingDoc.system?.description || "") !== def.description;

        if (needsUpdate) {
          await existingDoc.update({
            img: def.img,
            system: {
              description: def.description,
              basic: {
                type: def.type,
                level: def.level,
                prerequisites: def.prerequisites
              }
            }
          });
        }
      } catch (err) {
        console.warn("Singularity | Failed to update existing level 11 talent:", err);
      }
    }

    const toCreate11 = level11Definitions
      .filter(def => !existing11.has(def.name.toLowerCase()))
      .map(def => ({
        name: def.name,
        type: "talent",
        img: def.img,
        system: {
          description: def.description,
          basic: {
            type: def.type,
            level: def.level,
            prerequisites: def.prerequisites
          }
        }
      }));

    if (toCreate11.length) {
      try {
        const createdItems11 = await Item.createDocuments(toCreate11, { render: false });
        for (const item of createdItems11) {
          await talentsPack.importDocument(item);
          await item.delete();
        }
        await talentsPack.getIndex({ force: true });
      } catch (err) {
        console.warn("Singularity | Failed to seed generic level 11 talents:", err);
      }
    }

    // Seed level 13 talents
    index = await talentsPack.getIndex();
    const existing13 = new Set(index.map(entry => (entry.name || "").toLowerCase()));
    const level13Definitions = [
      {
        name: "Blast Damage Enhancement III",
        type: "generic",
        level: 13,
        prerequisites: "Prime Level 13; Blast Damage Enhancement II",
        description: "<p><strong>Requirements</strong> Prime Level 13; Blast Damage Enhancement II</p><p>Your control over destructive energy has become truly exceptional, enabling you to concentrate overwhelming force into each blast.</p><p><strong>Effect</strong> Your Blast damage increases to 7d4 + chosen ability modifier (instead of 5d4 + chosen ability modifier).</p>",
        img: "icons/svg/explosion.svg"
      }
    ];

    for (const def of level13Definitions) {
      if (!existing13.has(def.name.toLowerCase())) {
        continue;
      }

      const indexEntry = index.find(entry => (entry.name || "").toLowerCase() === def.name.toLowerCase());
      if (!indexEntry?._id) continue;

      try {
        const existingDoc = await talentsPack.getDocument(indexEntry._id);
        if (!existingDoc) continue;

        const nextLevel = Number(existingDoc.system?.basic?.level) || 0;
        const needsUpdate = nextLevel !== def.level ||
          existingDoc.system?.basic?.type !== def.type ||
          existingDoc.system?.basic?.prerequisites !== def.prerequisites ||
          existingDoc.img !== def.img ||
          (existingDoc.system?.description || "") !== def.description;

        if (needsUpdate) {
          await existingDoc.update({
            img: def.img,
            system: {
              description: def.description,
              basic: {
                type: def.type,
                level: def.level,
                prerequisites: def.prerequisites
              }
            }
          });
        }
      } catch (err) {
        console.warn("Singularity | Failed to update existing level 13 talent:", err);
      }
    }

    const toCreate13 = level13Definitions
      .filter(def => !existing13.has(def.name.toLowerCase()))
      .map(def => ({
        name: def.name,
        type: "talent",
        img: def.img,
        system: {
          description: def.description,
          basic: {
            type: def.type,
            level: def.level,
            prerequisites: def.prerequisites
          }
        }
      }));

    if (toCreate13.length) {
      try {
        const createdItems13 = await Item.createDocuments(toCreate13, { render: false });
        for (const item of createdItems13) {
          await talentsPack.importDocument(item);
          await item.delete();
        }
        await talentsPack.getIndex({ force: true });
      } catch (err) {
        console.warn("Singularity | Failed to seed generic level 13 talents:", err);
      }
    }

    // Seed level 16 talents
    index = await talentsPack.getIndex();
    const existing16 = new Set(index.map(entry => (entry.name || "").toLowerCase()));
    const level16Definitions = [
      {
        name: "Blast (Legendary)",
        type: "generic",
        level: 16,
        prerequisites: "Prime Level 16; Blast (Masterful)",
        description: "<p><strong>Requirements</strong> Prime Level 16; Blast (Masterful)</p><p>Your control over destructive energy has transcended all limits. Your blasts strike with legendary precision and unwavering accuracy, never missing their intended target.</p><p><strong>Effect</strong> Your proficiency in Blast attacks increases to Legendary.</p>",
        img: "icons/svg/explosion.svg"
      },
      {
        name: "Initiative Training (Legendary)",
        type: "generic",
        level: 16,
        prerequisites: "Prime Level 16; Initiative Training (Masterful)",
        description: "<p><strong>Requirements</strong> Prime Level 16; Initiative Training (Masterful)</p><p>Your reaction time has transcended mortal limits. You operate in a state of constant readiness, reading the flow of battle like a conductor reads music. Your actions precede thought, and enemies find themselves reacting to moves you've already made.</p><p><strong>Effect</strong> Your proficiency in Initiative checks increases to Legendary.</p>",
        img: "icons/svg/lightning.svg"
      },
      {
        name: "Saving Throw Training (Legendary)",
        type: "generic",
        level: 16,
        prerequisites: "Prime Level 16; Saving Throw Training (Masterful)",
        description: "<p><strong>Requirements</strong> Prime Level 16; Saving Throw Training (Masterful)</p><p>Your character's resilience is absolute. They possess a mythic level of grit and presence of mind that makes them virtually unshakable in the face of disaster.</p><p><strong>Effect</strong> Choose one saving throw in which your character is Masterful. Your proficiency in that saving throw increases to Legendary.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Skill Training (Legendary)",
        type: "generic",
        level: 16,
        prerequisites: "Prime Level 16; Skill Training (Masterful)",
        description: "<p><strong>Requirements</strong> Prime Level 16; Skill Training (Masterful)</p><p>Your character's abilities have transcended human limits, becoming the stuff of myths and modern legends.</p><p><strong>Effect</strong> Choose one skill in which your character is Masterful. Your proficiency in that skill increases to Legendary.</p>",
        img: "icons/svg/book.svg"
      },
      {
        name: "Wall Runner's Flow",
        type: "generic",
        level: 16,
        prerequisites: "Prime Level 16; Handless Climber",
        description: "<p><strong>Requirements</strong> Prime Level 16; Handless Climber</p><p>You can maintain perfect aim and balance while climbing, allowing you to use ranged weapons with the same precision as if you were standing on solid ground.</p><p><strong>Effect</strong> You ignore the -5 penalty to ranged attack rolls from Restricted Ranged Combat while climbing.</p>",
        img: "icons/svg/upgrade.svg"
      },
      {
        name: "Weapon Training (Legendary)",
        type: "generic",
        level: 16,
        prerequisites: "Prime Level 16; Weapon Training (Masterful)",
        description: "<p><strong>Requirements</strong> Prime Level 16; Weapon Training (Masterful)</p><p>Your character's mastery of weaponry has reached a mythic status. You no longer merely use a weapon; it is an extension of your will, capable of performing feats that defy belief and dominate any battlefield.</p><p><strong>Effect</strong> Choose one weapon category in which your character is currently Masterful. Your training level in that category increases to Legendary.</p><p><strong>Weapon Categories</strong> Unarmed Strikes, Light Melee Weapons, Heavy Melee Weapons, Thrown Weapons, Bows, Firearms, Improvised Weapons.</p><p><strong>Notes</strong> If you have training in Light Melee Weapons, the bonus applies only when the weapon is used in melee. Throwing the weapon does not grant the bonus. If you have training in Thrown Weapons, the bonus applies only when the weapon is thrown. Using a thrown weapon in melee does not grant the bonus.</p>",
        img: "icons/svg/sword.svg"
      }
    ];

    for (const def of level16Definitions) {
      if (!existing16.has(def.name.toLowerCase())) {
        continue;
      }

      const indexEntry = index.find(entry => (entry.name || "").toLowerCase() === def.name.toLowerCase());
      if (!indexEntry?._id) continue;

      try {
        const existingDoc = await talentsPack.getDocument(indexEntry._id);
        if (!existingDoc) continue;

        const nextLevel = Number(existingDoc.system?.basic?.level) || 0;
        const needsUpdate = nextLevel !== def.level ||
          existingDoc.system?.basic?.type !== def.type ||
          existingDoc.system?.basic?.prerequisites !== def.prerequisites ||
          existingDoc.img !== def.img ||
          (existingDoc.system?.description || "") !== def.description;

        if (needsUpdate) {
          await existingDoc.update({
            img: def.img,
            system: {
              description: def.description,
              basic: {
                type: def.type,
                level: def.level,
                prerequisites: def.prerequisites
              }
            }
          });
        }
      } catch (err) {
        console.warn("Singularity | Failed to update existing level 16 talent:", err);
      }
    }

    const toCreate16 = level16Definitions
      .filter(def => !existing16.has(def.name.toLowerCase()))
      .map(def => ({
        name: def.name,
        type: "talent",
        img: def.img,
        system: {
          description: def.description,
          basic: {
            type: def.type,
            level: def.level,
            prerequisites: def.prerequisites
          }
        }
      }));

    if (toCreate16.length) {
      try {
        const createdItems16 = await Item.createDocuments(toCreate16, { render: false });
        for (const item of createdItems16) {
          await talentsPack.importDocument(item);
          await item.delete();
        }
        await talentsPack.getIndex({ force: true });
      } catch (err) {
        console.warn("Singularity | Failed to seed generic level 16 talents:", err);
      }
    }

    // Seed level 18 talents
    index = await talentsPack.getIndex();
    const existing18 = new Set(index.map(entry => (entry.name || "").toLowerCase()));
    const level18Definitions = [
      {
        name: "Blast Damage Enhancement IV",
        type: "generic",
        level: 18,
        prerequisites: "Prime Level 18; Blast Damage Enhancement III",
        description: "<p><strong>Requirements</strong> Prime Level 18; Blast Damage Enhancement III</p><p>You have achieved the absolute pinnacle of energy manipulation. Your blasts now unleash cataclysmic force that can reshape battlefields and overwhelm even the most formidable defenses.</p><p><strong>Effect</strong> Your Blast damage increases to 9d4 + chosen ability modifier (instead of 7d4 + chosen ability modifier).</p>",
        img: "icons/svg/explosion.svg"
      }
    ];

    for (const def of level18Definitions) {
      if (!existing18.has(def.name.toLowerCase())) {
        continue;
      }

      const indexEntry = index.find(entry => (entry.name || "").toLowerCase() === def.name.toLowerCase());
      if (!indexEntry?._id) continue;

      try {
        const existingDoc = await talentsPack.getDocument(indexEntry._id);
        if (!existingDoc) continue;

        const nextLevel = Number(existingDoc.system?.basic?.level) || 0;
        const needsUpdate = nextLevel !== def.level ||
          existingDoc.system?.basic?.type !== def.type ||
          existingDoc.system?.basic?.prerequisites !== def.prerequisites ||
          existingDoc.img !== def.img ||
          (existingDoc.system?.description || "") !== def.description;

        if (needsUpdate) {
          await existingDoc.update({
            img: def.img,
            system: {
              description: def.description,
              basic: {
                type: def.type,
                level: def.level,
                prerequisites: def.prerequisites
              }
            }
          });
        }
      } catch (err) {
        console.warn("Singularity | Failed to update existing level 18 talent:", err);
      }
    }

    const toCreate18 = level18Definitions
      .filter(def => !existing18.has(def.name.toLowerCase()))
      .map(def => ({
        name: def.name,
        type: "talent",
        img: def.img,
        system: {
          description: def.description,
          basic: {
            type: def.type,
            level: def.level,
            prerequisites: def.prerequisites
          }
        }
      }));

    if (toCreate18.length) {
      try {
        const createdItems18 = await Item.createDocuments(toCreate18, { render: false });
        for (const item of createdItems18) {
          await talentsPack.importDocument(item);
          await item.delete();
        }
        await talentsPack.getIndex({ force: true });
      } catch (err) {
        console.warn("Singularity | Failed to seed generic level 18 talents:", err);
      }
    }
    } finally {
      if (wasLocked) {
        await talentsPack.configure({ locked: true });
      }
    }
  }

  async _ensureBastionTalents(talentsPack) {
    if (!talentsPack) return;

    const wasLocked = talentsPack.locked;
    if (wasLocked) {
      await talentsPack.configure({ locked: false });
    }

    try {

    let index;
    try {
      index = await talentsPack.getIndex();
    } catch (err) {
      console.warn("Singularity | Failed to read talents compendium index:", err);
      return;
    }

    const existing = new Set(index.map(entry => (entry.name || "").toLowerCase()));
    const talentDefinitions = [
      {
        name: "Regenerative Fortitude",
        type: "bastion",
        level: 7,
        prerequisites: "Bastion 7",
        description: "<h2>Description</h2><p>Your body knits itself back together under duress, letting you shrug off severe hits.</p><h3>Requirements</h3><ul><li>Bastion 7</li></ul><h3>Effect</h3><p>Once per day, when you take damage, you can use your reaction to reduce that damage by an amount equal to your Endurance score.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Protective Barrier",
        type: "bastion",
        level: 9,
        prerequisites: "Bastion 9",
        description: "<h2>Description</h2><p>You project a protective aura that shields nearby allies from harm.</p><h3>Requirements</h3><ul><li>Bastion 9</li></ul><h3>Effect</h3><p>You may activate a Protective Barrier (free action). Allies within 15 feet gain a +1 bonus to AC. At levels 15 and 20, this bonus increases to +2 and +3, respectively.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Indomitable Will",
        type: "bastion",
        level: 10,
        prerequisites: "Bastion 10",
        description: "<h2>Description</h2><p>Your mental fortitude matches your physical resilience, allowing you to resist effects that would control or disable you.</p><h3>Requirements</h3><ul><li>Bastion 10</li></ul><h3>Effect</h3><p>You have advantage on saving throws against effects that would cause you to be Paralyzed, Staggered, or Dazed. Additionally, you gain a +2 bonus to all Wits and Charm saving throws.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Total Immunity",
        type: "bastion",
        level: 10,
        prerequisites: "Bastion 10; Increased Resistance",
        description: "<h2>Description</h2><p>Your defenses can fully shut down a single damage type.</p><h3>Requirements</h3><ul><li>Bastion 10</li><li>Increased Resistance</li></ul><h3>Effect</h3><p>Choose one damage type you currently have Resistance against from your Increased Resistance talent. You gain Immunity to that damage type.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Rapid Intercept",
        type: "bastion",
        level: 12,
        prerequisites: "Bastion 12; Intercept Attack",
        description: "<h2>Description</h2><p>Your reflexes and defensive training allow you to intercept attacks meant for allies even at greater distances, moving quickly to take the blow yourself.</p><h3>Requirements</h3><ul><li>Bastion 12</li><li>Intercept Attack</li></ul><h3>Effect</h3><p>When you use Intercept Attack, you can move up to your speed to reach the ally, rather than needing to be within 5 feet already. After you reach the ally, you swap places with them. The ally moves to the space you just occupied (where you reached them), not to your original starting position.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Adaptive Defense",
        type: "bastion",
        level: 14,
        prerequisites: "Bastion 14",
        description: "<h2>Description</h2><p>Your defenses adapt to incoming attacks, learning from each hit to better resist similar damage.</p><h3>Requirements</h3><ul><li>Bastion 14</li></ul><h3>Effect</h3><p>The first time you take damage of a specific type each encounter, you gain Resistance 5 to that damage type for the remainder of the encounter. This resistance stacks with other resistances you may have.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Legendary Resilience",
        type: "bastion",
        level: 15,
        prerequisites: "Bastion 15",
        description: "<h2>Description</h2><p>Your body has reached a state of near-perfect durability, allowing you to shrug off damage that would kill others.</p><h3>Requirements</h3><ul><li>Bastion 15</li></ul><h3>Effect</h3><p>You gain Resistance 10 to all damage types. This resistance applies before any other resistances or immunities you may have.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Guardian Aura",
        type: "bastion",
        level: 17,
        prerequisites: "Bastion 17; Protective Barrier",
        description: "<h2>Description</h2><p>Your protective presence extends further, creating a larger zone of safety for your allies.</p><h3>Requirements</h3><ul><li>Bastion 17</li><li>Protective Barrier</li></ul><h3>Effect</h3><p>The range of your Protective Barrier increases to 25 feet. Additionally, allies within this range also gain Resistance 5 to all damage types.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Immovable Object",
        type: "bastion",
        level: 19,
        prerequisites: "Bastion 19",
        description: "<h2>Description</h2><p>You become an anchor point in reality, impossible to move or displace against your will.</p><h3>Requirements</h3><ul><li>Bastion 19</li></ul><h3>Effect</h3><p>You cannot be moved against your will by any means, including forced movement, teleportation, or effects that would push, pull, or reposition you. You can still move voluntarily. Additionally, you have advantage on saving throws against effects that would knock you Prone.</p>",
        img: "icons/svg/shield.svg"
      },
      {
        name: "Unbreakable",
        type: "bastion",
        level: 20,
        prerequisites: "Bastion 20",
        description: "<h2>Description</h2><p>You have achieved the pinnacle of defensive mastery. Your will to survive is so strong that you can push through injuries that would fell others, refusing to fall even when your body should give out.</p><h3>Requirements</h3><ul><li>Bastion 20</li></ul><h3>Effect</h3><p>A number of times per day equal to your Endurance modifier (minimum 1), when you would be reduced to 0 HP and become unconscious, you are instead reduced to 1 HP and remain conscious. You do not gain a Wound from this instance of damage.</p>",
        img: "icons/svg/shield.svg"
      }
    ];


    for (const def of talentDefinitions) {
      if (!existing.has(def.name.toLowerCase())) {
        continue;
      }

      const indexEntry = index.find(entry => (entry.name || "").toLowerCase() === def.name.toLowerCase());
      if (!indexEntry?._id) continue;

      try {
        const existingDoc = await talentsPack.getDocument(indexEntry._id);
        if (!existingDoc) continue;

        const nextLevel = Number(existingDoc.system?.basic?.level) || 0;
        const needsUpdate = nextLevel !== def.level ||
          existingDoc.system?.basic?.type !== def.type ||
          existingDoc.system?.basic?.prerequisites !== def.prerequisites ||
          existingDoc.img !== def.img ||
          (existingDoc.system?.description || "") !== def.description;

        if (needsUpdate) {
          await existingDoc.update({
            img: def.img,
            system: {
              description: def.description,
              basic: {
                type: def.type,
                level: def.level,
                prerequisites: def.prerequisites
              }
            }
          });
        }
      } catch (err) {
        console.warn("Singularity | Failed to update Bastion talent:", err);
      }
    }

    const toCreate = talentDefinitions
      .filter(def => !existing.has(def.name.toLowerCase()))
      .map(def => ({
        name: def.name,
        type: "talent",
        img: def.img,
        system: {
          description: def.description,
          basic: {
            type: def.type,
            level: def.level,
            prerequisites: def.prerequisites
          }
        }
      }));

    if (!toCreate.length) return;

    try {
      const createdItems = await Item.createDocuments(toCreate, { render: false });
      for (const item of createdItems) {
        await talentsPack.importDocument(item);
        await item.delete();
      }
      await talentsPack.getIndex({ force: true });
    } catch (err) {
      console.warn("Singularity | Failed to create Bastion talents:", err);
    }
    } finally {
      if (wasLocked) {
        await talentsPack.configure({ locked: true });
      }
    }
  }

  async _ensureParagonTalents(talentsPack) {
    if (!talentsPack) return;

    const wasLocked = talentsPack.locked;
    if (wasLocked) {
      await talentsPack.configure({ locked: false });
    }

    try {
      let index;
      try {
        index = await talentsPack.getIndex();
      } catch (err) {
        console.warn("Singularity | Failed to read talents compendium index:", err);
        return;
      }

      const existing = new Set(index.map(entry => (entry.name || "").toLowerCase()));
      const talentDefinitions = [
        {
          name: "Aerial Evasion",
          type: "paragon",
          level: 5,
          prerequisites: "Paragon 5",
          description: "<h2>Description</h2><p>Your control in the air lets you weave around incoming blows.</p><h3>Requirements</h3><ul><li>Paragon 5</li></ul><h3>Effect</h3><p>While you are flying, you gain a <strong>+2 bonus to AC against melee attacks</strong>.</p>",
          img: "icons/svg/shield.svg"
        },
        {
          name: "Aerial Maneuverability",
          type: "paragon",
          level: 5,
          prerequisites: "Paragon 5",
          description: "<h2>Description</h2><p>Your aerial agility makes you a difficult target. You move through the air with unpredictable patterns that make ranged attacks against you far less effective.</p><h3>Requirements</h3><ul><li>Paragon 5</li></ul><h3>Effect</h3><p>While you are flying, you have a <strong>+2 bonus to AC against ranged attacks</strong>.</p>",
          img: "icons/svg/shield.svg"
        },
        {
          name: "Breaker's Force",
          type: "paragon",
          level: 5,
          prerequisites: "Paragon 5",
          description: "<h2>Description</h2><p>Your momentum has become powerful enough to shatter fragile objects. You can smash through weak barriers and obstacles with ease.</p><h3>Requirements</h3><ul><li>Paragon 5</li></ul><h3>Effect</h3><p>You can move through any object or structure made of fragile materials (glass, paper, straw, thin plastic) or soft materials (cloth, leather, wood, plaster), destroying it as you pass through. Objects with higher material durability block your movement normally.</p>",
          img: "icons/svg/hammer.svg"
        },
        {
          name: "Meteor Slam",
          type: "paragon",
          level: 5,
          prerequisites: "Paragon 5",
          description: "<h2>Description</h2><p>You use your flight speed to grab or strike an airborne opponent, using your combined weight and thrust to drive them ruthlessly into the earth.</p><h3>Requirements</h3><ul><li>Paragon 5</li></ul><h3>Effect</h3><p>You gain the <strong>Meteor Slam</strong> action.</p>",
          img: "icons/svg/explosion.svg"
        },
        {
          name: "Shockwave Landing",
          type: "paragon",
          level: 5,
          prerequisites: "Paragon 5; Improved Impact Control",
          description: "<h2>Description</h2><p>You can channel the force of your landing into a devastating shockwave that knocks nearby enemies off their feet.</p><h3>Requirements</h3><ul><li>Paragon 5</li><li>Improved Impact Control</li></ul><h3>Effect</h3><p>When you land on a solid surface after falling at least 30 feet, you can choose to create a shockwave. All creatures within 10 feet of your landing point must make a Might Save against your Might DC. On a failure, they are knocked Prone.</p>",
          img: "icons/svg/impact-point.svg"
        },
        {
          name: "Unbreakable Will",
          type: "paragon",
          level: 5,
          prerequisites: "Paragon 5",
          description: "<h2>Description</h2><p>Your mental fortitude matches your physical power. You resist mental assaults and maintain your composure under extreme pressure.</p><h3>Requirements</h3><ul><li>Paragon 5</li></ul><h3>Effect</h3><p>You gain a <strong>+2 bonus</strong> to all saving throws against being Charmed, Scared, or Stunned.</p>",
          img: "icons/svg/brain.svg"
        },
        {
          name: "Improved Supersonic Moment",
          type: "paragon",
          level: 7,
          prerequisites: "Paragon 7; Supersonic Moment",
          description: "<h2>Description</h2><p>Your ability to convert speed into devastating force has reached new heights. Every foot of movement becomes a weapon.</p><h3>Requirements</h3><ul><li>Paragon 7</li><li>Supersonic Moment</li></ul><h3>Effect</h3><p>When you use Supersonic Moment, you now gain a <strong>+4 bonus to damage</strong> for every 15 feet you fly (instead of +2).</p>",
          img: "icons/svg/wingfoot.svg"
        },
        {
          name: "Thunderclap",
          type: "paragon",
          level: 7,
          prerequisites: "Paragon 7",
          description: "<h2>Description</h2><p>You clap your hands together with such force that it creates a devastating shockwave, sending enemies reeling.</p><h3>Requirements</h3><ul><li>Paragon 7</li></ul><h3>Effect</h3><p>You gain the <strong>Thunderclap</strong> action.</p>",
          img: "icons/svg/explosion.svg"
        },
        {
          name: "Inspiring Presence",
          type: "paragon",
          level: 9,
          prerequisites: "Paragon 9",
          description: "<h2>Description</h2><p>Your overwhelming presence inspires courage in those around you. Your mere presence makes allies feel protected and fearless.</p><h3>Requirements</h3><ul><li>Paragon 9</li></ul><h3>Effect</h3><p>All allies within 30 feet of you have advantage on saving throws against being Scared.</p>",
          img: "icons/svg/aura.svg"
        },
        {
          name: "Legendary Presence",
          type: "paragon",
          level: 9,
          prerequisites: "Paragon 9; Dominating Presence or Noble Presence",
          description: "<h2>Description</h2><p>Your presence has become truly legendary. Whether through fear or respect, your mere presence commands attention and shapes the battlefield.</p><h3>Requirements</h3><ul><li>Paragon 9</li><li>Dominating Presence or Noble Presence</li></ul><h3>Effect</h3><p>You gain a <strong>+6 bonus</strong> to Intimidation and Persuasion checks (instead of the +4 from your chosen Presence talent).</p>",
          img: "icons/svg/aura.svg"
        },
        {
          name: "Aerial Mastery",
          type: "paragon",
          level: 10,
          prerequisites: "Paragon 10",
          description: "<h2>Description</h2><p>Your flight capabilities continue to improve. You move through the air with even greater speed.</p><h3>Requirements</h3><ul><li>Paragon 10</li></ul><h3>Effect</h3><p>Your flying speed increases by an additional <strong>15 feet</strong>.</p>",
          img: "icons/svg/windmill.svg"
        },
        {
          name: "Legendary Impact",
          type: "paragon",
          level: 19,
          prerequisites: "Paragon 19; Ultimate Impact",
          description: "<h2>Description</h2><p>Your strikes have reached legendary status. Every impact is cataclysmic.</p><h3>Requirements</h3><ul><li>Paragon 19</li><li>Ultimate Impact</li></ul><h3>Effect</h3><p>Your unarmed attacks deal an additional <strong>2d12 damage</strong> (instead of 1d12 from Ultimate Impact). Additionally, when you score a critical hit, you deal maximum damage on all dice rolled for that attack, and the target must make a Might Save against your Might DC or be Stunned until the end of their next turn.</p>",
          img: "icons/svg/impact-point.svg"
        },
        {
          name: "Transcendent Presence",
          type: "paragon",
          level: 19,
          prerequisites: "Paragon 19; Overwhelming Presence",
          description: "<h2>Description</h2><p>Your presence has transcended the physical realm. You command the battlefield through sheer force of being.</p><h3>Requirements</h3><ul><li>Paragon 19</li><li>Overwhelming Presence</li></ul><h3>Effect</h3><p>Once per turn, you can use your reaction to force an enemy within 60 feet to reroll an attack roll, ability check, or saving throw, and they must use the new result.</p>",
          img: "icons/svg/aura.svg"
        },
        {
          name: "Ultimate Breaker",
          type: "paragon",
          level: 20,
          prerequisites: "Paragon 20; Hard Breaker",
          description: "<h2>Description</h2><p>Your momentum has reached legendary proportions. There is no material that can withstand your force. You move through the strongest substances in existence as if they were air.</p><h3>Requirements</h3><ul><li>Paragon 20</li><li>Hard Breaker</li></ul><h3>Effect</h3><p>You can move through any object or structure made of fragile materials, soft materials, average materials, hard materials, or very hard materials (titanium, diamond, advanced alloys), destroying it as you pass through.</p>",
          img: "icons/svg/hammer.svg"
        },
        {
          name: "Worldbreaker",
          type: "paragon",
          level: 20,
          prerequisites: "Paragon 20; Colossal Slam",
          description: "<h2>Description</h2><p>Your power has reached such heights that you can shatter the very world around you with a single strike. This is the ultimate expression of overwhelming force.</p><h3>Requirements</h3><ul><li>Paragon 20</li><li>Colossal Slam</li></ul><h3>Action Type</h3><p><strong>Action</strong> (Cost: <strong>10 energy</strong>)</p><h3>Effect</h3><p>While flying at least 200 feet above the ground, you can use an action to perform a Worldbreaker. You dive straight down up to your full flying speed, then make a melee attack against a target at ground level. If you hit, you deal your normal damage plus <strong>12d10 additional damage</strong>. All creatures within 60 feet of the impact point must make a Might Save against your Might DC or take <strong>8d10 kinetic damage</strong> and be knocked Prone. The ground in a 30-foot radius becomes difficult terrain, and all structures in the area are destroyed. The impact creates a crater that persists until the end of the encounter.</p><p>You can use this talent <strong>once per long rest</strong>.</p>",
          img: "icons/svg/explosion.svg"
        }
      ];

      for (const def of talentDefinitions) {
        if (!existing.has(def.name.toLowerCase())) {
          continue;
        }

        const indexEntry = index.find(entry => (entry.name || "").toLowerCase() === def.name.toLowerCase());
        if (!indexEntry?._id) continue;

        try {
          const existingDoc = await talentsPack.getDocument(indexEntry._id);
          if (!existingDoc) continue;

          const nextLevel = Number(existingDoc.system?.basic?.level) || 0;
          const needsUpdate = nextLevel !== def.level ||
            existingDoc.system?.basic?.type !== def.type ||
            existingDoc.system?.basic?.prerequisites !== def.prerequisites ||
            existingDoc.img !== def.img ||
            (existingDoc.system?.description || "") !== def.description;

          if (needsUpdate) {
            await existingDoc.update({
              img: def.img,
              system: {
                description: def.description,
                basic: {
                  type: def.type,
                  level: def.level,
                  prerequisites: def.prerequisites
                }
              }
            });
          }
        } catch (err) {
          console.warn("Singularity | Failed to update Paragon talent:", err);
        }
      }

      const toCreate = talentDefinitions
        .filter(def => !existing.has(def.name.toLowerCase()))
        .map(def => ({
          name: def.name,
          type: "talent",
          img: def.img,
          system: {
            description: def.description,
            basic: {
              type: def.type,
              level: def.level,
              prerequisites: def.prerequisites
            }
          }
        }));

      if (!toCreate.length) return;

      try {
        const createdItems = await Item.createDocuments(toCreate, { render: false });
        for (const item of createdItems) {
          await talentsPack.importDocument(item);
          await item.delete();
        }
        await talentsPack.getIndex({ force: true });
      } catch (err) {
        console.warn("Singularity | Failed to create Paragon talents:", err);
      }
    } finally {
      if (wasLocked) {
        await talentsPack.configure({ locked: true });
      }
    }
  }

  async _ensureGadgeteerTalents(talentsPack) {
    if (!talentsPack) return;

    const wasLocked = talentsPack.locked;
    if (wasLocked) {
      await talentsPack.configure({ locked: false });
    }

    try {

    let index;
    try {
      index = await talentsPack.getIndex();
    } catch (err) {
      console.warn("Singularity | Failed to read talents compendium index:", err);
      return;
    }

    const existing = new Set(index.map(entry => (entry.name || "").toLowerCase()));
    const talentDefinitions = [
      {
        name: "Rapid Deployment",
        type: "gadgeteer",
        level: 3,
        prerequisites: "Gadgeteer 3",
        description: "<h2>Description</h2><p>Your gadgets are optimized for quick activation, allowing you to deploy them with minimal setup time.</p><h3>Requirements</h3><ul><li>Gadgeteer 3</li></ul><h3>Effect</h3><p>When you use a gadget, you can reduce its energy cost by <strong>1</strong> (minimum <strong>1</strong> energy).</p><p>You can use this ability a number of times per encounter equal to your <strong>Wits modifier</strong> (minimum <strong>1</strong>).</p>",
        img: "icons/svg/item-bag.svg"
      },
      {
        name: "Improved Improvisation",
        type: "gadgeteer",
        level: 5,
        prerequisites: "Gadgeteer 5; Improvised Gadget",
        description: "<h2>Description</h2><p>Your ability to create gadgets on the fly has improved, allowing you to craft more powerful devices in the heat of battle.</p><h3>Requirements</h3><ul><li>Gadgeteer 5</li><li>Improvised Gadget</li></ul><h3>Effect</h3><p>When you use <strong>Improvised Gadget</strong>, you can create a <strong>Level 1 gadget</strong> instead of a Level 0 gadget. The energy cost remains 2.</p>",
        img: "icons/svg/item-bag.svg"
      }
    ];


    for (const def of talentDefinitions) {
      if (!existing.has(def.name.toLowerCase())) {
        continue;
      }

      const indexEntry = index.find(entry => (entry.name || "").toLowerCase() === def.name.toLowerCase());
      if (!indexEntry?._id) continue;

      try {
        const existingDoc = await talentsPack.getDocument(indexEntry._id);
        if (!existingDoc) continue;

        const nextLevel = Number(existingDoc.system?.basic?.level) || 0;
        const needsUpdate = nextLevel !== def.level ||
          existingDoc.system?.basic?.type !== def.type ||
          existingDoc.system?.basic?.prerequisites !== def.prerequisites ||
          (existingDoc.system?.description || "") !== def.description;

        if (needsUpdate) {
          await existingDoc.update({
            img: def.img,
            system: {
              description: def.description,
              basic: {
                type: def.type,
                level: def.level,
                prerequisites: def.prerequisites
              }
            }
          });
        }
      } catch (err) {
        console.warn("Singularity | Failed to update Gadgeteer talent:", err);
      }
    }

    const toCreate = talentDefinitions
      .filter(def => !existing.has(def.name.toLowerCase()))
      .map(def => ({
        name: def.name,
        type: "talent",
        img: def.img,
        system: {
          description: def.description,
          basic: {
            type: def.type,
            level: def.level,
            prerequisites: def.prerequisites
          }
        }
      }));

    if (!toCreate.length) return;

    try {
      const createdItems = await Item.createDocuments(toCreate, { render: false });
      for (const item of createdItems) {
        await talentsPack.importDocument(item);
        await item.delete();
      }
      await talentsPack.getIndex({ force: true });
    } catch (err) {
      console.warn("Singularity | Failed to create Gadgeteer talents:", err);
    }
    } finally {
      if (wasLocked) {
        await talentsPack.configure({ locked: true });
      }
    }
  }

  async _onTalentSlotClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Don't open dialog if a talent selection dialog is already open (prevents multiple modals)
    if (this._talentSelectionDialogOpen) {
      return;
    }
    
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

    if (!this._canAccessProgressionLevel(level)) {
      return;
    }
    
    // Open talent selection dialog (pass the slot we clicked so the chosen talent goes here)
    await this._openTalentSelectionDialog(level, slotType);
  }

  async _openTalentSelectionDialog(level, slotType) {
    console.log("Singularity | _openTalentSelectionDialog called", { level, slotType });
    // Prevent opening a second talent dialog while one is already open
    if (this._talentSelectionDialogOpen) {
      console.log("Singularity | Dialog already open, returning");
      return;
    }
    this._talentSelectionDialogOpen = true;

    // Get talents from the talents compendium
    const talentsPack = game.packs.get("singularity.talents");
    if (!talentsPack) {
      ui.notifications.error("Talents compendium not found!");
      return;
    }

    await this._ensureBastionTalents(talentsPack);
    await this._ensureParagonTalents(talentsPack);
    await this._ensureGadgeteerTalents(talentsPack);
    await this._ensureGenericLevel2Talents(talentsPack);
    
    // Collect all already-selected talents from all progression slots
    const selectedTalents = new Map(); // Map of talent name -> { variations: Set, counts: number }
    const progression = this.actor.system.progression || {};
    const primeLevel = this.actor.system.basic?.primeLevel || 1;
    const isBaseBlastTalentName = (name) => {
      const normalized = (name || "").toLowerCase().trim();
      return normalized === "blast (apprentice)" || normalized.startsWith("blast (");
    };
    const embeddedTalentNames = new Set(
      (this.actor.items || [])
        .filter(item => item?.type === "talent")
        .map(item => String(item.name || "").toLowerCase().trim())
    );
    const talentNameCache = new Map();
    const resolveTalentName = async (uuid) => {
      if (!uuid) return "";
      if (talentNameCache.has(uuid)) return talentNameCache.get(uuid);
      try {
        const doc = await fromUuid(uuid);
        const name = doc?.name || "";
        talentNameCache.set(uuid, name);
        return name;
      } catch (err) {
        console.warn("Singularity | Failed to resolve talent name", err);
        talentNameCache.set(uuid, "");
        return "";
      }
    };
    
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
      } else if (levelData.genericTalent) {
        const resolvedName = await resolveTalentName(levelData.genericTalent);
        if (resolvedName) addSelectedTalent(resolvedName);
      }
      
      // Check human generic talent
      if (levelData.humanGenericTalentName) {
        // For Blast, check the damage type from the attack
        if (isBaseBlastTalentName(levelData.humanGenericTalentName)) {
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
        if (isBaseBlastTalentName(levelData.terranGenericTalentName)) {
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
      
      // Check gadgeteer talent
      if (levelData.gadgeteerTalentName) {
        addSelectedTalent(levelData.gadgeteerTalentName);
      }
      
      // Check paragon talent
      if (levelData.paragonTalentName) {
        addSelectedTalent(levelData.paragonTalentName);
      }
      
      // Check marksman talent
      if (levelData.marksmanTalentName) {
        addSelectedTalent(levelData.marksmanTalentName);
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
    
    const powersetNameForSlot = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
    let filterSlotType = slotType;
    if (slotType === "powersetTalent") {
      if (powersetNameForSlot === "Bastion") {
        filterSlotType = "bastionTalent";
      } else if (powersetNameForSlot === "Paragon") {
        filterSlotType = "paragonTalent";
      } else if (powersetNameForSlot === "Gadgeteer") {
        filterSlotType = "gadgeteerTalent";
      } else if (powersetNameForSlot === "Marksman") {
        filterSlotType = "marksmanTalent";
      } else {
        ui.notifications.warn("Choose a Powerset before selecting Powerset talents.");
        return;
      }
    }

    // Get the index of all talents (store for use in render callback)
    const index = await talentsPack.getIndex();
    let allTalents = Array.from(index.values());
    
    // Filter talents based on slot type
    if (filterSlotType === "bastionTalent") {
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
            "regenerative fortitude", "protective barrier", "indomitable will", "total immunity",
            "rapid intercept", "adaptive defense", "legendary resilience", "guardian aura",
            "immovable object", "unbreakable"
      ];
          if (name.includes("bastion") || 
              bastionTalentNames.some(btName => name.includes(btName.toLowerCase()))) {
            bastionTalents.push(talentIndex);
          }
        }
      }
      allTalents = bastionTalents;
    } else if (filterSlotType === "paragonTalent") {
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
    } else if (filterSlotType === "gadgeteerTalent") {
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
    } else if (filterSlotType === "marksmanTalent") {
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
            "inspiring presence", "legendary presence", "aerial mastery", "reinforced breaker",
            "improved meteor slam", "overwhelming presence", "perfect flight", "unstoppable force",
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
    } else if (filterSlotType === "genericTalent" || filterSlotType === "humanGenericTalent" || filterSlotType === "terranGenericTalent") {
      // Filter OUT Bastion and Paragon talents for generic talent slots
      const genericTalents = [];
      const bastionTalentNames = [
        "bastion's resistance", "bastions resistance", "bastion resistance",
        "enlarged presence", "ironbound", "protect the weak",
        "defensive stance", "increased resistance", "intercept attack",
        "regenerative fortitude", "protective barrier", "indomitable will", "total immunity",
        "rapid intercept", "adaptive defense", "legendary resilience", "guardian aura",
        "immovable object", "unbreakable"
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
    
    const talentsByLevel = {};
    const availableLevels = [];
    const normalizedSelected = Array.from(selectedTalents.keys());
    const hasArmorTraining = normalizedSelected.some(name =>
      name.includes("light armor training") || name.includes("medium armor training") || name.includes("heavy armor training")
    );

    const meetsTalentPrereqs = (talentDoc) => {
      const name = (talentDoc.name || "").toLowerCase();
      const hasTalent = (talentName) => {
        const normalized = (talentName || "").toLowerCase().trim();
        if (normalizedSelected.includes(normalized) || embeddedTalentNames.has(normalized)) {
          return true;
        }
        const selectedMatch = normalizedSelected.some(selected => selected.includes(normalized));
        if (selectedMatch) return true;
        for (const embeddedName of embeddedTalentNames) {
          if (embeddedName.includes(normalized)) return true;
        }
        return false;
      };
      if (name === "medium armor training") {
        return primeLevel >= 2 && hasArmorTraining;
      }
      if (name === "blast damage enhancement i") {
        return primeLevel >= 4 && hasTalent("blast (apprentice)");
      }
      if (name === "blast damage enhancement ii") {
        return primeLevel >= 8 && hasTalent("blast damage enhancement i");
      }
      if (name === "blast damage enhancement iii") {
        return primeLevel >= 13 && hasTalent("blast damage enhancement ii");
      }
      if (name === "blast damage enhancement iv") {
        return primeLevel >= 18 && hasTalent("blast damage enhancement iii");
      }
      if (name === "handless climber") {
        return primeLevel >= 8 && hasTalent("wall crawler");
      }
      if (name === "wall runner's flow") {
        return primeLevel >= 16 && hasTalent("handless climber");
      }
      if (name === "blast (competent)") {
        return primeLevel >= 6 && hasTalent("blast (apprentice)");
      }
      if (name === "blast (masterful)") {
        return primeLevel >= 11 && hasTalent("blast (competent)");
      }
      if (name === "blast (legendary)") {
        return primeLevel >= 16 && hasTalent("blast (masterful)");
      }
      if (name === "heavy armor training") {
        const alreadyHasHeavyArmor = hasTalent("heavy armor training");
        return primeLevel >= 6 && hasTalent("medium armor training") && !alreadyHasHeavyArmor;
      }
      if (name === "initiative training (competent)") {
        return primeLevel >= 6 && hasTalent("initiative training (apprentice)");
      }
      if (name === "initiative training (masterful)") {
        return primeLevel >= 11 && hasTalent("initiative training (competent)");
      }
      if (name === "initiative training (legendary)") {
        return primeLevel >= 16 && hasTalent("initiative training (masterful)");
      }
      if (name === "saving throw training (masterful)") {
        const hasSavingThrowCompetent = normalizedSelected.some(talentName =>
          talentName.includes("saving throw") && talentName.includes("competent")
        ) || embeddedTalentNames.has("saving throw training (competent)");
        const savingThrows = this.actor.system.savingThrows || {};
        const hasCompetentFromProgression = Object.values(savingThrows).some(st => st?.rank === "Competent");
        return primeLevel >= 11 && (hasSavingThrowCompetent || hasCompetentFromProgression);
      }
      if (name === "saving throw training (legendary)") {
        const hasSavingThrowMasterful = normalizedSelected.some(talentName =>
          talentName.includes("saving throw") && talentName.includes("masterful")
        ) || embeddedTalentNames.has("saving throw training (masterful)");
        const savingThrows = this.actor.system.savingThrows || {};
        const hasMasterfulFromProgression = Object.values(savingThrows).some(st => st?.rank === "Masterful");
        return primeLevel >= 16 && (hasSavingThrowMasterful || hasMasterfulFromProgression);
      }
      if (name === "saving throw training (competent)") {
        // Check if player has any "Saving Throw Training (Apprentice)" talent
        const hasSavingThrowApprentice = normalizedSelected.some(talentName => 
          talentName.includes("saving throw") && talentName.includes("apprentice")
        ) || embeddedTalentNames.has("saving throw training (apprentice)");
        // Also check if player has any Apprentice rank saving throws from progression
        const savingThrows = this.actor.system.savingThrows || {};
        const hasApprenticeFromProgression = Object.values(savingThrows).some(st => st?.rank === "Apprentice");
        return primeLevel >= 6 && (hasSavingThrowApprentice || hasApprenticeFromProgression);
      }
      if (name === "skill training (masterful)") {
        const hasSkillTrainingCompetent = normalizedSelected.some(talentName =>
          talentName.includes("skill training") && talentName.includes("competent")
        ) || embeddedTalentNames.has("skill training (competent)");
        const skills = this.actor.system.skills || {};
        const hasCompetentFromProgression = Object.values(skills).some(skill => skill?.rank === "Competent");
        return primeLevel >= 11 && (hasSkillTrainingCompetent || hasCompetentFromProgression);
      }
      if (name === "skill training (legendary)") {
        const hasSkillTrainingMasterful = normalizedSelected.some(talentName =>
          talentName.includes("skill training") && talentName.includes("masterful")
        ) || embeddedTalentNames.has("skill training (masterful)");
        const skills = this.actor.system.skills || {};
        const hasMasterfulFromProgression = Object.values(skills).some(skill => skill?.rank === "Masterful");
        return primeLevel >= 16 && (hasSkillTrainingMasterful || hasMasterfulFromProgression);
      }
      if (name === "skill training (competent)") {
        // Check if player has any "Skill Training (Apprentice)" talent
        const hasSkillTrainingApprentice = normalizedSelected.some(talentName => 
          talentName.includes("skill training") && talentName.includes("apprentice")
        ) || embeddedTalentNames.has("skill training (apprentice)");
        // Also check if player has any Apprentice rank skills from progression
        const skills = this.actor.system.skills || {};
        const hasApprenticeSkillFromProgression = Object.values(skills).some(skill => skill?.rank === "Apprentice");
        return primeLevel >= 6 && (hasSkillTrainingApprentice || hasApprenticeSkillFromProgression);
      }
      if (name === "weapon training (competent)") {
        // Check if player has any "Weapon Training (Apprentice)" talent
        const hasWeaponTrainingApprentice = normalizedSelected.some(talentName => 
          talentName.includes("weapon training") && talentName.includes("apprentice")
        ) || embeddedTalentNames.has("weapon training (apprentice)");
        // Also check if player has any Apprentice rank weapons from progression/items
        const weaponItems = this.actor.items.filter(item => item.type === "weapon");
        const hasApprenticeWeaponFromProgression = weaponItems.some(weapon => weapon.system?.training?.rank === "Apprentice");
        return primeLevel >= 6 && (hasWeaponTrainingApprentice || hasApprenticeWeaponFromProgression);
      }
      if (name === "weapon training (masterful)") {
        const hasWeaponTrainingCompetent = normalizedSelected.some(talentName =>
          talentName.includes("weapon training") && talentName.includes("competent")
        ) || embeddedTalentNames.has("weapon training (competent)");
        const weaponItems = this.actor.items.filter(item => item.type === "weapon");
        const hasCompetentWeaponFromProgression = weaponItems.some(weapon => weapon.system?.training?.rank === "Competent");
        return primeLevel >= 11 && (hasWeaponTrainingCompetent || hasCompetentWeaponFromProgression);
      }
      if (name === "weapon training (legendary)") {
        const hasWeaponTrainingMasterful = normalizedSelected.some(talentName =>
          talentName.includes("weapon training") && talentName.includes("masterful")
        ) || embeddedTalentNames.has("weapon training (masterful)");
        const weaponItems = this.actor.items.filter(item => item.type === "weapon");
        const hasMasterfulWeaponFromProgression = weaponItems.some(weapon => weapon.system?.training?.rank === "Masterful");
        return primeLevel >= 16 && (hasWeaponTrainingMasterful || hasMasterfulWeaponFromProgression);
      }
      if (name === "expert climber") {
        return primeLevel >= 4 && hasTalent("wall crawler");
      }
      if (name === "increased resistance") {
        const hasBastionResistance = [
          "bastion's resistance",
          "bastions resistance",
          "bastion resistance"
        ].some(hasTalent);
        return primeLevel >= 5 && hasBastionResistance;
      }
      if (name === "improved improvisation") {
        return primeLevel >= 5 && hasTalent("improvised gadget");
      }
      if (name === "improved impact control") {
        return hasTalent("impact control");
      }
      if (name === "aerial evasion") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 5 && powersetName === "Paragon";
      }
      if (name === "aerial maneuverability") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 5 && powersetName === "Paragon";
      }
      if (name === "breaker's force") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 5 && powersetName === "Paragon";
      }
      if (name === "meteor slam") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 5 && powersetName === "Paragon";
      }
      if (name === "shockwave landing") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 5 && powersetName === "Paragon" && hasTalent("improved impact control");
      }
      if (name === "unbreakable will") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 5 && powersetName === "Paragon";
      }
      if (name === "improved supersonic moment") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 7 && powersetName === "Paragon" && hasTalent("supersonic moment");
      }
      if (name === "thunderclap") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 7 && powersetName === "Paragon";
      }
      if (name === "inspiring presence") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 9 && powersetName === "Paragon";
      }
      if (name === "legendary presence") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 9 && powersetName === "Paragon" && (hasTalent("dominating presence") || hasTalent("noble presence"));
      }
      if (name === "aerial mastery") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 10 && powersetName === "Paragon";
      }
      if (name === "reinforced breaker") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 10 && powersetName === "Paragon" && hasTalent("breaker's force");
      }
      if (name === "improved meteor slam") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 12 && powersetName === "Paragon" && hasTalent("meteor slam");
      }
      if (name === "overwhelming presence") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 12 && powersetName === "Paragon" && hasTalent("legendary presence");
      }
      if (name === "perfect flight") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 14 && powersetName === "Paragon" && hasTalent("aerial mastery");
      }
      if (name === "unstoppable force") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 14 && powersetName === "Paragon" && hasTalent("breaker's force");
      }
      if (name === "apex predator") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 15 && powersetName === "Paragon";
      }
      if (name === "hard breaker") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 15 && powersetName === "Paragon" && hasTalent("reinforced breaker");
      }
      if (name === "ultimate impact") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 15 && powersetName === "Paragon";
      }
      if (name === "legendary impact") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 19 && powersetName === "Paragon" && hasTalent("ultimate impact");
      }
      if (name === "transcendent presence") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 19 && powersetName === "Paragon" && hasTalent("overwhelming presence");
      }
      if (name === "ultimate breaker") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 20 && powersetName === "Paragon" && hasTalent("hard breaker");
      }
      if (name === "worldbreaker") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 20 && powersetName === "Paragon" && hasTalent("colossal slam");
      }
      if (name === "colossal slam") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 17 && powersetName === "Paragon" && hasTalent("improved meteor slam");
      }
      if (name === "regenerative fortitude") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 7 && powersetName === "Bastion";
      }
      if (name === "protective barrier") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 9 && powersetName === "Bastion";
      }
      if (name === "indomitable will") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 10 && powersetName === "Bastion";
      }
      if (name === "total immunity") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 10 && powersetName === "Bastion" && hasTalent("increased resistance");
      }
      if (name === "rapid intercept") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 12 && powersetName === "Bastion" && hasTalent("intercept attack");
      }
      if (name === "adaptive defense") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 14 && powersetName === "Bastion";
      }
      if (name === "legendary resilience") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 15 && powersetName === "Bastion";
      }
      if (name === "guardian aura") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 17 && powersetName === "Bastion" && hasTalent("protective barrier");
      }
      if (name === "immovable object") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 19 && powersetName === "Bastion";
      }
      if (name === "unbreakable") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 20 && powersetName === "Bastion";
      }
      if (name === "stabilized movement") {
        return hasTalent("deadeye");
      }
      if (name === "improved deadeye") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 7 && powersetName === "Marksman" && hasTalent("deadeye");
      }
      if (name === "trick shot") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 7 && powersetName === "Marksman";
      }
      if (name === "rapid fire") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 9 && powersetName === "Marksman";
      }
      if (name === "specialized ammunition") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 9 && powersetName === "Marksman";
      }
      if (name === "enhanced precision") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 10 && powersetName === "Marksman" && hasTalent("deadeye");
      }
      if (name === "tripoint trauma") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 10 && powersetName === "Marksman" && hasTalent("surgical precision");
      }
      if (name === "lightning reload") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 12 && powersetName === "Marksman" && hasTalent("fast reload");
      }
      if (name === "perfect aim") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 12 && powersetName === "Marksman" && hasTalent("deadeye");
      }
      if (name === "ricochet shot") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 12 && powersetName === "Marksman";
      }
      if (name === "master marksman") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 14 && powersetName === "Marksman";
      }
      if (name === "pinpoint accuracy") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 14 && powersetName === "Marksman";
      }
      if (name === "versatile arsenal") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 15 && powersetName === "Marksman" && hasTalent("quickdraw");
      }
      if (name === "deadly focus") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 17 && powersetName === "Marksman" && hasTalent("deadeye");
      }
      if (name === "master ricochet") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 17 && powersetName === "Marksman" && hasTalent("ricochet shot");
      }
      if (name === "penetrating shot") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 17 && powersetName === "Marksman" && hasTalent("perfect aim");
      }
      if (name === "unerring aim") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 19 && powersetName === "Marksman" && hasTalent("enhanced precision");
      }
      if (name === "impossible shot") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 20 && powersetName === "Marksman";
      }
      if (name === "perfect shot") {
        const powersetName = this.actor.system.progression?.level1?.powersetName || this.actor.system.basic?.powerset;
        return primeLevel >= 20 && powersetName === "Marksman" && hasTalent("unerring aim");
      }
      return true;
    };

    const resolvedTalents = [];
    for (const talentIndex of allTalents) {
      let talentDoc;
      try {
        talentDoc = await talentsPack.getDocument(talentIndex._id);
      } catch (err) {
        continue;
      }
      if (!talentDoc || !meetsTalentPrereqs(talentDoc)) {
        continue;
      }

      const normalizedName = (talentDoc.name || "").toLowerCase().trim();
      if (selectedTalents.has(normalizedName)) {
        const canRepeatWithVariations =
          normalizedName.includes("saving throw") && normalizedName.includes("apprentice") ||
          normalizedName.includes("skill training") && normalizedName.includes("apprentice") ||
          normalizedName.includes("weapon training") ||
          normalizedName.startsWith("blast (") ||
          (normalizedName.includes("bastion") && normalizedName.includes("resistance"));
        if (!canRepeatWithVariations) {
          continue;
        }
      }

      const rawTalentLevel = talentDoc.system?.basic?.level;
      let talentLevel = Number(rawTalentLevel);
      if (!Number.isFinite(talentLevel) || talentLevel <= 0) {
        const match = String(rawTalentLevel || "").match(/\d+/);
        talentLevel = match ? Number(match[0]) : 1;
      }
      if (talentLevel === 1) {
        const nameLower = normalizedName;
        if (nameLower === "medium armor training") {
          talentLevel = 2;
        } else if (nameLower === "blast (competent)") {
          talentLevel = 6;
        } else if (nameLower === "heavy armor training") {
          talentLevel = 6;
        } else if (nameLower === "initiative training (competent)") {
          talentLevel = 6;
        } else if (nameLower === "saving throw training (competent)") {
          talentLevel = 6;
        } else if (nameLower === "skill training (competent)") {
          talentLevel = 6;
        } else if (nameLower === "weapon training (competent)") {
          talentLevel = 6;
        } else if (nameLower === "blast damage enhancement ii") {
          talentLevel = 8;
        } else if (nameLower === "handless climber") {
          talentLevel = 8;
        } else if (nameLower === "blast (masterful)") {
          talentLevel = 11;
        } else if (nameLower === "initiative training (masterful)") {
          talentLevel = 11;
        } else if (nameLower === "saving throw training (masterful)") {
          talentLevel = 11;
        } else if (nameLower === "skill training (masterful)") {
          talentLevel = 11;
        } else if (nameLower === "weapon training (masterful)") {
          talentLevel = 11;
        } else if (nameLower === "blast damage enhancement iii") {
          talentLevel = 13;
        } else if (nameLower === "blast (legendary)") {
          talentLevel = 16;
        } else if (nameLower === "initiative training (legendary)") {
          talentLevel = 16;
        } else if (nameLower === "saving throw training (legendary)") {
          talentLevel = 16;
        } else if (nameLower === "skill training (legendary)") {
          talentLevel = 16;
        } else if (nameLower === "wall runner's flow") {
          talentLevel = 16;
        } else if (nameLower === "weapon training (legendary)") {
          talentLevel = 16;
        } else if (nameLower === "blast damage enhancement iv") {
          talentLevel = 18;
        }
      }
      if (filterSlotType === "gadgeteerTalent") {
        const gadgeteerTalentLevelMap = {
          "rapid deployment": 3,
          "improved improvisation": 5
        };
        if (gadgeteerTalentLevelMap[normalizedName]) {
          talentLevel = gadgeteerTalentLevelMap[normalizedName];
        }
      }
      resolvedTalents.push({
        _id: talentDoc.id || talentIndex._id,
        name: talentDoc.name,
        img: talentDoc.img || "icons/svg/mystery-man.svg",
        description: talentDoc.system?.description || talentDoc.system?.details?.description || "",
        level: talentLevel
      });
    }

    for (const talent of resolvedTalents) {
      if (!talentsByLevel[talent.level]) {
        talentsByLevel[talent.level] = [];
      }
      talentsByLevel[talent.level].push(talent);
    }
    
    const maxSelectableLevel = Number(level) || 1;
    const levelsWithTalents = [];
    for (let lvl = 1; lvl <= maxSelectableLevel; lvl++) {
      const count = talentsByLevel[lvl]?.length || 0;
      if (count > 0) {
        levelsWithTalents.push(lvl);
      }
    }

    const initialLevel = level;

    // Define which levels should appear in the filter for each slot type
    let expectedLevelsForSlot = [];
    if (filterSlotType === "bastionTalent") {
      expectedLevelsForSlot = [1, 3, 5, 7, 9, 10, 12, 14, 17, 19, 20];
    } else if (filterSlotType === "paragonTalent") {
      expectedLevelsForSlot = [1, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19, 20];
    } else if (filterSlotType === "gadgeteerTalent") {
      expectedLevelsForSlot = [1, 3, 5, 7, 9, 12, 14, 17, 19, 20];
    } else if (filterSlotType === "marksmanTalent") {
      expectedLevelsForSlot = [1, 3, 5, 7, 9, 12, 14, 17, 19, 20];
    } else {
      // Generic talents: 1, 2, 4, 6, 8, 11, 13, 16, 18
      expectedLevelsForSlot = [1, 2, 4, 6, 8, 11, 13, 16, 18];
    }

    // Create level filter list (only show expected levels up to current level)
    for (const lvl of expectedLevelsForSlot) {
      if (lvl > maxSelectableLevel) break;
      const count = talentsByLevel[lvl]?.length || 0;
      availableLevels.push({
        level: lvl,
        count: count,
        selected: lvl === level
      });
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
    
    if (selectedLevelTalents.length === 0 && levelsWithTalents.length === 0) {
      ui.notifications.warn(`No talents available up to Level ${level}.`);
      return;
    }
    
    // Create dialog content
    const templateRenderer = foundry.applications?.handlebars?.renderTemplate || renderTemplate;
    const content = await templateRenderer("systems/singularity/templates/dialogs/talent-selection.html", {
      level: level,
      slotType: slotType,
      talents: selectedLevelTalents,
      availableLevels: availableLevels
    });
    
    // Create and show dialog
    // Use a plain string title to avoid Foundry's localization/actor type formatting
          let dialogTitle = `Select Talent (Level ${level})`;
          if (filterSlotType === "bastionTalent") {
            dialogTitle = `Select Bastion Talent (Level ${level})`;
          } else if (filterSlotType === "paragonTalent") {
            dialogTitle = `Select Paragon Talent (Level ${level})`;
          } else if (filterSlotType === "gadgeteerTalent") {
            dialogTitle = `Select Gadgeteer Talent (Level ${level})`;
          } else if (filterSlotType === "marksmanTalent") {
            dialogTitle = `Select Marksman Talent (Level ${level})`;
          }
    
    const dialogId = `talent-dialog-${Date.now()}`;
    const self = this;

    // Build click handler that closes over level/slotType/pack (same pattern as item-selection bindItemSelection)
    const makeTalentClickHandler = (dialogRef) => async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const itemEl = event.currentTarget;
      const talentId = itemEl.getAttribute("data-talent-id");
      if (!talentId) return;
      const talentUuid = `Compendium.singularity.talents.${talentId}`;
      let talent;
      try {
        talent = await talentsPack.getDocument(talentId);
      } catch (err) {
        console.error("Singularity | Error fetching talent document:", err);
      }
      if (!talent) {
        ui.notifications.error("Talent not found!");
        return;
      }
      const talentName = (talent.name || "").trim();
      const normalizedName = talentName.toLowerCase();
      if (selectedTalents.has(normalizedName)) {
        const canRepeat = normalizedName.includes("saving throw") && normalizedName.includes("apprentice") ||
          normalizedName.includes("skill training") && normalizedName.includes("apprentice") ||
          normalizedName.includes("weapon training") ||
          normalizedName.startsWith("blast (") ||
          (normalizedName.includes("bastion") && normalizedName.includes("resistance"));
        if (!canRepeat) {
          ui.notifications.warn(`You have already selected "${talentName}".`);
          return;
        }
      }
      const levelKey = `level${level}`;
      const updateData = {
        [`system.progression.${levelKey}.${slotType}`]: talentUuid,
        [`system.progression.${levelKey}.${slotType}Name`]: talent.name,
        [`system.progression.${levelKey}.${slotType}Img`]: talent.img || "icons/svg/mystery-man.svg"
      };
      try {
        await self.actor.update(updateData);
        ui.notifications.info(`Selected talent "${talent.name}" added to progression.`);
      } catch (err) {
        console.error("Singularity | Failed to update actor with talent:", err);
        ui.notifications.error("Failed to apply talent. See console for details.");
        return;
      }
      if (slotType === "paragonTalent") {
        const talentNameLower = talent.name.toLowerCase();
        const skills = foundry.utils.deepClone(self.actor.system.skills || {});
        let skillsUpdated = false;
        if (talentNameLower.includes("dominating") && talentNameLower.includes("presence")) {
          if (!skills["Intimidation"] || skills["Intimidation"].lockedSource !== "Dominating Presence") {
            skills["Intimidation"] = { rank: "Novice", ability: "charm", otherBonuses: 4, lockedOtherBonuses: true, lockedSource: "Dominating Presence" };
            skillsUpdated = true;
          }
        }
        if (talentNameLower.includes("noble") && talentNameLower.includes("presence")) {
          if (!skills["Persuasion"] || skills["Persuasion"].lockedSource !== "Noble Presence") {
            skills["Persuasion"] = { rank: "Novice", ability: "charm", otherBonuses: 4, lockedOtherBonuses: true, lockedSource: "Noble Presence" };
            skillsUpdated = true;
          }
        }
        if (talentNameLower.includes("legendary") && talentNameLower.includes("presence")) {
          if (skills["Intimidation"]?.lockedSource === "Dominating Presence") {
            skills["Intimidation"].otherBonuses = 6;
            skills["Intimidation"].lockedOtherBonuses = true;
            skillsUpdated = true;
          }
          if (skills["Persuasion"]?.lockedSource === "Noble Presence") {
            skills["Persuasion"].otherBonuses = 6;
            skills["Persuasion"].lockedOtherBonuses = true;
            skillsUpdated = true;
          }
        }
        if (skillsUpdated) await self.actor.update({ "system.skills": skills });
      }
      if (isBaseBlastTalentName(talent.name)) {
        setTimeout(() => self._showBlastAttackDialog(), 100);
      }
      if (talent.name?.toLowerCase().includes("initiative training")) {
        let newRank = "Novice";
        if (talent.name.toLowerCase().includes("apprentice")) newRank = "Apprentice";
        else if (talent.name.toLowerCase().includes("competent")) newRank = "Competent";
        else if (talent.name.toLowerCase().includes("masterful")) newRank = "Masterful";
        else if (talent.name.toLowerCase().includes("legendary")) newRank = "Legendary";
        const initiative = foundry.utils.deepClone(self.actor.system.combat.initiative || { rank: "Novice", otherBonuses: 0 });
        initiative.rank = newRank;
        await self.actor.update({ "system.combat.initiative": initiative });
        ui.notifications.info(`Initiative proficiency set to ${newRank}!`);
      }
      const talentNameLower = (talent.name || "").toLowerCase();
      if (talentNameLower.includes("bastion") && talentNameLower.includes("resistance")) {
        setTimeout(() => self._showBastionResistanceDialog(level), 100);
      }
      if (talentNameLower === "increased resistance") {
        setTimeout(() => self._showBastionResistanceUpgradeDialog(level), 100);
      }
      if (talentNameLower === "total immunity") {
        setTimeout(() => self._showBastionTotalImmunityDialog(level), 100);
      }
      if (talentNameLower.includes("saving throw training")) {
        let targetRank = "Apprentice";
        if (talentNameLower.includes("competent")) targetRank = "Competent";
        else if (talentNameLower.includes("masterful")) targetRank = "Masterful";
        else if (talentNameLower.includes("legendary")) targetRank = "Legendary";
        setTimeout(() => self._showSavingThrowTrainingDialog(level, slotType, targetRank), 100);
      }
      if (talentNameLower === "legendary resilience") {
        const resistances = foundry.utils.deepClone(self.actor.system.resistances || []);
        const existing = resistances.find(resistance => resistance.source === "Legendary Resilience");
        if (!existing) {
          resistances.push({
            type: "All",
            value: 10,
            source: "Legendary Resilience",
            sourceLevel: levelKey
          });
          await self.actor.update({ "system.resistances": resistances });
        }
      }
      if (talentNameLower.includes("enlarged") && talentNameLower.includes("presence")) {
        const currentSize = self.actor.system.basic.size || "Medium";
        if (currentSize !== "Large") await self.actor.update({ "system.basic.size": "Large" });
      }
      if (talentNameLower.includes("enhanced vitality")) {
        const primeLevel = self.actor.system.basic?.primeLevel || 1;
        const currentMax = self.actor.system.combat?.hp?.max ?? 0;
        await self.actor.update({
          "system.combat.hp.max": currentMax + primeLevel,
          "system.combat.hp.value": Math.min(
            self.actor.system.combat?.hp?.value ?? currentMax,
            currentMax + primeLevel
          )
        });
      }
      self._talentSelectionDialogOpen = false;
      $(document.body).off("click.singularityTalent");
      if (dialogRef?.close) dialogRef.close();
      self.render();
    };

    const bindTalentSelection = (dialogInstance) => {
      const root = dialogInstance?.element?.shadowRoot ?? dialogInstance?.element;
      const container = root instanceof HTMLElement ? root : (root?.length ? root[0] : null);
      const items = container?.querySelectorAll?.(".talent-item") || [];
      items.forEach((itemEl) => {
        if (itemEl.dataset?.boundTalent === "true") return;
        itemEl.dataset.boundTalent = "true";
        itemEl.addEventListener("click", makeTalentClickHandler(dialogInstance));
      });
      return items.length > 0;
    };

    const renderTalentDialog = (html, dialogInstance) => {
        console.log("Singularity | renderTalentDialog CALLED", { html, dialogInstance });
        const originalLevel = level;
        
        // Immediately fix the title in the HTML before Foundry can change it
      const $html = $(html instanceof HTMLElement ? html : html?.[0] || html);
      const rootNode = dialogInstance?.element?.shadowRoot
        ?? (dialogInstance?.element instanceof HTMLElement ? dialogInstance.element : dialogInstance?.element?.[0])
        ?? (html instanceof HTMLElement ? html : html?.[0] || html);
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
        const updateTalentList = (selectedLevel) => {
          const filteredTalents = (talentsByLevel[selectedLevel] || []).sort((a, b) => {
            const nameA = a.name || "";
            const nameB = b.name || "";
            return nameA.localeCompare(nameB);
          });
          
          console.log(`Singularity | updateTalentList called for level ${selectedLevel}, found ${filteredTalents.length} talents`);
          
          // Update the talent list
          const listRoot = rootNode?.querySelector?.(".talent-list")
            ?? $html[0]?.querySelector?.(".talent-list");
          console.log("Singularity | listRoot element:", listRoot);
          if (!listRoot) {
            console.error("Singularity | Could not find .talent-list element!");
            return;
          }
          console.log("Singularity | Clearing listRoot innerHTML, current children:", listRoot.children.length);
          listRoot.innerHTML = "";
          console.log("Singularity | After clear, children count:", listRoot.children.length);
          
          if (filteredTalents.length === 0) {
            console.log("Singularity | No talents, inserting empty message");
            listRoot.insertAdjacentHTML("beforeend", `<p style="color: #a0aec0; padding: 20px; text-align: center;">No talents available for Level ${selectedLevel}.</p>`);
          } else {
            console.log(`Singularity | Inserting ${filteredTalents.length} talents into listRoot`);
            filteredTalents.forEach((talent, index) => {
              const talentItemHtml = `
                <div class="talent-item" data-talent-id="${talent._id}" data-talent-level="${talent.level}" role="button" tabindex="0">
                  <img class="talent-icon" src="${talent.img || 'icons/svg/mystery-man.svg'}" alt="${talent.name}" onerror="this.src='icons/svg/mystery-man.svg'">
                  <div class="talent-info">
                    <div class="talent-name">${talent.name}</div>
                    ${talent.description ? `<div class="talent-description">${talent.description}</div>` : ""}
                  </div>
                </div>
              `;
              listRoot.insertAdjacentHTML("beforeend", talentItemHtml);
              if (index === 0) console.log("Singularity | First talent HTML:", talentItemHtml.substring(0, 200));
            });
            console.log("Singularity | After inserting, listRoot children count:", listRoot.children.length);
          }
          
          // Re-bind click handlers to new items (same pattern as item-selection)
          if (dialogInstance) bindTalentSelection(dialogInstance);
        };
        
        // Handle level filter changes
        const levelInputs = rootNode?.querySelectorAll?.('input[name="levelFilter"]')
          ?? $html[0]?.querySelectorAll?.('input[name="levelFilter"]')
          ?? [];
        console.log("Singularity | Found level filter inputs:", levelInputs.length);
        levelInputs.forEach((input) => {
          input.addEventListener("change", (event) => {
            console.log("Singularity | Level filter changed to:", event.target.value);
            const selectedLevel = parseInt(event.target.value);
            updateTalentList(selectedLevel);
          });
        });
        
        // Bind talent item clicks from dialog root (same as bindItemSelection for background/phenotype/etc.)
        if (dialogInstance) bindTalentSelection(dialogInstance);
        
        // Populate the initial list on render
        setTimeout(() => {
          const selectedInput = rootNode?.querySelector?.('input[name="levelFilter"]:checked')
            ?? $html[0]?.querySelector?.('input[name="levelFilter"]:checked');
          const selected = selectedInput?.value;
          console.log("Singularity | Initial render, selected level:", selected);
          if (selected) updateTalentList(parseInt(selected));
        }, 100);
      };
    
    const clearDialogFlag = () => {
      self._talentSelectionDialogOpen = false;
      $(document.body).off("click.singularityTalent");
    };
    const dialogRef = {};
    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogOptions = {
      title: dialogTitle,
      content: content,
      buttons: DialogClass?.name === "DialogV2"
        ? [
            { action: "cancel", icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: clearDialogFlag }
          ]
        : {
            cancel: {
              icon: '<i class="fas fa-times"></i>',
              label: "Cancel",
              callback: clearDialogFlag
            }
          },
      default: "cancel",
      render: DialogClass?.name === "DialogV2"
        ? (_app, html) => renderTalentDialog(html, dialogRef.current)
        : (html) => renderTalentDialog(html, dialogRef.current)
    };
    console.log("Singularity | Creating dialog with options", { DialogClass: DialogClass?.name, dialogOptions });
    const dialog = new DialogClass(dialogOptions);
    dialogRef.current = dialog;
    
    const origClose = dialog.close?.bind(dialog);
    if (typeof origClose === "function") {
      dialog.close = (...args) => {
        clearDialogFlag();
        return origClose(...args);
      };
    }
    
    dialog._singularityDialogTitle = dialogTitle;
    if (dialog.data) dialog.data.title = dialogTitle;
    
    console.log("Singularity | About to render dialog", dialog);
    await dialog.render(true);
    console.log("Singularity | Dialog rendered");
    
    // For DialogV2, the render callback in options doesn't work - manually call it after render
    if (DialogClass?.name === "DialogV2") {
      console.log("Singularity | Manually calling renderTalentDialog for DialogV2");
      setTimeout(() => {
        const html = dialog.element;
        console.log("Singularity | DialogV2 element:", html);
        renderTalentDialog(html, dialog);
      }, 100);
    }
    
    const tryBind = () => bindTalentSelection(dialog);
    if (!tryBind()) {
      setTimeout(tryBind, 50);
      setTimeout(tryBind, 150);
      setTimeout(tryBind, 300);
    }
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

    if (!this._canAccessProgressionLevel(level)) {
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

    if (!this._canAccessProgressionLevel(level)) {
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

    if (!this._canAccessProgressionLevel(level)) {
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

    if (!this._canAccessProgressionLevel(level)) {
      return;
    }
    
    // Open powerset selection dialog
    await this._openItemSelectionDialog(level, slotType, "powersets", "Powerset");
  }

  async _openItemSelectionDialog(level, slotType, compendiumName, itemTypeLabel, filterPhenotype = null) {
    // Prevent opening a second item-selection dialog (fixes multiple cancel to close)
    if (this._itemSelectionDialogOpen) {
      return;
    }
    this._itemSelectionDialogOpen = true;

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
    
    const sortedItems = sortItems(availableItems).map(item => {
      const rawDescription = item.system?.description || item.system?.basic?.description || item.description || "";
      const stripper = foundry.utils?.stripHTML || ((html) => String(html || "").replace(/<[^>]*>/g, ""));
      const stripped = stripper(rawDescription || "").replace(/\s+/g, " ").trim();
      const descriptionShort = stripped.length > 180 ? `${stripped.slice(0, 177)}...` : stripped;
      return {
        ...item,
        descriptionShort
      };
    });
    
    // Create dialog content using a generic template
    const templateRenderer = foundry.applications?.handlebars?.renderTemplate || renderTemplate;
    const content = await templateRenderer("systems/singularity/templates/dialogs/item-selection.html", {
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
    
    const selectItemById = async (itemId) => {
      if (!itemId) return;
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
          await this._applyBastionBenefits();
          this._itemSelectionDialogOpen = false;
          this._preferredTab = "progression";
          this.render(true);
          dialog.close();
          return;
        }
      }
      
      await this.actor.update(updateData);
      
      this._itemSelectionDialogOpen = false;
      this._preferredTab = "progression";
      this.render(true);
      dialog.close();
    };

    const self = this;
    const clearItemDialogFlag = () => {
      self._itemSelectionDialogOpen = false;
    };
    const bindItemSelection = (dialogInstance) => {
      const root = dialogInstance?.element?.shadowRoot ?? dialogInstance?.element;
      const container = root instanceof HTMLElement ? root : (root?.length ? root[0] : null);
      const items = container?.querySelectorAll?.(".item-selection-item") || [];
      if (!items.length) return false;
      items.forEach((itemEl) => {
        if (itemEl.dataset?.boundSelect === "true") return;
        itemEl.dataset.boundSelect = "true";
        itemEl.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const itemId = itemEl.getAttribute("data-item-id");
          selectItemById(itemId);
        });
      });
      return true;
    };

    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: dialogTitle,
          content: content,
          buttons: [
            { action: "cancel", icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: clearItemDialogFlag }
          ],
          default: "cancel",
          render: (_app, _html) => {
            const root = dialog?.element?.shadowRoot || dialog?.element;
            const $root = root instanceof jQuery ? root : $(root);
            const $html = $root.length ? $root : $(_html);
            
            const dialogElement = $html.closest('.window-app');
            if (dialogElement.length) {
              dialogElement.attr('data-dialog-id', dialogId);
            }
          }
        }
      : {
          title: dialogTitle,
          content: content,
          buttons: {
            cancel: {
              icon: '<i class="fas fa-times"></i>',
              label: "Cancel",
              callback: clearItemDialogFlag
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
      }
    };
    
    dialogOptions.position = { width: 520, height: "auto" };
    dialogOptions.window = { resizable: true };
    const dialog = new DialogClass(dialogOptions);
    dialog._singularityDialogTitle = dialogTitle;
    if (dialog.data) dialog.data.title = dialogTitle;
    const origItemClose = dialog.close?.bind(dialog);
    if (typeof origItemClose === "function") {
      dialog.close = (...args) => {
        clearItemDialogFlag();
        return origItemClose(...args);
      };
    }
    
    await dialog.render(true);
    const tryBind = () => bindItemSelection(dialog);
    if (!tryBind()) {
      setTimeout(tryBind, 50);
      setTimeout(tryBind, 150);
      setTimeout(tryBind, 300);
    }
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
        const humanIsBaseBlast = (humanGenericTalentName || "").toLowerCase().trim().startsWith("blast (") || (humanGenericTalentName || "").toLowerCase().trim() === "blast (apprentice)";
        if (humanIsBaseBlast) {
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
        const terranIsBaseBlast = (terranGenericTalentName || "").toLowerCase().trim().startsWith("blast (") || (terranGenericTalentName || "").toLowerCase().trim() === "blast (apprentice)";
        if (terranIsBaseBlast) {
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
      const isBaseBlastTalent = (talentName || "").toLowerCase().trim().startsWith("blast (") || (talentName || "").toLowerCase().trim() === "blast (apprentice)";
      
      // If deleting Blast talent, remove the Blast attack
      if (isBaseBlastTalent) {
        const attacks = foundry.utils.deepClone(this.actor.system.attacks || []);
        // Find and remove the Blast attack
        const blastAttackIndex = attacks.findIndex(attack => attack.name === "Blast");
        if (blastAttackIndex !== -1) {
          attacks.splice(blastAttackIndex, 1);
          updateData["system.attacks"] = attacks;
        }
      }

      if (talentName && talentName.toLowerCase().includes("weapon training")) {
        updateData[`system.progression.${levelKey}.${slotType}WeaponCategory`] = null;
      }
    }
    
    // If deleting a Bastion talent slot, check if it's Bastion's Resistance and remove the corresponding resistance
    if (slotType === "bastionTalent" || slotType === "powersetTalent") {
      const talentName = this.actor.system.progression?.[levelKey]?.[`${slotType}Name`];
      const talentNameLower = (talentName || "").toLowerCase();
      
      // If deleting Bastion's Resistance, remove the resistance(s) added by it
      if (talentNameLower.includes("bastion") && talentNameLower.includes("resistance")) {
        const storedType = this.actor.system.progression?.[levelKey]?.bastionTalentResistanceType;
        const resistances = foundry.utils.deepClone(this.actor.system.resistances || []);
        // Remove only the resistance tied to this level (or matching stored type)
        const filteredResistances = resistances.filter(r => {
          if (r.source !== "Bastion's Resistance") return true;
          if (r.sourceLevel && r.sourceLevel === levelKey) return false;
          if (storedType && r.type === storedType) return false;
          return true;
        });
        if (filteredResistances.length !== resistances.length) {
          updateData["system.resistances"] = filteredResistances;
        }
        // Clear the stored damage type
        updateData[`system.progression.${levelKey}.bastionTalentResistanceType`] = null;
      }

      // If deleting Increased Resistance, remove the enhancement from the chosen resistance
      if (talentNameLower === "increased resistance") {
        const storedType = this.actor.system.progression?.[levelKey]?.bastionTalentResistanceType;
        const resistances = foundry.utils.deepClone(this.actor.system.resistances || []);
        let updated = false;
        const updatedResistances = resistances.map(resistance => {
          if (resistance.source !== "Bastion's Resistance") return resistance;
          if (storedType && String(resistance.type).toLowerCase() === String(storedType).toLowerCase()) {
            updated = true;
            return { ...resistance, bastionMultiplier: 2 };
          }
          return resistance;
        });
        if (updated) {
          updateData["system.resistances"] = updatedResistances;
        }
        updateData[`system.progression.${levelKey}.bastionTalentResistanceType`] = null;
      }

      if (talentNameLower === "total immunity") {
        const storedType = this.actor.system.progression?.[levelKey]?.bastionTalentResistanceType;
        const immunities = foundry.utils.deepClone(this.actor.system.immunities || []);
        const filteredImmunities = immunities.filter(imm => {
          if (imm.source !== "Total Immunity") return true;
          if (imm.sourceLevel && imm.sourceLevel === levelKey) return false;
          if (storedType && String(imm.type).toLowerCase() === String(storedType).toLowerCase()) return false;
          return true;
        });
        if (filteredImmunities.length !== immunities.length) {
          updateData["system.immunities"] = filteredImmunities;
        }
        updateData[`system.progression.${levelKey}.bastionTalentResistanceType`] = null;
      }

      if (talentNameLower === "adaptive defense") {
        const resistances = foundry.utils.deepClone(this.actor.system.resistances || []);
        const filteredResistances = resistances.filter(resistance => resistance.source !== "Adaptive Defense");
        if (filteredResistances.length !== resistances.length) {
          updateData["system.resistances"] = filteredResistances;
        }
        const adaptiveDefenseData = foundry.utils.deepClone(this.actor.system.combat?.adaptiveDefense || { types: [] });
        adaptiveDefenseData.types = [];
        updateData["system.combat.adaptiveDefense"] = adaptiveDefenseData;
      }

      if (talentNameLower === "legendary resilience") {
        const resistances = foundry.utils.deepClone(this.actor.system.resistances || []);
        const filteredResistances = resistances.filter(resistance => resistance.source !== "Legendary Resilience");
        if (filteredResistances.length !== resistances.length) {
          updateData["system.resistances"] = filteredResistances;
        }
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
      
      // If deleting Saving Throw Training, recompute ranks based on remaining sources
      if (talentNameLower.includes("saving throw training")) {
        updateData[`system.progression.${levelKey}.${slotType}SavingThrow`] = null;
        const progressionCopy = foundry.utils.deepClone(this.actor.system.progression || {});
        const levelData = progressionCopy[levelKey] || {};
        levelData[`${slotType}SavingThrow`] = null;
        levelData[`${slotType}Name`] = null;
        progressionCopy[levelKey] = levelData;

        const savingThrows = foundry.utils.deepClone(this.actor.system.savingThrows || {});
        const rankOrder = { Novice: 0, Apprentice: 1, Competent: 2, Masterful: 3, Legendary: 4 };
        const rankFromTalent = (name) => {
          const lower = (name || "").toLowerCase();
          if (lower.includes("legendary")) return "Legendary";
          if (lower.includes("masterful")) return "Masterful";
          if (lower.includes("competent")) return "Competent";
          return "Apprentice";
        };

        const desiredRanks = {
          might: "Novice",
          agility: "Novice",
          endurance: "Novice",
          wits: "Novice",
          charm: "Novice"
        };

        const powersetName = progressionCopy.level1?.powersetName || this.actor.system.basic?.powerset;
        const bastionSavingThrow = progressionCopy.level1?.bastionSavingThrow;
        if (powersetName === "Bastion" && bastionSavingThrow) {
          desiredRanks[bastionSavingThrow] = "Apprentice";
        }

        const savingThrowSlots = ["genericTalent", "humanGenericTalent", "terranGenericTalent"];
        for (let lvl = 1; lvl <= 20; lvl++) {
          const lvlKey = `level${lvl}`;
          const lvlData = progressionCopy[lvlKey] || {};
          for (const slot of savingThrowSlots) {
            const name = lvlData[`${slot}Name`];
            if (!name || !String(name).toLowerCase().includes("saving throw training")) continue;
            const ability = lvlData[`${slot}SavingThrow`];
            if (!ability || !desiredRanks[ability]) continue;
            const rank = rankFromTalent(name);
            if (rankOrder[rank] > rankOrder[desiredRanks[ability]]) {
              desiredRanks[ability] = rank;
            }
          }
        }

        for (const ability of Object.keys(desiredRanks)) {
          if (!savingThrows[ability]) {
            savingThrows[ability] = { rank: desiredRanks[ability], otherBonuses: 0 };
          } else {
            savingThrows[ability].rank = desiredRanks[ability];
          }
        }
        updateData["system.savingThrows"] = savingThrows;
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
          try {
            await savingThrowTalent.delete();
          } catch (error) {
            console.warn("Singularity | Saving Throw Training talent already removed.", error);
          }
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
    this._preferredTab = "progression";
    const select = event.currentTarget;
    const value = select.value;
    const slotType = select.dataset.slotType || $(select).closest(".progression-slot").data("slot-type");
    const level = Number($(select).closest(".progression-slot").data("level")) || null;
    const levelKey = level ? `level${level}` : "level1";

    if (level && !this._canAccessProgressionLevel(level)) {
      this.render();
      return;
    }

    if (select.dataset?.manualSave === "true") {
      return;
    }
    
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
            otherBonuses: 0,
            lockedSource: "Paragon Skill Training",
            lockedByPowerset: true
          };
        } else {
          // Upgrade to Apprentice if currently Novice
          if (skills[skillName].rank === "Novice" || !skills[skillName].rank) {
            skills[skillName].rank = "Apprentice";
          }
          if (!skills[skillName].lockedSource) {
            skills[skillName].lockedSource = "Paragon Skill Training";
          }
          skills[skillName].lockedByPowerset = true;
        }
        
        await this.actor.update({
          "system.skills": skills,
          [`system.progression.${levelKey}.${slotType}`]: value
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
            otherBonuses: 0,
            lockedSource: "Gadgeteer Skill Training",
            lockedByPowerset: true
          };
        } else {
          if (skills[skillName].rank === "Novice" || !skills[skillName].rank) {
            skills[skillName].rank = "Apprentice";
          }
          if (!skills[skillName].lockedSource) {
            skills[skillName].lockedSource = "Gadgeteer Skill Training";
          }
          skills[skillName].lockedByPowerset = true;
        }
        
        await this.actor.update({
          "system.skills": skills,
          [`system.progression.${levelKey}.${slotType}`]: value
        });
        this.render();
        return;
      }
    }
    
    // Handle Marksman skill training (bonus skill)
    if (slotType === "marksmanSkillTraining") {
      await this._applyMarksmanSkillTraining(value, select);
      return;
    }

    if (slotType === "marksmanSkillTrainingAbility") {
      const slot = $(select).closest(".progression-slot");
      const input = slot.find(".marksman-skill-input")[0];
      const rawValue = input ? input.value : "";
      await this._applyMarksmanSkillTraining(rawValue, input, value);
      return;
    }
    
    if (!slotType) {
      return;
    }
    
    // Update the progression slot
    const updateData = {
      [`system.progression.${levelKey}.${slotType}`]: value || null
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
    const levelData = progression[levelKey] || {};
    levelData[slotType] = value || null;
    progression[levelKey] = levelData;
    const level1 = progression.level1 || {};
    
    // Calculate bonuses
    if (level1.humanAbilityBoost) {
      abilityBonuses[level1.humanAbilityBoost] += 1;
    }
    if (level1.terranAbilityBoost) {
      abilityBonuses[level1.terranAbilityBoost] += 1;
    }
    if (level1.backgroundAbilityBoost) {
      abilityBonuses[level1.backgroundAbilityBoost] += 1;
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
    
    const asiLevels = [3, 5, 8, 10, 13, 15, 18, 20];
    for (const asiLevel of asiLevels) {
      const asiKey = `level${asiLevel}`;
      const asiData = progression[asiKey] || {};
      const boosts = [asiData.abilityScoreImprovement1, asiData.abilityScoreImprovement2];
      for (const boost of boosts) {
        if (boost && abilityBonuses.hasOwnProperty(boost)) {
          abilityBonuses[boost] += 1;
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

  async _onSaveMarksmanSkillTraining(event) {
    event.preventDefault();
    event.stopPropagation();
    this._preferredTab = "progression";

    const slot = $(event.currentTarget).closest(".progression-slot");
    const input = slot.find(".marksman-skill-input")[0];
    const abilitySelect = slot.find(".marksman-skill-ability")[0];
    const rawValue = input ? input.value : "";
    const abilityOverride = abilitySelect ? abilitySelect.value : "";
    await this._applyMarksmanSkillTraining(rawValue, input, abilityOverride);
  }

  async _applyMarksmanSkillTraining(rawValue, inputEl, abilityOverride = "") {
    const normalizeSkillKey = (name) => String(name || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\s*\(\s*/g, "(")
      .replace(/\s*\)\s*/g, ")")
      .toLowerCase();

    const cleanedValue = String(rawValue || "").trim();
    const previousValueRaw = String(this.actor.system.progression?.level1?.marksmanSkillTraining || "").trim();
    const previousKeyRaw = String(this.actor.system.progression?.level1?.marksmanSkillTrainingKey || "").trim();
    const normalizedPrevious = normalizeSkillKey(previousKeyRaw || previousValueRaw);
    const deletions = [];
    const storedAbility = String(this.actor.system.progression?.level1?.marksmanSkillTrainingAbility || "").trim();

    if (!cleanedValue) {
      const skills = foundry.utils.deepClone(this.actor.system.skills || {});
      for (const key of Object.keys(skills)) {
        const skill = skills[key];
        if (key === "Perception") {
          continue;
        }
        if (skill?.lockedSource === "Marksman Skill Training" && !skill.lockedOtherBonuses) {
          delete skills[key];
          deletions.push(key);
        }
      }
      if (normalizedPrevious) {
        const previousSkillKey = Object.keys(skills).find(
          (key) => normalizeSkillKey(key) === normalizedPrevious
        );
        if (previousSkillKey && previousSkillKey !== "Perception" && !skills[previousSkillKey]?.lockedOtherBonuses) {
          delete skills[previousSkillKey];
          deletions.push(previousSkillKey);
        }
      }
      const updateData = {
        "system.skills": skills,
        "system.progression.level1.marksmanSkillTraining": null,
        "system.progression.level1.marksmanSkillTrainingKey": null,
        "system.progression.level1.marksmanSkillTrainingAbility": null
      };
      for (const key of deletions) {
        updateData[`system.skills.-=${key}`] = null;
      }
      await this.actor.update(updateData);
      if (inputEl) {
        inputEl.value = "";
      }
      this.render();
      return;
    }

    const formattedValue = cleanedValue
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\s*\(\s*/g, " (")
      .replace(/\s*\)\s*/g, ")");
    let skillName = formattedValue.charAt(0).toUpperCase() + formattedValue.slice(1);

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

    let ability = abilityOverride || storedAbility || "wits";
    for (const [mappedName, mappedAbility] of Object.entries(skillAbilityMap)) {
      if (normalizeSkillKey(mappedName) === normalizeSkillKey(skillName)) {
        skillName = mappedName;
        if (!abilityOverride && !storedAbility) {
          ability = mappedAbility;
        }
        break;
      }
    }

    const existingAbility = this.actor.system.skills?.[skillName]?.ability;
    if (existingAbility && !abilityOverride) {
      ability = existingAbility;
    }

    if (inputEl && inputEl.value !== skillName) {
      inputEl.value = skillName;
    }

    const skills = foundry.utils.deepClone(this.actor.system.skills || {});
    const normalizedNewKey = normalizeSkillKey(skillName);
    const existingSkillKey = Object.keys(skills).find(
      (key) => normalizeSkillKey(key) === normalizedNewKey
    );

    for (const key of Object.keys(skills)) {
      const skill = skills[key];
      if (key === "Perception") {
        continue;
      }
      if (skill?.lockedSource === "Marksman Skill Training" && normalizeSkillKey(key) !== normalizedNewKey && !skill.lockedOtherBonuses) {
        delete skills[key];
        deletions.push(key);
      }
    }

    if (normalizedPrevious && normalizedPrevious !== normalizedNewKey) {
      const previousSkillKey = Object.keys(skills).find(
        (key) => normalizeSkillKey(key) === normalizedPrevious
      );
      if (previousSkillKey && previousSkillKey !== "Perception" && !skills[previousSkillKey]?.lockedOtherBonuses) {
        delete skills[previousSkillKey];
        deletions.push(previousSkillKey);
      }
    }

    const targetSkillKey = existingSkillKey || skillName;
    if (!skills[targetSkillKey]) {
      skills[targetSkillKey] = {
        rank: "Apprentice",
        ability: ability,
        otherBonuses: 0,
        lockedSource: "Marksman Skill Training",
        lockedByPowerset: true
      };
    } else {
      if (skills[targetSkillKey].rank === "Novice" || !skills[targetSkillKey].rank) {
        skills[targetSkillKey].rank = "Apprentice";
      }
      if (abilityOverride) {
        skills[targetSkillKey].ability = abilityOverride;
      }
      skills[targetSkillKey].lockedSource = "Marksman Skill Training";
      skills[targetSkillKey].lockedByPowerset = true;
    }

    const updateData = {
      "system.skills": skills,
      "system.progression.level1.marksmanSkillTraining": skillName,
      "system.progression.level1.marksmanSkillTrainingKey": targetSkillKey,
      "system.progression.level1.marksmanSkillTrainingAbility": ability
    };
    for (const key of deletions) {
      updateData[`system.skills.-=${key}`] = null;
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
