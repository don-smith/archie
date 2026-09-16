/** Verifies the runtime supported by the Archie-provisioned package. */
export declare function verifyOnboardingRuntime(nodeVersion?: string): void;
/** Rejects ambient executables: onboarding may run only Archie's target-owned npm projection. */
export declare function verifyLocalOnboardingSetup(repositoryRoot?: string): void;
