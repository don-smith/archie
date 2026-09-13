export class ArchitectureDocsError extends Error {
  constructor(message, { code = "ARCHITECTURE_DOCS_ERROR", cause } = {}) {
    super(message, { cause });
    this.name = "ArchitectureDocsError";
    this.code = code;
  }
}

export class ArchitectureDocsBuildError extends ArchitectureDocsError {
  constructor(message, { code = "BUILD_FAILED", issues = [], cause } = {}) {
    super(message, { code, cause });
    this.name = "ArchitectureDocsBuildError";
    this.issues = issues;
  }
}

export class ArchitectureDocsConfigurationError extends ArchitectureDocsError {
  constructor(configPath, issues, { cause } = {}) {
    const count = issues.length;
    super(`Architecture docs configuration has ${count} ${count === 1 ? "issue" : "issues"}.`, {
      code: "CONFIGURATION_INVALID",
      cause,
    });
    this.name = "ArchitectureDocsConfigurationError";
    this.configPath = configPath;
    this.issues = issues;
  }
}

export class ArchitectureDocsLedgerError extends ArchitectureDocsError {
  constructor(ledgerPath, issues, { cause } = {}) {
    super(`Architecture claims ledger has ${issues.length} ${issues.length === 1 ? "issue" : "issues"}.`, {
      code: "LEDGER_INVALID",
      cause,
    });
    this.name = "ArchitectureDocsLedgerError";
    this.ledgerPath = ledgerPath;
    this.issues = issues;
  }
}

// Kept as short aliases for consumers that prefer the product name in imports.
export const ArchitectureDocsErrorBase = ArchitectureDocsError;
