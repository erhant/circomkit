# Circomkit with Bun

In this example, we use [Bun](https://bun.sh/) with the [SHA256](https://en.wikipedia.org/wiki/SHA-2) circuit.

## Installation

Simply do:

```sh
bun install
```

## Usage

You can see an example within [`src/index.ts`](./src/index.ts). Run it with:

```sh
bun start
```

For the CLI, you can test the entire flow as follows:

1. Compile circuit: `bunx circomkit compile sha256_32`
2. Prove with default input: `bunx circomkit prove sha256_32 default`
3. Verify the proof: `bunx circomkit verify sha256_32 default`
4. Create contract: `bunx circomkit contract sha256_32`
5. Create calldata: `bunx circomkit calldata sha256_32 default`

Notice that we use `bunx` instead of `npx` to use Bun!

## Testing

Run tests with:

```sh
bun test
```
