/**
 * Item Sheet
 * @extends {foundry.appv1.sheets.ItemSheet}
 */
export class SingularityItemSheet extends foundry.appv1.sheets.ItemSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["singularity", "sheet", "item"],
      template: "systems/singularity/templates/item-sheets/item-sheet.html",
      width: 500,
      height: 600,
      resizable: true
    });
  }

  /** @override */
  getData() {
    const context = super.getData();
    
    // Ensure description is initialized if it doesn't exist
    if (!context.item.system.description) {
      context.item.system.description = "";
    }
    
    // Make sure system.description is available in the context for the template
    if (!context.system) {
      context.system = context.item.system;
    }
    if (!context.system.description) {
      context.system.description = context.item.system.description || "";
    }
    
    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    
    // Handle categories field - convert string to array on change
    html.find('input[name="system.basic.categories"]').on("change", (event) => {
      const input = event.target;
      const value = input.value.trim();
      if (value) {
        // Split by comma and clean up
        const categories = value.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
        // Update the item with the array
        this.item.update({ "system.basic.categories": categories });
      } else {
        // Empty string means empty array
        this.item.update({ "system.basic.categories": [] });
      }
    });
  }
  
  /** @override */
  getData() {
    const context = super.getData();
    
    // Ensure description is initialized if it doesn't exist
    if (!context.item.system.description) {
      context.item.system.description = "";
    }
    
    // Make sure system.description is available in the context for the template
    if (!context.system) {
      context.system = context.item.system;
    }
    if (!context.system.description) {
      context.system.description = context.item.system.description || "";
    }
    
    // Format categories array as comma-separated string for display
    if (context.item.type === "weapon" && context.item.system?.basic?.categories) {
      const categories = context.item.system.basic.categories;
      if (Array.isArray(categories)) {
        context.system.basic.categories = categories.join(", ");
      } else {
        context.system.basic.categories = "";
      }
    } else if (context.item.type === "weapon") {
      context.system.basic.categories = "";
    }
    
    return context;
  }
}
