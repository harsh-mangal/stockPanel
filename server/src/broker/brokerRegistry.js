import { paperBroker } from './paperBroker.js';

export function getBrokerAdapter(name) {
  if (name === 'PAPER') return paperBroker;
  // plug other adapters later
  throw new Error(`Broker adapter not found: ${name}`);
}
