export interface RepositoryCheck {
  id: string;
  command: string;
  authority: string;
  evidencePath: string;
  resultMeaning: string;
}
export interface RepositoryCheckResult {
  id: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  resultMeaning: string;
}
