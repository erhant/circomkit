import {readSync, ReadPosition} from 'fs';

/** Reads a specified number of bytes from a file and converts them to a BigInt.
 */
export function readBytesFromFile(fd: number, offset: number, length: number, position: ReadPosition): BigInt {
  const buffer = Buffer.alloc(length);

  readSync(fd, buffer, offset, length, position);

  return BigInt(`0x${buffer.reverse().toString('hex')}`);
}
