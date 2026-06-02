import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const DATABASE_NAME = 'expense-tracker.db';

type ExpoDatabase = ReturnType<typeof openDatabaseSync>;

function createDatabase(client: ExpoDatabase) {
  return drizzle(client, { schema });
}

type DrizzleDatabase = ReturnType<typeof createDatabase>;

let expoDbInstance: ExpoDatabase | null = null;
let drizzleDbInstance: DrizzleDatabase | null = null;

function getExpoDbInstance() {
  if (!expoDbInstance) {
    expoDbInstance = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
  }
  return expoDbInstance;
}

function getDrizzleDbInstance() {
  if (!drizzleDbInstance) {
    drizzleDbInstance = createDatabase(getExpoDbInstance());
  }
  return drizzleDbInstance;
}

function bindIfFunction<T>(value: T, receiver: unknown) {
  return typeof value === 'function' ? value.bind(receiver) : value;
}

export const expoDb = new Proxy({} as ExpoDatabase, {
  get(_target, prop) {
    return bindIfFunction(Reflect.get(getExpoDbInstance() as object, prop), getExpoDbInstance());
  },
}) as ExpoDatabase;

export const db = new Proxy({} as DrizzleDatabase, {
  get(_target, prop) {
    return bindIfFunction(
      Reflect.get(getDrizzleDbInstance() as object, prop),
      getDrizzleDbInstance()
    );
  },
}) as DrizzleDatabase;

export function resetDatabaseClientForTests() {
  expoDbInstance = null;
  drizzleDbInstance = null;
}
