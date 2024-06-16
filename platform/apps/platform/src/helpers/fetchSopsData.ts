import { SECRETS } from "@dragonfly/utils";
import { decodeFile } from "sops-decoder";

/**
 * Decoding sops secrets file to grab all API keys and secrets
 */
export async function fetchSopsData() {
    try {
      return await decodeFile('secrets.sops.json');
    } catch (err) {
      if (process.env.RETURN_DUMMY_SECRETS_DATA) {
        console.info('Returning secret sops dummy data');
        return SECRETS;
      } else {
        throw err;
      }
    }
  }