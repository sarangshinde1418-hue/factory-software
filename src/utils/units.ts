import { ConversionRule, StandardUnit } from '../types/erp';

// Standard unit dimensions
export type UnitDimension = 'mass' | 'volume' | 'count' | 'custom';

export const MASS_UNITS: Record<string, number> = {
  // Base unit: gram (g)
  mg: 0.001,
  g: 1,
  kg: 1000,
  ton: 1000000,
  lbs: 453.592,
  oz: 28.3495,
};

export const VOLUME_UNITS: Record<string, number> = {
  // Base unit: milliliter (ml)
  ml: 1,
  l: 1000,
  liter: 1000,
  litres: 1000,
  litre: 1000,
  gal: 3785.41,
};

export const COUNT_UNITS: string[] = [
  'pieces',
  'pcs',
  'bottles',
  'bags',
  'buckets',
  'drums',
  'boxes',
  'pouches',
  'packs',
  'units',
  'caps',
  'labels',
  'sleeves',
  'seals',
];

/**
 * Returns the dimension of a given unit
 */
export function getUnitDimension(unit: StandardUnit): UnitDimension {
  const normalized = (unit || '').trim().toLowerCase();
  if (normalized in MASS_UNITS) return 'mass';
  if (normalized in VOLUME_UNITS) return 'volume';
  if (COUNT_UNITS.includes(normalized)) return 'count';
  return 'custom';
}

/**
 * Checks if two units are compatible without cross-dimension conversion rules
 */
export function areUnitsDirectlyCompatible(unitA: StandardUnit, unitB: StandardUnit): boolean {
  const normA = (unitA || '').trim().toLowerCase();
  const normB = (unitB || '').trim().toLowerCase();

  if (normA === normB) return true;

  const dimA = getUnitDimension(normA);
  const dimB = getUnitDimension(normB);

  return dimA === dimB && (dimA === 'mass' || dimA === 'volume');
}

/**
 * Converts value from one unit to another within the same dimension or using conversion rules.
 * Returns null if conversion is impossible without a density/custom conversion rule.
 */
export function convertUnit(
  value: number,
  fromUnit: StandardUnit,
  toUnit: StandardUnit,
  materialId?: string,
  conversionRules: ConversionRule[] = []
): { success: boolean; value: number; explanation?: string } {
  if (value === 0) return { success: true, value: 0 };

  const normFrom = (fromUnit || '').trim().toLowerCase();
  const normTo = (toUnit || '').trim().toLowerCase();

  // Same unit
  if (normFrom === normTo) {
    return { success: true, value };
  }

  const dimFrom = getUnitDimension(normFrom);
  const dimTo = getUnitDimension(normTo);

  // Compatible mass conversion
  if (dimFrom === 'mass' && dimTo === 'mass') {
    const fromFactor = MASS_UNITS[normFrom];
    const toFactor = MASS_UNITS[normTo];
    if (fromFactor && toFactor) {
      const inBase = value * fromFactor;
      const converted = inBase / toFactor;
      return { success: true, value: Number(converted.toFixed(6)) };
    }
  }

  // Compatible volume conversion
  if (dimFrom === 'volume' && dimTo === 'volume') {
    const fromFactor = VOLUME_UNITS[normFrom];
    const toFactor = VOLUME_UNITS[normTo];
    if (fromFactor && toFactor) {
      const inBase = value * fromFactor;
      const converted = inBase / toFactor;
      return { success: true, value: Number(converted.toFixed(6)) };
    }
  }

  // Cross-dimensional check: Check conversion rules (e.g. material-specific or global density)
  if (conversionRules && conversionRules.length > 0) {
    // 1. Look for material-specific rule first
    let rule = conversionRules.find(
      (r) =>
        r.materialId === materialId &&
        r.fromUnit.toLowerCase() === normFrom &&
        r.toUnit.toLowerCase() === normTo
    );

    // 2. Or reverse material-specific rule
    if (!rule) {
      const reverseRule = conversionRules.find(
        (r) =>
          r.materialId === materialId &&
          r.fromUnit.toLowerCase() === normTo &&
          r.toUnit.toLowerCase() === normFrom
      );
      if (reverseRule && reverseRule.factor > 0) {
        return {
          success: true,
          value: Number((value / reverseRule.factor).toFixed(6)),
          explanation: `Converted using inverse density rule (1 ${reverseRule.toUnit} = ${(1 / reverseRule.factor).toFixed(4)} ${reverseRule.fromUnit})`,
        };
      }
    } else {
      return {
        success: true,
        value: Number((value * rule.factor).toFixed(6)),
        explanation: `Converted using density rule: 1 ${rule.fromUnit} = ${rule.factor} ${rule.toUnit}`,
      };
    }

    // 3. Global rule without materialId
    rule = conversionRules.find(
      (r) =>
        !r.materialId &&
        r.fromUnit.toLowerCase() === normFrom &&
        r.toUnit.toLowerCase() === normTo
    );
    if (rule) {
      return {
        success: true,
        value: Number((value * rule.factor).toFixed(6)),
        explanation: `Converted using global rule: 1 ${rule.fromUnit} = ${rule.factor} ${rule.toUnit}`,
      };
    }
  }

  // Never convert mass to volume without an explicitly verified conversion rule!
  return {
    success: false,
    value,
    explanation: `Cannot convert between incompatible units '${fromUnit}' and '${toUnit}' without a verified density or conversion rule.`,
  };
}

/**
 * Calculates dynamically scaled ingredient requirement:
 * required quantity = formula quantity * requested batch size / reference batch size
 */
export function calculateDynamicRequirement(
  formulaQuantity: number,
  requestedBatchSize: number,
  referenceBatchSize: number
): number {
  if (!referenceBatchSize || referenceBatchSize <= 0) {
    return 0;
  }
  const scaled = (formulaQuantity * requestedBatchSize) / referenceBatchSize;
  return Number(scaled.toFixed(4));
}

/**
 * Formats numbers for clean display in industrial ERP
 */
export function formatQuantity(val: number | undefined | null, decimals: number = 2): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  if (Number.isInteger(val)) return val.toLocaleString();
  return Number(val.toFixed(decimals)).toLocaleString();
}

export function formatCurrency(amount: number | undefined | null, currency: string = '$'): string {
  if (amount === undefined || amount === null || isNaN(amount)) return `${currency}0.00`;
  return `${currency}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
