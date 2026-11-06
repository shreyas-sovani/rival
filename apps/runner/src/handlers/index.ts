import { NotImplemented, type Handlers } from "./types";

function unimplemented(taskId: string): () => Promise<never> {
  return async () => {
    throw new NotImplemented(taskId);
  };
}

/** Every endpoint. Stubs until M-021. Routes must map `NotImplemented` to HTTP 501, never to 200. */
export const handlers: Handlers = {
  health: unimplemented("M-021"),
  faucet: unimplemented("M-021"),
  intents: unimplemented("M-021"),
  cancel: unimplemented("M-021"),
  stream: unimplemented("M-021"),
};
