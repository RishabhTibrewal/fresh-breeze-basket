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
}

export type CDSettlementMode = 'direct' | 'credit_note';

export interface OrderItemResult extends OrderItemInput {
  item_taxable_base: number;
  item_cd_share: number;
  tax_amount: number;
  line_total: number;
}

export interface OrderTotals {
  subtotal: number;
  total_discount: number;
  taxable_base: number;           // subtotal − item discounts (what tax is levied on)
  extra_discount_amount: number;
  after_extra_disc: number;
  cd_percentage: number;
  cd_amount: number;
  cd_settlement_mode: CDSettlementMode;
  taxable_value: number;          // after_extra_disc − cd_amount (accounting field)
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
  // ④ Total Tax calculated on (Price * Qty - Item Discount)
  const itemResults_pre = items.map(i => {
    const taxBase = r2(r2(i.unit_price * i.quantity) - i.discount_amount);
    const taxAmt = r2(taxBase * i.tax_percentage / 100);
    return { ...i, tax_amount: taxAmt, taxBase };
  });
  const totalTax = r2(itemResults_pre.reduce((s, i) => s + i.tax_amount, 0));

  // ⑤ CD Base = After Extra Discount + Total Tax
  const cdBase = r2(afterExtraDisc + totalTax);
  const cdAmount = r2(cdBase * cdPercentage / 100);

  // ⑥ Taxable value = afterItemDisc (GST taxable value on invoice)
  const taxableValue = afterItemDisc;

  // ⑦ Final Per-item results
  const itemResults: OrderItemResult[] = itemResults_pre.map(i => {
    const base = i.taxBase;
    
    const edShare = afterItemDisc > 0
      ? r2(base / afterItemDisc * extraDiscountAmount)
      : 0;
    const afterED = r2(base - edShare);

    // CD share for internal tracking (allocated proportionally)
    const cdShare = (cdSettlementMode === 'direct' && cdBase > 0)
      ? r2((base + i.tax_amount) / cdBase * cdAmount)
      : 0;

    return {
      ...i,
      item_taxable_base: base,
      item_cd_share: cdShare,
      line_total: r2(base + i.tax_amount),
    };
  });

  // ⑨ Grand total chain: afterItemDisc − extraDisc − CD (if direct) + tax + extraCharges
  const totalExtraCharges = r2(extraCharges.reduce((s, c) => s + c.amount, 0));
  const netBeforeRound = r2(afterExtraDisc - (cdSettlementMode === 'direct' ? cdAmount : 0) + totalTax + totalExtraCharges);
  const roundOff = r2(Math.round(netBeforeRound) - netBeforeRound);
  const totalAmount = Math.round(netBeforeRound);

  return {
    subtotal,
    total_discount: r2(totalDiscount),
    taxable_base: afterItemDisc,    // the base on which item tax is levied
    extra_discount_amount: r2(extraDiscountAmount),
    after_extra_disc: afterExtraDisc,
    cd_percentage: cdPercentage,
    cd_amount: cdAmount,
    cd_settlement_mode: cdSettlementMode,
    taxable_value: r2(taxableValue), // post-extra-discount, post-CD (accounting)
    total_tax: totalTax,
    extra_charges: extraCharges,
    total_extra_charges: totalExtraCharges,
    round_off_amount: roundOff,
    total_amount: totalAmount,
    items: itemResults,
  };
}
