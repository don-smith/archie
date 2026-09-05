# Pi adapter smoke template

This template checks a future Pi adapter. It does not test portable-core quality and it must only claim confirmation or interception behavior that the adapter implements.

## Setup record

Record the adapter revision, Pi version, installation method, test repository, enabled capabilities, and any configured write boundary.

## Smoke cases

| Case | Procedure | Expected evidence |
|---|---|---|
| Installation | Follow the adapter's documented local installation path in a clean test workspace. | The adapter reports successful installation or a concrete error. |
| Skill discovery | Start Pi and inspect the discovered Archie skill resources. | The portable Archie instructions are discoverable without duplicating host metadata into the core. |
| Explicit invocation | Invoke `/archie` with a fixture prompt. | The explicit `/archie` entry starts focused Archie behavior and reports its selected mode and route. |
| Confirmation or interception | Attempt the durable-change fixture with the adapter's configured write boundary. | Record only the implemented confirmation prompt, refusal, interception, or absence of a host control. |

## Evidence record

For each case, keep the command or setup steps, captured output, observed behavior, and pass or fail result. Record the portable fixture result separately.

A passing smoke suite is not evidence for another host. It proves only this adapter's recorded installation, discovery, invocation, and implemented boundary behavior.
