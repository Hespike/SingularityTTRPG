/**
 * Utility to import pregenerated characters from HTML files into Foundry VTT compendium
 */

/**
 * Import Vanguard pregen character
 */
export async function importVanguard() {
  // Get or create the pregens compendium
  let pack = game.packs.find(p => p.metadata.name === "pregens" && p.metadata.packageName === "singularity");
  
  if (!pack) {
    ui.notifications.error("Pregens compendium not found. Please ensure it's configured in system.json");
    return;
  }

  // Unlock the pack if needed
  const wasLocked = pack.locked;
  if (wasLocked) {
    await pack.configure({ locked: false });
  }

  try {
    // Check if Vanguard already exists
    const existing = pack.index.find(a => a.name === "Vanguard");
    if (existing) {
      const confirm = await Dialog.confirm({
        title: "Vanguard Already Exists",
        content: "<p>Vanguard already exists in the compendium. Do you want to replace it?</p>",
        yes: () => true,
        no: () => false,
        defaultYes: false
      });
      
      if (confirm) {
        const actor = await pack.getDocument(existing._id);
        await actor.delete();
      } else {
        ui.notifications.info("Import cancelled.");
        return;
      }
    }

    // Parse ability scores from the HTML (they're shown as modifiers, need to convert)
    // In Singularity, +2 modifier = ability score of 4, +1 = 2, +0 = 0
    // Formula: modifier * 2 = ability score
    const abilityModifiers = {
      might: 2,    // +2 = 4
      agility: 1,  // +1 = 2
      endurance: 2, // +2 = 4
      wits: 1,     // +1 = 2
      charm: 0     // +0 = 0
    };

    const abilities = {};
    for (const [ability, modifier] of Object.entries(abilityModifiers)) {
      abilities[ability] = modifier * 2;
    }

    // Create the actor data
    const actorData = {
      name: "Vanguard",
      type: "hero",
      system: {
        basic: {
          primeLevel: 1,
          phenotype: "Human",
          subtype: "Terran",
          size: "Medium",
          background: "Military",
          powerset: "Bastion"
        },
        abilities: abilities,
        combat: {
          hp: {
            value: 18,
            max: 18
          },
          ac: 17,
          speeds: {
            land: 25
          },
          initiative: 0
        },
        skills: {
          "Survival": {
            ability: "wits",
            rank: "Apprentice",
            otherBonuses: 0
          },
          "Endurance Saves": {
            ability: "endurance",
            rank: "Apprentice",
            otherBonuses: 0
          }
        },
        savingThrows: {
          might: { rank: "Novice", otherBonuses: 0 },
          agility: { rank: "Novice", otherBonuses: 0 },
          endurance: { rank: "Apprentice", otherBonuses: 0 },
          wits: { rank: "Novice", otherBonuses: 0 },
          charm: { rank: "Novice", otherBonuses: 0 }
        },
        equipment: {
          credits: 4,
          weapons: [],
          armor: [],
          other: []
        },
        attacks: [
          {
            name: "Unarmed Strike",
            attackBonus: 6,
            damage: "1d2+2",
            damageType: "kinetic",
            range: "Melee",
            ability: "might"
          }
        ],
        notes: "",
        backstory: "Cassidy Miller was born in the Dust Belts, struggling agricultural states on the Terra frontiers. Her father, a structural welder, taught her that anything can be fixed with enough heat and a steady hand.\n\nWhen local syndicates began shaking down workers, a teenage Cassidy fashioned crude armor from welding equipment and hull-plating scraps. She became a nightmare for bullies and debt collectors, earning a reputation as an \"unmovable object.\"\n\nShe joined the Free States Army to protect more than just her neighborhood. During the Varysk Campaign, her true power revealed itself when her unit was pinned in a collapsing spire. While the building crumbled around them, Cassidy anchored herself and held the structural supports together with her bare hands, allowing her squad to evacuate. She walked out of the rubble carrying her commanding officer, her enhanced durability and strength fully awakened for the first time.\n\nThe government tried to market her as \"Lady Liberty\" in a flashy spandex suit, but Cassidy refused. She dropped her combat boots on the General's desk and declared, \"I'm a soldier, not a mascot.\" They compromised on \"Vanguard\", a name honoring her position at the front of every charge.",
        appearance: "Cassidy has short, dark brown hair that's often windswept from action. Her face carries a stern, focused expression, with dark, intense eyes that constantly scan for threats. She's in her late twenties, with the weathered look of someone who's seen real combat.\n\nShe wears heavy, segmented armor in dark metallic grey, showing patches of rust and wear that speak to extensive field use. The armor is layered and robust, covering her torso, arms, and legs with gauntlets, pauldrons, and greaves. Beneath the armor, a dark form-fitting undersuit provides additional protection. A utility belt with multiple pouches is strapped around her waist, carrying essential gear. Her boots are sturdy and dark brown, built for durability over style.\n\nHer posture is always ready, weight slightly shifted, conveying both confidence and constant vigilance. Even at rest, she moves with the economy of motion of a trained soldier who knows how to conserve energy for when it matters."
      },
      img: "systems/singularity/img/Vanguard.jpg"
    };

    // Create the actor in the compendium
    const actor = await pack.createDocument(actorData);
    
    // Create Hard to Kill talent
    const talentData = {
      name: "Hard to Kill",
      type: "talent",
      system: {
        description: "Increase Wound Limit by 2",
        basic: {
          type: "generic",
          prerequisites: ""
        },
        archived: false
      }
    };
    
    await actor.createEmbeddedDocuments("Item", [talentData]);

    // Create Combat Vest equipment
    const equipmentData = {
      name: "Combat Vest",
      type: "equipment",
      system: {
        description: "A protective combat vest providing armor coverage.",
        basic: {
          quantity: 1
        },
        archived: false
      }
    };
    
    await actor.createEmbeddedDocuments("Item", [equipmentData]);

    ui.notifications.info(`Successfully imported Vanguard into the pregens compendium!`);
    
  } catch (error) {
    console.error("Error importing Vanguard:", error);
    ui.notifications.error(`Error importing Vanguard: ${error.message}`);
  } finally {
    // Re-lock the pack if it was locked
    if (wasLocked) {
      await pack.configure({ locked: true });
    }
  }
}

// Register as a macro for easy access
Hooks.once("ready", () => {
  // Make it available globally for console access
  window.importVanguard = importVanguard;
  
  console.log("Singularity | Vanguard import function available. Run 'importVanguard()' in the console to import the character.");
});
