# Circomkit with Bun

In this example, we use [Bun](https://bun.sh/) with the [SHA256](https://en.wikipedia.org/wiki/SHA-2) circuit of [`circomlib`](https://github.com/iden3/circomlib).

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
2. Prove with the default input, `inputs/sha256_32.json`: `bunx circomkit prove sha256_32`
3. Verify the proof: `bunx circomkit verify sha256_32`
4. Create contract: `bunx circomkit contract sha256_32`
5. Create calldata: `bunx circomkit calldata sha256_32`

Notice that we use `bunx` instead of `npx` to use Bun!

## Testing

Run tests with:

```sh
bun test
```
