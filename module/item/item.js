/**
 * Extend the base Item entity
 * @extends {Item}
 */
export class SingularityItem extends Item {
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
    // Calculate derived data
  }
}
