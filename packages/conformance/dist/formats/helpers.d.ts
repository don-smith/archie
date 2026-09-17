export declare function fail(message: string): never;
export declare function record(value: unknown, label: string): Record<string, unknown>;
export declare function string(value: unknown, label: string): string;
export declare function array(value: unknown, label: string): unknown[];
export declare function strings(value: unknown, label: string): string[];
export declare function oneOf<T extends string>(value: unknown, choices: readonly T[], label: string): T;
export declare function version(value: Record<string, unknown>, expected: string): void;
export declare function exactKeys(raw: Record<string, unknown>, allowed: readonly string[], label: string): void;
