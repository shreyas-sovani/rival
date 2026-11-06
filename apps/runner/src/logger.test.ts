import { Writable } from "node:stream";
import { expect, it } from "vitest";
import { createLogger } from "./logger.ts";

it("logs do not contain a private key or a signature", () => {
  const chunks: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  const privateKey = `0x${"11".repeat(32)}`;
  const signature = `0x${"ab".repeat(65)}`;
  const logger = createLogger(sink);
  logger.info(
    { privateKey, signature, MM_PRIVATE_KEY: privateKey, nested: { signature } },
    `use ${privateKey} sig ${signature}`,
  );
  const text = chunks.join("");
  expect(text).not.toContain(privateKey);
  expect(text).not.toContain(signature);
  expect(text).toContain("[Redacted]");
});
