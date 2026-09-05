# Private-trial fixture inputs

The private-trial evaluator uses `test/fixtures/private-bundles/valid` as its single canonical input. It copies and finalizes that fixture for each case so the test does not maintain a second tarball or APM lock with the same intended bytes.

Cases mutate only the copied target or copied bundle. The source fixture remains unchanged.
