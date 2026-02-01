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
    html.on("click", ".editor-edit", (event) => this._onEditDescription(event));
    html.on("click", ".profile-img", (event) => this._onChangeItemImage(event));
    html.on("change", 'select[name="system.basic.type"]', async (event) => {
      const value = event.currentTarget?.value;
      if (!value) return;
      await this.item.update({ "system.basic.type": value });
    });

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
            await this.item.update({ [target]: value });
            this.render(true);
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
                await this.item.update({ [target]: value });
                this.render(true);
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
    
    return context;
  }
}
