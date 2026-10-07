// Generated from the providers’ published price lists. Do not edit by hand.

import { NumberValue } from "./number_value.ts";

export class TokenCount extends NumberValue<TokenCount> {
  static readonly zero = new TokenCount(0);
  static readonly one = new TokenCount(1);
  static readonly infinity = new TokenCount(Infinity);

  static value(value: number): TokenCount {
    return new TokenCount(value);
  }

  static sum(items: TokenCount[]): TokenCount {
    let total = 0;
    for (const item of items) total += item.value;
    return new TokenCount(total);
  }

  static max(a: TokenCount, b: TokenCount): TokenCount {
    return new TokenCount(Math.max(a.value, b.value));
  }
  static min(a: TokenCount, b: TokenCount): TokenCount {
    return new TokenCount(Math.min(a.value, b.value));
  }

  protected create(value: number): TokenCount {
    return new TokenCount(value);
  }
}
