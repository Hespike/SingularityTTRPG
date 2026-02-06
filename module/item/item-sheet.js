/**
 * Item Sheet (Application V2)
 * @extends {foundry.applications.api.DocumentSheetV2}
 */
const BaseItemSheetV2 = foundry.applications.api.ItemSheetV2 || foundry.applications.api.DocumentSheetV2;
export class SingularityItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  BaseItemSheetV2
) {
  static TEMPLATE = "systems/singularity/templates/item-sheets/item-sheet.html";

  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["singularity", "sheet", "item"],
    position: { width: 500, height: 600 },
    window: { resizable: true }
  });

  static PARTS = {
    body: { template: "systems/singularity/templates/item-sheets/item-sheet.html" }
  };

  get item() {
    return this.document;
  }

  get title() {
    return this.item?.name || "Item";
  }

  /** @override */
  getTitle() {
    return this.title;
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
        this.setPosition({ width: 500, height: 600 });
        this._singularitySized = true;
      }
      const root = this.element?.shadowRoot || this.element;
      const $html = root instanceof jQuery ? root : $(root);
      this.activateListeners($html);
    }
  }

  /** @override */
  activateListeners(html) {
    if (super.activateListeners) {
      super.activateListeners(html);
    }
    
    // Description editor (DialogV2-compatible)
    html.off("click", ".editor-edit");
    html.on("click", ".editor-edit", (event) => this._onEditDescription(event));
    html.off("click", ".profile-img");
    html.on("click", ".profile-img", (event) => this._onChangeItemImage(event));
    
    // Handle form submission for name and other fields
    html.off("submit", "form");
    html.on("submit", "form", (event) => this._onSubmit(event));
    
    // Handle inline changes for immediate save
    html.off("change", 'input[name="name"]');
    html.on("change", 'input[name="name"]', (event) => {
      const value = event.currentTarget?.value?.trim();
      if (value) {
        this._preserveParentTab();
        this.item.update({ name: value });
      }
    });
    
    html.off("change", 'input[name="system.basic.quantity"]');
    html.on("change", 'input[name="system.basic.quantity"]', (event) => {
      const value = parseInt(event.currentTarget?.value) || 0;
      this._preserveParentTab();
      this.item.update({ "system.basic.quantity": Math.max(0, value) });
    });
    
    html.off("change", 'select[name="system.basic.type"]');
    html.on("change", 'select[name="system.basic.type"]', async (event) => {
      const value = event.currentTarget?.value;
      if (!value) return;
      this._preserveParentTab();
      await this.item.update({ "system.basic.type": value });
    });

    html.off("change", 'select[name="system.basic.damageType"]');
    html.on("change", 'select[name="system.basic.damageType"]', async (event) => {
      const value = event.currentTarget?.value;
      if (!value) return;

      const conversionMod = this._getWeaponModifications().find(
        (mod) => mod.type === "damage-type-conversion" && mod.damageType
      );
      if (conversionMod?.damageType) {
        event.currentTarget.value = conversionMod.damageType;
        ui.notifications.warn("Damage Type is locked by a conversion modification.");
        return;
      }

      this._preserveParentTab();
      await this.item.update({ "system.basic.damageType": value });
    });

    html.off("change", 'input[name="system.basic.baseAC"]');
    html.on("change", 'input[name="system.basic.baseAC"]', (event) => {
      const raw = event.currentTarget?.value;
      const value = raw === "" ? null : Number(raw);
      this._preserveParentTab();
      this.item.update({ "system.basic.baseAC": Number.isNaN(value) ? null : value });
    });

    html.off("change", 'input[name="system.basic.agilityCap"]');
    html.on("change", 'input[name="system.basic.agilityCap"]', (event) => {
      const raw = event.currentTarget?.value;
      const value = raw === "" ? null : Number(raw);
      this._preserveParentTab();
      this.item.update({ "system.basic.agilityCap": Number.isNaN(value) ? null : value });
    });

    html.off("change", 'input[name="system.basic.mightRequirement"]');
    html.on("change", 'input[name="system.basic.mightRequirement"]', (event) => {
      const raw = event.currentTarget?.value;
      const value = raw === "" ? null : Number(raw);
      this._preserveParentTab();
      this.item.update({ "system.basic.mightRequirement": Number.isNaN(value) ? null : value });
    });

    html.off("change", ".armor-trait-input");
    html.on("change", ".armor-trait-input", () => {
      this._updateArmorTraitsFromForm(html);
    });

    html.off("click", ".armor-add-mod");
    html.on("click", ".armor-add-mod", (event) => this._onAddArmorModification(event));

    html.off("click", ".armor-remove-mod");
    html.on("click", ".armor-remove-mod", (event) => this._onRemoveArmorModification(event));

    html.off("click", ".weapon-add-mod");
    html.on("click", ".weapon-add-mod", (event) => this._onAddWeaponModification(event));

    html.off("click", ".weapon-remove-mod");
    html.on("click", ".weapon-remove-mod", (event) => this._onRemoveWeaponModification(event));

    // Handle categories field - convert string to array on change
    html.find('input[name="system.basic.categories"]').off("change").on("change", (event) => {
      const input = event.target;
      const value = input.value.trim();
      if (value) {
        // Split by comma and clean up
        const categories = value.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
        // Update the item with the array
        this._preserveParentTab();
        this.item.update({ "system.basic.categories": categories });
      } else {
        // Empty string means empty array
        this._preserveParentTab();
        this.item.update({ "system.basic.categories": [] });
      }
    });
  }

  _getArmorTraitsArray() {
    const traits = this.item?.system?.basic?.traits || [];
    if (Array.isArray(traits)) return traits.slice();
    return String(traits || "")
      .split(",")
      .map((trait) => trait.trim())
      .filter(Boolean);
  }

  _buildArmorTraits({ bulky, stealthyValue, noisyValue, sealedValue }) {
    const existing = this._getArmorTraitsArray().filter((trait) => {
      const value = String(trait || "").trim();
      if (!value) return false;
      if (/^Bulky$/i.test(value)) return false;
      if (/^Stealthy\s*\(/i.test(value)) return false;
      if (/^Stealthy$/i.test(value)) return false;
      if (/^Noisy\s*\(/i.test(value)) return false;
      if (/^Sealed\s*\(/i.test(value)) return false;
      return true;
    });

    const next = [...existing];
    if (bulky) next.push("Bulky");
    if (stealthyValue) next.push(`Stealthy (${stealthyValue})`);
    if (noisyValue) next.push(`Noisy (${noisyValue})`);
    if (sealedValue) next.push(`Sealed (${sealedValue})`);
    return next;
  }

  _updateArmorTraitsFromForm(html) {
    if (this.item?.type !== "armor") return;
    const $root = html instanceof jQuery ? html : $(html);
    const bulky = Boolean($root.find('input[name="armorTraitBulky"]').prop("checked"));
    const stealthyRaw = String($root.find('input[name="armorTraitStealthy"]').val() ?? "").trim();
    const stealthyValue = stealthyRaw ? Number(stealthyRaw) : null;
    const noisyRaw = String($root.find('input[name="armorTraitNoisy"]').val() ?? "").trim();
    const noisyValue = noisyRaw ? Number(noisyRaw) : null;
    const sealedValue = String($root.find('input[name="armorTraitSealed"]').val() ?? "").trim();

    const traits = this._buildArmorTraits({
      bulky,
      stealthyValue: Number.isNaN(stealthyValue) ? null : stealthyValue,
      noisyValue: Number.isNaN(noisyValue) ? null : noisyValue,
      sealedValue: sealedValue || null
    });

    this._preserveParentTab();
    this.item.update({ "system.basic.traits": traits });
  }

  _preserveParentTab() {
    const parentSheet = this.item?.parent?.sheet;
    if (!parentSheet) return;

    let tab = parentSheet._preferredTab || "equipment";
    let $parent = null;
    if (parentSheet.element) {
      $parent = parentSheet.element instanceof jQuery ? parentSheet.element : $(parentSheet.element);
      const activeTab = $parent.find(".sheet-tabs .item.active").first();
      if (activeTab.length) {
        tab = activeTab.data("tab") || tab;
      }
    }

    parentSheet._preferredTab = tab;
    parentSheet._scrollPositions = parentSheet._scrollPositions || {};
    if ($parent) {
      parentSheet._scrollPositions[tab] = $parent.find(`.tab.${tab}`).scrollTop() || 0;
    }
  }

  _getArmorModifications() {
    const mods = this.item?.system?.basic?.modifications || [];
    if (Array.isArray(mods)) return mods.map((mod) => ({ ...mod }));
    return [];
  }

  _getWeaponModifications() {
    const mods = this.item?.system?.basic?.modifications || [];
    if (Array.isArray(mods)) return mods.map((mod) => ({ ...mod }));
    return [];
  }

  _getPrimeLevel() {
    const actor = this.item?.parent;
    return Number(actor?.system?.basic?.primeLevel) || 1;
  }

  _getActorCredits() {
    const actor = this.item?.parent;
    let currentCredits = Number(actor?.system?.equipment?.credits) || 0;
    const parentSheet = actor?.sheet;
    if (parentSheet?.element) {
      const $sheet = parentSheet.element instanceof jQuery ? parentSheet.element : $(parentSheet.element);
      const inputVal = $sheet.find('input[name="system.equipment.credits"]').val();
      if (inputVal !== undefined && inputVal !== null && `${inputVal}`.trim() !== "") {
        const parsed = Number(String(inputVal).replace(/,/g, "").trim());
        if (!Number.isNaN(parsed)) {
          currentCredits = parsed;
        }
      }
    }
    return currentCredits;
  }

  _getAvailableArmorMods() {
    const primeLevel = this._getPrimeLevel();
    const allMods = [
      {
        id: "resistance-enhancement-i",
        name: "Resistance Enhancement I",
        price: 50,
        minPrimeLevel: 1,
        type: "resistance",
        value: 3
      },
      {
        id: "silence-enhancement-i",
        name: "Silence Enhancement I",
        price: 25,
        minPrimeLevel: 2,
        type: "silence",
        value: 1
      }
    ];
    return allMods.filter((mod) => primeLevel >= mod.minPrimeLevel);
  }

  _getAvailableWeaponMods() {
    const actor = this.item?.parent;
    const primeLevel = this._getPrimeLevel();
    const allMods = [
      {
        id: "damage-type-conversion",
        name: "Damage Type Conversion",
        price: 10,
        minPrimeLevel: 1,
        type: "damage-type-conversion"
      },
      {
        id: "damage-enhancement-i",
        name: "Damage Enhancement I",
        price: 100,
        minPrimeLevel: 4,
        type: "damage-enhancement",
        tier: 1,
        addDiceSmall: 2,
        addDiceLarge: 1
      },
      {
        id: "damage-enhancement-ii",
        name: "Damage Enhancement II",
        price: 800,
        minPrimeLevel: 8,
        type: "damage-enhancement",
        tier: 2,
        addDiceSmall: 2,
        addDiceLarge: 1
      },
      {
        id: "damage-enhancement-iii",
        name: "Damage Enhancement III",
        price: 6270,
        minPrimeLevel: 13,
        type: "damage-enhancement",
        tier: 3,
        addDiceSmall: 2,
        addDiceLarge: 1
      },
      {
        id: "damage-enhancement-iv",
        name: "Damage Enhancement IV",
        price: 38280,
        minPrimeLevel: 18,
        type: "damage-enhancement",
        tier: 4,
        addDiceSmall: 2,
        addDiceLarge: 1
      }
    ];
    if (actor?.type === "npc") return allMods;
    return allMods.filter((mod) => primeLevel >= mod.minPrimeLevel);
  }

  async _onAddArmorModification(event) {
    event.preventDefault();
    if (this.item?.type !== "armor") return;

    const availableMods = this._getAvailableArmorMods();
    if (availableMods.length === 0) {
      ui.notifications.warn("No modifications available for your Prime Level.");
      return;
    }

    const damageTypes = [
      "Acid", "Chaos", "Cold", "Fire", "Kinetic", "Lightning",
      "Necrotic", "Photonic", "Poison", "Psychic", "Radiant", "Sonic", "Energy"
    ];
    const damageTypeOptions = damageTypes.map(type => `<option value="${type}">${type}</option>`).join("");

    const content = `
      <form class="singularity-roll-dialog">
        <div class="form-group">
          <label>Modification</label>
          <select id="armor-mod-select">
            ${availableMods.map(mod => `
              <option value="${mod.id}">${mod.name} (${mod.price} credits)</option>
            `).join("")}
          </select>
        </div>
        <div class="form-group" id="armor-mod-damage-type" style="display: none;">
          <label>Damage Type</label>
          <select id="armor-mod-damage">
            <option value="">Choose...</option>
            ${damageTypeOptions}
          </select>
        </div>
      </form>
    `;

    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: "Add Armor Modification",
          content,
          buttons: [
            { action: "add", icon: '<i class="fas fa-check"></i>', label: "Add" },
            { action: "cancel", icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          ],
          default: "add",
          render: (html) => {
            const root = html instanceof jQuery ? html[0] : html;
            const container = root?.shadowRoot || root;
            const select = container?.querySelector("#armor-mod-select");
            const damageRow = container?.querySelector("#armor-mod-damage-type");
            const toggleDamage = () => {
              const selectedId = select?.value;
              const selected = availableMods.find(mod => mod.id === selectedId);
              if (damageRow) {
                damageRow.style.display = selected?.type === "resistance" ? "block" : "none";
              }
            };
            if (select) {
              select.addEventListener("change", toggleDamage);
              toggleDamage();
            }
          },
          submit: async (result, dialog) => {
            if (result !== "add") return;
            const root = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
            const container = root?.shadowRoot || root;
            const selectedId = container?.querySelector("#armor-mod-select")?.value;
            const selected = availableMods.find(mod => mod.id === selectedId);
            if (!selected) return;
            await this._applyArmorModification(selected, container);
          }
        }
      : {
          title: "Add Armor Modification",
          content,
          buttons: {
            add: {
              icon: '<i class="fas fa-check"></i>',
              label: "Add",
              callback: async (html) => {
                const selectedId = html.find("#armor-mod-select").val();
                const selected = availableMods.find(mod => mod.id === selectedId);
                if (!selected) return;
                await this._applyArmorModification(selected, html);
              }
            },
            cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          },
          default: "add",
          render: (html) => {
            const $html = html instanceof jQuery ? html : $(html);
            const toggleDamage = () => {
              const selectedId = $html.find("#armor-mod-select").val();
              const selected = availableMods.find(mod => mod.id === selectedId);
              $html.find("#armor-mod-damage-type").toggle(selected?.type === "resistance");
            };
            $html.find("#armor-mod-select").on("change", toggleDamage);
            toggleDamage();
          }
        };

    const dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
  }

  async _applyArmorModification(mod, container) {
    const actor = this.item?.parent;
    const currentCredits = this._getActorCredits();
    if (currentCredits < mod.price) {
      ui.notifications.warn(`Not enough credits. Requires ${mod.price} credits.`);
      return;
    }

    const mods = this._getArmorModifications();
    let payload = {
      id: `${mod.id}-${Date.now()}`,
      baseId: mod.id,
      name: mod.name,
      type: mod.type,
      value: mod.value,
      price: mod.price
    };

    if (mod.type === "resistance") {
      const damageType = container?.querySelector
        ? String(container.querySelector("#armor-mod-damage")?.value || "").trim()
        : String(container?.find?.("#armor-mod-damage")?.val() || "").trim();
      if (!damageType) {
        ui.notifications.warn("Please enter a damage type.");
        return;
      }
      const exists = mods.some(existing => existing.type === "resistance" && String(existing.damageType || "").toLowerCase() === damageType.toLowerCase());
      if (exists) {
        ui.notifications.warn("You already have a Resistance Enhancement for that damage type.");
        return;
      }
      payload.damageType = damageType;
    }

    mods.push(payload);
    this._preserveParentTab();
    await this.item.update({ "system.basic.modifications": mods });
    await actor?.update({ "system.equipment.credits": currentCredits - mod.price });
    ui.notifications.info(`Added ${mod.name} to ${this.item.name}.`);
  }

  async _onRemoveArmorModification(event) {
    event.preventDefault();
    if (this.item?.type !== "armor") return;
    const modId = event.currentTarget?.dataset?.modId;
    if (!modId) return;
    const mods = this._getArmorModifications().filter(mod => mod.id !== modId);
    this._preserveParentTab();
    await this.item.update({ "system.basic.modifications": mods });
  }

  async _onAddWeaponModification(event) {
    event.preventDefault();
    if (this.item?.type !== "weapon") return;

    const availableMods = this._getAvailableWeaponMods();
    if (availableMods.length === 0) {
      ui.notifications.warn("No modifications available for your Prime Level.");
      return;
    }

    const damageTypes = [
      "Acid", "Chaos", "Cold", "Fire", "Kinetic", "Lightning",
      "Necrotic", "Photonic", "Poison", "Psychic", "Radiant", "Sonic", "Energy"
    ];
    const currentDamageTypeRaw = this.item?.system?.basic?.damageType || "";
    const currentDamageType = damageTypes.find(
      (type) => type.toLowerCase() === String(currentDamageTypeRaw).trim().toLowerCase()
    ) || "";
    const damageTypeOptions = damageTypes.map(type => {
      const selected = currentDamageType && type === currentDamageType ? " selected" : "";
      return `<option value="${type}"${selected}>${type}</option>`;
    }).join("");

    const content = `
      <form class="singularity-roll-dialog">
        <div class="form-group">
          <label>Modification</label>
          <select id="weapon-mod-select">
            ${availableMods.map(mod => `
              <option value="${mod.id}">${mod.name} (${mod.price} credits)</option>
            `).join("")}
          </select>
        </div>
        <div class="form-group" id="weapon-mod-damage-type" style="display: none;">
          <label>Damage Type</label>
          <select id="weapon-mod-damage">
            <option value="">Choose...</option>
            ${damageTypeOptions}
          </select>
        </div>
      </form>
    `;

    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: "Add Weapon Modification",
          content,
          buttons: [
            { action: "add", icon: '<i class="fas fa-check"></i>', label: "Add" },
            { action: "cancel", icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          ],
          default: "add",
          render: (html) => {
            const root = html instanceof jQuery ? html[0] : html;
            const container = root?.shadowRoot || root;
            const select = container?.querySelector("#weapon-mod-select");
            const damageRow = container?.querySelector("#weapon-mod-damage-type");
            const toggleDamage = () => {
              const selectedId = select?.value;
              const selected = availableMods.find(mod => mod.id === selectedId);
              if (damageRow) {
                damageRow.style.display = selected?.type === "damage-type-conversion" ? "block" : "none";
              }
            };
            if (select) {
              select.addEventListener("change", toggleDamage);
              toggleDamage();
            }
          },
          submit: async (result, dialog) => {
            if (result !== "add") return;
            const root = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
            const container = root?.shadowRoot || root;
            const selectedId = container?.querySelector("#weapon-mod-select")?.value;
            const selected = availableMods.find(mod => mod.id === selectedId);
            if (!selected) return;
            await this._applyWeaponModification(selected, container);
          }
        }
      : {
          title: "Add Weapon Modification",
          content,
          buttons: {
            add: {
              icon: '<i class="fas fa-check"></i>',
              label: "Add",
              callback: async (html) => {
                const selectedId = html.find("#weapon-mod-select").val();
                const selected = availableMods.find(mod => mod.id === selectedId);
                if (!selected) return;
                await this._applyWeaponModification(selected, html);
              }
            },
            cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          },
          default: "add",
          render: (html) => {
            const $html = html instanceof jQuery ? html : $(html);
            const toggleDamage = () => {
              const selectedId = $html.find("#weapon-mod-select").val();
              const selected = availableMods.find(mod => mod.id === selectedId);
              $html.find("#weapon-mod-damage-type").toggle(selected?.type === "damage-type-conversion");
            };
            $html.find("#weapon-mod-select").on("change", toggleDamage);
            toggleDamage();
          }
        };

    const dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
  }

  async _applyWeaponModification(mod, container) {
    const actor = this.item?.parent;
    const isNpc = actor?.type === "npc";
    const currentCredits = this._getActorCredits();
    if (!isNpc && currentCredits < mod.price) {
      ui.notifications.warn(`Not enough credits. Requires ${mod.price} credits.`);
      return;
    }

    let mods = this._getWeaponModifications();
    let payload = {
      id: `${mod.id}-${Date.now()}`,
      baseId: mod.id,
      name: mod.name,
      type: mod.type,
      price: mod.price
    };

    if (mod.type === "damage-type-conversion") {
      const existingConversion = mods.find(existing => existing.type === "damage-type-conversion");
      const damageType = container?.querySelector
        ? String(container.querySelector("#weapon-mod-damage")?.value || "").trim()
        : String(container?.find?.("#weapon-mod-damage")?.val() || "").trim();
      if (!damageType) {
        ui.notifications.warn("Please choose a damage type.");
        return;
      }
      const previousDamageType =
        existingConversion?.previousDamageType ?? this.item?.system?.basic?.damageType ?? "";
      mods = mods.filter(existing => existing.type !== "damage-type-conversion");
      payload.damageType = damageType;
      payload.previousDamageType = previousDamageType;
    }

    if (mod.type === "damage-enhancement") {
      mods = mods.filter(existing => existing.type !== "damage-enhancement");
      payload.tier = mod.tier;
      payload.addDiceSmall = mod.addDiceSmall;
      payload.addDiceLarge = mod.addDiceLarge;
    }

    mods.push(payload);
    this._preserveParentTab();
    const updateData = { "system.basic.modifications": mods };
    if (mod.type === "damage-type-conversion") {
      updateData["system.basic.damageType"] = payload.damageType;
    }
    await this.item.update(updateData);
    if (!isNpc) {
      await actor?.update({ "system.equipment.credits": currentCredits - mod.price });
    }
    ui.notifications.info(`Added ${mod.name} to ${this.item.name}.`);
  }

  async _onRemoveWeaponModification(event) {
    event.preventDefault();
    if (this.item?.type !== "weapon") return;
    const modId = event.currentTarget?.dataset?.modId;
    if (!modId) return;
    const currentMods = this._getWeaponModifications();
    const removedMod = currentMods.find(mod => mod.id === modId);
    const mods = currentMods.filter(mod => mod.id !== modId);
    this._preserveParentTab();
    const updateData = { "system.basic.modifications": mods };
    if (removedMod?.type === "damage-type-conversion") {
      if (removedMod.previousDamageType !== undefined && removedMod.previousDamageType !== null) {
        updateData["system.basic.damageType"] = removedMod.previousDamageType || "";
      }
    }
    await this.item.update(updateData);
  }
  
  async _onSubmit(event) {
    event.preventDefault();
    // Collect form data
    const formData = new FormData(event.target);
    const data = {};
    
    for (const [key, value] of formData) {
      if (key === "name") {
        data.name = value.trim();
      } else if (key.startsWith("system.")) {
        foundry.utils.setProperty(data, key, value);
      }
    }
    
    if (Object.keys(data).length > 0) {
      this._preserveParentTab();
      await this.item.update(data);
    }
  }

  async _onEditDescription(event) {
    event.preventDefault();
    event.stopPropagation();

    const editorEl = event.currentTarget.closest(".editor");
    const target = editorEl?.dataset?.edit || "system.description";
    const currentValue = foundry.utils.getProperty(this.item, target) || "";

    const DialogClass = foundry.applications?.api?.DialogV2 || Dialog;
    const dialogOptions = DialogClass?.name === "DialogV2"
      ? {
          title: "Edit Description",
          content: `
            <form>
              <div class="form-group">
                <label>Description</label>
                <textarea name="description" rows="10" style="width: 100%;">${currentValue}</textarea>
              </div>
            </form>
          `,
          buttons: [
            { action: "save", icon: '<i class="fas fa-check"></i>', label: "Save" },
            { action: "cancel", icon: '<i class="fas fa-times"></i>', label: "Cancel" }
          ],
          default: "save",
          submit: async (result, dialog) => {
            if (result !== "save") return;
            const root = dialog?.element instanceof jQuery ? dialog.element[0] : dialog?.element;
            const container = root?.shadowRoot || root;
            const value = container?.querySelector('textarea[name="description"]')?.value ?? "";
            this._preserveParentTab();
            await this.item.update({ [target]: value });
          }
        }
      : {
          title: "Edit Description",
          content: `
            <form>
              <div class="form-group">
                <label>Description</label>
                <textarea name="description" rows="10" style="width: 100%;">${currentValue}</textarea>
              </div>
            </form>
          `,
          buttons: {
            save: {
              icon: '<i class="fas fa-check"></i>',
              label: "Save",
              callback: async (html) => {
                const value = html.find('textarea[name="description"]').val() ?? "";
                this._preserveParentTab();
                await this.item.update({ [target]: value });
              }
            },
            cancel: {
              icon: '<i class="fas fa-times"></i>',
              label: "Cancel"
            }
          },
          default: "save"
        };
    dialogOptions.position = { width: 520, height: "auto" };
    dialogOptions.window = { resizable: true };
    const dialog = new DialogClass(dialogOptions);
    await dialog.render(true);
  }

  async _onChangeItemImage(event) {
    event.preventDefault();
    event.stopPropagation();

    const current = this.item?.img || "";
    const filePicker = new FilePicker({
      type: "image",
      current,
      callback: async (path) => {
        if (!path) return;
        await this.item.update({ img: path });
      }
    });
    filePicker.render(true);
  }
  
  /** @override */
  async getData() {
    const context = {
      item: this.item,
      system: this.item?.system || {},
      data: this.item?.system || {},
      owner: this.item?.isOwner ?? false,
      editable: this.isEditable ?? this.item?.isOwner ?? false,
      cssClass: "singularity sheet item"
    };
    
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

    // Enrich description for the editor helper
    try {
      const textEditor = foundry.applications?.ux?.TextEditor?.implementation || TextEditor;
      context.enrichedDescription = await textEditor.enrichHTML(context.system.description || "", {
        async: true,
        secrets: context.owner,
        relativeTo: this.item
      });
    } catch (error) {
      console.warn("Singularity | Failed to enrich item description:", error);
      context.enrichedDescription = context.system.description || "";
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

    if (context.item.type === "armor") {
      const traits = Array.isArray(context.system.basic?.traits)
        ? context.system.basic.traits
        : String(context.system.basic?.traits || "")
            .split(",")
            .map((trait) => trait.trim())
            .filter(Boolean);

      const noisyMatch = traits.map((trait) => String(trait)).find((trait) => /Noisy\s*\(/i.test(trait));
      const stealthyMatch = traits.map((trait) => String(trait)).find((trait) => /Stealthy\s*\(/i.test(trait));
      const stealthyPlain = traits.map((trait) => String(trait)).find((trait) => /^Stealthy$/i.test(trait));
      const sealedMatch = traits.map((trait) => String(trait)).find((trait) => /Sealed\s*\(/i.test(trait));

      const noisyValue = noisyMatch?.match(/Noisy\s*\(([^)]+)\)/i)?.[1] ?? "";
      const stealthyValue = stealthyMatch?.match(/Stealthy\s*\(([^)]+)\)/i)?.[1] ?? (stealthyPlain ? "1" : "");
      const sealedValue = sealedMatch?.match(/Sealed\s*\(([^)]+)\)/i)?.[1] ?? "";

      context.system.basic.traitsBulky = traits.some((trait) => /^Bulky$/i.test(String(trait)));
      context.system.basic.traitsNoisyValue = noisyValue;
      context.system.basic.traitsStealthyValue = stealthyValue;
      context.system.basic.traitsSealedValue = sealedValue;

      const mods = this._getArmorModifications();
      const modList = mods.map((mod) => {
        let displayDetail = "";
        if (mod.type === "resistance") {
          displayDetail = `${mod.damageType} Resistance ${mod.value}`;
        } else if (mod.type === "silence") {
          displayDetail = `Noisy -${mod.value}`;
        }
        return {
          ...mod,
          displayName: mod.name,
          displayDetail
        };
      });
      context.system.basic.modifications = modList.length ? modList : null;
    }

    if (context.item.type === "weapon") {
      const damageTypes = [
        "Acid", "Chaos", "Cold", "Fire", "Kinetic", "Lightning",
        "Necrotic", "Photonic", "Poison", "Psychic", "Radiant", "Sonic", "Energy"
      ];
      const mods = this._getWeaponModifications();
      const conversionMod = mods.find(
        (mod) => mod.type === "damage-type-conversion" && mod.damageType
      );
      if (conversionMod?.damageType) {
        context.system = context.system || {};
        context.system.basic = context.system.basic || {};
        context.system.basic.damageType = conversionMod.damageType;
        context.weaponDamageTypeLocked = true;
        context.weaponConvertedDamageType = conversionMod.damageType;
      } else {
        context.weaponDamageTypeLocked = false;
        const rawDamageType = this.item?.system?.basic?.damageType;
        const normalizedDamageType = damageTypes.find(
          (type) => type.toLowerCase() === String(rawDamageType || "").trim().toLowerCase()
        );
        let desiredDamageType = normalizedDamageType || "";
        if (!desiredDamageType) {
          desiredDamageType = "Kinetic";
        }
        context.system.basic = context.system.basic || {};
        context.system.basic.damageType = desiredDamageType;
        if (this.isEditable && desiredDamageType !== rawDamageType) {
          await this.item.update({ "system.basic.damageType": desiredDamageType });
        }
      }

      const modList = mods.map((mod) => {
        let displayDetail = "";
        if (mod.type === "damage-type-conversion") {
          displayDetail = `Damage Type: ${mod.damageType}`;
        } else if (mod.type === "damage-enhancement") {
          displayDetail = "Damage +2 dice (d6 or less) or +1 die (d8+)";
        }
        return {
          ...mod,
          displayName: mod.name,
          displayDetail
        };
      });
      context.system.basic.modifications = modList.length ? modList : null;
    }
    
    return context;
  }
}
