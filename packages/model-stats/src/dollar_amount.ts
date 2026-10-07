// Generated from the providers’ published price lists. Do not edit by hand.

import { NumberValue } from "./number_value.ts";

export class DollarAmount extends NumberValue<DollarAmount> {
  static readonly zero = new DollarAmount(0);

  static value(value: number): DollarAmount {
    return new DollarAmount(value);
  }

  static sum(items: DollarAmount[]): DollarAmount {
    let total = 0;
    for (const item of items) total += item.value;
    return new DollarAmount(total);
  }

  protected create(value: number): DollarAmount {
    return new DollarAmount(value);
  }
}
