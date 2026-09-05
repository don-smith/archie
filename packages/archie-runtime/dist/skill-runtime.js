import { PRODUCT_VERSION } from "./product-version.js";
const [command] = process.argv.slice(2);
if (command === "--describe") {
    process.stdout.write(`${JSON.stringify({ product: "archie", version: PRODUCT_VERSION, runtime: "pinned-project-local" })}\n`);
}
else {
    process.stderr.write("Usage: archie skill runtime --describe\n");
    process.exitCode = 2;
}
//# sourceMappingURL=skill-runtime.js.map