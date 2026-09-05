# Private-trial fixture inputs

The private-trial evaluator uses `test/fixtures/private-bundles/valid` as its single canonical input. It copies and finalizes that fixture for each case. The fixture includes the selected npm tarball and the selected APM Archie skill artifact. The evaluator installs only those copied artifacts, then compares them with the target deployment.

Cases mutate only the copied target or copied bundle. The source fixture remains unchanged.
