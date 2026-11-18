import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
// Persistent local data needs its replica member address updated when the port changes.
// mongodb-memory-server's generic replica helper reuses the old address on restart.
export async function localDatabase({
  dataDirectory = ".local/mongodb-data",
  replicaName = "testset",
} = {}) {
  const server = await MongoMemoryServer.create({
    binary: {
      version: "7.0.24",
      downloadDir: path.join(projectRoot, ".local/mongodb-binaries"),
    },
    instance: {
      dbPath: path.join(projectRoot, dataDirectory),
      replSet: replicaName,
      storageEngine: "wiredTiger",
      ip: "127.0.0.1",
    },
  });
  const client = new MongoClient(server.getUri(), { directConnection: true });
  try {
    await client.connect();
    const admin = client.db("admin");
    const host = `127.0.0.1:${server.instanceInfo.port}`;
    try {
      const { config } = await admin.command({ replSetGetConfig: 1 });
      config.members = [{ _id: 0, host }];
      config.version++;
      await admin.command({ replSetReconfig: config, force: true });
    } catch (error) {
      if (error.code !== 94) throw error;
      await admin.command({
        replSetInitiate: {
          _id: replicaName,
          members: [{ _id: 0, host }],
          settings: { electionTimeoutMillis: 500 },
        },
      });
    }
    const deadline = Date.now() + 30000;
    while (!(await admin.command({ hello: 1 })).isWritablePrimary) {
      if (Date.now() > deadline)
        throw new Error("Local replica set election timed out");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (error) {
    await server.stop({ doCleanup: false });
    throw error;
  } finally {
    await client.close();
  }
  return {
    getUri: (name) => server.getUri(name) + "?replicaSet=" + replicaName,
    stop: () => server.stop({ doCleanup: false }),
  };
}
