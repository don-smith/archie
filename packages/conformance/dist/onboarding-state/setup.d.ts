/** Verifies the runtime expected by the locally installed package, without consulting PATH. */
export declare function verifyOnboardingRuntime(nodeVersion?: string, npmUserAgent?: string | undefined): void;
/** Rejects ambient executables: onboarding may run only the target's exact local devDependency. */
export declare function verifyLocalOnboardingSetup(repositoryRoot?: string): void;
