import { PRODUCT_VERSION } from "./product-version.js";
import { runReleaseInstallCommand } from "./commands/release-install.js";

const command = process.argv.slice(2);
if (command[0] === "bootstrap" || command[0] === "upgrade" || command[0] === "verify") {
  runReleaseInstallCommand(command);
} else {
  const deferred = "Signing, public-release trust, controller distribution, and key operations are deferred.";
  console.log(`Archie ${PRODUCT_VERSION}, locally reviewed: ${deferred}`);
}
