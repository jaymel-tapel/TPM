import { APP_TIMEZONE } from "@/lib/date";

/**
 * Every zone this runtime knows.
 *
 * A plain module rather than an export of the actions file: everything
 * exported from a `"use server"` file has to be an async server action, and a
 * sync helper in there fails the whole bundle rather than just itself.
 *
 * This list is also the validation. A name outside it would throw inside
 * `Intl` on every render, which would lock somebody out of the very screen
 * that could put it right.
 */
export function supportedZones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
    .supportedValuesOf;
  return supported ? supported("timeZone") : [APP_TIMEZONE];
}
