# model-stats

List prices and cache thresholds for OpenAI, Anthropic, Gemini, and Fireworks
models, with a lookup API that always resolves: an unknown model id falls back
to the closest known family and says so through `matched: false`.

`src/` is generated from the providers’ published price lists; don’t edit it
by hand. `tests/` is maintained here.

```ts
import { getTokenCost, resolveModel } from "@agent-bench/model-stats/index.js";
```
