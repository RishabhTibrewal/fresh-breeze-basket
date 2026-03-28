// ─────────────────────────────────────────────────────────────────────────────
// Order Calculations Utility (Backend)
// Mirror of frontend/src/lib/orderCalculations.ts
// Used in orderController.ts to compute and persist all financial fields.
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderItemInput {
  id: string;
  unit_price: number;
  quantity: number;
  discount_amount: number;
  tax_percentage: number;
}

export interface ExtraCharge {
  name: string;
  amount: number;
  tax_percent?: number;
  total_amount?: number;
}

export type CDSettlementMode = 'direct' | 'credit_note';

export interface OrderItemResult extends OrderItemInput {
  item_taxable_base: number;
  extra_discount_share: number;
  net_taxable_base: number;
  item_cd_share: number;
  tax_amount: number;
  line_total: number;
}

export interface OrderTotals {
  subtotal: number;
  total_discount: number;
  taxable_base: number;
  extra_discount_amount: number;
  after_extra_disc: number;
  cd_percentage: number;
  cd_amount: number;
  cd_settlement_mode: CDSettlementMode;
  taxable_value: number;
  total_tax: number;
  extra_charges: ExtraCharge[];
  total_extra_charges: number;
  round_off_amount: number;
  total_amount: number;
  items: OrderItemResult[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculateOrderTotals(
  items: OrderItemInput[],
  extraDiscountAmount: number,
  cdPercentage: number,
  cdSettlementMode: CDSettlementMode,
  extraCharges: ExtraCharge[],
): OrderTotals {
  const subtotal = r2(items.reduce((s, i) => s + r2(i.unit_price * i.quantity), 0));
  const totalDiscount = r2(items.reduce((s, i) => s + i.discount_amount, 0));
  const afterItemDisc = r2(subtotal - totalDiscount);
  const afterExtraDisc = r2(afterItemDisc - extraDiscountAmount);

  const itemResults = items.map(i => {
    const base = r2(r2(i.unit_price * i.quantity) - i.discount_amount);
    const edShare = afterItemDisc > 0
      ? r2(base / afterItemDisc * extraDiscountAmount)
      : 0;
    const netTaxable = r2(base - edShare);
    const taxAmt = r2(netTaxable * i.tax_percentage / 100);

    return { 
      id: i.id,
      unit_price: i.unit_price,
      quantity: i.quantity,
      discount_amount: i.discount_amount,
      tax_percentage: i.tax_percentage,
      item_taxable_base: base,
      extra_discount_share: edShare,
      net_taxable_base: netTaxable,
      tax_amount: taxAmt, 
      line_total: r2(netTaxable + taxAmt),
      item_cd_share: 0 
    } as OrderItemResult;
  });

  const totalTax = r2(itemResults.reduce((s, i) => s + i.tax_amount, 0));

  const cdBase = r2(afterExtraDisc + totalTax);
  const cdAmount = r2(cdBase * cdPercentage / 100);

  itemResults.forEach(i => {
     i.item_cd_share = 0;
  });

  const taxableValue = afterExtraDisc;

  const processedExtraCharges = extraCharges.map(ec => {
    const taxPct = ec.tax_percent || 0;
    const taxAmt = r2(ec.amount * taxPct / 100);
    return {
      ...ec,
      total_amount: r2(ec.amount + taxAmt)
    };
  });
  
  const totalExtraCharges = r2(processedExtraCharges.reduce((s, c) => s + (c.total_amount || c.amount), 0));

  const netBeforeRound = r2(afterExtraDisc + totalTax + totalExtraCharges);
  const roundOff = r2(Math.round(netBeforeRound) - netBeforeRound);
  const totalAmount = Math.round(netBeforeRound);

  return {
    subtotal,
    total_discount: r2(totalDiscount),
    taxable_base: afterExtraDisc,
    extra_discount_amount: r2(extraDiscountAmount),
    after_extra_disc: afterExtraDisc,
    cd_percentage: cdPercentage,
    cd_amount: cdAmount,
    cd_settlement_mode: cdSettlementMode,
    taxable_value: r2(taxableValue),
    total_tax: totalTax,
    extra_charges: processedExtraCharges,
    total_extra_charges: totalExtraCharges,
    round_off_amount: roundOff,
    total_amount: totalAmount,
    items: itemResults,
  };
}
