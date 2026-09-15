export type Json = null | boolean | number | string | Json[] | {
    [key: string]: Json;
};
/** RFC 8785-compatible for values representable by JavaScript JSON. */
export declare function canonicalize(value: unknown): string;
